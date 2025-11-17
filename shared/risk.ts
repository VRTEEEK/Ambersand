import {
  pgTable, serial, integer, varchar, text, timestamp, boolean
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const riskStatus = ["not-started", "in-progress", "mitigated", "under-review", "completed"] as const;
export type RiskStatus = typeof riskStatus[number];

export const riskSeverity = ["low", "medium", "high", "critical", "urgent"] as const;
export type RiskSeverity = typeof riskSeverity[number];

export const risks = pgTable("risks", {
  id: serial("id").primaryKey(),

  organizationId: varchar("organization_id", { length: 64 }).notNull(),

  // Link to the original task
  taskId: integer("task_id").notNull(),

  // Assignment (string user id)
  assigneeId: varchar("assignee_id", { length: 128 }), // nullable

  // Core fields
  title: varchar("title", { length: 256 }).notNull(), // copy from task title at creation
  riskDescription: text("risk_description"),
  mitigationPlan: text("mitigation_plan"),

  status: varchar("status", { length: 32 }).$type<RiskStatus>().default("not-started").notNull(),
  severity: varchar("severity", { length: 32 }).$type<RiskSeverity>().default("medium").notNull(),

  // Lifecycle
  isOpen: boolean("is_open").default(true).notNull(),
  createdById: varchar("created_by_id", { length: 128 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

// Zod schemas for validation
export const insertRiskSchema = createInsertSchema(risks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRiskSchema = insertRiskSchema.partial().omit({
  organizationId: true,
  taskId: true,
  createdById: true,
});

export type Risk = typeof risks.$inferSelect;
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type UpdateRisk = z.infer<typeof updateRiskSchema>;

// Risk Attachments table
export const riskAttachments = pgTable("risk_attachments", {
  id: serial("id").primaryKey(),
  riskId: integer("risk_id").notNull(),
  fileName: varchar("file_name", { length: 512 }).notNull(),
  filePath: varchar("file_path", { length: 1024 }).notNull(),
  fileType: varchar("file_type", { length: 128 }).notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedById: varchar("uploaded_by_id", { length: 128 }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRiskAttachmentSchema = createInsertSchema(riskAttachments).omit({
  id: true,
  uploadedAt: true,
});

export type RiskAttachment = typeof riskAttachments.$inferSelect;
export type InsertRiskAttachment = z.infer<typeof insertRiskAttachmentSchema>;