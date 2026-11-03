import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { products } from "./products";
import { orders } from "./orders";

export const accountsVault = pgTable("accounts_vault", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
  costId: varchar("cost_id", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  password: text("password"),
  additionalInfo: text("additional_info"),
  isActive: boolean("is_active").default(true).notNull(),
  isReserved: boolean("is_reserved").default(false).notNull(),
  reservedExpiry: timestamp("reserved_expiry"),
  // The pending order holding this account. Only that order may receive it, even after the hold time passes.
  reservedOrderId: uuid("reserved_order_id").references(() => orders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AccountVault = typeof accountsVault.$inferSelect;
export type NewAccountVault = typeof accountsVault.$inferInsert;
