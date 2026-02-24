import type Anthropic from "@anthropic-ai/sdk";
import { runCalculator, type CalculatorInput } from "./calculator";
import { slotCapacityValidator } from "../services/slot-validator";
import { prisma } from "../db/client";
import { logAudit } from "../services/audit-service";
import { sendAppointmentConfirmation } from "../services/provider-email-service";
import { formatInTimeZone } from "date-fns-tz";
import { getMadridDayOfWeek, getMadridMidnight, getMadridDateStr } from "../utils/madrid-date";
import {
  normalizeCategory,
  estimateLines,
  estimateDeliveryNotes,
} from "../config/estimation-ratios";

const DAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const CALENDAR_AVAILABILITY_TOOL: Anthropic.Tool = {
  name: "calendar_availability",
  description: "Busca franjas de citas disponibles en el calendario del almacén. Requiere rango de fechas (from, to), duración estimada y detalles de la entrega. Devuelve franjas disponibles con puntos libres.",
  input_schema: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "Fecha de inicio del rango de búsqueda (ISO 8601, Europe/Madrid timezone). Ejemplo: '2025-01-15T08:00:00+01:00'",
      },
      to: {
        type: "string",
        description: "Fecha de fin del rango de búsqueda (ISO 8601, Europe/Madrid timezone). Ejemplo: '2025-01-17T14:00:00+01:00'",
      },
      duration_minutes: {
        type: "number",
        description: "Duración estimada de la cita en minutos (obtenido del calculator agent)",
      },
      providerName: {
        type: "string",
        description: "Nombre de la empresa/proveedor que realiza la entrega",
      },
      goodsType: {
        type: "string",
        description: "Tipo de mercancía (ej: 'Colchones', 'Sofás', 'Electrodomésticos', 'Muebles')",
      },
      units: {
        type: "number",
        description: "Número de unidades/bultos a descargar",
      },
      lines: {
        type: "number",
        description: "Número de líneas/referencias diferentes (opcional — se estima si no se proporciona)",
      },
      albaranes: {
        type: "number",
        description: "Número de albaranes/documentos de entrega (opcional — se estima si no se proporciona)",
      },
      workMinutesNeeded: {
        type: "number",
        description: "Minutos de trabajo estimados (obtenido del calculator agent)",
      },
    },
    required: ["from", "to", "duration_minutes", "providerName", "goodsType", "units", "workMinutesNeeded"],
  },
};

const CALENDAR_BOOK_TOOL: Anthropic.Tool = {
  name: "calendar_book",
  description: "Reserva una cita en el calendario del almacén. Usa esta herramienta solo después de que el usuario haya confirmado explícitamente la fecha y hora. Implementa reintentos automáticos si hay conflictos de capacidad.",
  input_schema: {
    type: "object",
    properties: {
      start: {
        type: "string",
        description: "Fecha/hora de inicio de la cita (ISO 8601, Europe/Madrid timezone). Ejemplo: '2025-01-15T09:00:00+01:00'",
      },
      end: {
        type: "string",
        description: "Fecha/hora de fin de la cita (ISO 8601, Europe/Madrid timezone). Debe ser posterior a start",
      },
      providerName: {
        type: "string",
        description: "Nombre de la empresa/proveedor que realiza la entrega",
      },
      goodsType: {
        type: "string",
        description: "Tipo de mercancía (ej: 'Colchones', 'Sofás', 'Electrodomésticos', 'Muebles')",
      },
      units: {
        type: "number",
        description: "Número de unidades/bultos a descargar",
      },
      lines: {
        type: "number",
        description: "Número de líneas/referencias diferentes (opcional — se estima si no se proporciona)",
      },
      albaranes: {
        type: "number",
        description: "Número de albaranes/documentos de entrega (opcional — se estima si no se proporciona)",
      },
      workMinutesNeeded: {
        type: "number",
        description: "Minutos de trabajo estimados (obtenido del calculator agent)",
      },
      providerEmail: {
        type: "string",
        description: "Email del proveedor para enviar confirmación de cita (opcional)",
      },
      providerPhone: {
        type: "string",
        description: "Teléfono del proveedor para contacto (opcional)",
      },
    },
    required: ["start", "end", "providerName", "goodsType", "units", "workMinutesNeeded"],
  },
};

