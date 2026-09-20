import { pgTable, uuid, varchar, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { orders } from "./orders";

export const walletTxTypeEnum = pgEnum("wallet_transaction_type", [
  "deposit",
  "referral_reward",
  "order_payment",
  "refund",
  "admin_adjustment",
  "spin_reward",
]);

export const walletTxStatusEnum = pgEnum("wallet_transaction_status", [
  "pending",
  "completed",
  "failed",
  "cancelled",
]);

export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: walletTxTypeEnum("type").notNull(),
  points: integer("points").notNull(), // positive for credit, negative for debit
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  referenceId: varchar("reference_id", { length: 255 }), // ABA transaction ID or admin note ref
  description: text("description").notNull(),
  status: walletTxStatusEnum("status").default("completed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type NewWalletTransaction = typeof walletTransactions.$inferInsert;
