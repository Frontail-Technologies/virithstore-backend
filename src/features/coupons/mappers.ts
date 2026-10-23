import type { Coupon, NewCoupon } from "../../db/schema/coupons";
import type { SaveCoupon } from "./model";

/** Dashboard shape: the canonical row plus the legacy alias fields it still reads. */
export function toCouponDto(c: Coupon) {
  return {
    ...c,
    _id: c.id,
    coupon: c.code,
    type: c.discountType,
    discount: parseFloat(c.discountValue || "0"),
    minAmount: parseFloat(c.minOrderAmount || "0"),
    maxDiscount: c.maxDiscount ? parseFloat(c.maxDiscount) : undefined,
    limit: c.usageLimit,
    timesUsed: c.usedCount || 0,
    expiry: c.expiresAt,
    startDate: c.createdAt,
  };
}

const firstDefined = <T>(...values: (T | undefined)[]) => values.find((value) => value !== undefined);

/** Accepts canonical or legacy field names and returns a row ready to insert/update. */
export function normalizeCouponInput(input: SaveCoupon): NewCoupon {
  const usageLimit = firstDefined(input.usageLimit, input.limit);
  const maxDiscount = input.maxDiscount;
  const expires = firstDefined(input.expiresAt, input.expiry);

  return {
    code: (input.code || input.coupon || "").trim().toUpperCase(),
    discountType: input.discountType ?? input.type ?? "percentage",
    discountValue: String(firstDefined(input.discountValue, input.discount) ?? 0),
    minOrderAmount: String(firstDefined(input.minOrderAmount, input.minAmount) ?? 0),
    maxDiscount: maxDiscount === undefined || maxDiscount === null || maxDiscount === "" ? null : String(maxDiscount),
    usageLimit: usageLimit === undefined || usageLimit === null || usageLimit === "" ? null : Number(usageLimit),
    usedCount: Number(firstDefined(input.usedCount, input.timesUsed) ?? 0),
    isActive: input.isActive ?? true,
    expiresAt: expires ? new Date(expires) : null,
  };
}