const CALCULATOR_TOOL: Anthropic.Tool = {
  name: "calculator",
  description: "Calcula el tiempo estimado de descarga basándose en el tipo de mercancía y unidades. Líneas y albaranes son opcionales: si no se proporcionan, se estiman con datos históricos. Usa esta herramienta antes de buscar disponibilidad o reservar.",
  input_schema: {
    type: "object",
    properties: {
      providerName: {
        type: "string",
        description: "Nombre de la empresa/proveedor (opcional para el cálculo)",
      },
      goodsType: {
        type: "string",
        description: "Tipo de mercancía (ej: 'Colchones', 'Sofás', 'Electrodomésticos', 'Muebles', 'Asientos', 'Baño', 'Cocina', 'PAE')",
      },
      units: {
        type: "number",
        description: "Número de unidades/bultos a descargar",
      },
      lines: {
        type: "number",
        description: "Número de líneas/referencias diferentes (opcional — se estima si no se proporciona)",
      },
      albaranes: {
        type: "number",
        description: "Número de albaranes/documentos de entrega (opcional — se estima si no se proporciona)",
      },
    },
    required: ["goodsType", "units"],
  },
};

export const AGENT_TOOLS: Anthropic.Tool[] = [
  CALENDAR_AVAILABILITY_TOOL,
  CALENDAR_BOOK_TOOL,
  CALCULATOR_TOOL,
];

/**
 * Execute calendar_availability using the slot validator directly.
 * Returns human-readable slot availability per day.
 */
async function executeCalendarAvailability(input: Record<string, any>): Promise<string> {
  const fromDate = new Date(input.from);
  const toDate = new Date(input.to);
  const durationMinutes = input.duration_minutes || 60;

  const { size, points: pointsNeeded } = slotCapacityValidator.determineSizeAndPoints(durationMinutes);

  const availableSlots = await slotCapacityValidator.findAvailableSlots(fromDate, toDate, pointsNeeded);

  if (availableSlots.length === 0) {
    return JSON.stringify({
      success: false,
      error: "No hay disponibilidad",
      details: "No se encontraron franjas con capacidad suficiente en el rango indicado.",
      size,
      pointsNeeded,
    }, null, 2);
  }

  // Format as human-readable for the LLM
  const formattedDays: string[] = [];
  const formattedSlots: Array<{
    date: string;
    slotStartTime: string;
    slotEndTime: string;
    pointsAvailable: number;
    docksAvailable: number;
    size: string;
  }> = [];

  for (const day of availableSlots) {
    const dayDate = new Date(day.date + "T12:00:00");
    const dayOfWeek = getMadridDayOfWeek(dayDate);
    const dayName = DAY_NAMES_ES[dayOfWeek];
    const formattedDate = day.date.split("-").reverse().join("/");

    const slotTexts: string[] = [];
    for (const slot of day.slots) {
      slotTexts.push(`franja ${slot.startTime}-${slot.endTime} (${slot.pointsAvailable} puntos libres, ${slot.docksAvailable} muelles)`);
      formattedSlots.push({
        date: day.date,
        slotStartTime: slot.startTime,
        slotEndTime: slot.endTime,
        pointsAvailable: slot.pointsAvailable,
        docksAvailable: slot.docksAvailable,
        size,
      });
    }

    formattedDays.push(`${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${formattedDate}: ${slotTexts.join(", ")}`);
  }

  return JSON.stringify({
    success: true,
    slotsFound: formattedSlots.length,
    size,
    pointsNeeded,
    summary: formattedDays.join("\n"),
    slots: formattedSlots,
  }, null, 2);
}

/**
 * Resolve lines and albaranes from input, estimating if not provided.
 * Returns the resolved values and which fields were estimated.
 */
function resolveEstimations(input: Record<string, any>): {
  lines: number | null;
  albaranes: number | null;
  estimatedFields: string[];
} {
  const estimatedFields: string[] = [];
  const category = normalizeCategory(input.goodsType || "");
  const units = input.units || 0;

  let lines: number | null = input.lines ?? null;
  let albaranes: number | null = input.albaranes ?? null;

  if (lines == null || lines === undefined) {
    if (category) {
      lines = estimateLines(category, units);
      estimatedFields.push("lines");
      console.log(`[Agent] Estimated lines for ${category}: ${lines} (from ${units} units)`);
    }
  }

  if (albaranes == null || albaranes === undefined) {
    if (category) {
      albaranes = estimateDeliveryNotes(category);
      estimatedFields.push("deliveryNotes");
      console.log(`[Agent] Estimated deliveryNotes for ${category}: ${albaranes}`);
    }
  }

  return { lines, albaranes, estimatedFields };
}

