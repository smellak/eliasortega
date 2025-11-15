import type Anthropic from "@anthropic-ai/sdk";
import { runCalculator, type CalculatorInput } from "./calculator";

const CALENDAR_AVAILABILITY_TOOL: Anthropic.Tool = {
  name: "calendar_availability",
  description: "Busca slots de citas disponibles en el calendario del almacén. Requiere rango de fechas (from, to), duración estimada y detalles de la entrega. Devuelve hasta 3 slots disponibles con horarios en Europe/Madrid.",
  input_schema: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "Fecha/hora de inicio del rango de búsqueda (ISO 8601, Europe/Madrid timezone). Ejemplo: '2025-01-15T08:00:00+01:00'",
      },
      to: {
        type: "string",
        description: "Fecha/hora de fin del rango de búsqueda (ISO 8601, Europe/Madrid timezone). Ejemplo: '2025-01-17T14:00:00+01:00'",
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

export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, any>,
  baseUrl: string
): Promise<string> {
  console.log(`[TOOL EXECUTION] Tool: ${toolName}`);
  console.log(`[TOOL EXECUTION] Input:`, JSON.stringify(toolInput, null, 2));
  
  try {
    switch (toolName) {
      case "calculator":
        const calcInput: CalculatorInput = {
          providerName: toolInput.providerName,
          goodsType: toolInput.goodsType,
          units: toolInput.units,
          lines: toolInput.lines,
          albaranes: toolInput.albaranes,
        };
        const calcResult = await runCalculator(calcInput);
        console.log(`[TOOL EXECUTION] Calculator result:`, JSON.stringify(calcResult, null, 2));
        return JSON.stringify(calcResult, null, 2);

      case "calendar_availability":
        console.log(`[TOOL EXECUTION] Calling calendar availability API at: ${baseUrl}/api/integration/calendar/availability`);
        const availabilityResponse = await fetch(
          `${baseUrl}/api/integration/calendar/availability`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toolInput),
          }
        );
        console.log(`[TOOL EXECUTION] Availability API response status: ${availabilityResponse.status}`);
        if (!availabilityResponse.ok) {
          const errorText = await availabilityResponse.text();
          console.error(`[TOOL EXECUTION] Availability API error:`, errorText);
          throw new Error(`Calendar API error (${availabilityResponse.status}): ${errorText}`);
        }
        const availabilityData = await availabilityResponse.json();
        console.log(`[TOOL EXECUTION] Availability API result:`, JSON.stringify(availabilityData, null, 2));
        return JSON.stringify(availabilityData, null, 2);

      case "calendar_book":
        console.log(`[TOOL EXECUTION] Calling calendar book API at: ${baseUrl}/api/integration/calendar/book`);
        const bookResponse = await fetch(
          `${baseUrl}/api/integration/calendar/book`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toolInput),
          }
        );
        console.log(`[TOOL EXECUTION] Book API response status: ${bookResponse.status}`);
        if (!bookResponse.ok) {
          const errorText = await bookResponse.text();
          console.error(`[TOOL EXECUTION] Book API error:`, errorText);
          throw new Error(`Booking API error (${bookResponse.status}): ${errorText}`);
        }
        const bookData = await bookResponse.json();
        console.log(`[TOOL EXECUTION] Book API result:`, JSON.stringify(bookData, null, 2));
        return JSON.stringify(bookData, null, 2);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[TOOL EXECUTION] Error in ${toolName}:`, errorMessage);
    return JSON.stringify({ error: errorMessage });
  }
}
