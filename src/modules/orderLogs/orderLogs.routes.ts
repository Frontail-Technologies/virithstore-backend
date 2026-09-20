import { Elysia } from "elysia";
import { db } from "../../db/client";
import { orderLogs } from "../../db/schema";
import { desc, eq, and } from "drizzle-orm";
import { ok } from "../../shared/response";
import { requireAdminPlugin } from "../../middleware/admin.middleware";

export const orderLogsRoutes = new Elysia({ prefix: "/order-logs" })
  .use(requireAdminPlugin)
  .get("/admin", async ({ query }) => {
    let conditions = [];
    if (query.status && query.status !== "all") {
      conditions.push(eq(orderLogs.status, query.status as string));
    }
    if (query.provider && query.provider !== "all") {
      conditions.push(eq(orderLogs.provider, query.provider as string));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const list = await db
      .select()
      .from(orderLogs)
      .where(whereClause as any)
      .orderBy(desc(orderLogs.createdAt))
      .limit(100);

    return ok(list);
  });
