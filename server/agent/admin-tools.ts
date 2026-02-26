import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db/client";
import { formatInTimeZone } from "date-fns-tz";
import { getMadridMidnight, getMadridDateStr } from "../utils/madrid-date";
import { slotCapacityValidator } from "../services/slot-validator";
import { getActiveSlotSchedule } from "./prompts";
import { getPredictionAccuracy, getProviderProfiles } from "../services/analytics-service";
import { calculateCalibration, applyCalibration } from "../services/calibration-service";

// ── Tool Definitions ────────────────────────────────────────────────

const CONSULTAR_CITAS: Anthropic.Tool = {
  name: "consultar_citas",
  description: "Busca y lista citas de descarga del almacén. Puede filtrar por rango de fechas, nombre de proveedor o estado de confirmación.",
  input_schema: {
    type: "object",
    properties: {
      fecha_inicio: { type: "string", description: "Fecha inicio filtro (YYYY-MM-DD). Si no se indica, busca desde hoy." },
      fecha_fin: { type: "string", description: "Fecha fin filtro (YYYY-MM-DD). Si no se indica, busca hasta 7 días desde fecha_inicio." },
      proveedor: { type: "string", description: "Nombre (parcial) del proveedor para filtrar." },
      estado: { type: "string", description: "Estado de confirmación: pending, confirmed, cancelled." },
    },
    required: [],
  },
};

const CONSULTAR_OCUPACION: Anthropic.Tool = {
  name: "consultar_ocupacion",
  description: "Consulta la ocupación y capacidad del almacén para una fecha o rango. Muestra puntos usados/disponibles por franja horaria y muelles activos.",
  input_schema: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha a consultar (YYYY-MM-DD). Por defecto hoy." },
      fecha_fin: { type: "string", description: "Fecha fin del rango (YYYY-MM-DD). Si no se indica, solo consulta la fecha indicada." },
    },
    required: [],
  },
};

const CONSULTAR_PROVEEDORES: Anthropic.Tool = {
  name: "consultar_proveedores",
  description: "Lista los proveedores registrados en el sistema, con su número de citas. Puede filtrar por nombre.",
  input_schema: {
    type: "object",
    properties: {
      nombre: { type: "string", description: "Nombre (parcial) del proveedor para buscar." },
    },
    required: [],
  },
};

const MODIFICAR_CITA: Anthropic.Tool = {
  name: "modificar_cita",
  description: "Modifica un campo de una cita existente. SIEMPRE muestra un preview de los cambios y espera confirmación del admin antes de aplicar. No ejecuta directamente.",
  input_schema: {
    type: "object",
    properties: {
      id_cita: { type: "string", description: "ID de la cita a modificar." },
      campo: { type: "string", description: "Campo a modificar: fecha_hora, muelle, estado_confirmacion." },
      nuevo_valor: { type: "string", description: "Nuevo valor para el campo." },
      confirmado: { type: "boolean", description: "true si el admin ya confirmó el cambio. false para preview." },
    },
    required: ["id_cita", "campo", "nuevo_valor"],
  },
};

const CANCELAR_CITA: Anthropic.Tool = {
  name: "cancelar_cita",
  description: "Cancela una cita de descarga. SIEMPRE muestra resumen de la cita y pide confirmación antes de cancelar.",
  input_schema: {
    type: "object",
    properties: {
      id_cita: { type: "string", description: "ID de la cita a cancelar." },
      confirmado: { type: "boolean", description: "true si el admin ya confirmó la cancelación. false para preview." },
    },
    required: ["id_cita"],
  },
};

const CREAR_CITA_MANUAL: Anthropic.Tool = {
  name: "crear_cita_manual",
  description: "Crea una cita de descarga manualmente con los datos proporcionados por el admin. El sistema asigna muelle automáticamente.",
  input_schema: {
    type: "object",
    properties: {
      proveedor: { type: "string", description: "Nombre del proveedor." },
      fecha: { type: "string", description: "Fecha de la cita (YYYY-MM-DD)." },
      hora_inicio: { type: "string", description: "Hora de inicio (HH:MM, 24h, Europe/Madrid)." },
      duracion_minutos: { type: "number", description: "Duración estimada en minutos." },
      tipo_mercancia: { type: "string", description: "Tipo de mercancía." },
      unidades: { type: "number", description: "Número de unidades/bultos." },
    },
    required: ["proveedor", "fecha", "hora_inicio", "duracion_minutos"],
  },
};

