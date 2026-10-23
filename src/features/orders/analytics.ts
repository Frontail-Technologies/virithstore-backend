import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orders } from "../../db/schema/orders";
import { products } from "../../db/schema/products";
import { users } from "../../db/schema/users";

/** Dashboard numbers: totals, income, weekly/monthly sales, status mix and top products. */
export async function getOrderAnalytics() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const earned = sql`(${orders.status} = 'completed' or ${orders.paymentStatus} = 'paid')`;
  const day = sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`;
  const month = sql`to_char(${orders.createdAt}, 'YYYY-MM')`;

  const [
    [{ orderCount }],
    [{ productCount }],
    [{ userCount }],
    [{ todaysOrders }],
    [income],
    weeklySales,
    monthlySales,
    orderStatusCounts,
    topProducts,
  ] = await Promise.all([
    db.select({ orderCount: sql<number>`count(*)::int` }).from(orders),
    db.select({ productCount: sql<number>`count(*)::int` }).from(products).where(eq(products.isAvailable, true)),
    db.select({ userCount: sql<number>`count(*)::int` }).from(users),
    db.select({ todaysOrders: sql<number>`count(*)::int` }).from(orders).where(gte(orders.createdAt, todayStart)),
    db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${orders.price}::numeric) filter (where ${earned}), 0)::float`,
        todaysIncome: sql<number>`coalesce(sum(${orders.price}::numeric) filter (where ${earned} and ${orders.createdAt} >= ${todayStart.toISOString()}), 0)::float`,
        monthlyIncome: sql<number>`coalesce(sum(${orders.price}::numeric) filter (where ${earned} and ${orders.createdAt} >= ${monthStart.toISOString()} and ${orders.createdAt} < ${nextMonthStart.toISOString()}), 0)::float`,
      })
      .from(orders),
    db
      .select({
        _id: sql<string>`${day}`,
        total: sql<number>`coalesce(sum(${orders.price}::numeric), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(gte(orders.createdAt, oneWeekAgo), lt(orders.createdAt, now)))
      .groupBy(day)
      .orderBy(day),
    db
      .select({
        _id: sql<string>`${month}`,
        total: sql<number>`coalesce(sum(${orders.price}::numeric), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(gte(orders.createdAt, sixMonthsAgo), lt(orders.createdAt, now)))
      .groupBy(month)
      .orderBy(month),
    db.select({ _id: orders.status, count: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    db
      .select({
        _id: orders.productId,
        totalSales: sql<number>`coalesce(sum(${orders.price}::numeric), 0)::float`,
        count: sql<number>`count(*)::int`,
        productDetails: sql<{ name: string; price: string }>`json_build_object('name', coalesce(max(${orders.productName}), 'Product'), 'price', coalesce(max(${orders.price}), '0'))`,
      })
      .from(orders)
      .groupBy(orders.productId)
      .orderBy(desc(sql`sum(${orders.price}::numeric)`))
      .limit(5),
  ]);

  return {
    orders: orderCount,
    todaysOrders,
    products: productCount,
    customers: userCount,
    revenue: income?.totalRevenue || 0,
    todaysIncome: income?.todaysIncome || 0,
    monthlyIncome: income?.monthlyIncome || 0,
    weeklySales,
    monthlySales,
    orderStatusCounts,
    topProducts,
  };
}
