import type { Coupon } from "../../db/schema/coupons";

/** Discount in currency units for an order amount; never exceeds `maxDiscount` or the amount itself. */
export function calculateDiscount(
  coupon: Pick<Coupon, "discountType" | "discountValue" | "maxDiscount">,
  amount: number,
): number {
  const value = parseFloat(coupon.discountValue);
  let discount = coupon.discountType === "percentage" ? (amount * value) / 100 : value;
  if (coupon.discountType === "percentage" && coupon.maxDiscount) {
    discount = Math.min(discount, parseFloat(coupon.maxDiscount));
  }
  return Math.min(Math.max(discount, 0), amount);
}
