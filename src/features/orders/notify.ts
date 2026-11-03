import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { orders, type Order } from "../../db/schema/orders";
import {
  alertKindFor,
  editOrderNotification,
  sendOrderNotification,
  type OrderFinalStatus,
} from "../../libs/telegram-orders";

/**
 * Sends the admin alert for a paid order and remembers the message so the buttons can update it later.
 * Best effort: a failure is logged and the expiry sweeper retries orders that were never announced.
 */
export async function notifyPaidOrder(order: Order): Promise<Order | null> {
  try {
    const sent = await sendOrderNotification(order, alertKindFor(order));
    if (!sent) return null;
    const [notified] = await db
      .update(orders)
      .set({ telegramChatId: sent.chatId, telegramMessageId: sent.messageId, telegramNotifiedAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning();
    return notified ?? null;
  } catch (error) {
    console.error(`Telegram order alert failed for ${order.orderNumber}:`, error);
    return null;
  }
}

/** Keeps the Telegram message in step when an order is closed from the dashboard or the bot. */
export async function syncOrderNotification(order: Order) {
  if (!order.telegramChatId || !order.telegramMessageId) return;
  if (!["completed", "cancelled", "failed"].includes(order.status)) return;
  try {
    await editOrderNotification(order, order.telegramChatId, order.telegramMessageId, order.status as OrderFinalStatus);
  } catch (error) {
    console.error(`Telegram order message update failed for ${order.orderNumber}:`, error);
  }
}
