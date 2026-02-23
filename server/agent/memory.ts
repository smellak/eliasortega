import { prisma } from "../db/client";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export class ConversationMemory {
  private sessionId: string;
  private maxMessages: number;

  constructor(sessionId: string, maxMessages: number = 30) {
    this.sessionId = sessionId;
    this.maxMessages = maxMessages;
  }

  async getOrCreateConversation(): Promise<string> {
    const existing = await prisma.conversation.findUnique({
      where: { sessionId: this.sessionId },
    });

    if (existing) {
      return existing.id;
    }

    const newConversation = await prisma.conversation.create({
      data: {
        sessionId: this.sessionId,
        metadata: {},
      },
    });

    return newConversation.id;
  }

  async getHistory(): Promise<ConversationMessage[]> {
    const conversationId = await this.getOrCreateConversation();

    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: this.maxMessages,
    });

    return history
      .reverse()
      .map((msg) => ({
        role: msg.role as MessageRole,
        content: msg.content,
        createdAt: new Date(msg.createdAt),
      }));
  }

  async addMessage(role: MessageRole, content: string): Promise<void> {
    const conversationId = await this.getOrCreateConversation();

    await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        metadata: {},
      },
    });
  }

  async addUserMessage(content: string): Promise<void> {
    await this.addMessage("user", content);
  }

  async addAssistantMessage(content: string): Promise<void> {
    await this.addMessage("assistant", content);
  }

  async clear(): Promise<void> {
    const conversationId = await this.getOrCreateConversation();
    await prisma.message.deleteMany({
      where: { conversationId },
    });
  }
}
