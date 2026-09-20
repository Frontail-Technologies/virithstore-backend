import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { categories } from "./categories";

export const productTypeEnum = pgEnum("product_type", ["digital-service", "account"]);

export interface ProductCostItem {
  id: string;
  price: string;
  name?: string;
  amount?: string;
  costPrice?: string;
  durationDays?: number;
  note?: string;
  image?: string;
  category?: string;
  stock?: number;
  inStock?: boolean;
  isActive?: boolean;
}

export interface ProductFieldItem {
  label: string;
  name: string;
  type: "text" | "number" | "url" | "select" | "email";
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameKh: varchar("name_kh", { length: 255 }),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  image: text("image").notNull(),
  slides: jsonb("slides").$type<string[]>().default([]).notNull(),
  banner: text("banner"),
  type: productTypeEnum("type").notNull(),
  region: varchar("region", { length: 100 }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  isAvailable: boolean("is_available").default(true).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isHot: boolean("is_hot").default(false).notNull(),
  isPopular: boolean("is_popular").default(false).notNull(),
  isAutoDelivery: boolean("is_auto_delivery").default(true).notNull(),
  stock: boolean("stock").default(true).notNull(),
  spinActive: boolean("spin_active").default(false).notNull(),
  spinCostIds: jsonb("spin_cost_ids").$type<string[]>().default([]).notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  cost: jsonb("cost").$type<ProductCostItem[]>().default([]).notNull(),
  description: text("description"),
  guide: text("guide"),
  fields: jsonb("fields").$type<ProductFieldItem[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
