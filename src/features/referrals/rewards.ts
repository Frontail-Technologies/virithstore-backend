import type { ReferralConfig } from "./model";

/** Points the referrer earns for an order. 0 means no reward. */
export function calculateReferralPoints(config: ReferralConfig, orderAmount: number): number {
  if (!config.isEnabled || orderAmount < (config.minOrderAmount || 1)) return 0;

  if (config.rewardType === "percentage") {
    // e.g. 5% of $20 = $1.00 -> 100 points
    const commissionUsd = (orderAmount * (config.commissionValue || 5)) / 100;
    return Math.max(1, Math.round(commissionUsd * (config.pointsPerDollar || 100)));
  }
  return Math.max(0, Math.round(config.commissionValue || 100));
}
