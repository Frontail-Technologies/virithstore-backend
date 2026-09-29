import { Elysia, t } from "elysia";
import { PaymentService } from "./payment.service";
import { ok } from "../../shared/response";
import { authPlugin } from "../../middleware/auth.middleware";
import { OrdersService } from "../orders/orders.service";
import { assertOrderAccess } from "../orders/checkout-access";

export const paymentRoutes = new Elysia({ prefix: "/payment" })
  .use(authPlugin)
  // Create PayWay checkout session & hash
  .post(
    "/payway/create-transaction",
    async ({ body, user, request }) => {
      const input = body as { orderId: string };
      const order = await OrdersService.getById(input.orderId);
      const checkoutToken = request.headers.get("x-checkout-token") || undefined;
      assertOrderAccess(order, user?.id, checkoutToken);
      const result = await PaymentService.createPaywayTransaction(order.id, checkoutToken);
      return ok(result, "PayWay transaction generated");
    },
    {
      body: t.Object({
        orderId: t.String(),
      }),
    }
  )

  // Webhook listener for ABA PayWay push notifications. ABA posts the actual result
  // base64-encoded inside a `response` field (form-urlencoded or JSON) rather than as
  // top-level fields, so it has to be unwrapped before handing it to the service.
  .post("/webhook/abapayway", async ({ body }) => {
    const raw = body as any;
    let payload = raw;

    if (raw?.response) {
      try {
        payload = JSON.parse(Buffer.from(raw.response, "base64").toString("utf-8"));
      } catch {
        payload = raw;
      }
    }

    const result = await PaymentService.handleWebhook(payload);
    return ok(result);
  });
