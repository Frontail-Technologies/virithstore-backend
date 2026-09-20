import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameKh: varchar("name_kh", { length: 255 }),
  image: text("image").notNull(),
  eventBanner: text("event_banner"),
  eventPrice: varchar("event_price", { length: 50 }),
  originalPrice: varchar("original_price", { length: 50 }),
  productId: varchar("product_id", { length: 255 }),
  link: varchar("link", { length: 500 }),
  order: integer("order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
