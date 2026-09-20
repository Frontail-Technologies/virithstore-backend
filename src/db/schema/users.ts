import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const authProviderEnum = pgEnum("auth_provider", ["email", "google", "telegram"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).unique(),
  password: text("password"),
  name: varchar("name", { length: 255 }),
  image: text("image"),
  telegramId: varchar("telegram_id", { length: 255 }).unique(),
  authProvider: authProviderEnum("auth_provider").default("email").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  isBlocked: boolean("is_blocked").default(false).notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  adminLoginOtp: varchar("admin_login_otp", { length: 10 }),
  adminLoginOtpExpiry: timestamp("admin_login_otp_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
