import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { assertOrderAccess } from "./access";
import { getOrderAnalytics } from "./analytics";
import { createOrder } from "./create";
import { toOrderStatusDto, toPublicOrderStatusDto } from "./mappers";
import { CreateOrder, OrderNumberParam, OrdersQuery, UpdateOrderStatus } from "./model";
import { getLiveFeed, getOrder, getOrderByNumber, listOrders, listUserOrders } from "./queries";
import { updateOrderStatus } from "./status";

const CHECKOUT_TOKEN_HEADER = "x-checkout-token";

/** Admin order lists keep the `{ orders, total, totalPages }` shape the dashboard reads. */
async function listOrdersForDashboard(query: OrdersQuery) {
  const { items, meta } = await listOrders(query);
  return { orders: items, total: meta.total, totalPages: meta.totalPages || 1 };
}

export const ordersFeature = new Elysia({ prefix: "/orders", name: "feature.orders", tags: ["Orders"] })
  .use(authPlugin)
  // Public / guest-or-user checkout
  .post(
    "/",
    async ({ body, user }) => {
      const order = await createOrder({ ...body, userId: user?.id, userEmail: user?.email || body.userEmail });
      return created(order, "Order created successfully");
    },
    { optionalUser: true, body: CreateOrder },
  )
  .get("/number/:orderNumber", async ({ params }) => ok(toPublicOrderStatusDto(await getOrderByNumber(params.orderNumber))), {
    params: OrderNumberParam,
  })
  .get("/live", async () => ok(await getLiveFeed()))
  // Buyer
  .get("/my-orders", async ({ user }) => ok(await listUserOrders(user.id)), { auth: true })
  // Admin
  .get("/query", async ({ query }) => ok(await listOrdersForDashboard(query)), { admin: true, query: OrdersQuery })
  .get("/admin/analytics", async () => ok(await getOrderAnalytics()), { admin: true })
  .get(
    "/admin/all",
    async ({ query }) => {
      const { items, meta } = await listOrders(query);
      return ok(items, "Orders fetched", meta);
    },
    { admin: true, query: OrdersQuery },
  )
  .get("/admin", async ({ query }) => ok(query.id ? await getOrder(query.id) : await listOrdersForDashboard(query)), {
    admin: true,
    query: OrdersQuery,
  })
  .get("/admin/:id", async ({ params }) => ok(await getOrder(params.id)), { admin: true, params: IdParam })
  .put(
    "/admin/:id/status",
    async ({ params, body, user: admin }) =>
      ok(await updateOrderStatus(params.id, body, admin.email || admin.name || admin.id), "Order status updated"),
    { admin: true, params: IdParam, body: UpdateOrderStatus },
  )
  // Order owner or guest-token holder
  .get(
    "/:id/payment-status",
    async ({ params, user, request }) => {
      const order = await getOrder(params.id);
      assertOrderAccess(order, user?.id, request.headers.get(CHECKOUT_TOKEN_HEADER) || undefined);
      return ok({ orderId: order.id, status: order.status, paymentStatus: order.paymentStatus, updatedAt: order.updatedAt });
    },
    { optionalUser: true, params: IdParam },
  )
  .get(
    "/:id",
    async ({ params, user, request }) => {
      const order = await getOrder(params.id);
      assertOrderAccess(order, user?.id, request.headers.get(CHECKOUT_TOKEN_HEADER) || undefined);
      return ok(toOrderStatusDto(order));
    },
    { optionalUser: true, params: IdParam },
  );
