import { pgTable, uuid, numeric, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { orders } from "./orders";

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "completed",
  "cancelled",
]);

export const referralTransactions = pgTable("referral_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  referrerId: uuid("referrer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  refereeId: uuid("referee_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  orderAmount: numeric("order_amount", { precision: 10, scale: 2 }).notNull(),
  pointsEarned: integer("points_earned").notNull(),
  status: referralStatusEnum("status").default("completed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ReferralTransaction = typeof referralTransactions.$inferSelect;
export type NewReferralTransaction = typeof referralTransactions.$inferInsert;
