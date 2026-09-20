import { Elysia, t } from "elysia";
import { PaymentService } from "./payment.service";
import { ok } from "../../shared/response";

export const paymentRoutes = new Elysia({ prefix: "/payment" })
  // Create PayWay checkout session & hash
  .post(
    "/payway/create-transaction",
    async ({ body }) => {
      const result = await PaymentService.createPaywayTransaction((body as any).orderId);
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
  })

  // Check transaction status from PayWay gateway
  .get("/payway/check-transaction/:tranId", async ({ params }) => {
    const result = await PaymentService.checkTransaction(params.tranId);
    return ok(result);
  });
