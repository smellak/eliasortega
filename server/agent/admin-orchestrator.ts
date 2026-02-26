import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./llm-clients";
import { ADMIN_AGENT_TOOLS, executeAdminToolCall } from "./admin-tools";
import { getActiveSlotSchedule } from "./prompts";
import type { StreamChunk } from "./orchestrator";

const ADMIN_MODEL = process.env.AGENT_MODEL || "claude-sonnet-4-6";

// In-memory conversation history per session
const sessionHistories = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessionTimestamps = new Map<string, number>();

function getHistory(sessionId: string): Array<{ role: "user" | "assistant"; content: string }> {
  // Cleanup expired sessions
  const now = Date.now();
  for (const [id, ts] of sessionTimestamps) {
    if (now - ts > SESSION_TTL_MS) {
      sessionHistories.delete(id);
      sessionTimestamps.delete(id);
    }
  }

  sessionTimestamps.set(sessionId, now);
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, []);
  }
  return sessionHistories.get(sessionId)!;
}

async function getAdminSystemPrompt(): Promise<string> {
  const now = new Date();
  const madridTime = now.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "full",
    timeStyle: "short",
  });
  const schedule = await getActiveSlotSchedule();

  return `Eres el Asistente IA del panel de administración de CentroHogar Sánchez, un sistema de gestión de citas de descarga en almacén.

Fecha y hora actual: ${madridTime} (Europe/Madrid)

CONTEXTO DEL SISTEMA:
- La app gestiona citas de descarga de mercancía de proveedores en un almacén
- Hay 3 muelles de descarga (M1, M2, M3) que pueden recibir camiones simultáneamente
- Las citas tienen tallas: S (1 punto, <30min), M (2 puntos, 30-120min), L (3 puntos, >120min)
- Los puntos representan la carga de trabajo. Cada franja horaria tiene un máximo de puntos según personal disponible
- El buffer entre descargas en el mismo muelle es de 15 minutos
- Los proveedores reservan citas hablando con Elías (el asistente público) en /chat
- El admin gestiona todo desde el panel

Franjas horarias configuradas:
${schedule}

CÓMO FUNCIONA LA APP (para explicar al usuario si pregunta):
- Página Calendario (/): Vista semanal con KPIs de ocupación, gráficas de uso, y grid de franjas horarias con citas
- Página Citas (/appointments): Lista todas las citas con proveedor, fecha, hora, muelle, talla, estado. Se pueden crear, editar y cancelar
- Página Muelles (/docks): Gestión de los 3 muelles. Activar/desactivar, configurar disponibilidad por día/hora
- Página Capacidad (/capacity): Grid semanal con puntos usados vs disponibles por franja
- Página Proveedores (/providers): Lista de proveedores registrados con nombre, contacto, notas
- Página Notificaciones (/notifications): Configuración de emails de confirmación y recordatorio
- Página Usuarios (/users): Gestión de usuarios admin/planner con roles
- Página Auditoría (/audit): Log de todas las acciones realizadas en el sistema
- Chat público (/chat): Donde los proveedores hablan con Elías para reservar citas

CAPACIDADES:
Tienes herramientas para consultar y modificar datos del sistema. Úsalas siempre que el usuario pida información o acciones concretas.

REGLAS:
- Responde SIEMPRE en español
- Sé conciso y directo, el admin es una persona ocupada
- Para acciones destructivas (cancelar, eliminar, modificar), SIEMPRE pide confirmación antes de ejecutar
- Si no estás seguro de algo, dilo claramente
- Cuando muestres datos, usa formato limpio con fechas en zona Europe/Madrid
- Si el usuario pregunta cómo funciona algo de la app, explícalo de forma clara y práctica
- Si el usuario pregunta algo que no puedes hacer con las tools disponibles, dile exactamente qué debería hacer manualmente en qué página
- Nunca inventes datos. Usa siempre las herramientas para obtener información real
- Formatea los datos de forma legible: usa tablas markdown cuando muestres listas

SISTEMA DE CÁLCULO DE TIEMPOS DE DESCARGA:

El calculador usa coeficientes del consultor externo basados en 293 entregas reales (marzo-mayo 2025):

Fórmula: Tiempo = TD + (U × TU) + (A × TA) + (L × TL)
Excepción: Asientos no usa TD.

Coeficientes por categoría:
| Categoría | TD (base) | TA (/albarán) | TL (/línea) | TU (/unidad) |
|-----------|-----------|---------------|-------------|--------------|
| Asientos | 48.88 | 5.49 | 0.00 | 1.06 |
| Baño | 3.11 | 11.29 | 0.61 | 0.00 |
| Cocina | 10.67 | 0.00 | 4.95 | 0.04 |
| Colchonería | 14.83 | 0.00 | 4.95 | 0.12 |
| Electro | 33.49 | 0.81 | 0.00 | 0.31 |
| Mobiliario | 23.20 | 0.00 | 2.54 | 0.25 |
| PAE | 6.67 | 8.33 | 0.00 | 0.00 |
| Tapicería | 34.74 | 0.00 | 2.25 | 0.10 |

Topes máximos (basados en P95 de datos históricos × 1.3):
- Asientos: 350 min | Baño: 60 min | Cocina: 140 min | Colchonería: 160 min
- Electro: 230 min | Mobiliario: 270 min | PAE: 60 min | Tapicería: 180 min

Cuando el proveedor no da albaranes ni líneas, se estiman:
- Líneas = unidades × ratio por categoría (ej: Colchonería 0.369)
- Albaranes = mediana histórica por categoría (ej: Electro 34)

Categorías problemáticas (menor fiabilidad):
- Electro: R²=0.47, muy variable. Proveedores como CODECO son impredecibles.
- Asientos: R²=0.65, outliers extremos (JANCOR 20 uds = 350 min).
- Tapicería: R²=0.65, variabilidad alta por tipo de tapizado.

Categorías fiables:
- Cocina: R²=0.97
- PAE: R²=0.89
- Colchonería: R²=0.86

Tallas y puntos:
- S (≤30 min): 1 punto. Entregas rápidas.
- M (31-120 min): 2 puntos. Cargas medianas.
- L (>120 min): 3 puntos. Cargas grandes.

Si el admin pregunta por qué una estimación parece incorrecta, explica qué categoría es, cuál es su fiabilidad (R²), y sugiere que con datos reales de albaranes y líneas la predicción mejora significativamente.
SISTEMA DE APRENDIZAJE CONTINUO:

El almacén ahora registra tiempos reales de cada descarga (check-in/check-out en la página /warehouse).
Con estos datos puedes:

1. **consultar_precision**: Ver MAE, MAPE, sesgo y R² por categoría. Útil para saber qué categorías estiman bien y cuáles no.
2. **consultar_perfiles_proveedores**: Ver perfiles de proveedores basados en datos reales (duración media, fiabilidad: rápido/normal/lento).
3. **recalibrar_categoria**: Recalcular coeficientes usando regresión lineal sobre datos reales. Se necesitan ≥20 muestras. Primero calcula (devuelve preview), luego aplica con snapshot_id.

Cuando el admin pregunte sobre precisión de estimaciones o rendimiento de proveedores, usa estas herramientas en lugar de los datos estáticos del consultor.
Si el admin quiere recalibrar, explica que necesita ≥20 descargas monitorizadas en esa categoría y muestra el resultado antes de aplicar.`;

}

