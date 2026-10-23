import crypto from "node:crypto";

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

export type TelegramLoginResult = "valid" | "bad-signature" | "expired";

/**
 * Verifies a Telegram Login Widget payload: the HMAC over the sorted fields must match, and `auth_date`
 * must be recent so a leaked payload can't be replayed later. `referralCode` is ours, not Telegram's.
 */
export function verifyTelegramLogin(data: Record<string, string | undefined>, botToken: string): TelegramLoginResult {
  const secretKey = crypto.createHash("sha256").update(botToken.trim()).digest();
  const checkString = Object.entries(data)
    .filter(([key, value]) => key !== "hash" && key !== "referralCode" && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const expected = Buffer.from(crypto.createHmac("sha256", secretKey).update(checkString).digest("hex"));
  const actual = Buffer.from(String(data.hash ?? ""));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return "bad-signature";

  const ageSeconds = Date.now() / 1000 - Number(data.auth_date);
  if (!Number.isFinite(ageSeconds) || ageSeconds > MAX_AUTH_AGE_SECONDS || ageSeconds < -60) return "expired";
  return "valid";
}
