import { pgTable, text, timestamp, integer, pgEnum, json, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("UserRole", ["ADMIN", "PLANNER", "BASIC_READONLY"]);
export const messageRoleEnum = pgEnum("MessageRole", ["user", "assistant", "system", "tool"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("BASIC_READONLY"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const providers = pgTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const capacityShifts = pgTable("capacity_shifts", {
  id: text("id").primaryKey(),
  startUtc: timestamp("start_utc").notNull(),
  endUtc: timestamp("end_utc").notNull(),
  workers: integer("workers").notNull().default(0),
  forklifts: integer("forklifts").notNull().default(0),
  docks: integer("docks").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  timeIdx: index("capacity_shifts_start_utc_end_utc_idx").on(table.startUtc, table.endUtc),
}));

export const appointments = pgTable("appointments", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").references(() => providers.id, { onDelete: "set null" }),
  providerName: text("provider_name").notNull(),
  startUtc: timestamp("start_utc").notNull(),
  endUtc: timestamp("end_utc").notNull(),
  workMinutesNeeded: integer("work_minutes_needed").notNull(),
  forkliftsNeeded: integer("forklifts_needed").notNull(),
  goodsType: text("goods_type"),
  units: integer("units"),
  lines: integer("lines"),
  deliveryNotesCount: integer("delivery_notes_count"),
  externalRef: text("external_ref").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  startIdx: index("appointments_start_utc_idx").on(table.startUtc),
  endIdx: index("appointments_end_utc_idx").on(table.endUtc),
  providerNameIdx: index("appointments_provider_name_idx").on(table.providerName),
}));

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("conversations_session_id_idx").on(table.sessionId),
}));

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  conversationIdx: index("messages_conversation_id_idx").on(table.conversationId),
  createdIdx: index("messages_created_at_idx").on(table.createdAt),
}));

export const conversationRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const providerRelations = relations(providers, ({ many }) => ({
  appointments: many(appointments),
}));

export const appointmentRelations = relations(appointments, ({ one }) => ({
  provider: one(providers, {
    fields: [appointments.providerId],
    references: [providers.id],
  }),
}));

export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);
export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type SelectConversation = z.infer<typeof selectConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type SelectMessage = z.infer<typeof selectMessageSchema>;
export type MessageRole = SelectMessage["role"];
