import { Elysia } from "elysia";
import { db } from "../../db/client";
import { orderLogs } from "../../db/schema";
import { desc, eq, and, ilike, or, sql } from "drizzle-orm";
import { ok } from "../../shared/response";
import { requireAdminPlugin } from "../../middleware/admin.middleware";

export const orderLogsRoutes = new Elysia({ prefix: "/order-logs" })
  .use(requireAdminPlugin)
  .get("/admin", async ({ query }) => {
    const page = Math.max(1, query.page ? Number(query.page) : 1);
    const limit = Math.min(100, Math.max(1, query.limit ? Number(query.limit) : 25));
    const conditions = [];
    if (query.status && query.status !== "all") {
      conditions.push(eq(orderLogs.status, query.status as string));
    }
    if (query.provider && query.provider !== "all") {
      conditions.push(eq(orderLogs.provider, query.provider as string));
    }
    if (query.search) {
      conditions.push(or(ilike(orderLogs.transactionId, `%${query.search}%`), ilike(orderLogs.errorMessage, `%${query.search}%`))!);
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const list = await db
      .select()
      .from(orderLogs)
      .where(whereClause as any)
      .orderBy(desc(orderLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(orderLogs).where(whereClause as any);
    return ok(list, "Order logs fetched", { page, limit, total: count, totalPages: Math.ceil(count / limit) });
  });