export async function* adminChat(
  sessionId: string,
  userMessage: string,
): AsyncGenerator<StreamChunk> {
  try {
    const history = getHistory(sessionId);
    history.push({ role: "user", content: userMessage });

    // Trim history to last 20 messages and 30k chars
    const MAX_MESSAGES = 20;
    const MAX_CHARS = 30000;
    let recentHistory = history.slice(-MAX_MESSAGES);
    let totalChars = recentHistory.reduce((s, m) => s + m.content.length, 0);
    while (totalChars > MAX_CHARS && recentHistory.length > 2) {
      totalChars -= recentHistory[0].content.length;
      recentHistory = recentHistory.slice(1);
      if (recentHistory.length > 0 && recentHistory[0].role === "assistant") {
        totalChars -= recentHistory[0].content.length;
        recentHistory = recentHistory.slice(1);
      }
    }

    const anthropicMessages: Anthropic.MessageParam[] = recentHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const systemPrompt = await getAdminSystemPrompt();
    let fullResponse = "";
    let shouldContinue = true;
    let iterations = 0;

    while (shouldContinue && iterations < 5) {
      iterations++;
      shouldContinue = false;

      const stream = await anthropic.messages.stream({
        model: ADMIN_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: ADMIN_AGENT_TOOLS,
      });

      const toolUses: Array<{ id: string; name: string; input: any }> = [];

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text;
          yield { type: "text", content: event.delta.text };
        } else if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          yield { type: "tool_use", toolName: event.content_block.name, content: `Consultando: ${event.content_block.name}` };
        } else if (event.type === "message_delta" && event.delta.stop_reason === "tool_use") {
          shouldContinue = true;
        }
      }

      const finalMessage = await stream.finalMessage();

      if (finalMessage.stop_reason === "end_turn" || finalMessage.stop_reason === "max_tokens") {
        shouldContinue = false;
      }

      for (const block of finalMessage.content) {
        if (block.type === "text") {
          // already streamed
        } else if (block.type === "tool_use") {
          toolUses.push({ id: block.id, name: block.name, input: block.input as Record<string, any> });
        }
      }

      if (toolUses.length > 0) {
        const toolResults: Anthropic.MessageParam = { role: "user", content: [] };

        for (const tu of toolUses) {
          yield { type: "thinking", content: `Procesando ${tu.name}...` };
          const result = await executeAdminToolCall(tu.name, tu.input);
          yield { type: "tool_result", toolName: tu.name, toolResult: result };

          (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: result,
          });
        }

        anthropicMessages.push({ role: "assistant", content: finalMessage.content });
        anthropicMessages.push(toolResults);
      }
    }

    if (fullResponse) {
      history.push({ role: "assistant", content: fullResponse });
    }

    yield { type: "done", content: fullResponse };
  } catch (error: any) {
    console.error("Admin orchestrator error:", error);

    let friendlyMessage: string;
    // Anthropic SDK APIError: error.error = {type:"error", error:{type:"overloaded_error",...}}
    const errMsg = String(error?.message || "").toLowerCase();
    const errType = error?.error?.error?.type || error?.error?.type || error?.type || "";

    if (errType === "overloaded_error" || error?.status === 529 || errMsg.includes("overloaded")) {
      friendlyMessage = "Lo siento, el sistema está saturado en este momento. Por favor, inténtalo de nuevo en unos segundos.";
    } else if (errType === "rate_limit_error" || error?.status === 429 || errMsg.includes("rate limit")) {
      friendlyMessage = "Se han realizado demasiadas consultas. Por favor, espera un momento e inténtalo de nuevo.";
    } else {
      friendlyMessage = `Lo siento, ha ocurrido un error inesperado. Por favor, inténtalo de nuevo. (${errType || error?.status || 'unknown'})`;
    }

    yield { type: "error", content: friendlyMessage };
  }
}