const CONSULTAR_MUELLES: Anthropic.Tool = {
  name: "consultar_muelles",
  description: "Consulta el estado actual de los muelles de descarga: activos/inactivos, citas de hoy en cada muelle.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const RESUMEN_DIARIO: Anthropic.Tool = {
  name: "resumen_diario",
  description: "Genera un resumen ejecutivo del día con KPIs: citas programadas, ocupación por franja, muelles activos, proveedores del día.",
  input_schema: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha del resumen (YYYY-MM-DD). Por defecto hoy." },
    },
    required: [],
  },
};

const CONSULTAR_PRECISION: Anthropic.Tool = {
  name: "consultar_precision",
  description: "Consulta la precisión de las estimaciones de tiempo de descarga. Muestra MAE, MAPE, sesgo y R² por categoría de mercancía.",
  input_schema: {
    type: "object",
    properties: {
      desde: { type: "string", description: "Fecha inicio (YYYY-MM-DD). Opcional." },
      hasta: { type: "string", description: "Fecha fin (YYYY-MM-DD). Opcional." },
      categoria: { type: "string", description: "Categoría específica a consultar. Opcional." },
    },
    required: [],
  },
};

const CONSULTAR_PERFILES_PROVEEDORES: Anthropic.Tool = {
  name: "consultar_perfiles_proveedores",
  description: "Consulta perfiles de proveedores basados en datos reales de descarga: duración media, unidades, error de predicción y fiabilidad (rápido/normal/lento).",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const RECALIBRAR_CATEGORIA: Anthropic.Tool = {
  name: "recalibrar_categoria",
  description: "Recalibra los coeficientes de estimación de una categoría usando regresión lineal sobre datos reales. Puede calcular nuevos coeficientes y opcionalmente aplicarlos.",
  input_schema: {
    type: "object",
    properties: {
      categoria: { type: "string", description: "Categoría a recalibrar (ej: Electro, Cocina, etc.)." },
      aplicar: { type: "boolean", description: "Si true y se proporciona snapshot_id, aplica los coeficientes calculados." },
      snapshot_id: { type: "string", description: "ID del snapshot de calibración a aplicar." },
    },
    required: ["categoria"],
  },
};

export const ADMIN_AGENT_TOOLS: Anthropic.Tool[] = [
  CONSULTAR_CITAS,
  CONSULTAR_OCUPACION,
  CONSULTAR_PROVEEDORES,
  MODIFICAR_CITA,
  CANCELAR_CITA,
  CREAR_CITA_MANUAL,
  CONSULTAR_MUELLES,
  RESUMEN_DIARIO,
  CONSULTAR_PRECISION,
  CONSULTAR_PERFILES_PROVEEDORES,
  RECALIBRAR_CATEGORIA,
];

// ── Tool Execution ──────────────────────────────────────────────────

function fmtMadrid(date: Date, fmt: string): string {
  return formatInTimeZone(date, "Europe/Madrid", fmt);
}

function todayStr(): string {
  return fmtMadrid(new Date(), "yyyy-MM-dd");
}

async function execConsultarCitas(input: Record<string, any>): Promise<string> {
  const from = input.fecha_inicio || todayStr();
  const to = input.fecha_fin || (() => {
    const d = new Date(from + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return fmtMadrid(d, "yyyy-MM-dd");
  })();

  const where: any = {
    AND: [
      { startUtc: { lt: new Date(to + "T23:59:59Z") } },
      { endUtc: { gt: new Date(from + "T00:00:00Z") } },
    ],
  };

  if (input.proveedor) {
    where.providerName = { contains: input.proveedor, mode: "insensitive" };
  }
  if (input.estado) {
    where.confirmationStatus = input.estado;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: { dock: true },
    orderBy: { startUtc: "asc" },
    take: 50,
  });

  if (appointments.length === 0) {
    return JSON.stringify({ total: 0, mensaje: "No se encontraron citas con esos filtros." });
  }

  const list = appointments.map((a) => ({
    id: a.id,
    proveedor: a.providerName,
    fecha: fmtMadrid(a.startUtc, "dd/MM/yyyy"),
    hora: `${fmtMadrid(a.startUtc, "HH:mm")} - ${fmtMadrid(a.endUtc, "HH:mm")}`,
    duracion_min: a.workMinutesNeeded,
    tipo: a.goodsType || "—",
    unidades: a.units || 0,
    talla: a.size,
    puntos: a.pointsUsed,
    muelle: a.dock?.name || "Sin asignar",
    estado: a.confirmationStatus,
    email: a.providerEmail || "—",
  }));

  return JSON.stringify({ total: list.length, citas: list }, null, 2);
}

async function execConsultarOcupacion(input: Record<string, any>): Promise<string> {
  const fecha = input.fecha || todayStr();
  const fechaFin = input.fecha_fin || fecha;

  const fromDate = getMadridMidnight(new Date(fecha + "T12:00:00"));
  const toDate = new Date(fechaFin + "T23:59:59Z");

  // Get slot templates for the date range
  const templates = await prisma.slotTemplate.findMany({
    where: { active: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      AND: [
        { startUtc: { lt: toDate } },
        { endUtc: { gt: fromDate } },
        { cancelledAt: null },
      ],
    },
    include: { dock: true },
    orderBy: { startUtc: "asc" },
  });

  // Group appointments by date
  const byDate = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const dateKey = fmtMadrid(a.startUtc, "yyyy-MM-dd");
    const arr = byDate.get(dateKey) || [];
    arr.push(a);
    byDate.set(dateKey, arr);
  }

  const days: any[] = [];
  let current = new Date(fecha + "T12:00:00");
  const end = new Date(fechaFin + "T12:00:00");

  while (current <= end) {
    const dateStr = fmtMadrid(current, "yyyy-MM-dd");
    const dayOfWeek = current.getDay();
    const dayTemplates = templates.filter((t) => t.dayOfWeek === dayOfWeek);
    const dayApps = byDate.get(dateStr) || [];

    const slots = dayTemplates.map((t) => {
      const slotApps = dayApps.filter((a) => {
        const slotStart = fmtMadrid(a.startUtc, "HH:mm");
        return slotStart >= t.startTime && slotStart < t.endTime;
      });
      const usedPoints = slotApps.reduce((sum, a) => sum + a.pointsUsed, 0);
      return {
        franja: `${t.startTime}-${t.endTime}`,
        maxPuntos: t.maxPoints,
        puntosUsados: usedPoints,
        puntosLibres: t.maxPoints - usedPoints,
        citas: slotApps.length,
      };
    });

    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    days.push({
      fecha: dateStr,
      dia: dayNames[dayOfWeek],
      totalCitas: dayApps.length,
      franjas: slots,
    });

    current.setDate(current.getDate() + 1);
  }

  return JSON.stringify({ dias: days }, null, 2);
}

