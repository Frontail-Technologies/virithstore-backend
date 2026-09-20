import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const orderLogs = pgTable("order_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  transactionId: varchar("transaction_id", { length: 255 }),
  provider: varchar("provider", { length: 100 }).default("system").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  performedBy: varchar("performed_by", { length: 255 }).default("system").notNull(),
  status: varchar("status", { length: 50 }).default("success").notNull(),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  errorMessage: varchar("error_message", { length: 1000 }),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrderLog = typeof orderLogs.$inferSelect;
export type NewOrderLog = typeof orderLogs.$inferInsert;
