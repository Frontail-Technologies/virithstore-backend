import { t, type Static } from "elysia";

export const ValidateCoupon = t.Object({
  code: t.String({ minLength: 1, maxLength: 50 }),
  amount: t.Number({ minimum: 0 }),
});
export type ValidateCoupon = Static<typeof ValidateCoupon>;

const Numeric = t.Union([t.Number(), t.String()]);
const NullableNumeric = t.Optional(t.Union([t.Number(), t.String(), t.Null()]));
const NullableString = t.Optional(t.Union([t.String(), t.Null()]));

/**
 * Admin payload. The dashboard still sends the legacy aliases (`coupon`, `type`, `discount`, `minAmount`,
 * `limit`, `expiry`) next to the canonical names, so both are accepted and normalised in `normalizeCouponInput`.
 */
export const SaveCoupon = t.Object({
  id: t.Optional(t.String()),
  _id: t.Optional(t.String()),
  code: t.Optional(t.String({ maxLength: 50 })),
  coupon: t.Optional(t.String({ maxLength: 50 })),
  discountType: t.Optional(t.Union([t.Literal("percentage"), t.Literal("fixed")])),
  type: t.Optional(t.Union([t.Literal("percentage"), t.Literal("fixed")])),
  discountValue: t.Optional(Numeric),
  discount: t.Optional(Numeric),
  minOrderAmount: t.Optional(Numeric),
  minAmount: t.Optional(Numeric),
  maxDiscount: NullableNumeric,
  usageLimit: NullableNumeric,
  limit: NullableNumeric,
  usedCount: t.Optional(Numeric),
  timesUsed: t.Optional(Numeric),
  isActive: t.Optional(t.Boolean()),
  expiresAt: NullableString,
  expiry: NullableString,
});
export type SaveCoupon = Static<typeof SaveCoupon>;

export const OptionalIdQuery = t.Object({ id: t.Optional(t.String()) });
