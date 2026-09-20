import { Elysia, t } from "elysia";
import { OrdersService } from "./orders.service";
import { ok, created } from "../../shared/response";
import { authPlugin, requireAuthPlugin } from "../../middleware/auth.middleware";
import { requireAdminPlugin } from "../../middleware/admin.middleware";

export const ordersRoutes = new Elysia({ prefix: "/orders" })
  .use(authPlugin)
  .post(
    "/",
    async ({ body, user }) => {
      const order = await OrdersService.createOrder({
        ...(body as any),
        userId: user?.id,
        userEmail: user?.email || (body as any).userEmail,
      });
      return created(order, "Order created successfully");
    }
  )
  .get("/number/:orderNumber", async ({ params }) => {
    const order = await OrdersService.getByOrderNumber(params.orderNumber);
    return ok(order);
  })
  .get("/live", async () => {
    const feed = await OrdersService.getLiveFeed();
    return ok(feed);
  })
  .use(requireAuthPlugin)
  .get("/my-orders", async ({ user }) => {
    const list = await OrdersService.getUserOrders(user.id);
    return ok(list);
  })
  .get("/query", async ({ query }) => {
    const result = await OrdersService.getAllOrders({
      status: query.status as any,
      paymentStatus: query.paymentStatus as any,
      search: query.search as any,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 200,
    });
    return ok({ orders: result.items, total: result.meta?.total || result.items.length, totalPages: result.meta?.totalPages || 1 });
  })
  // Admin order management
  .use(requireAdminPlugin)
  .get("/admin/analytics", async () => {
    const data = await OrdersService.getAnalytics();
    return ok(data);
  })
  .get("/admin", async ({ query }) => {
    if (query?.id) {
      const order = await OrdersService.getById(query.id as string);
      return ok(order);
    }
    const result = await OrdersService.getAllOrders({
      status: query.status as any,
      paymentStatus: query.paymentStatus as any,
      search: query.search as any,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 200,
    });
    return ok({ orders: result.items, total: result.meta?.total || result.items.length, totalPages: result.meta?.totalPages || 1 });
  })
  .get("/admin/all", async ({ query }) => {
    const result = await OrdersService.getAllOrders({
      status: query.status as any,
      paymentStatus: query.paymentStatus as any,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 200,
    });
    return ok(result.items, "Orders fetched", result.meta);
  })
  .get("/admin/:id", async ({ params }) => {
    const order = await OrdersService.getById(params.id);
    return ok(order);
  })
  .put("/admin/:id/status", async ({ params, body, adminUser }) => {
    const updated = await OrdersService.updateStatus(
      params.id,
      (body as any).status,
      adminUser.email || adminUser.name || adminUser.id,
      (body as any).deliveryData
    );
    return ok(updated, "Order status updated");
  });
