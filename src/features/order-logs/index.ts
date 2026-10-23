import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { authPlugin } from "../../plugins/auth";
import { db } from "../../db/client";
import { orderLogs } from "../../db/schema/orderLogs";
import { ok } from "../../libs/response";
import { parsePage, toPageMeta } from "../../libs/pagination";

const OrderLogsQuery = t.Object({
  status: t.Optional(t.String()),
  provider: t.Optional(t.String()),
  search: t.Optional(t.String({ maxLength: 100 })),
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});

async function listOrderLogs(query: typeof OrderLogsQuery.static) {
  const { page, limit, offset } = parsePage(query, { defaultLimit: 25 });
  const conditions = [];
  if (query.status && query.status !== "all") conditions.push(eq(orderLogs.status, query.status));
  if (query.provider && query.provider !== "all") conditions.push(eq(orderLogs.provider, query.provider));
  if (query.search) {
    conditions.push(or(ilike(orderLogs.transactionId, `%${query.search}%`), ilike(orderLogs.errorMessage, `%${query.search}%`))!);
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [items, [{ count }]] = await Promise.all([
    db.select().from(orderLogs).where(where).orderBy(desc(orderLogs.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(orderLogs).where(where),
  ]);
  return { items, meta: toPageMeta(count, page, limit) };
}

export const orderLogsFeature = new Elysia({ prefix: "/order-logs", name: "feature.order-logs", tags: ["Orders"] })
  .use(authPlugin)
  .get(
    "/admin",
    async ({ query }) => {
      const result = await listOrderLogs(query);
      return ok(result.items, "Order logs fetched", result.meta);
    },
    { admin: true, query: OrderLogsQuery },
  );
