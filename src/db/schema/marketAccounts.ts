import { pgTable, uuid, varchar, text, timestamp, jsonb, numeric, boolean } from "drizzle-orm/pg-core";

export const marketCategories = pgTable("market_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  slug: varchar("slug", { length: 255 }).unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketAccounts = pgTable("market_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: varchar("account_id", { length: 100 }),
  category: varchar("category", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
  stock: numeric("stock").default("1"),
  image: text("image"),
  slides: jsonb("slides").default([]),
  description: text("description"),
  attributes: jsonb("attributes").default([]),
  credentials: jsonb("credentials").default({}),
  isSoldOut: boolean("is_sold_out").default(false).notNull(),
  buyLink: text("buy_link"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MarketCategory = typeof marketCategories.$inferSelect;
export type MarketAccount = typeof marketAccounts.$inferSelect;
