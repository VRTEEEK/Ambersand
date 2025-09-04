import { pgTable, serial, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

export const userInvites = pgTable("user_invites", {
  id: serial("id").primaryKey(),
  organizationId: varchar("organization_id", { length: 64 }).notNull(),
  email: varchar("email", { length: 256 }).notNull(),
  token: varchar("token", { length: 128 }).notNull(), // random, single-use
  role: varchar("role", { length: 32 }).default("member").notNull(),
  accepted: boolean("accepted").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

export type UserInvite = typeof userInvites.$inferSelect;