import { randomBytes, randomInt } from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

/** e.g. VRT-A1B2C3 */
export const generateReferralCode = () => `VRT-${randomBytes(3).toString("hex").toUpperCase()}`;

/** e.g. ORD-1790000000000-4821 */
export const generateOrderNumber = () => `ORD-${Date.now()}-${randomInt(1000, 10000)}`;

/** Payment gateway transaction id, e.g. TXN1790000000000123 */
export const generateTransactionId = (requestTime: string | number) => `TXN${requestTime}${randomInt(100, 1000)}`;
