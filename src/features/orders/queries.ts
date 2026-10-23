import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orders } from "../../db/schema/orders";
import { notFound } from "../../libs/http-error";
import { isUuid } from "../../libs/ids";
import { parsePage, toPageMeta } from "../../libs/pagination";
import { toLiveFeedItem } from "./mappers";
import type { OrdersQuery } from "./model";

export async function getOrder(id: string) {
  if (!isUuid(id)) throw notFound("Order not found");
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw notFound("Order not found");
  return order;
}

export async function getOrderByNumber(orderNumber: string) {
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order) throw notFound("Order not found");
  return order;
}

export const listUserOrders = (userId: string) =>
  db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(200);

/** Admin list with status/payment filters and a free-text search over order number, email and product. */
export async function listOrders(query: OrdersQuery) {
  const { page, limit, offset } = parsePage(query, { defaultLimit: 25 });
  const conditions = [];
  if (query.status) conditions.push(eq(orders.status, query.status));
  if (query.paymentStatus) conditions.push(eq(orders.paymentStatus, query.paymentStatus));
  if (query.search) {
    const pattern = `%${query.search}%`;
    conditions.push(or(ilike(orders.orderNumber, pattern), ilike(orders.userEmail, pattern), ilike(orders.productName, pattern))!);
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [items, [{ count }]] = await Promise.all([
    db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where),
  ]);
  return { items, meta: toPageMeta(count, page, limit) };
}

/** Recent orders with masked ids for the storefront "live purchases" ticker. */
export async function getLiveFeed(limit = 25) {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      productName: orders.productName,
      packageName: orders.packageName,
      price: orders.price,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  return rows.map(toLiveFeedItem);
}
