import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { coupons } from "../../db/schema/coupons";
import { badRequest, notFound } from "../../libs/http-error";
import { isUuid } from "../../libs/ids";
import { normalizeCouponInput, toCouponDto } from "./mappers";
import { calculateDiscount } from "./pricing";
import type { SaveCoupon } from "./model";

function assertCouponId(id: string | undefined): string {
  if (!id || !isUuid(id)) throw notFound("Coupon not found");
  return id;
}

export async function validateCoupon(code: string, amount: number) {
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.trim().toUpperCase())).limit(1);

  if (!coupon || !coupon.isActive) throw badRequest("Invalid or inactive coupon code");
  if (coupon.expiresAt && new Date() > coupon.expiresAt) throw badRequest("Coupon has expired");
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw badRequest("Coupon usage limit reached");

  const minOrder = parseFloat(coupon.minOrderAmount);
  if (amount < minOrder) throw badRequest(`Minimum order amount for this coupon is $${minOrder}`);

  const discount = calculateDiscount(coupon, amount);
  return {
    valid: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discount: discount.toFixed(2),
      finalAmount: Math.max(0, amount - discount).toFixed(2),
    },
  };
}

export async function listCoupons() {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  return rows.map(toCouponDto);
}

export async function getCoupon(id: string | undefined) {
  const [coupon] = await db.select().from(coupons).where(eq(coupons.id, assertCouponId(id))).limit(1);
  if (!coupon) throw notFound("Coupon not found");
  return toCouponDto(coupon);
}

export async function createCoupon(input: SaveCoupon) {
  const values = normalizeCouponInput(input);
  if (!values.code) throw badRequest("Coupon code is required");
  const [created] = await db.insert(coupons).values(values).returning();
  return toCouponDto(created);
}

export async function updateCoupon(id: string | undefined, input: SaveCoupon) {
  const [updated] = await db
    .update(coupons)
    .set({ ...normalizeCouponInput(input), updatedAt: new Date() })
    .where(eq(coupons.id, assertCouponId(id)))
    .returning();
  if (!updated) throw notFound("Coupon not found");
  return toCouponDto(updated);
}

export async function deleteCoupon(id: string | undefined) {
  const [deleted] = await db.delete(coupons).where(eq(coupons.id, assertCouponId(id))).returning();
  if (!deleted) throw notFound("Coupon not found");
  return toCouponDto(deleted);
}
