import { pgTable, uuid, varchar, text, timestamp, jsonb, numeric, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { products } from "./products";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "completed",
  "cancelled",
  "failed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).unique().notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail: varchar("user_email", { length: 255 }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  productImage: text("product_image"),
  productType: varchar("product_type", { length: 50 }).notNull(), // 'digital-service' | 'account'
  packageId: varchar("package_id", { length: 255 }).notNull(),
  packageName: varchar("package_name", { length: 255 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: numeric("original_price", { precision: 10, scale: 2 }).notNull(),
  couponCode: varchar("coupon_code", { length: 50 }),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  status: orderStatusEnum("status").default("pending").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("aba-khqr").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(),
  paymentTransactionId: varchar("payment_transaction_id", { length: 255 }),
  credentials: jsonb("credentials").default({}).notNull(), // URL, Username, or Account fields
  deliveryData: jsonb("delivery_data"), // Account details / delivery secret
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
