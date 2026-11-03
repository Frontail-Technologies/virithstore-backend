export {};

const token = Bun.env.TELEGRAM_ORDER_BOT_TOKEN?.trim() || Bun.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = Bun.env.TELEGRAM_ORDER_WEBHOOK_SECRET?.trim();
const apiPublicUrl = Bun.env.API_PUBLIC_URL?.trim().replace(/\/$/, "");

if (!token || !secret || !apiPublicUrl) {
  throw new Error("TELEGRAM_BOT_TOKEN (or TELEGRAM_ORDER_BOT_TOKEN), TELEGRAM_ORDER_WEBHOOK_SECRET and API_PUBLIC_URL are required");
}

const webhookUrl = `${apiPublicUrl}/api/v1/integrations/telegram/orders/webhook`;
const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["callback_query"],
    drop_pending_updates: false,
  }),
});
const payload = await response.json();
if (!response.ok || !(payload as { ok?: boolean }).ok) {
  throw new Error(`Telegram setWebhook failed: ${JSON.stringify(payload)}`);
}
console.log(`Telegram order webhook configured: ${webhookUrl}`);
