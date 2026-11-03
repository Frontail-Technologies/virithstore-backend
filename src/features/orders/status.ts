import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { orders, type Order } from "../../db/schema/orders";
import { badRequest, notFound } from "../../libs/http-error";
import { recordOrderLog } from "../order-logs/log";
import { processOrderReferral } from "../referrals/service";
import { releaseUnpaidOrder } from "./fulfil";
import { findHeldAccount, releaseHolds, sellAccount } from "./inventory";
import { syncOrderNotification } from "./notify";
import type { UpdateOrderStatus } from "./model";

type ReservedDelivery = { reservedAccountId?: string } | null;
export type OrderActionResult = { order: Order; changed: boolean; message?: string };

const CLOSED = ["completed", "cancelled", "failed"];

/** Real delivered account details, as opposed to the internal `{ reservedAccountId }` placeholder. */
export function hasDeliveredCredentials(data: unknown): boolean {
  const value = data as Record<string, unknown> | null;
  return Boolean(value && typeof value === "object" && typeof value.email === "string" && value.email.trim());
}

async function rewardOnCompletion(order: Order) {
  try {
    await processOrderReferral(order);
  } catch (error) {
    console.error("Referral reward error on order completion:", error);
  }
}

/**
 * Cancels or fails an order on an admin's behalf (dashboard or Telegram).
 * - Unpaid: the held account and coupon go back to stock.
 * - Paid: the order closes and is flagged for a manual refund. A delivered account is not put back on sale.
 */
export async function closeOrderByAdmin(
  id: string,
  status: "cancelled" | "failed",
  performedBy: string,
  reason?: string,
): Promise<OrderActionResult> {
  const note = reason?.trim() || `Closed by ${performedBy}`;
  const released = await releaseUnpaidOrder(id, note, status, performedBy);
  if (!released.order) throw notFound("Order not found");
  if (released.changed) {
    await syncOrderNotification(released.order);
    return { order: released.order, changed: true };
  }

  const result = await db.transaction(async (tx): Promise<OrderActionResult> => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update").limit(1);
    if (!order) throw notFound("Order not found");
    if (order.status === "cancelled" || order.status === "failed") return { order, changed: false };

    // Paid. Any account still held but not delivered (should not happen) goes back to stock.
    await releaseHolds(tx, id);
    const [closed] = await tx
      .update(orders)
      .set({ status, refundRequired: true, notes: `Refund required (manual). ${note}`, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    await recordOrderLog({ orderId: id, action: "REFUND_REQUIRED", performedBy, details: { status, amount: order.price } }, tx);
    return { order: closed, changed: true };
  });
  await syncOrderNotification(result.order);
  return result;
}

/**
 * Completes an order on an admin's behalf.
 * Account orders need credentials: the ones given here, ones saved earlier, or the account the order still holds.
 */
export async function completeOrderByAdmin(
  id: string,
  options: { deliveryData?: Record<string, unknown>; requirePaid: boolean },
  performedBy: string,
): Promise<OrderActionResult> {
  const result = await db.transaction(async (tx): Promise<OrderActionResult> => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update").limit(1);
    if (!order) throw notFound("Order not found");
    if (CLOSED.includes(order.status)) return { order, changed: false };
    if (options.requirePaid && order.paymentStatus !== "paid") {
      return { order, changed: false, message: "Payment is not confirmed for this order." };
    }

    let deliveryData = order.deliveryData;
    if (order.productType === "account") {
      if (hasDeliveredCredentials(options.deliveryData)) {
        deliveryData = options.deliveryData!;
        await releaseHolds(tx, id);
      } else if (!hasDeliveredCredentials(order.deliveryData)) {
        const held = await findHeldAccount(tx, (order.deliveryData as ReservedDelivery)?.reservedAccountId, id);
        if (!held) {
          return { order, changed: false, message: "Add the account credentials in the dashboard first, then press Complete." };
        }
        await sellAccount(tx, held.id);
        deliveryData = { email: held.email, password: held.password, additionalInfo: held.additionalInfo };
      }
    } else if (options.deliveryData) {
      deliveryData = options.deliveryData;
    }

    const now = new Date();
    const [completed] = await tx
      .update(orders)
      .set({ status: "completed", deliveryData, fulfilledAt: now, updatedAt: now })
      .where(eq(orders.id, id))
      .returning();
    await recordOrderLog({ orderId: id, action: "ORDER_COMPLETED_BY_ADMIN", performedBy, details: { paymentStatus: order.paymentStatus } }, tx);
    return { order: completed, changed: true };
  });

  if (result.changed) {
    await rewardOnCompletion(result.order);
    await syncOrderNotification(result.order);
  }
  return result;
}

/** Dashboard status change. Closing and completing go through the same stock-safe paths as the Telegram bot. */
export async function updateOrderStatus(id: string, { status, deliveryData, reason }: UpdateOrderStatus, performedBy: string) {
  if (status === "cancelled" || status === "failed") return (await closeOrderByAdmin(id, status, performedBy, reason)).order;
  if (status === "completed") {
    const result = await completeOrderByAdmin(id, { deliveryData, requirePaid: false }, performedBy);
    // Saving new credentials on an already completed order is still allowed.
    if (!result.changed && result.order.status === "completed" && deliveryData) {
      const [updated] = await db.update(orders).set({ deliveryData, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
      return updated;
    }
    if (!result.changed) throw badRequest(result.message ?? `Order is already ${result.order.status}`);
    return result.order;
  }

  // A closed unpaid order has given its stock back, so it cannot be reopened.
  const [current] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, id)).limit(1);
  if (!current) throw notFound("Order not found");
  if (current.status === "cancelled" || current.status === "failed") throw badRequest(`Order is already ${current.status}`);
  const [updated] = await db
    .update(orders)
    .set({ status, deliveryData: deliveryData ?? undefined, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  await recordOrderLog({ orderId: id, action: `STATUS_UPDATED_${status.toUpperCase()}`, performedBy, details: { status } });
  return updated;
}
