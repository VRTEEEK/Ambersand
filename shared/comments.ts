import { pgTable, serial, integer, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const commentTargets = ["task","project","risk"] as const;
export type CommentTarget = typeof commentTargets[number];

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 16 }).$type<CommentTarget>().notNull(), // 'task' | 'project'
  targetId: integer("target_id").notNull(),
  parentId: integer("parent_id"), // for replies (1-level)
  authorId: integer("author_id").notNull(),
  body: text("body").notNull(),
  mentions: text("mentions").default(sql`'[]'::text`).notNull(), // JSON stringified array of userIds
  hasAttachments: boolean("has_attachments").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Optional "watchers/subscribers" for notifications
export const commentSubscriptions = pgTable("comment_subscriptions", {
  id: serial("id").primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 16 }).$type<CommentTarget>().notNull(),
  targetId: integer("target_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type CommentSubscription = typeof commentSubscriptions.$inferSelect;