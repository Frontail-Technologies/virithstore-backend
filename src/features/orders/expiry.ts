import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { accountsVault } from "../../db/schema/accountsVault";
import { orders } from "../../db/schema/orders";
import { PAYWAY_LIFETIME_MINUTES, checkPaywayTransaction, paywayVerdict } from "../../libs/payway";
import { isOrderBotConfigured } from "../../libs/telegram-orders";
import { fulfillOrder, releaseUnpaidOrder } from "./fulfil";
import { notifyPaidOrder } from "./notify";

const SWEEP_INTERVAL_MS = 60_000;
// PayWay stops accepting a transaction after its lifetime. A few extra minutes lets late webhooks land first.
const UNPAID_GRACE_MINUTES = 5;
const BATCH = 50;
// Paid orders whose Telegram alert failed are retried for this long.
const NOTIFY_RETRY_WINDOW_MS = 6 * 60 * 60_000;
const bootedAt = Date.now();

/**
 * Closes unpaid PayWay orders whose payment window is over. Each one gets a last check with PayWay first, so a
 * payment that slipped through is fulfilled instead of cancelled. If PayWay can't be reached the order is left
 * for the next run.
 */
export async function expireUnpaidOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - (PAYWAY_LIFETIME_MINUTES + UNPAID_GRACE_MINUTES) * 60_000);
  const stale = await db
    .select({ id: orders.id, paymentMethod: orders.paymentMethod, paymentTransactionId: orders.paymentTransactionId })
    .from(orders)
    .where(and(eq(orders.status, "pending"), eq(orders.paymentStatus, "pending"), lt(orders.updatedAt, cutoff)))
    .limit(BATCH);

  let closed = 0;
  for (const order of stale) {
    try {
      if (order.paymentMethod === "aba-khqr" && order.paymentTransactionId) {
        const check = await checkPaywayTransaction(order.paymentTransactionId);
        if (!check) continue;
        if (paywayVerdict(check) === "approved") {
          await fulfillOrder(order.id);
          continue;
        }
      }
      const { changed } = await releaseUnpaidOrder(order.id, "Payment window expired", "cancelled", "Expiry sweeper");
      if (changed) closed++;
    } catch (error) {
      console.error(`Expiring order ${order.id} failed:`, error);
    }
  }
  return closed;
}

/** Vault holds whose order is gone, paid or closed, and whose hold time has passed: back to stock. */
export async function releaseOrphanHolds() {
  await db
    .update(accountsVault)
    .set({ isReserved: false, reservedExpiry: null, reservedOrderId: null, updatedAt: new Date() })
    .where(and(
      eq(accountsVault.isActive, true),
      eq(accountsVault.isReserved, true),
      lt(accountsVault.reservedExpiry, new Date()),
      sql`NOT EXISTS (
        SELECT 1 FROM ${orders}
        WHERE ${orders.id} = ${accountsVault.reservedOrderId}
          AND ${orders.status} = 'pending'
          AND ${orders.paymentStatus} = 'pending'
      )`,
    ));
}

/** Sends Telegram alerts that failed the first time. Skips orders paid before this server started long ago. */
export async function retryMissedAlerts() {
  if (!isOrderBotConfigured()) return;
  const since = new Date(Math.max(Date.now() - NOTIFY_RETRY_WINDOW_MS, bootedAt - 10 * 60_000));
  const missed = await db
    .select()
    .from(orders)
    .where(and(
      eq(orders.paymentStatus, "paid"),
      isNull(orders.telegramNotifiedAt),
      gt(orders.updatedAt, since),
      gt(orders.createdAt, new Date(Date.now() - 24 * 60 * 60_000)),
      lt(orders.updatedAt, new Date(Date.now() - 60_000)),
    ))
    .limit(20);
  for (const order of missed) await notifyPaidOrder(order);
}

let running = false;

export async function runOrderMaintenance() {
  if (running) return;
  running = true;
  try {
    await expireUnpaidOrders();
    await releaseOrphanHolds();
    await retryMissedAlerts();
  } catch (error) {
    console.error("Order maintenance failed:", error);
  } finally {
    running = false;
  }
}

/** Starts the background sweeper (and runs it once now, which also catches up on rechecks lost in a restart). */
export function startOrderMaintenance() {
  void runOrderMaintenance();
  const timer = setInterval(() => void runOrderMaintenance(), SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
