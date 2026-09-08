import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const savedComparisons = mysqlTable("savedComparisons", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  countriesJson: text("countriesJson").notNull(),
  metric: varchar("metric", { length: 32 }).notNull().default("absolute"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const learningProgress = mysqlTable("learningProgress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  pathId: varchar("pathId", { length: 80 }).notNull(),
  completedStepsJson: text("completedStepsJson").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull(),
  subagentId: varchar("subagentId", { length: 16 }).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  status: varchar("status", { length: 24 }).notNull(),
  qualityGatesJson: text("qualityGatesJson").notNull(),
  inputHash: varchar("inputHash", { length: 64 }).notNull(),
  outputHash: varchar("outputHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const syncRuns = mysqlTable("syncRuns", {
  id: int("id").autoincrement().primaryKey(),
  runId: varchar("runId", { length: 80 }).notNull().unique(),
  provider: varchar("provider", { length: 64 }).notNull(),
  status: varchar("status", { length: 24 }).notNull(),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt").notNull(),
  recordsRead: int("recordsRead").notNull().default(0),
  recordsWritten: int("recordsWritten").notNull().default(0),
  checksum: varchar("checksum", { length: 160 }).notNull(),
  qualityJson: text("qualityJson").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SavedComparison = typeof savedComparisons.$inferSelect;
export type LearningProgress = typeof learningProgress.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
