import { pgTable, uuid, varchar, text, numeric, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const spinPrizeTypeEnum = pgEnum("spin_prize_type", [
  "points",
  "discount",
  "cash",
  "product",
  "free_spin",
]);

export const spinPrizes = pgTable("spin_prizes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  image: text("image"),
  type: spinPrizeTypeEnum("type").default("points").notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  probability: integer("probability").default(10).notNull(), // percentage or weight (0-100)
  color: varchar("color", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const spinTransactions = pgTable("spin_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  prizeId: uuid("prize_id").references(() => spinPrizes.id, { onDelete: "set null" }),
  prizeName: varchar("prize_name", { length: 255 }).notNull(),
  prizeValue: varchar("prize_value", { length: 255 }).notNull(),
  isClaimed: boolean("is_claimed").default(false).notNull(),
  // Auto-applied rewards (points/discount/free_spin) complete instantly; cash/product
  // prizes need manual admin fulfillment, tracked here as pending until resolved.
  status: varchar("status", { length: 20 }).default("success").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A spin is a feature earned via a qualifying purchase (product.spinActive +
// spinCostIds), not something every visitor gets for free. One credit is granted per
// qualifying order and consumed the moment it's spent on a spin.
export const spinCredits = pgTable("spin_credits", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  orderId: uuid("order_id"),
  isUsed: boolean("is_used").default(false).notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SpinPrize = typeof spinPrizes.$inferSelect;
export type NewSpinPrize = typeof spinPrizes.$inferInsert;
export type SpinTransaction = typeof spinTransactions.$inferSelect;
export type NewSpinTransaction = typeof spinTransactions.$inferInsert;
export type SpinCredit = typeof spinCredits.$inferSelect;
export type NewSpinCredit = typeof spinCredits.$inferInsert;
