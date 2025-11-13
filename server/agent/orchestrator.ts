import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./llm-clients";
import { getMainAgentPrompt } from "./prompts";
import { AGENT_TOOLS, executeToolCall } from "./tools";
import { ConversationMemory } from "./memory";

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
      
      const anthropicMessages: Anthropic.MessageParam[] = history.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      }));

      let fullAssistantResponse = "";
      let shouldContinue = true;
      let iterationCount = 0;
      const maxIterations = 10;

      while (shouldContinue && iterationCount < maxIterations) {
        iterationCount++;
        shouldContinue = false;

        const stream = await anthropic.messages.stream({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          system: getMainAgentPrompt(new Date()),
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
    } catch (error) {
      console.error("Orchestrator error:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      yield {
        type: "error",
        content: `Lo siento, ha ocurrido un error: ${errorMessage}`,
      };
    }
  }
}
