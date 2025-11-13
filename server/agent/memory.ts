import { db } from "../db/client";
import { conversations, messages, type MessageRole } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

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
    const existing = await db.query.conversations.findFirst({
      where: eq(conversations.sessionId, this.sessionId),
    });

    if (existing) {
      return existing.id;
    }

    const [newConversation] = await db
      .insert(conversations)
      .values({
        id: randomUUID(),
        sessionId: this.sessionId,
        metadata: {},
      })
      .returning();

    return newConversation.id;
  }

  async getHistory(): Promise<ConversationMessage[]> {
    const conversationId = await this.getOrCreateConversation();

    const history = await db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: [desc(messages.createdAt)],
      limit: this.maxMessages,
    });

    return history
      .reverse()
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.createdAt),
      }));
  }

  async addMessage(role: MessageRole, content: string): Promise<void> {
    const conversationId = await this.getOrCreateConversation();

    await db.insert(messages).values({
      id: randomUUID(),
      conversationId,
      role,
      content,
      metadata: {},
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
    await db.delete(messages).where(eq(messages.conversationId, conversationId));
  }
}
