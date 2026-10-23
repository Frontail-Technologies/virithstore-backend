import { Elysia, t } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { ok } from "../../libs/response";
import { unwrapPaywayWebhook } from "../../libs/payway";
import { assertOrderAccess } from "../orders/access";
import { getOrder } from "../orders/queries";
import { createPaywayTransaction, handlePaywayWebhook } from "./service";

export const paymentFeature = new Elysia({ prefix: "/payment", name: "feature.payment", tags: ["Payment"] })
  .use(authPlugin)
  .post(
    "/payway/create-transaction",
    async ({ body, user, request }) => {
      const order = await getOrder(body.orderId);
      const checkoutToken = request.headers.get("x-checkout-token") || undefined;
      assertOrderAccess(order, user?.id, checkoutToken);
      return ok(await createPaywayTransaction(order, checkoutToken), "PayWay transaction generated");
    },
    { optionalUser: true, body: t.Object({ orderId: t.String({ minLength: 1 }) }) },
  )
  // PayWay posts the result base64-encoded in a `response` field (form-urlencoded or JSON); it is unwrapped,
  // then confirmed against PayWay's own API before anything is fulfilled.
  .post("/webhook/abapayway", async ({ body }) => ok(await handlePaywayWebhook(unwrapPaywayWebhook(body))));
