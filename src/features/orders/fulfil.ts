import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { accountsVault } from "../../db/schema/accountsVault";
import { couponReservations, coupons } from "../../db/schema/coupons";
import { orders } from "../../db/schema/orders";
import { products } from "../../db/schema/products";
import { conflict, notFound } from "../../libs/http-error";
import { recordOrderLog } from "../order-logs/log";
import { processOrderReferral } from "../referrals/service";
import { grantSpinCredit } from "../spin/service";

type Order = typeof orders.$inferSelect;
type ReservedDelivery = { reservedAccountId?: string } | null;

/**
 * Runs once payment is verified. Locks the order so a duplicate webhook can't fulfil it twice, hands over the
 * account reserved at checkout (digital services complete immediately) and redeems the coupon reservation.
 * Safe to call repeatedly: later calls return the already-fulfilled order untouched.
 */
export async function fulfillOrder(orderId: string): Promise<Order> {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw notFound("Order not found");
    if (order.fulfilledAt) return { order, newlyFulfilled: false };
    if (["cancelled", "failed"].includes(order.status)) throw conflict("Order is not payable");

    let deliveryData = order.deliveryData;
    let status: "completed" | "pending" = "completed";

    if (order.productType === "account") {
      const reservedAccountId = (order.deliveryData as ReservedDelivery)?.reservedAccountId;
      const [account] = reservedAccountId
        ? await tx
            .select()
            .from(accountsVault)
            .where(and(eq(accountsVault.id, reservedAccountId), eq(accountsVault.isActive, true), eq(accountsVault.isReserved, true)))
            .limit(1)
        : [];

      if (!account) {
        // Paid, but the reservation expired or was taken: stays pending for an admin to assign a replacement.
        status = "pending";
      } else {
        await tx
          .update(accountsVault)
          .set({ isActive: false, isReserved: false, reservedExpiry: null, updatedAt: new Date() })
          .where(and(eq(accountsVault.id, account.id), eq(accountsVault.isActive, true)));
        deliveryData = { email: account.email, password: account.password, additionalInfo: account.additionalInfo };
      }
    }

    const fulfilledAt = new Date();
    if (order.couponCode && !order.couponRedeemedAt) {
      const [reservation] = await tx
        .select()
        .from(couponReservations)
        .where(and(eq(couponReservations.orderId, order.id), eq(couponReservations.status, "reserved")))
        .limit(1);
      if (reservation) {
        const [coupon] = await tx.select().from(coupons).where(eq(coupons.id, reservation.couponId)).for("update").limit(1);
        if (!coupon || (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)) {
          throw conflict("Coupon capacity is no longer available");
        }
        await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: fulfilledAt }).where(eq(coupons.id, coupon.id));
        await tx
          .update(couponReservations)
          .set({ status: "redeemed", redeemedAt: fulfilledAt })
          .where(eq(couponReservations.id, reservation.id));
      }
    }

    const [fulfilled] = await tx
      .update(orders)
      .set({
        paymentStatus: "paid",
        status,
        deliveryData,
        couponRedeemedAt: order.couponCode ? fulfilledAt : null,
        fulfilledAt,
        updatedAt: fulfilledAt,
      })
      .where(eq(orders.id, order.id))
      .returning();
    return { order: fulfilled, newlyFulfilled: true };
  });

  if (!result.newlyFulfilled) return result.order;

  const { order } = result;
  await Promise.all([
    recordOrderLog({
      orderId,
      action: order.status === "completed" ? "ORDER_FULFILLED" : "ACCOUNT_DELIVERY_PENDING",
      performedBy: "Payment verification",
      details: { status: order.status },
    }),
    grantRewards(order),
  ]);
  return order;
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

/** Marks an unpaid order failed and releases its reserved account and coupon capacity. */
export async function failOrder(orderId: string, reason: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order || order.paymentStatus === "paid") return order ?? null;

    const reservedAccountId = (order.deliveryData as ReservedDelivery)?.reservedAccountId;
    if (reservedAccountId) {
      await tx
        .update(accountsVault)
        .set({ isReserved: false, reservedExpiry: null, updatedAt: new Date() })
        .where(and(eq(accountsVault.id, reservedAccountId), eq(accountsVault.isActive, true)));
    }
    await tx
      .update(couponReservations)
      .set({ status: "released" })
      .where(and(eq(couponReservations.orderId, orderId), eq(couponReservations.status, "reserved")));

    const [failed] = await tx
      .update(orders)
      .set({ paymentStatus: "failed", status: "failed", notes: reason, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return failed;
  });
}