async function execConsultarProveedores(input: Record<string, any>): Promise<string> {
  const where: any = {};
  if (input.nombre) {
    where.name = { contains: input.nombre, mode: "insensitive" };
  }

  const providers = await prisma.provider.findMany({
    where,
    include: { _count: { select: { appointments: true } } },
    orderBy: { name: "asc" },
  });

  const list = providers.map((p) => ({
    id: p.id,
    nombre: p.name,
    notas: p.notes || "—",
    totalCitas: p._count.appointments,
  }));

  return JSON.stringify({ total: list.length, proveedores: list }, null, 2);
}

async function execModificarCita(input: Record<string, any>): Promise<string> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.id_cita },
    include: { dock: true },
  });

  if (!appointment) {
    return JSON.stringify({ error: "Cita no encontrada con ese ID." });
  }

  // Preview mode — show what would change
  if (!input.confirmado) {
    const current: Record<string, string> = {
      proveedor: appointment.providerName,
      fecha_hora: `${fmtMadrid(appointment.startUtc, "dd/MM/yyyy HH:mm")} - ${fmtMadrid(appointment.endUtc, "HH:mm")}`,
      muelle: appointment.dock?.name || "Sin asignar",
      estado: appointment.confirmationStatus,
    };

    return JSON.stringify({
      preview: true,
      mensaje: "PREVIEW — Estos son los cambios propuestos. Pide confirmación al admin antes de ejecutar con confirmado=true.",
      cita_actual: current,
      campo_a_cambiar: input.campo,
      valor_actual: current[input.campo] || "—",
      nuevo_valor: input.nuevo_valor,
    }, null, 2);
  }

  // Execute the modification
  const updateData: any = {};
  switch (input.campo) {
    case "estado_confirmacion":
      updateData.confirmationStatus = input.nuevo_valor;
      if (input.nuevo_valor === "confirmed") updateData.confirmedAt = new Date();
      if (input.nuevo_valor === "cancelled") {
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = "Cancelada por admin via asistente IA";
      }
      break;
    default:
      return JSON.stringify({ error: `Campo '${input.campo}' no es modificable por esta herramienta. Campos válidos: estado_confirmacion.` });
  }

  await prisma.appointment.update({ where: { id: input.id_cita }, data: updateData });
  return JSON.stringify({ success: true, mensaje: `Cita de ${appointment.providerName} actualizada: ${input.campo} = ${input.nuevo_valor}` });
}

