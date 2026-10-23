import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  userId: string;
  email?: string;
  role: "admin" | "user";
  telegramId?: string;
}

export const signAccessToken = (payload: AccessTokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });

/** Returns the payload, or null for a missing/invalid/expired token. */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    return typeof decoded === "object" && decoded && "userId" in decoded ? (decoded as AccessTokenPayload) : null;
  } catch {
    return null;
  }
}

// Guest checkout: a short-lived token that proves ownership of one guest order.
interface CheckoutTokenPayload {
  purpose: "guest-checkout";
  orderId: string;
}

const CHECKOUT_TOKEN_OPTIONS = { issuer: "virithstore", audience: "checkout" } as const;

export const createCheckoutToken = (orderId: string): string =>
  jwt.sign({ purpose: "guest-checkout", orderId } satisfies CheckoutTokenPayload, env.JWT_SECRET, {
    expiresIn: "30m",
    ...CHECKOUT_TOKEN_OPTIONS,
  });

export function verifyCheckoutToken(token: string | undefined, orderId: string): boolean {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, CHECKOUT_TOKEN_OPTIONS) as CheckoutTokenPayload;
    return payload.purpose === "guest-checkout" && payload.orderId === orderId;
  } catch {
    return false;
  }
}
