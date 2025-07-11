import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  decimal,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("viewer"), // admin, manager, viewer
  organizationId: varchar("organization_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organizations table
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  nameAr: varchar("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ECC Controls table (from the uploaded SQL data)
export const eccControls = pgTable("ecc_controls", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(),
  domainEn: text("domain_en").notNull(),
  domainAr: text("domain_ar").notNull(),
  subdomainEn: text("subdomain_en").notNull(),
  subdomainAr: text("subdomain_ar").notNull(),
  controlEn: text("control_en").notNull(),
  controlAr: text("control_ar").notNull(),
  evidenceEn: text("evidence_en"),
  evidenceAr: text("evidence_ar"),
  requirementEn: text("requirement_en"),
  requirementAr: text("requirement_ar"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Custom Regulations table (user-defined regulations)
export const customRegulations = pgTable("custom_regulations", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  nameAr: varchar("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  category: varchar("category").notNull(), // internal, external, industry, custom
  framework: varchar("framework"), // e.g., ISO 27001, SOX, custom framework name
  version: varchar("version").default("1.0"),
  status: varchar("status").notNull().default("draft"), // draft, active, archived
  organizationId: varchar("organization_id").notNull(),
  createdById: varchar("created_by_id").notNull(),
  approvedById: varchar("approved_by_id"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Custom Controls table (controls within custom regulations)
export const customControls = pgTable("custom_controls", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull(),
  title: varchar("title").notNull(),
  titleAr: varchar("title_ar"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  category: varchar("category"), // technical, administrative, physical
  severity: varchar("severity").notNull().default("medium"), // low, medium, high, critical
  evidence: text("evidence"),
  evidenceAr: text("evidence_ar"),
  requirement: text("requirement"),
  requirementAr: text("requirement_ar"),
  customRegulationId: integer("custom_regulation_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  nameAr: varchar("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  status: varchar("status").notNull().default("planning"), // planning, active, completed, on-hold, overdue
  priority: varchar("priority").notNull().default("medium"), // low, medium, high, urgent
  startDate: date("start_date"),
  endDate: date("end_date"),
  progress: integer("progress").default(0), // percentage 0-100
  organizationId: varchar("organization_id"),
  ownerId: varchar("owner_id").notNull(),
  regulationType: varchar("regulation_type"), // ecc, pdpl, ndmo
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  titleAr: varchar("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  status: varchar("status").notNull().default("todo"), // todo, in-progress, review, completed
  priority: varchar("priority").notNull().default("medium"), // low, medium, high, urgent
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  projectId: integer("project_id"),
  assigneeId: varchar("assignee_id"),
  createdById: varchar("created_by_id").notNull(),
  eccControlId: integer("ecc_control_id"), // link to specific ECC control
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project Controls Association table
export const projectControls = pgTable("project_controls", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  eccControlId: integer("ecc_control_id").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, in-progress, completed, not-applicable
  assignedTo: varchar("assigned_to"),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Evidence repository table
export const evidence = pgTable("evidence", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  titleAr: varchar("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size"),
  fileType: varchar("file_type"),
  filePath: varchar("file_path").notNull(),
  taskId: integer("task_id"),
  projectId: integer("project_id"),
  eccControlId: integer("ecc_control_id"),
  uploadedById: varchar("uploaded_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Compliance assessments table
export const complianceAssessments = pgTable("compliance_assessments", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  nameAr: varchar("name_ar"),
  regulationType: varchar("regulation_type").notNull(), // ecc, pdpl, ndmo
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }),
  totalControls: integer("total_controls"),
  completedControls: integer("completed_controls"),
  organizationId: varchar("organization_id"),
  assessorId: varchar("assessor_id").notNull(),
  status: varchar("status").notNull().default("draft"), // draft, in-progress, completed
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Control assessments table (individual control evaluations)
export const controlAssessments = pgTable("control_assessments", {
  id: serial("id").primaryKey(),
  complianceAssessmentId: integer("compliance_assessment_id").notNull(),
  eccControlId: integer("ecc_control_id").notNull(),
  status: varchar("status").notNull().default("not-started"), // not-started, in-progress, compliant, non-compliant, not-applicable
  score: decimal("score", { precision: 5, scale: 2 }),
  notes: text("notes"),
  notesAr: text("notes_ar"),
  evidenceIds: text("evidence_ids"), // JSON array of evidence IDs
  assessorId: varchar("assessor_id"),
  assessedAt: timestamp("assessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  tasks: many(tasks),
  evidence: many(evidence),
  assessments: many(complianceAssessments),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  tasks: many(tasks),
  evidence: many(evidence),
  projectControls: many(projectControls),
}));

export const projectControlsRelations = relations(projectControls, ({ one }) => ({
  project: one(projects, {
    fields: [projectControls.projectId],
    references: [projects.id],
  }),
  eccControl: one(eccControls, {
    fields: [projectControls.eccControlId],
    references: [eccControls.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
  }),
  eccControl: one(eccControls, {
    fields: [tasks.eccControlId],
    references: [eccControls.id],
  }),
  evidence: many(evidence),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  task: one(tasks, {
    fields: [evidence.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [evidence.projectId],
    references: [projects.id],
  }),
  eccControl: one(eccControls, {
    fields: [evidence.eccControlId],
    references: [eccControls.id],
  }),
  uploadedBy: one(users, {
    fields: [evidence.uploadedById],
    references: [users.id],
  }),
}));

export const complianceAssessmentsRelations = relations(complianceAssessments, ({ one, many }) => ({
  assessor: one(users, {
    fields: [complianceAssessments.assessorId],
    references: [users.id],
  }),
  controlAssessments: many(controlAssessments),
}));

export const controlAssessmentsRelations = relations(controlAssessments, ({ one }) => ({
  complianceAssessment: one(complianceAssessments, {
    fields: [controlAssessments.complianceAssessmentId],
    references: [complianceAssessments.id],
  }),
  eccControl: one(eccControls, {
    fields: [controlAssessments.eccControlId],
    references: [eccControls.id],
  }),
  assessor: one(users, {
    fields: [controlAssessments.assessorId],
    references: [users.id],
  }),
}));

export const eccControlsRelations = relations(eccControls, ({ many }) => ({
  tasks: many(tasks),
  evidence: many(evidence),
  assessments: many(controlAssessments),
  projectControls: many(projectControls),
}));

export const customRegulationsRelations = relations(customRegulations, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [customRegulations.createdById],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [customRegulations.approvedById],
    references: [users.id],
  }),
  controls: many(customControls),
}));

export const customControlsRelations = relations(customControls, ({ one }) => ({
  regulation: one(customRegulations, {
    fields: [customControls.customRegulationId],
    references: [customRegulations.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
  organizationId: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvidenceSchema = createInsertSchema(evidence).omit({
  id: true,
  createdAt: true,
});

export const insertComplianceAssessmentSchema = createInsertSchema(complianceAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertControlAssessmentSchema = createInsertSchema(controlAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomRegulationSchema = createInsertSchema(customRegulations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomControlSchema = createInsertSchema(customControls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectControlSchema = createInsertSchema(projectControls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Evidence = typeof evidence.$inferSelect;
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type EccControl = typeof eccControls.$inferSelect;
export type ProjectControl = typeof projectControls.$inferSelect;
export type InsertProjectControl = z.infer<typeof insertProjectControlSchema>;
export type ComplianceAssessment = typeof complianceAssessments.$inferSelect;
export type InsertComplianceAssessment = z.infer<typeof insertComplianceAssessmentSchema>;
export type ControlAssessment = typeof controlAssessments.$inferSelect;
export type InsertControlAssessment = z.infer<typeof insertControlAssessmentSchema>;
export type CustomRegulation = typeof customRegulations.$inferSelect;
export type InsertCustomRegulation = z.infer<typeof insertCustomRegulationSchema>;
export type CustomControl = typeof customControls.$inferSelect;
export type InsertCustomControl = z.infer<typeof insertCustomControlSchema>;
