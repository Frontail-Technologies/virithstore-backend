import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface SliderImage {
  url: string;
}

export const sliders = pgTable("sliders", {
  id: uuid("id").defaultRandom().primaryKey(),
  images: jsonb("images").$type<SliderImage[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Slider = typeof sliders.$inferSelect;
export type NewSlider = typeof sliders.$inferInsert;
