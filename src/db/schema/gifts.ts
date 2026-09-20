import { pgTable, uuid, varchar, text, numeric, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const giftRewardTypeEnum = pgEnum("gift_reward_type", ["discount", "product", "cash"]);

export interface GiftClaimRecord {
  userId: string;
  claimedAt: string;
}

export const gifts = pgTable("gifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  image: text("image"),
  requiredWagering: numeric("required_wagering", { precision: 10, scale: 2 }).notNull(),
  rewardType: giftRewardTypeEnum("reward_type").default("discount").notNull(),
  rewardValue: varchar("reward_value", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  claimedBy: jsonb("claimed_by").$type<GiftClaimRecord[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const giftTransactions = pgTable("gift_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  giftId: uuid("gift_id").references(() => gifts.id, { onDelete: "cascade" }),
  cost: numeric("cost", { precision: 10, scale: 2 }).default("0.00").notNull(),
  userWagering: numeric("user_wagering", { precision: 10, scale: 2 }).default("0.00").notNull(),
  wagering: numeric("wagering", { precision: 10, scale: 2 }).default("0.00").notNull(),
  level: varchar("level", { length: 50 }).default("1"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Gift = typeof gifts.$inferSelect;
export type NewGift = typeof gifts.$inferInsert;
export type GiftTransaction = typeof giftTransactions.$inferSelect;
