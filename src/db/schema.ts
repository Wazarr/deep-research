import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Users table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // API key serves as user ID
  email: text("email").unique(),
  settings: text("settings", { mode: "json" }).notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`datetime('now')`),
  updatedAt: text("updated_at").notNull().default(sql`datetime('now')`),
});

// Knowledge table
export const knowledge = sqliteTable("knowledge", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type", { enum: ["file", "url", "knowledge"] }).notNull(),
  content: text("content"),
  url: text("url"),
  fileMeta: text("file_meta", { mode: "json" }),
  status: text("status", { enum: ["processing", "completed", "failed"] })
    .notNull()
    .default("processing"),
  size: integer("size").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`datetime('now')`),
  updatedAt: text("updated_at").notNull().default(sql`datetime('now')`),
});

// Sessions table
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`datetime('now')`),
  updatedAt: text("updated_at").notNull().default(sql`datetime('now')`),
  expiresAt: text("expires_at").notNull(),
  phase: text("phase", {
    enum: ["topic", "questions", "feedback", "planning", "executing", "completed", "error"],
  })
    .notNull()
    .default("topic"),

  // Core session data
  topic: text("topic"),
  questions: text("questions"),
  feedback: text("feedback"),
  reportPlan: text("report_plan"),
  tasks: text("tasks", { mode: "json" }).default("[]"),
  results: text("results", { mode: "json" }).default("[]"),
  finalReport: text("final_report"),
  error: text("error"),
  settings: text("settings", { mode: "json" }).notNull(),

  // Enhanced fields for full TaskStore parity
  resources: text("resources", { mode: "json" }).default("[]"),
  requirement: text("requirement").default(""),
  suggestion: text("suggestion").default(""),
  knowledgeGraph: text("knowledge_graph").default(""),
  images: text("images", { mode: "json" }).default("[]"),
  sources: text("sources", { mode: "json" }).default("[]"),
  title: text("title").default(""),
  query: text("query").default(""),
  version: integer("version").notNull().default(1),
  metadata: text("metadata", { mode: "json" }).default("{}"),
});

// History table
export const history = sqliteTable("history", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  title: text("title").notNull(),
  tags: text("tags", { mode: "json" }).notNull().default("[]"),
  sessionData: text("session_data", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`datetime('now')`),
});

// Export types for the schema using proper Drizzle type inference
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Knowledge = InferSelectModel<typeof knowledge>;
export type NewKnowledge = InferInsertModel<typeof knowledge>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type History = InferSelectModel<typeof history>;
export type NewHistory = InferInsertModel<typeof history>;
