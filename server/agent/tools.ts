import type Anthropic from "@anthropic-ai/sdk";
import { runCalculator, type CalculatorInput } from "./calculator";
import { slotCapacityValidator } from "../services/slot-validator";
import { prisma } from "../db/client";
import { logAudit } from "../services/audit-service";
import { formatInTimeZone } from "date-fns-tz";

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
        description: "Número de líneas/referencias diferentes",
      },
      albaranes: {
        type: "number",
        description: "Número de albaranes/documentos de entrega",
      },
      workMinutesNeeded: {
        type: "number",
        description: "Minutos de trabajo estimados (obtenido del calculator agent)",
      },
      forkliftsNeeded: {
        type: "number",
        description: "Número de carretillas necesarias (obtenido del calculator agent)",
      },
    },
    required: ["from", "to", "duration_minutes", "providerName", "goodsType", "units", "lines", "albaranes", "workMinutesNeeded", "forkliftsNeeded"],
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
        description: "Número de líneas/referencias diferentes",
      },
      albaranes: {
        type: "number",
        description: "Número de albaranes/documentos de entrega",
      },
      workMinutesNeeded: {
        type: "number",
        description: "Minutos de trabajo estimados (obtenido del calculator agent)",
      },
      forkliftsNeeded: {
        type: "number",
        description: "Número de carretillas necesarias (obtenido del calculator agent)",
      },
    },
    required: ["start", "end", "providerName", "goodsType", "units", "lines", "albaranes", "workMinutesNeeded", "forkliftsNeeded"],
  },
};

const CALCULATOR_TOOL: Anthropic.Tool = {
  name: "calculator",
  description: "Calcula los recursos necesarios (tiempo, carretillas, operarios) para una entrega basándose en el tipo de mercancía, unidades, líneas y albaranes. Usa esta herramienta antes de buscar disponibilidad o reservar.",
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
        description: "Número de líneas/referencias diferentes en el pedido",
      },
      albaranes: {
        type: "number",
        description: "Número de albaranes/documentos de entrega",
      },
    },
    required: ["goodsType", "units", "lines", "albaranes"],
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
    size: string;
  }> = [];

  for (const day of availableSlots) {
    const dayDate = new Date(day.date + "T12:00:00");
    const dayOfWeek = dayDate.getDay();
    const dayName = DAY_NAMES_ES[dayOfWeek];
    const formattedDate = day.date.split("-").reverse().join("/");

    const slotTexts: string[] = [];
    for (const slot of day.slots) {
      slotTexts.push(`franja ${slot.startTime}-${slot.endTime} (${slot.pointsAvailable} puntos libres)`);
      formattedSlots.push({
        date: day.date,
        slotStartTime: slot.startTime,
        slotEndTime: slot.endTime,
        pointsAvailable: slot.pointsAvailable,
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
 * Execute calendar_book using prisma directly with slot validation.
 * If the requested slot is full, retries by searching for the next available slot.
 */
async function executeCalendarBook(input: Record<string, any>): Promise<string> {
  const startDate = new Date(input.start);
  const endDate = new Date(input.end);
  const providerName = input.providerName;
  const workMinutesNeeded = input.workMinutesNeeded || 60;
  const forkliftsNeeded = input.forkliftsNeeded || 0;

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

  const externalRef = `agent-${providerName}-${input.start}-${input.units}-${input.lines}`;
  const durationMs = endDate.getTime() - startDate.getTime();

  // Attempt to book in the requested slot first
  const maxAttempts = 3;
  let currentStart = new Date(startDate);
  let lastError: string | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await prisma.$transaction(async (tx) => {
      const slotDate = new Date(currentStart);
      slotDate.setHours(0, 0, 0, 0);

      const resolvedSlotStart = await slotCapacityValidator.resolveSlotStartTime(currentStart, tx);
      const slotStartTime = resolvedSlotStart || formatInTimeZone(currentStart, "Europe/Madrid", "HH:mm");

      // Check for existing appointment with this externalRef
      const existing = await tx.appointment.findUnique({
        where: { externalRef },
      });

      const slotValidation = await slotCapacityValidator.validateSlotCapacity(
        slotDate,
        slotStartTime,
        pointsUsed,
        existing?.id,
        tx
      );

      if (!slotValidation.valid) {
        return { success: false as const, error: slotValidation.error || "Slot sin capacidad" };
      }

      const currentEnd = new Date(currentStart.getTime() + durationMs);

      if (existing) {
        const appointment = await tx.appointment.update({
          where: { id: existing.id },
          data: {
            providerId: provider!.id,
            providerName,
            startUtc: currentStart,
            endUtc: currentEnd,
            workMinutesNeeded,
            forkliftsNeeded,
            goodsType: input.goodsType || null,
            units: input.units || null,
            lines: input.lines || null,
            deliveryNotesCount: input.albaranes || null,
            size,
            pointsUsed,
            slotDate,
            slotStartTime: slotValidation.slotStartTime,
          },
        });
        return { success: true as const, action: "updated" as const, appointment };
      }

      const appointment = await tx.appointment.create({
        data: {
          providerId: provider!.id,
          providerName,
          startUtc: currentStart,
          endUtc: currentEnd,
          workMinutesNeeded,
          forkliftsNeeded,
          goodsType: input.goodsType || null,
          units: input.units || null,
          lines: input.lines || null,
          deliveryNotesCount: input.albaranes || null,
          externalRef,
          size,
          pointsUsed,
          slotDate,
          slotStartTime: slotValidation.slotStartTime,
        },
      });

      return { success: true as const, action: "created" as const, appointment };
    }, { isolationLevel: "Serializable" });

    if (result.success) {
      const appointment = result.appointment;
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

      return JSON.stringify({
        success: true,
        confirmationHtml: `<b>Cita confirmada</b><br>Proveedor: ${providerName}<br>Tipo: ${input.goodsType}<br>Fecha: ${startLocal.split(",")[0]}<br>Hora: ${startLocal.split(", ")[1]}–${endLocal} (duración: ${duration} min)<br>Talla: ${size} (${pointsUsed} pts)`,
        providerName,
        goodsType: input.goodsType,
        startLocal,
        endLocal,
        size,
        pointsUsed,
        id: appointment.id,
      }, null, 2);
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
        // Try the second slot instead
        const altSlot = nextDay.slots[1];
        const [h2, m2] = altSlot.startTime.split(":").map(Number);
        currentStart = new Date(nextDay.date + "T00:00:00");
        currentStart.setHours(h2, m2, 0, 0);
      } else if (prevTimeStr === newTimeStr) {
        // Same slot, same day — skip to next day
        if (nextAvailable.length > 1) {
          const altDay = nextAvailable[1];
          const altSlot2 = altDay.slots[0];
          const [h3, m3] = altSlot2.startTime.split(":").map(Number);
          currentStart = new Date(altDay.date + "T00:00:00");
          currentStart.setHours(h3, m3, 0, 0);
        } else {
          break; // No more options
        }
      }
    } else {
      break; // No available slots found
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
          lines: toolInput.lines,
          albaranes: toolInput.albaranes,
        };
        const calcResult = await runCalculator(calcInput);
        return JSON.stringify(calcResult, null, 2);
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
