import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { orders } from "../../db/schema/orders";
import { notFound } from "../../libs/http-error";
import { recordOrderLog } from "../order-logs/log";
import { processOrderReferral } from "../referrals/service";
import { conflict } from "../../libs/http-error";
import type { UpdateOrderStatus } from "./model";

/** Admin status change. Completing an order triggers the referral commission. */
export async function updateOrderStatus(id: string, { status, deliveryData }: UpdateOrderStatus, performedBy: string) {
  const [updated] = await db
    .update(orders)
    .set({ status, deliveryData: deliveryData ?? undefined, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  if (!updated) throw notFound("Order not found");

  await recordOrderLog({
    orderId: id,
    action: `STATUS_UPDATED_${status.toUpperCase()}`,
    performedBy,
    details: { status, deliveryData },
  });

  if (status === "completed") {
    try {
      await processOrderReferral(updated);
    } catch (error) {
      console.error("Referral reward error on admin order completion:", error);
    }
  }
  return updated;
}

/** Secure Telegram fulfilment transition. Payment truth is never changed by a fulfilment action. */
export async function updateManualOrderStatus(id: string, status: "completed" | "failed") {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update").limit(1);
    if (!order) throw notFound("Order not found");
    if (order.paymentStatus !== "paid") throw conflict("Order payment is not confirmed");
    if (order.productType !== "digital-service") throw conflict("Order is not a manual digital service");
    if (order.status !== "processing") return { order, changed: false };

    const now = new Date();
    const [updated] = await tx
      .update(orders)
      .set({
        status,
        fulfilledAt: status === "completed" ? now : null,
        notes: status === "failed" ? "Manual fulfilment marked failed from Telegram" : order.notes,
        updatedAt: now,
      })
      .where(eq(orders.id, id))
      .returning();

    await recordOrderLog({
      orderId: id,
      action: status === "completed" ? "MANUAL_ORDER_COMPLETED" : "MANUAL_ORDER_FAILED",
      performedBy: "Telegram order bot",
      details: { status, paymentStatus: updated.paymentStatus },
    }, tx);
    return { order: updated, changed: true };
  });
}
