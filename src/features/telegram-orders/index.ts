import { Elysia, t } from "elysia";
import { env } from "../../config/env";
import { unauthorized } from "../../libs/http-error";
import { answerOrderCallback, parseOrderCallback } from "../../libs/telegram-orders";
import { syncOrderNotification } from "../orders/notify";
import { closeOrderByAdmin, completeOrderByAdmin } from "../orders/status";
import { getOrder } from "../orders/queries";

interface TelegramCallbackPayload {
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number | string; username?: string; first_name?: string };
    message?: { message_id?: number; chat?: { id?: string | number } };
  };
}

const adminIds = new Set(env.TELEGRAM_ORDER_ADMIN_IDS);

export const telegramOrdersFeature = new Elysia({ prefix: "/integrations/telegram", name: "feature.telegram-orders", tags: ["Integrations"] })
  .post("/orders/webhook", async ({ request, body }) => {
    const secret = request.headers.get("x-telegram-bot-api-secret-token") || "";
    if (!env.TELEGRAM_ORDER_WEBHOOK_SECRET || secret !== env.TELEGRAM_ORDER_WEBHOOK_SECRET) {
      throw unauthorized("Invalid Telegram webhook secret");
    }

    const callback = (body as TelegramCallbackPayload)?.callback_query;
    if (!callback?.id || !callback.data) return { ok: true };
    const answer = (text: string, alert = false) => answerOrderCallback(callback.id!, text, alert).catch(() => undefined);

    const chatId = String(callback.message?.chat?.id ?? "");
    if (!chatId || chatId !== env.TELEGRAM_ORDER_CHAT_ID) {
      await answer("This chat is not authorized.", true);
      return { ok: true };
    }
    const fromId = String(callback.from?.id ?? "");
    if (adminIds.size > 0 && !adminIds.has(fromId)) {
      await answer("You are not allowed to change orders.", true);
      return { ok: true };
    }

    const parsed = parseOrderCallback(callback.data);
    if (!parsed) {
      await answer("Unknown order action.", true);
      return { ok: true };
    }

    const performedBy = `Telegram: ${callback.from?.username ? `@${callback.from.username}` : callback.from?.first_name || fromId || "admin"}`;
    try {
      const result = parsed.action === "complete"
        ? await completeOrderByAdmin(parsed.orderId, { requirePaid: true }, performedBy)
        : await closeOrderByAdmin(parsed.orderId, "cancelled", performedBy);

      // The order may live in a different message than the one pressed (old alerts): bring this one up to date too.
      const messageId = callback.message?.message_id;
      if (messageId && (result.order.telegramMessageId !== messageId || !result.changed)) {
        await syncOrderNotification({ ...result.order, telegramChatId: chatId, telegramMessageId: messageId });
      }

      if (result.changed) {
        // Delykastore's confirmations; a paid cancel also reminds the admin to refund.
        const done = parsed.action === "complete" ? "✅ Order marked as Complete!" : "❌ Order marked as Cancelled!";
        const refund = result.order.refundRequired ? " Refund required: return the money manually." : "";
        await answer(`${done}${refund}`, Boolean(refund));
      } else if (parsed.action === "complete" && result.order.status === "completed") {
        // Auto-delivered orders are already complete: pressing Complete just confirms and closes the alert.
        await answer("✅ Order marked as Complete!");
      } else {
        await answer(result.message ?? `⚠️ Order already marked as ${result.order.status.toUpperCase()}!`, true);
      }
    } catch (error) {
      console.error("Telegram order action failed:", error);
      const exists = await getOrder(parsed.orderId).then(() => true, () => false);
      await answer(exists ? "Could not update the order. Try again or use the dashboard." : "Order not found.", true);
    }
    return { ok: true };
  }, { body: t.Any() });
