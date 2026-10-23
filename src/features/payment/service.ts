import { eq } from "drizzle-orm";
import { env } from "../../config/env";
import { db } from "../../db/client";
import { orders, type Order } from "../../db/schema/orders";
import { badRequest, conflict, notFound } from "../../libs/http-error";
import { generateTransactionId } from "../../libs/ids";
import { formatMoney, parseMoney } from "../../libs/money";
import { checkPaywayTransaction, paywayHash, paywayVerdict } from "../../libs/payway";
import { recordOrderLog } from "../order-logs/log";
import { failOrder, fulfillOrder } from "../orders/fulfil";

// Cross-bank (Bakong) payments can take a few seconds to settle on PayWay's side.
const RECHECK_DELAYS_MS = [2_000, 5_000, 15_000];

/** Builds the PayWay KHQR checkout form (with its HMAC) for a payable order and stores the transaction id. */
export async function createPaywayTransaction(order: Order, checkoutToken?: string) {
  if (order.paymentStatus === "paid" || order.fulfilledAt) throw badRequest("Order is already paid");
  if (order.paymentMethod !== "aba-khqr" || ["cancelled", "failed", "completed"].includes(order.status)) {
    throw conflict("Order is not payable through PayWay");
  }

  const reqTime = Math.floor(Date.now() / 1000).toString();
  const tranId = generateTransactionId(reqTime);
  const amount = formatMoney(parseMoney(order.price));
  const tokenParam = checkoutToken ? `&checkoutToken=${encodeURIComponent(checkoutToken)}` : "";

  // Field order matters: PayWay verifies the hash over the values in exactly this sequence.
  const params = {
    req_time: reqTime,
    merchant_id: env.PAYWAY_MERCHANT_KEY,
    tran_id: tranId,
    amount,
    items: "",
    shipping: "0",
    ctid: "",
    pwt: "",
    firstname: "",
    lastname: "",
    email: order.userEmail || "",
    phone: "",
    type: "purchase",
    payment_option: "abapay_khqr",
    // PayWay POSTs the async result here (server to server), so it must be a real webhook endpoint.
    return_url: Buffer.from(`${env.FRONTEND_URL}/api/v1/payment/webhook/abapayway`).toString("base64"),
    cancel_url: `${env.FRONTEND_URL}/failed?orderId=${order.id}${tokenParam}`,
    continue_success_url: `${env.FRONTEND_URL}/success?transactionId=${tranId}&orderId=${order.id}&amount=${amount}${tokenParam}`,
    return_deeplink: "",
    currency: "USD",
    custom_fields: "",
    return_params: "",
    payout: "",
    lifetime: "",
    additional_params: "",
    google_pay_token: "",
  };

  await db.update(orders).set({ paymentTransactionId: tranId, updatedAt: new Date() }).where(eq(orders.id, order.id));

  return {
    api_url: env.PAYWAY_API_URL,
    form_data: {
      ...params,
      // These select PayWay's HTML checkout widget for merchants that also have QR API access.
      // PayWay explicitly excludes both fields from the HMAC input.
      view_type: "popup",
      payment_gate: "0",
      hash: paywayHash(Object.values(params).join("")),
    },
  };
}

type WebhookOutcome = "fulfilled" | "failed" | "pending";

/** Asks PayWay for the truth and settles the order accordingly. The webhook body itself is never trusted. */
async function verifyAndSettle(order: Order, tranId: string): Promise<WebhookOutcome> {
  const check = await checkPaywayTransaction(tranId);
  const verdict = paywayVerdict(check);

  if (verdict === "approved") {
    await fulfillOrder(order.id);
    await recordOrderLog({ orderId: order.id, action: "PAYWAY_PAYMENT_SUCCESS", performedBy: "PayWay Webhook", details: { tranId, check } });
    return "fulfilled";
  }
  if (verdict === "declined") {
    await failOrder(order.id, "PayWay payment was declined or cancelled");
    await recordOrderLog({ orderId: order.id, action: "PAYWAY_PAYMENT_FAILED", performedBy: "PayWay Webhook", details: { tranId, check } });
    return "failed";
  }
  return "pending";
}

/** Re-checks a still-pending payment a few times in the background, without holding the webhook request open. */
function scheduleRechecks(order: Order, tranId: string) {
  const attempt = (index: number) => {
    if (index >= RECHECK_DELAYS_MS.length) return;
    setTimeout(async () => {
      try {
        const [current] = await db.select({ paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, order.id)).limit(1);
        if (current?.paymentStatus === "paid") return;
        if ((await verifyAndSettle(order, tranId)) === "pending") attempt(index + 1);
      } catch (error) {
        console.error("PayWay recheck failed:", error);
      }
    }, RECHECK_DELAYS_MS[index]);
  };
  attempt(0);
}

/**
 * Handles PayWay's push notification. Responds after one verification round trip; payments that are still
 * settling are re-checked in the background instead of keeping the webhook open or being marked failed.
 */
export async function handlePaywayWebhook(payload: Record<string, unknown>) {
  const tranId = typeof payload.tran_id === "string" ? payload.tran_id : "";
  if (!tranId) throw badRequest("Invalid webhook payload: Missing tran_id");

  const [order] = await db.select().from(orders).where(eq(orders.paymentTransactionId, tranId)).limit(1);
  if (!order) throw notFound("Order with transaction ID not found");
  if (order.paymentStatus === "paid") return { success: true, message: "Already processed" };

  const outcome = await verifyAndSettle(order, tranId);
  if (outcome === "fulfilled") return { success: true, message: "Payment verified successfully" };
  if (outcome === "failed") return { success: false, message: "Payment could not be verified as approved" };

  scheduleRechecks(order, tranId);
  return { success: true, message: "Payment is still being verified" };
}
