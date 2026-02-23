import type Anthropic from "@anthropic-ai/sdk";
import { runCalculator, type CalculatorInput } from "./calculator";

const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY || "";

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

function getIntegrationHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (INTEGRATION_API_KEY) {
    headers["X-API-Key"] = INTEGRATION_API_KEY;
  }
  return headers;
}

export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, any>,
  baseUrl: string
): Promise<string> {
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
        return JSON.stringify(calcResult, null, 2);

      case "calendar_availability":
        const availabilityResponse = await fetch(
          `${baseUrl}/api/integration/calendar/availability`,
          {
            method: "POST",
            headers: getIntegrationHeaders(),
            body: JSON.stringify(toolInput),
          }
        );
        if (!availabilityResponse.ok) {
          const errorText = await availabilityResponse.text();
          throw new Error(`Calendar API error (${availabilityResponse.status}): ${errorText}`);
        }
        const availabilityData = await availabilityResponse.json();
        return JSON.stringify(availabilityData, null, 2);

      case "calendar_book":
        const bookResponse = await fetch(
          `${baseUrl}/api/integration/calendar/book`,
          {
            method: "POST",
            headers: getIntegrationHeaders(),
            body: JSON.stringify(toolInput),
          }
        );
        if (!bookResponse.ok) {
          const errorText = await bookResponse.text();
          throw new Error(`Booking API error (${bookResponse.status}): ${errorText}`);
        }
        const bookData = await bookResponse.json();
        return JSON.stringify(bookData, null, 2);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Tool execution error (${toolName}):`, errorMessage);
    return JSON.stringify({ error: errorMessage });
  }
}