/**
 * Execute calendar_book using prisma directly with slot validation.
 * If the requested slot is full, retries by searching for the next available slot.
 */
async function executeCalendarBook(input: Record<string, any>): Promise<string> {
  const startDate = new Date(input.start);
  const endDate = new Date(input.end);
  const providerName = input.providerName;
  const workMinutesNeeded = input.workMinutesNeeded || 60;

  // Estimate missing lines/albaranes before saving
  const { lines, albaranes, estimatedFields } = resolveEstimations(input);

  const { size, points: pointsUsed } = slotCapacityValidator.determineSizeAndPoints(workMinutesNeeded);

  // Find or create provider
  let provider = await prisma.provider.findFirst({
    where: { name: providerName },
  });
  if (!provider) {
    provider = await prisma.provider.create({
      data: { name: providerName },
    });
    logAudit({
      entityType: "PROVIDER",
      entityId: provider.id,
      action: "CREATE",
      actorType: "CHAT_AGENT",
      changes: { name: providerName, source: "agent-book" },
    }).catch(() => {});
  }

  const externalRef = `agent-${providerName}-${input.start}-${input.units}-${lines ?? 0}`;
  const durationMs = endDate.getTime() - startDate.getTime();

  // Attempt to book in the requested slot first
  const maxAttempts = 3;
  let currentStart = new Date(startDate);
  let lastError: string | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await prisma.$transaction(async (tx) => {
      const slotDate = getMadridMidnight(currentStart);

      const resolvedSlotStart = await slotCapacityValidator.resolveSlotStartTime(currentStart, tx);
      const slotStartTime = resolvedSlotStart || formatInTimeZone(currentStart, "Europe/Madrid", "HH:mm");

      // Check for existing appointment with this externalRef
      const existing = await tx.appointment.findUnique({
        where: { externalRef },
      });

      const currentEnd = new Date(currentStart.getTime() + durationMs);

      const slotValidation = await slotCapacityValidator.validateSlotCapacity(
        slotDate,
        slotStartTime,
        pointsUsed,
        currentStart,
        currentEnd,
        existing?.id,
        tx
      );

      if (!slotValidation.valid) {
        return { success: false as const, error: slotValidation.error || "Slot sin capacidad", reason: slotValidation.reason };
      }

      const appointmentData = {
        providerId: provider!.id,
        providerName,
        startUtc: currentStart,
        endUtc: currentEnd,
        workMinutesNeeded,
        forkliftsNeeded: 0,
        goodsType: input.goodsType || null,
        units: input.units ?? null,
        lines: lines ?? null,
        deliveryNotesCount: albaranes ?? null,
        size,
        pointsUsed,
        slotDate,
        slotStartTime: slotValidation.slotStartTime,
        estimatedFields: estimatedFields.length > 0 ? JSON.stringify(estimatedFields) : null,
        providerEmail: input.providerEmail || null,
        providerPhone: input.providerPhone || null,
        dockId: slotValidation.assignedDock?.id || null,
      };

      if (existing) {
        const appointment = await tx.appointment.update({
          where: { id: existing.id },
          data: appointmentData,
        });
        return { success: true as const, action: "updated" as const, appointment, assignedDock: slotValidation.assignedDock };
      }

      const appointment = await tx.appointment.create({
        data: {
          ...appointmentData,
          externalRef,
        },
      });

      return { success: true as const, action: "created" as const, appointment, assignedDock: slotValidation.assignedDock };
    }, { isolationLevel: "Serializable" });

    if (result.success) {
      const appointment = result.appointment;
      const assignedDock = result.assignedDock;
      const startLocal = formatInTimeZone(appointment.startUtc, "Europe/Madrid", "dd/MM/yyyy, HH:mm");
      const endLocal = formatInTimeZone(appointment.endUtc, "Europe/Madrid", "HH:mm");
      const duration = Math.round((appointment.endUtc.getTime() - appointment.startUtc.getTime()) / 60000);

      logAudit({
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        action: result.action === "created" ? "CREATE" : "UPDATE",
        actorType: "CHAT_AGENT",
        changes: { providerName, start: appointment.startUtc.toISOString(), end: appointment.endUtc.toISOString() },
      }).catch(() => {});

      // Send confirmation email if provider email is available
      if (appointment.providerEmail) {
        sendAppointmentConfirmation(appointment.id).catch(() => {});
      }

      const dockLabel = assignedDock ? ` — Muelle: ${assignedDock.name}` : "";
      const responseObj: Record<string, any> = {
        success: true,
        confirmationHtml: `<b>Cita confirmada</b><br>Proveedor: ${providerName}<br>Tipo: ${input.goodsType}<br>Fecha: ${startLocal.split(",")[0]}<br>Hora: ${startLocal.split(", ")[1]}–${endLocal} (duración: ${duration} min)<br>Talla: ${size} (${pointsUsed} pts)${dockLabel}`,
        providerName,
        goodsType: input.goodsType,
        startLocal,
        endLocal,
        size,
        pointsUsed,
        id: appointment.id,
        dockId: appointment.dockId,
        dockName: assignedDock?.name || null,
        dockCode: assignedDock?.code || null,
      };

      if (estimatedFields.length > 0) {
        responseObj.note = `Nota: se han estimado ${estimatedFields.join(" y ")} a partir de datos históricos de ${input.goodsType}.`;
      }

      return JSON.stringify(responseObj, null, 2);
    }

    // Slot was full — try next available slot on the same or subsequent days
    lastError = result.error;

    // Find next available slot starting from current date
    const searchFrom = new Date(currentStart);
    const searchTo = new Date(currentStart);
    searchTo.setDate(searchTo.getDate() + 7); // Search up to 7 days ahead

    const nextAvailable = await slotCapacityValidator.findAvailableSlots(searchFrom, searchTo, pointsUsed);

    if (nextAvailable.length > 0) {
      // Pick the first available slot
      const nextDay = nextAvailable[0];
      const nextSlot = nextDay.slots[0];
      // Parse the slot start time into a full date
      const [hours, minutes] = nextSlot.startTime.split(":").map(Number);
      currentStart = new Date(nextDay.date + "T00:00:00");
      currentStart.setHours(hours, minutes, 0, 0);

      // Skip if this is the same slot we just failed on
      const prevTimeStr = formatInTimeZone(startDate, "Europe/Madrid", "yyyy-MM-dd HH:mm");
      const newTimeStr = formatInTimeZone(currentStart, "Europe/Madrid", "yyyy-MM-dd HH:mm");
      if (prevTimeStr === newTimeStr && nextDay.slots.length > 1) {
        const altSlot = nextDay.slots[1];
        const [h2, m2] = altSlot.startTime.split(":").map(Number);
        currentStart = new Date(nextDay.date + "T00:00:00");
        currentStart.setHours(h2, m2, 0, 0);
      } else if (prevTimeStr === newTimeStr) {
        if (nextAvailable.length > 1) {
          const altDay = nextAvailable[1];
          const altSlot2 = altDay.slots[0];
          const [h3, m3] = altSlot2.startTime.split(":").map(Number);
          currentStart = new Date(altDay.date + "T00:00:00");
          currentStart.setHours(h3, m3, 0, 0);
        } else {
          break;
        }
      }
    } else {
      break;
    }
  }

  return JSON.stringify({
    success: false,
    error: "No hay disponibilidad",
    details: lastError || "Todos los intentos de reserva fallaron por falta de capacidad",
  }, null, 2);
}

export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, any>,
  _baseUrl: string
): Promise<string> {
  try {
    switch (toolName) {
      case "calculator": {
        const calcInput: CalculatorInput = {
          providerName: toolInput.providerName,
          goodsType: toolInput.goodsType,
          units: toolInput.units,
          lines: toolInput.lines ?? undefined,
          albaranes: toolInput.albaranes ?? undefined,
        };
        const calcResult = await runCalculator(calcInput);

        const response: Record<string, any> = { ...calcResult };
        if (calcResult.estimatedFields && calcResult.estimatedFields.length > 0) {
          response.note = `Nota: se han estimado ${calcResult.estimatedFields.join(" y ")} a partir de datos históricos de ${calcResult.categoria_elegida}.`;
        }
        return JSON.stringify(response, null, 2);
      }

      case "calendar_availability":
        return await executeCalendarAvailability(toolInput);

      case "calendar_book":
        return await executeCalendarBook(toolInput);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Tool execution error (${toolName}):`, errorMessage);
    return JSON.stringify({ error: errorMessage });
  }
}