async function execCancelarCita(input: Record<string, any>): Promise<string> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.id_cita },
    include: { dock: true },
  });

  if (!appointment) {
    return JSON.stringify({ error: "Cita no encontrada con ese ID." });
  }

  if (!input.confirmado) {
    return JSON.stringify({
      preview: true,
      mensaje: "PREVIEW — Esta cita se cancelaría. Pide confirmación al admin antes de ejecutar con confirmado=true.",
      cita: {
        id: appointment.id,
        proveedor: appointment.providerName,
        fecha: fmtMadrid(appointment.startUtc, "dd/MM/yyyy"),
        hora: `${fmtMadrid(appointment.startUtc, "HH:mm")} - ${fmtMadrid(appointment.endUtc, "HH:mm")}`,
        tipo: appointment.goodsType || "—",
        muelle: appointment.dock?.name || "—",
        estado_actual: appointment.confirmationStatus,
      },
    }, null, 2);
  }

  await prisma.appointment.update({
    where: { id: input.id_cita },
    data: {
      confirmationStatus: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: "Cancelada por admin via asistente IA",
    },
  });

  return JSON.stringify({ success: true, mensaje: `Cita de ${appointment.providerName} del ${fmtMadrid(appointment.startUtc, "dd/MM/yyyy HH:mm")} cancelada correctamente.` });
}

async function execCrearCitaManual(input: Record<string, any>): Promise<string> {
  const { proveedor, fecha, hora_inicio, duracion_minutos, tipo_mercancia, unidades } = input;

  // Build start/end dates in Madrid timezone
  const startStr = `${fecha}T${hora_inicio}:00`;
  const startUtc = new Date(formatInTimeZone(new Date(startStr), "Europe/Madrid", "yyyy-MM-dd'T'HH:mm:ssXXX"));
  // Simple approach: parse as local
  const startLocal = new Date(`${fecha}T${hora_inicio}:00+01:00`);
  const endLocal = new Date(startLocal.getTime() + duracion_minutos * 60000);

  const { size, points } = slotCapacityValidator.determineSizeAndPoints(duracion_minutos);

  // Find or create provider
  let provider = await prisma.provider.findFirst({ where: { name: proveedor } });
  if (!provider) {
    provider = await prisma.provider.create({ data: { name: proveedor } });
  }

  const slotDate = getMadridMidnight(startLocal);

  // Validate capacity
  const validation = await slotCapacityValidator.validateSlotCapacity(
    slotDate,
    hora_inicio.substring(0, 5),
    points,
    startLocal,
    endLocal,
    undefined,
  );

  if (!validation.valid) {
    return JSON.stringify({ error: `Sin capacidad: ${validation.error}` });
  }

  const finalStart = validation.adjustedStartUtc || startLocal;
  const finalEnd = validation.adjustedEndUtc || endLocal;

  const appointment = await prisma.appointment.create({
    data: {
      providerId: provider.id,
      providerName: proveedor,
      startUtc: finalStart,
      endUtc: finalEnd,
      workMinutesNeeded: duracion_minutos,
      forkliftsNeeded: 0,
      goodsType: tipo_mercancia || null,
      units: unidades || null,
      size,
      pointsUsed: points,
      slotDate,
      slotStartTime: validation.slotStartTime || hora_inicio,
      dockId: validation.assignedDock?.id || null,
    },
  });

  return JSON.stringify({
    success: true,
    mensaje: `Cita creada para ${proveedor}`,
    id: appointment.id,
    fecha: fmtMadrid(finalStart, "dd/MM/yyyy"),
    hora: `${fmtMadrid(finalStart, "HH:mm")} - ${fmtMadrid(finalEnd, "HH:mm")}`,
    muelle: validation.assignedDock?.name || "Sin asignar",
    talla: size,
    puntos: points,
  }, null, 2);
}

