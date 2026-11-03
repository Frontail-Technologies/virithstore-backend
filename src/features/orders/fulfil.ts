import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { couponReservations, coupons } from "../../db/schema/coupons";
import { orders } from "../../db/schema/orders";
import { products } from "../../db/schema/products";
import { notFound } from "../../libs/http-error";
import { recordOrderLog } from "../order-logs/log";
import { processOrderReferral } from "../referrals/service";
import { grantSpinCredit } from "../spin/service";
import { claimAccount, findHeldAccount, releaseHolds, sellAccount } from "./inventory";
import { notifyPaidOrder } from "./notify";

type Order = typeof orders.$inferSelect;
type ReservedDelivery = { reservedAccountId?: string } | null;

/**
 * Runs once payment is verified. Locks the order so a duplicate webhook can't fulfil it twice, hands over the
 * account held at checkout (digital services complete immediately) and redeems the coupon reservation.
 * Safe to call repeatedly: later calls return the already-fulfilled order untouched.
 *
 * Verified money always wins: an order that was cancelled or expired before the payment landed is still marked
 * paid. If its account is gone it waits for an admin, who is alerted on Telegram.
 */
export async function fulfillOrder(orderId: string): Promise<Order> {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw notFound("Order not found");
    if (order.paymentStatus === "paid") return { order, newlyPaid: false };
    const revived = ["cancelled", "failed"].includes(order.status);

    let deliveryData = order.deliveryData;
    let status: "completed" | "pending" | "processing" = "completed";

    if (order.productType === "digital-service" && order.productId) {
      const [product] = await tx
        .select({ isAutoDelivery: products.isAutoDelivery })
        .from(products)
        .where(eq(products.id, order.productId))
        .limit(1);
      if (product?.isAutoDelivery === false) status = "processing";
    }

    if (order.productType === "account") {
      // Only the account this order still holds. If the hold was taken over by another checkout, use any free one.
      const heldId = (order.deliveryData as ReservedDelivery)?.reservedAccountId;
      const account = (await findHeldAccount(tx, heldId, order.id))
        ?? (order.productId ? await claimAccount(tx, order.productId, order.packageId, order.id) : null);

      if (!account) {
        // Paid but nothing left to deliver: stays pending, and the admin gets a "needs account" alert.
        status = "pending";
        deliveryData = null;
      } else {
        await sellAccount(tx, account.id);
        deliveryData = { email: account.email, password: account.password, additionalInfo: account.additionalInfo };
      }
    }

    const paidAt = new Date();
    if (order.couponCode && !order.couponRedeemedAt) {
      const [reservation] = await tx
        .select()
        .from(couponReservations)
        .where(and(eq(couponReservations.orderId, order.id), eq(couponReservations.status, "reserved")))
        .limit(1);
      if (reservation) {
        const [coupon] = await tx.select().from(coupons).where(eq(coupons.id, reservation.couponId)).for("update").limit(1);
        // Capacity was checked at checkout. The buyer has paid the discounted price, so never undo the payment here.
        if (coupon) {
          await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: paidAt }).where(eq(coupons.id, coupon.id));
        }
        await tx
          .update(couponReservations)
          .set({ status: "redeemed", redeemedAt: paidAt })
          .where(eq(couponReservations.id, reservation.id));
      }
    }

    const [fulfilled] = await tx
      .update(orders)
      .set({
        paymentStatus: "paid",
        status,
        deliveryData,
        couponRedeemedAt: order.couponCode ? paidAt : null,
        fulfilledAt: status === "completed" ? paidAt : null,
        notes: revived ? "Payment arrived after the order was closed" : order.notes,
        updatedAt: paidAt,
      })
      .where(eq(orders.id, order.id))
      .returning();
    return { order: fulfilled, newlyPaid: true };
  });

  if (!result.newlyPaid) return result.order;

  const { order } = result;
  await Promise.all([
    recordOrderLog({
      orderId,
      action: order.status === "completed"
        ? "ORDER_FULFILLED"
        : order.status === "processing"
          ? "MANUAL_FULFILMENT_QUEUED"
          : "ACCOUNT_DELIVERY_PENDING",
      performedBy: "Payment verification",
      details: { status: order.status },
    }),
    grantRewards(order),
  ]);

  return (await notifyPaidOrder(order)) ?? order;
}

/** Spin credit and referral commission: failures are logged, never allowed to undo a paid order. */
async function grantRewards(order: Order) {
  if (!order.userId) return;
  try {
    const [product] = order.productId
      ? await db.select({ spinActive: products.spinActive, spinCostIds: products.spinCostIds }).from(products).where(eq(products.id, order.productId)).limit(1)
      : [];
    if (product?.spinActive && product.spinCostIds.includes(order.packageId)) {
      await grantSpinCredit(order.userId, order.id);
    }
    await processOrderReferral(order);
  } catch (error) {
    console.error("Reward error on fulfilment:", error);
  }
}

/**
 * Closes an unpaid order and gives its held account and coupon capacity back. Paid orders are never touched here.
 * Returns `changed: false` when the order was already paid or closed.
 */
export async function releaseUnpaidOrder(
  orderId: string,
  reason: string,
  finalStatus: "failed" | "cancelled",
  performedBy: string,
): Promise<{ order: Order | null; changed: boolean }> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) return { order: null, changed: false };
    if (order.paymentStatus === "paid" || ["cancelled", "failed"].includes(order.status)) return { order, changed: false };

    await releaseHolds(tx, orderId);
    await tx
      .update(couponReservations)
      .set({ status: "released" })
      .where(and(eq(couponReservations.orderId, orderId), eq(couponReservations.status, "reserved")));

    const [closed] = await tx
      .update(orders)
      .set({ paymentStatus: "failed", status: finalStatus, notes: reason, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    await recordOrderLog({
      orderId,
      action: finalStatus === "cancelled" ? "UNPAID_ORDER_CANCELLED" : "UNPAID_ORDER_FAILED",
      performedBy,
      details: { reason },
    }, tx);
    return { order: closed, changed: true };
  });
}

/** Payment was declined: closes the order and releases its account and coupon capacity. */
export async function failOrder(orderId: string, reason: string) {
  return (await releaseUnpaidOrder(orderId, reason, "failed", "PayWay")).order;
}

/**
 * The buyer closed the payment popup. The account goes back to stock straight away, but the order stays payable:
 * the QR may already be scanned. If that payment lands, fulfilment takes any free account. The expiry sweeper
 * closes the order once the payment window is over.
 */
export async function releaseOrderHold(orderId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order || order.paymentStatus !== "pending" || order.status !== "pending") return order ?? null;
    await releaseHolds(tx, orderId);
    await recordOrderLog({ orderId, action: "CHECKOUT_ABANDONED", performedBy: "Buyer", details: {} }, tx);
    return order;
  });
}
