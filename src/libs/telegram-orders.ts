import { env } from "../config/env";
import type { Order } from "../db/schema/orders";

type TelegramMessageResult = { chatId: string; messageId: number };

const telegramUrl = (method: string) => `https://api.telegram.org/bot${env.TELEGRAM_ORDER_BOT_TOKEN}/${method}`;

export function escapeTelegramHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatManualOrderMessage(order: Order, finalStatus?: "completed" | "failed") {
  const credentials = order.credentials && typeof order.credentials === "object"
    ? Object.entries(order.credentials as Record<string, unknown>)
    : [];
  const heading = finalStatus === "completed"
    ? `✅ <b>${escapeTelegramHtml(order.orderNumber)} — COMPLETED</b>`
    : finalStatus === "failed"
      ? `❌ <b>${escapeTelegramHtml(order.orderNumber)} — FAILED</b>`
      : `🆕 <b>Manual order ${escapeTelegramHtml(order.orderNumber)}</b>`;
  const lines = [
    heading,
    "━━━━━━━━━━━━━━━━━━",
    `📦 <b>Service:</b> ${escapeTelegramHtml(order.productName)}`,
    `🎁 <b>Package:</b> ${escapeTelegramHtml(order.packageName)}`,
    ...credentials.map(([key, value]) => `🔗 <b>${escapeTelegramHtml(key)}:</b> ${escapeTelegramHtml(value)}`),
    `💰 <b>Amount:</b> $${Number(order.price).toFixed(2)}`,
    order.userEmail ? `👤 <b>Buyer:</b> ${escapeTelegramHtml(order.userEmail)}` : "",
    "━━━━━━━━━━━━━━━━━━",
    `🆔 <b>Order ID:</b> <code>${escapeTelegramHtml(order.id)}</code>`,
    finalStatus ? `📍 <b>Status:</b> ${finalStatus === "completed" ? "Completed" : "Failed"}` : "⏳ <b>Status:</b> Processing",
  ].filter(Boolean);
  return lines.join("\n");
}

async function telegramRequest<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(telegramUrl(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram ${method} failed`);
  return payload.result as T;
}

export function isManualOrderBotConfigured() {
  return Boolean(env.TELEGRAM_ORDER_BOT_TOKEN && env.TELEGRAM_ORDER_CHAT_ID && env.TELEGRAM_ORDER_WEBHOOK_SECRET);
}

export async function sendManualOrderNotification(order: Order): Promise<TelegramMessageResult | null> {
  if (!isManualOrderBotConfigured()) return null;
  const result = await telegramRequest<{ message_id: number; chat: { id: string | number } }>("sendMessage", {
    chat_id: env.TELEGRAM_ORDER_CHAT_ID,
    text: formatManualOrderMessage(order),
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Complete", callback_data: `manual-complete:${order.id}` },
        { text: "❌ Failed", callback_data: `manual-failed:${order.id}` },
      ]],
    },
  });
  return { chatId: String(result.chat.id), messageId: result.message_id };
}

export async function editManualOrderNotification(order: Order, chatId: string, messageId: number, status: "completed" | "failed") {
  if (!env.TELEGRAM_ORDER_BOT_TOKEN) return;
  await telegramRequest("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: formatManualOrderMessage(order, status),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] },
  });
}

export async function answerManualOrderCallback(callbackQueryId: string, text: string, showAlert = false) {
  if (!env.TELEGRAM_ORDER_BOT_TOKEN) return;
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}