async function execConsultarMuelles(): Promise<string> {
  const today = getMadridMidnight(new Date());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const docks = await prisma.dock.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const todayApps = await prisma.appointment.findMany({
    where: {
      AND: [
        { startUtc: { lt: tomorrow } },
        { endUtc: { gt: today } },
        { cancelledAt: null },
      ],
    },
    include: { dock: true },
    orderBy: { startUtc: "asc" },
  });

  const now = new Date();
  const result = docks.map((d) => {
    const dockApps = todayApps.filter((a) => a.dockId === d.id);
    const current = dockApps.find((a) => a.startUtc <= now && a.endUtc > now);
    const next = dockApps.find((a) => a.startUtc > now);

    return {
      nombre: d.name,
      codigo: d.code,
      activo: d.active,
      citasHoy: dockApps.length,
      ocupadoAhora: current ? {
        proveedor: current.providerName,
        hasta: fmtMadrid(current.endUtc, "HH:mm"),
      } : null,
      proximaCita: next ? {
        proveedor: next.providerName,
        hora: fmtMadrid(next.startUtc, "HH:mm"),
      } : null,
    };
  });

  return JSON.stringify({ muelles: result }, null, 2);
}

async function execResumenDiario(input: Record<string, any>): Promise<string> {
  const fecha = input.fecha || todayStr();
  const dayStart = new Date(fecha + "T00:00:00Z");
  const dayEnd = new Date(fecha + "T23:59:59Z");

  const appointments = await prisma.appointment.findMany({
    where: {
      AND: [
        { startUtc: { lt: dayEnd } },
        { endUtc: { gt: dayStart } },
        { cancelledAt: null },
      ],
    },
    include: { dock: true },
    orderBy: { startUtc: "asc" },
  });

  const docks = await prisma.dock.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });

  const templates = await prisma.slotTemplate.findMany({
    where: { active: true, dayOfWeek: new Date(fecha + "T12:00:00").getDay() },
    orderBy: { startTime: "asc" },
  });

  const totalPuntos = templates.reduce((s, t) => s + t.maxPoints, 0);
  const usedPuntos = appointments.reduce((s, a) => s + a.pointsUsed, 0);

  const proveedores = [...new Set(appointments.map((a) => a.providerName))];

  const franjas = templates.map((t) => {
    const slotApps = appointments.filter((a) => {
      const h = fmtMadrid(a.startUtc, "HH:mm");
      return h >= t.startTime && h < t.endTime;
    });
    return {
      franja: `${t.startTime}-${t.endTime}`,
      citas: slotApps.length,
      puntosUsados: slotApps.reduce((s, a) => s + a.pointsUsed, 0),
      maxPuntos: t.maxPoints,
    };
  });

  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const d = new Date(fecha + "T12:00:00");

  return JSON.stringify({
    resumen: {
      fecha: fmtMadrid(d, "dd/MM/yyyy"),
      dia: dayNames[d.getDay()],
      totalCitas: appointments.length,
      muelles_activos: docks.length,
      ocupacion: totalPuntos > 0 ? `${usedPuntos}/${totalPuntos} puntos (${((usedPuntos / totalPuntos) * 100).toFixed(1)}%)` : "Sin franjas",
      proveedores,
      franjas,
      citas: appointments.map((a) => ({
        proveedor: a.providerName,
        hora: `${fmtMadrid(a.startUtc, "HH:mm")}-${fmtMadrid(a.endUtc, "HH:mm")}`,
        tipo: a.goodsType || "—",
        muelle: a.dock?.name || "—",
        talla: `${a.size} (${a.pointsUsed}pts)`,
      })),
    },
  }, null, 2);
}

