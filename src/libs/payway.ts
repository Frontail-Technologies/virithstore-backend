import crypto from "node:crypto";
import { env } from "../config/env";

const REQUEST_TIMEOUT_MS = 8_000;

/** PayWay signs requests with base64 HMAC-SHA512 over the concatenated field values. */
export const paywayHash = (value: string) => crypto.createHmac("sha512", env.PAYWAY_PUBLIC_KEY).update(value).digest("base64");

export interface PaywayCheckResult {
  status?: { code?: number | string };
  data?: { payment_status?: string };
}

/** Asks PayWay for the real state of a transaction; null on network failure or timeout. */
export async function checkPaywayTransaction(tranId: string): Promise<PaywayCheckResult | null> {
  const reqTime = Math.floor(Date.now() / 1000).toString();
  const merchantId = env.PAYWAY_MERCHANT_KEY;

  try {
    const response = await fetch(env.PAYWAY_CHECK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        req_time: reqTime,
        merchant_id: merchantId,
        tran_id: tranId,
        hash: paywayHash(`${reqTime}${merchantId}${tranId}`),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return (await response.json()) as PaywayCheckResult;
  } catch (error) {
    console.error("PayWay check-transaction request failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

export type PaywayVerdict = "approved" | "declined" | "pending";

/**
 * Interprets a check-transaction response. Only an explicit decline/cancel counts as a failure:
 * "PENDING", unknown states and unreachable gateways stay pending so a legitimate payment is never cancelled.
 */
export function paywayVerdict(check: PaywayCheckResult | null): PaywayVerdict {
  const state = check?.data?.payment_status?.toUpperCase();
  if (state === "APPROVED" && check?.status?.code !== 6) return "approved";
  if (state === "DECLINED" || state === "CANCELLED") return "declined";
  return "pending";
}

/** PayWay posts the result base64-encoded in a `response` field (JSON or form body). */
export function unwrapPaywayWebhook(raw: unknown): Record<string, unknown> {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (typeof body.response === "string") {
    try {
      return JSON.parse(Buffer.from(body.response, "base64").toString("utf-8"));
    } catch {
      return body;
    }
  }
  return body;
}
