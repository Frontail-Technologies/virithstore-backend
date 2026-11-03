import { env } from "../config/env";
import type { Order } from "../db/schema/orders";

type TelegramMessageResult = { chatId: string; messageId: number };

/**
 * What the admin is told about a paid order:
 * - `delivered`: handed over automatically. Cancel only (cancelling a paid order flags it for a manual refund).
 * - `manual`: a service the admin fulfils by hand. Complete / Cancel.
 * - `needs-account`: paid, but no account was left to deliver. Assign one in the dashboard, then Complete / Cancel.
 */
export type OrderAlertKind = "delivered" | "manual" | "needs-account";
export type OrderFinalStatus = "completed" | "cancelled" | "failed";

const telegramUrl = (method: string) => `https://api.telegram.org/bot${env.TELEGRAM_ORDER_BOT_TOKEN}/${method}`;
const REQUEST_TIMEOUT_MS = 8_000;

export function escapeTelegramHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Picks the alert kind from a paid order's state. */
export function alertKindFor(order: Pick<Order, "productType" | "status">): OrderAlertKind {
  if (order.status === "processing") return "manual";
  if (order.productType === "account" && order.status === "pending") return "needs-account";
  return "delivered";
}

const HEADINGS: Record<OrderAlertKind, string> = {
  delivered: "🆕 <b>New order {n}</b>",
  manual: "🆕 <b>Manual order {n}</b>",
  "needs-account": "⚠️ <b>Paid order {n}: no account in stock</b>",
};

const STATUS_LINES: Record<OrderAlertKind, string> = {
  delivered: "✅ <b>Status:</b> Paid &amp; delivered",
  manual: "⏳ <b>Status:</b> Processing",
  "needs-account": "⏳ <b>Status:</b> Paid, waiting for an account. Add credentials in the dashboard, then press Complete.",
};

const FINAL_HEADINGS: Record<OrderFinalStatus, string> = {
  completed: "✅ <b>{n}: COMPLETED</b>",
  cancelled: "❌ <b>{n}: CANCELLED</b>",
  failed: "❌ <b>{n}: FAILED</b>",
};

/** Delykastore-style order card. Buyer inputs are shown, delivered account passwords never are. */
export function formatOrderMessage(order: Order, kind: OrderAlertKind, finalStatus?: OrderFinalStatus) {
  const credentials = order.credentials && typeof order.credentials === "object"
    ? Object.entries(order.credentials as Record<string, unknown>)
    : [];
  const number = escapeTelegramHtml(order.orderNumber);
  const heading = (finalStatus ? FINAL_HEADINGS[finalStatus] : HEADINGS[kind]).replace("{n}", number);
  const finalLine = finalStatus
    ? `📍 <b>Status:</b> ${finalStatus[0].toUpperCase()}${finalStatus.slice(1)}${order.refundRequired ? " · 💸 <b>Refund required (manual)</b>" : ""}`
    : STATUS_LINES[kind];
  const lines = [
    heading,
    "━━━━━━━━━━━━━━━━━━",
    `📦 <b>Service:</b> ${escapeTelegramHtml(order.productName)}`,
    `🎁 <b>Package:</b> ${escapeTelegramHtml(order.packageName)}`,
    ...credentials.map(([key, value]) => `🔗 <b>${escapeTelegramHtml(key)}:</b> ${escapeTelegramHtml(value)}`),
    `💰 <b>Amount:</b> $${Number(order.price).toFixed(2)}${order.couponCode ? ` (coupon ${escapeTelegramHtml(order.couponCode)})` : ""}`,
    `💳 <b>Paid with:</b> ${escapeTelegramHtml(order.paymentMethod)}`,
    order.userEmail ? `👤 <b>Buyer:</b> ${escapeTelegramHtml(order.userEmail)}` : "👤 <b>Buyer:</b> Guest",
    "━━━━━━━━━━━━━━━━━━",
    `🆔 <b>Order ID:</b> <code>${escapeTelegramHtml(order.id)}</code>`,
    finalLine,
  ];
  return lines.join("\n");
}

export function orderButtons(order: Pick<Order, "id">, kind: OrderAlertKind) {
  const cancel = { text: "❌ Cancel", callback_data: `ord-cancel:${order.id}` };
  if (kind === "delivered") return [[cancel]];
  return [[{ text: "✅ Complete", callback_data: `ord-complete:${order.id}` }, cancel]];
}

/** Reads button data. Buttons on messages sent before this change (`manual-complete` / `manual-failed`) still work. */
export function parseOrderCallback(data: string): { action: "complete" | "cancel"; orderId: string } | null {
  const match = data.match(/^(ord|manual)-(complete|cancel|failed):([0-9a-f-]{36})$/i);
  if (!match) return null;
  return { action: match[2].toLowerCase() === "complete" ? "complete" : "cancel", orderId: match[3].toLowerCase() };
}

async function telegramRequest<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(telegramUrl(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json() as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram ${method} failed`);
  return payload.result as T;
}

export function isOrderBotConfigured() {
  return Boolean(env.TELEGRAM_ORDER_BOT_TOKEN && env.TELEGRAM_ORDER_CHAT_ID && env.TELEGRAM_ORDER_WEBHOOK_SECRET);
}

export async function sendOrderNotification(order: Order, kind: OrderAlertKind): Promise<TelegramMessageResult | null> {
  if (!isOrderBotConfigured()) return null;
  const result = await telegramRequest<{ message_id: number; chat: { id: string | number } }>("sendMessage", {
    chat_id: env.TELEGRAM_ORDER_CHAT_ID,
    text: formatOrderMessage(order, kind),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: orderButtons(order, kind) },
  });
  return { chatId: String(result.chat.id), messageId: result.message_id };
}

/** Rewrites the alert to the order's final state and removes the buttons. */
export async function editOrderNotification(order: Order, chatId: string, messageId: number, finalStatus: OrderFinalStatus) {
  if (!env.TELEGRAM_ORDER_BOT_TOKEN) return;
  try {
    await telegramRequest("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: formatOrderMessage(order, alertKindFor(order), finalStatus),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [] },
    });
  } catch (error) {
    // Pressing a button twice asks for the same text again; Telegram rejects that and it is harmless.
    if (!(error instanceof Error && error.message.includes("message is not modified"))) throw error;
  }
}

export async function answerOrderCallback(callbackQueryId: string, text: string, showAlert = false) {
  if (!env.TELEGRAM_ORDER_BOT_TOKEN) return;
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}
