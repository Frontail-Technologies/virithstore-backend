import crypto from "crypto";
import { db } from "../../db/client";
import { orders } from "../../db/schema/orders";
import { orderLogs } from "../../db/schema/orderLogs";
import { eq } from "drizzle-orm";
import { env } from "../../config/env";
import { AppError, NotFoundError } from "../../shared/errors";
import { OrdersService } from "../orders/orders.service";

export class PaymentService {
  /**
   * Generates ABA PayWay KHQR / PayWay transaction checkout parameters and HMAC SHA-512 hash
   */
  static async createPaywayTransaction(orderId: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.paymentStatus === "paid") {
      throw new AppError("Order is already paid", 400);
    }

    const merchant_id = env.PAYWAY_MERCHANT_KEY;
    const secret_key = env.PAYWAY_PUBLIC_KEY;
    const req_time = Math.floor(Date.now() / 1000).toString();
    const tran_id = `TXN${req_time}${Math.floor(100 + Math.random() * 900)}`;

    const amount = parseFloat(order.price).toFixed(2);
    // ABA POSTs the async payment result to this URL (server-to-server, not a browser
    // redirect) — it must point at a real endpoint that can process the callback.
    const return_url = Buffer.from(`${env.NEXT_PUBLIC_BASE_URL}/api/payment/webhook/abapayway`).toString("base64");
    const continue_success_url = `${env.NEXT_PUBLIC_BASE_URL}/success?transactionId=${tran_id}&orderId=${order.id}&amount=${amount}`;
    const cancel_url = `${env.NEXT_PUBLIC_BASE_URL}/failed?orderId=${order.id}`;

    // PayWay exact parameter sequence for HMAC SHA512
    const params = {
      req_time,
      merchant_id,
      tran_id,
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
      return_url,
      cancel_url,
      continue_success_url,
      return_deeplink: "",
      currency: "USD",
      custom_fields: "",
      return_params: "",
      payout: "",
      skip_success_page: "1",
      lifetime: "",
      additional_params: "",
      google_pay_token: "",
    };

    const hashString = Object.values(params).join("");
    const hash = crypto
      .createHmac("sha512", secret_key)
      .update(hashString)
      .digest("base64");

    // Save transaction ID on order
    await db
      .update(orders)
      .set({
        paymentTransactionId: tran_id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    return {
      ...params,
      hash,
      paymentUrl: env.PAYWAY_API_URL,
    };
  }

  /**
   * Processes PayWay's async payment webhook. The `status`/`apv` fields in the posted
   * payload are never trusted on their own — ABA's check-transaction API is always
   * called to independently confirm the payment before any order is fulfilled, since a
   * malicious client could otherwise POST a fake "approved" webhook directly.
   */
  static async handleWebhook(payload: Record<string, any>) {
    const { tran_id } = payload;

    if (!tran_id) {
      throw new AppError("Invalid webhook payload: Missing tran_id", 400);
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.paymentTransactionId, tran_id))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order with transaction ID not found");
    }

    if (order.paymentStatus === "paid") {
      return { success: true, message: "Already processed" };
    }

    // Bakong/cross-bank transactions can take a few seconds to settle on ABA's side.
    // Retry briefly if the check comes back PENDING or the request itself fails.
    let check = await this.checkTransaction(tran_id);
    let attempts = 0;
    while ((!check || check.data?.payment_status === "PENDING") && attempts < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      check = await this.checkTransaction(tran_id);
      attempts++;
    }

    const isApproved = !!check && check.status?.code !== 6 && check.data?.payment_status === "APPROVED";

    if (isApproved) {
      const fulfilled = await OrdersService.fulfillOrder(order.id);

      await db.insert(orderLogs).values({
        orderId: order.id,
        action: "PAYWAY_PAYMENT_SUCCESS",
        performedBy: "PayWay Webhook",
        details: { tran_id, check },
      });

      return { success: true, message: "Payment verified successfully", order: fulfilled };
    }

    await db
      .update(orders)
      .set({
        paymentStatus: "failed",
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await db.insert(orderLogs).values({
      orderId: order.id,
      action: "PAYWAY_PAYMENT_FAILED",
      performedBy: "PayWay Webhook",
      details: { tran_id, check },
    });

    return { success: false, message: "Payment could not be verified as approved" };
  }

  /**
   * Check transaction status with ABA PayWay API
   */
  static async checkTransaction(tran_id: string) {
    const merchant_id = env.PAYWAY_MERCHANT_KEY;
    const secret_key = env.PAYWAY_PUBLIC_KEY;
    const req_time = Math.floor(Date.now() / 1000).toString();

    const hashString = `${req_time}${merchant_id}${tran_id}`;
    const hash = crypto
      .createHmac("sha512", secret_key)
      .update(hashString)
      .digest("base64");

    const checkUrl = "https://checkout.payway.com.kh/api/payment-gateway/v1/payments/check-transaction";

    try {
      const response = await fetch(checkUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          req_time,
          merchant_id,
          tran_id,
          hash,
        }),
      });

      return await response.json();
    } catch (err: any) {
      console.error("PayWay check-transaction request failed:", err.message);
      return null;
    }
  }
}