async function execConsultarPrecision(input: Record<string, any>): Promise<string> {
  const results = await getPredictionAccuracy({
    from: input.desde,
    to: input.hasta,
    category: input.categoria,
  });

  if (results.length === 0) {
    return JSON.stringify({ mensaje: "No hay datos de precisión todavía. Se necesitan descargas con tiempos reales registrados." });
  }

  const totalSamples = results.reduce((s, r) => s + r.sampleSize, 0);
  const globalMae = totalSamples > 0
    ? results.reduce((s, r) => s + r.mae * r.sampleSize, 0) / totalSamples
    : 0;

  return JSON.stringify({
    total_muestras: totalSamples,
    mae_global: Math.round(globalMae * 10) / 10,
    categorias: results.map((r) => ({
      categoria: r.category,
      muestras: r.sampleSize,
      estimado_medio: r.avgEstimated,
      real_medio: r.avgActual,
      mae: r.mae,
      mape: r.mape,
      sesgo: r.bias,
      r2: r.r2,
    })),
  }, null, 2);
}

async function execConsultarPerfilesProveedores(): Promise<string> {
  const results = await getProviderProfiles();

  if (results.length === 0) {
    return JSON.stringify({ mensaje: "No hay perfiles de proveedor todavía. Se necesitan al menos 3 descargas con tiempos reales por proveedor." });
  }

  return JSON.stringify({
    total_proveedores: results.length,
    proveedores: results.map((r) => ({
      nombre: r.providerName,
      descargas: r.deliveryCount,
      duracion_media_min: r.avgDurationMin,
      unidades_media: r.avgUnits,
      error_prediccion_medio: r.avgPredictionError,
      fiabilidad: r.reliability === "fast" ? "rápido" : r.reliability === "slow" ? "lento" : "normal",
    })),
  }, null, 2);
}

async function execRecalibrarCategoria(input: Record<string, any>): Promise<string> {
  // If applying an existing snapshot
  if (input.aplicar && input.snapshot_id) {
    await applyCalibration(input.snapshot_id, "admin-agent");
    return JSON.stringify({ success: true, mensaje: `Calibración ${input.snapshot_id} aplicada correctamente.` });
  }

  // Calculate new calibration
  const result = await calculateCalibration(input.categoria);

  return JSON.stringify({
    snapshot_id: result.snapshotId,
    categoria: result.category,
    muestras: result.sampleSize,
    coeficientes_actuales: result.oldCoeffs,
    coeficientes_nuevos: result.newCoeffs,
    mae_actual: result.maeOld,
    mae_nuevo: result.maeNew,
    mejora_porcentaje: result.improvement,
    estado: "pendiente",
    mensaje: `Para aplicar los nuevos coeficientes, usa esta herramienta con aplicar=true y snapshot_id="${result.snapshotId}".`,
  }, null, 2);
}

export async function executeAdminToolCall(
  toolName: string,
  toolInput: Record<string, any>,
): Promise<string> {
  try {
    switch (toolName) {
      case "consultar_citas":
        return await execConsultarCitas(toolInput);
      case "consultar_ocupacion":
        return await execConsultarOcupacion(toolInput);
      case "consultar_proveedores":
        return await execConsultarProveedores(toolInput);
      case "modificar_cita":
        return await execModificarCita(toolInput);
      case "cancelar_cita":
        return await execCancelarCita(toolInput);
      case "crear_cita_manual":
        return await execCrearCitaManual(toolInput);
      case "consultar_muelles":
        return await execConsultarMuelles();
      case "resumen_diario":
        return await execResumenDiario(toolInput);
      case "consultar_precision":
        return await execConsultarPrecision(toolInput);
      case "consultar_perfiles_proveedores":
        return await execConsultarPerfilesProveedores();
      case "recalibrar_categoria":
        return await execRecalibrarCategoria(toolInput);
      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${toolName}` });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Admin Tool] Error (${toolName}):`, msg);
    return JSON.stringify({ error: msg });
  }
}
