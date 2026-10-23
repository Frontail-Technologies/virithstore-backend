import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { orders } from "../../db/schema/orders";
import { notFound } from "../../libs/http-error";
import { recordOrderLog } from "../order-logs/log";
import { processOrderReferral } from "../referrals/service";
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
