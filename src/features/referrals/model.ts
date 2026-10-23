import { t, type Static } from "elysia";

export const ReferralConfig = t.Object({
  isEnabled: t.Boolean(),
  rewardType: t.Union([t.Literal("percentage"), t.Literal("fixed")]),
  /** e.g. 5 (%) or 100 (points) */
  commissionValue: t.Number(),
  /** e.g. 100 points = $1.00 */
  pointsPerDollar: t.Number(),
  minOrderAmount: t.Number(),
  refereeDiscountPercent: t.Number(),
  terms: t.String(),
});
export type ReferralConfig = Static<typeof ReferralConfig>;

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  isEnabled: true,
  rewardType: "percentage",
  commissionValue: 5,
  pointsPerDollar: 100,
  minOrderAmount: 1.0,
  refereeDiscountPercent: 5,
  terms: "Share your referral link with friends. When they place an order on Virith Store, you will instantly earn Points credited directly to your Virith Points Wallet!",
};
