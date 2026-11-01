import { Elysia, t } from "elysia";
import { env } from "../../config/env";
import { unauthorized } from "../../libs/http-error";
import { answerManualOrderCallback, editManualOrderNotification } from "../../libs/telegram-orders";
import { updateManualOrderStatus } from "../orders/status";

interface TelegramCallbackPayload {
  callback_query?: {
    id?: string;
    data?: string;
    message?: { message_id?: number; chat?: { id?: string | number } };
  };
}

export const telegramOrdersFeature = new Elysia({ prefix: "/integrations/telegram", name: "feature.telegram-orders", tags: ["Integrations"] })
  .post("/orders/webhook", async ({ request, body }) => {
    const secret = request.headers.get("x-telegram-bot-api-secret-token") || "";
    if (!env.TELEGRAM_ORDER_WEBHOOK_SECRET || secret !== env.TELEGRAM_ORDER_WEBHOOK_SECRET) {
      throw unauthorized("Invalid Telegram webhook secret");
    }

    const callback = (body as TelegramCallbackPayload)?.callback_query;
    if (!callback?.id || !callback.data) return { ok: true };
    const chatId = String(callback.message?.chat?.id ?? "");
    if (!chatId || chatId !== env.TELEGRAM_ORDER_CHAT_ID) {
      await answerManualOrderCallback(callback.id, "This chat is not authorized.", true).catch(() => undefined);
      return { ok: true };
    }

    const match = callback.data.match(/^manual-(complete|failed):([0-9a-f-]{36})$/i);
    if (!match) {
      await answerManualOrderCallback(callback.id, "Unknown order action.", true).catch(() => undefined);
      return { ok: true };
    }

    const status = match[1] === "complete" ? "completed" : "failed";
    const result = await updateManualOrderStatus(match[2], status);
    const messageId = callback.message?.message_id;
    const finalStatus = ["completed", "failed"].includes(result.order.status)
      ? result.order.status as "completed" | "failed"
      : null;
    if (messageId && finalStatus) {
      await editManualOrderNotification(result.order, chatId, messageId, finalStatus).catch((error) => {
        console.error("Telegram order message update failed:", error);
      });
    }
    const text = result.changed ? `Order marked ${status}.` : `Order is already ${result.order.status}.`;
    await answerManualOrderCallback(callback.id, text, !result.changed).catch(() => undefined);
    return { ok: true };
  }, { body: t.Any() });
