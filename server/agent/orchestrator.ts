import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./llm-clients";
import { getMainAgentPrompt } from "./prompts";
import { AGENT_TOOLS, executeToolCall } from "./tools";
import { ConversationMemory } from "./memory";

const AGENT_MODEL = process.env.AGENT_MODEL || "claude-sonnet-4-6";

export interface StreamChunk {
  type: "text" | "thinking" | "tool_use" | "tool_result" | "done" | "error";
  content?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolResult?: string;
}

export class AgentOrchestrator {
  private memory: ConversationMemory;
  private baseUrl: string;

  constructor(sessionId: string, baseUrl: string) {
    this.memory = new ConversationMemory(sessionId);
    this.baseUrl = baseUrl;
  }

  async *chat(userMessage: string): AsyncGenerator<StreamChunk> {
    try {
      await this.memory.addUserMessage(userMessage);

      const history = await this.memory.getHistory();

      // Limit history to prevent token overflow.
      // Strategy: keep the most recent messages intact, dropping oldest first
      // if total character count exceeds budget. This avoids cutting messages
      // mid-content, which can corrupt context.
      const MAX_HISTORY_CHARS = 30000;
      const MAX_MESSAGES = 20;

      let recentHistory = history.slice(-MAX_MESSAGES);

      // Drop oldest messages until we fit within the character budget
      let totalChars = recentHistory.reduce((sum, msg) => sum + msg.content.length, 0);
      while (totalChars > MAX_HISTORY_CHARS && recentHistory.length > 2) {
        totalChars -= recentHistory[0].content.length;
        recentHistory = recentHistory.slice(1);
        // Ensure we don't start with an assistant message (Anthropic requires user-first)
        if (recentHistory.length > 0 && recentHistory[0].role === "assistant") {
          totalChars -= recentHistory[0].content.length;
          recentHistory = recentHistory.slice(1);
        }
      }

      const anthropicMessages: Anthropic.MessageParam[] = recentHistory.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      }));

      let fullAssistantResponse = "";
      let shouldContinue = true;
      let iterationCount = 0;
      const maxIterations = 5;

      while (shouldContinue && iterationCount < maxIterations) {
        iterationCount++;
        shouldContinue = false;

        const systemPrompt = await getMainAgentPrompt(new Date());
        const stream = await anthropic.messages.stream({
          model: AGENT_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: anthropicMessages,
          tools: AGENT_TOOLS,
        });

        let currentTextBlock = "";
        const toolUses: Array<{ id: string; name: string; input: any }> = [];

        for await (const event of stream) {
          if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              currentTextBlock += event.delta.text;
              yield {
                type: "text",
                content: event.delta.text,
              };
            }
          } else if (event.type === "content_block_start") {
            if (event.content_block.type === "tool_use") {
              yield {
                type: "tool_use",
                toolName: event.content_block.name,
                content: `Ejecutando: ${event.content_block.name}`,
              };
            }
          } else if (event.type === "message_delta") {
            if (event.delta.stop_reason === "tool_use") {
              shouldContinue = true;
            }
          }
        }

        const finalMessage = await stream.finalMessage();

        // Check if Claude finished its turn (no more tool use needed)
        if (finalMessage.stop_reason === "end_turn" || finalMessage.stop_reason === "max_tokens") {
          shouldContinue = false;
        }

        for (const block of finalMessage.content) {
          if (block.type === "text") {
            fullAssistantResponse += block.text;
          } else if (block.type === "tool_use") {
            toolUses.push({
              id: block.id,
              name: block.name,
              input: block.input as Record<string, any>,
            });
          }
        }

        if (toolUses.length > 0) {
          const toolResults: Anthropic.MessageParam = {
            role: "user",
            content: [],
          };

          for (const toolUse of toolUses) {
            yield {
              type: "thinking",
              content: `Procesando ${toolUse.name}...`,
            };

            const result = await executeToolCall(
              toolUse.name,
              toolUse.input,
              this.baseUrl
            );

            yield {
              type: "tool_result",
              toolName: toolUse.name,
              toolResult: result,
            };

            (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: result,
            });
          }

          anthropicMessages.push({
            role: "assistant",
            content: finalMessage.content,
          });
          anthropicMessages.push(toolResults);
        }
      }

      if (fullAssistantResponse) {
        await this.memory.addAssistantMessage(fullAssistantResponse);
      }

      yield {
        type: "done",
        content: fullAssistantResponse,
      };
    } catch (error: any) {
      console.error("Orchestrator error:", error);

      let friendlyMessage: string;
      const errType = error?.error?.type || error?.type || "";

      if (errType === "overloaded_error" || error?.status === 529) {
        friendlyMessage = "Lo siento, el sistema está saturado en este momento. Por favor, inténtalo de nuevo en unos segundos.";
      } else if (errType === "rate_limit_error" || error?.status === 429) {
        friendlyMessage = "Se han realizado demasiadas consultas. Por favor, espera un momento e inténtalo de nuevo.";
      } else {
        friendlyMessage = "Lo siento, ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.";
      }

      yield { type: "error", content: friendlyMessage };
    }
  }
}
