import { db } from "../../db/client";
import { coupons, type NewCoupon } from "../../db/schema/coupons";
import { eq, desc } from "drizzle-orm";
import { NotFoundError, AppError } from "../../shared/errors";

function formatCoupon(c: any) {
  if (!c) return c;
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

function parseCouponInput(b: any): Partial<NewCoupon> {
  const code = (b.code || b.coupon || "").toUpperCase();
  const discountType = b.discountType || b.type || "percentage";
  const discountValue = String(b.discountValue !== undefined ? b.discountValue : (b.discount !== undefined ? b.discount : 0));
  const minOrderAmount = String(b.minOrderAmount !== undefined ? b.minOrderAmount : (b.minAmount !== undefined ? b.minAmount : 0));
  const maxDiscount = b.maxDiscount !== undefined && b.maxDiscount !== null && b.maxDiscount !== "" ? String(b.maxDiscount) : null;
  const usageLimit = b.usageLimit !== undefined ? b.usageLimit : (b.limit !== undefined && b.limit !== "" ? Number(b.limit) : null);
  const usedCount = b.usedCount !== undefined ? Number(b.usedCount) : (b.timesUsed !== undefined ? Number(b.timesUsed) : 0);
  const isActive = b.isActive !== undefined ? Boolean(b.isActive) : true;
  
  let expiresAt: Date | null = null;
  if (b.expiresAt) {
    expiresAt = new Date(b.expiresAt);
  } else if (b.expiry) {
    expiresAt = new Date(b.expiry);
  }

  return {
    code,
    discountType: discountType as "percentage" | "fixed",
    discountValue,
    minOrderAmount,
    maxDiscount,
    usageLimit,
    usedCount,
    isActive,
    expiresAt,
  };
}

export class CouponsService {
  static async validate(code: string, amount: number) {
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.toUpperCase()))
      .limit(1);

    if (!coupon || !coupon.isActive) {
      throw new AppError("Invalid or inactive coupon code", 400);
    }

    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      throw new AppError("Coupon has expired", 400);
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError("Coupon usage limit reached", 400);
    }

    const minOrder = parseFloat(coupon.minOrderAmount);
    if (amount < minOrder) {
      throw new AppError(`Minimum order amount for this coupon is $${minOrder}`, 400);
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
      const discVal = parseFloat(coupon.discountValue);
      discount = (amount * discVal) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, parseFloat(coupon.maxDiscount));
      }
    } else {
      discount = parseFloat(coupon.discountValue);
    }

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

  static async getAll() {
    const items = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    return items.map(formatCoupon);
  }

  static async getById(id: string) {
    if (!id || id === "undefined" || id === "null") {
      throw new NotFoundError("Coupon ID is required");
    }
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    if (!coupon) throw new NotFoundError("Coupon not found");
    return formatCoupon(coupon);
  }

  static async create(data: any) {
    const parsed = parseCouponInput(data);
    if (!parsed.code) {
      throw new AppError("Coupon code is required", 400);
    }
    const [created] = await db
      .insert(coupons)
      .values(parsed as NewCoupon)
      .returning();
    return formatCoupon(created);
  }

  static async update(id: string, data: any) {
    if (!id || id === "undefined" || id === "null") {
      throw new NotFoundError("Coupon ID is required");
    }
    const parsed = parseCouponInput(data);
    const [updated] = await db
      .update(coupons)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning();

    if (!updated) throw new NotFoundError("Coupon not found");
    return formatCoupon(updated);
  }

  static async delete(id: string) {
    if (!id || id === "undefined" || id === "null") {
      throw new NotFoundError("Coupon ID is required");
    }
    const [deleted] = await db.delete(coupons).where(eq(coupons.id, id)).returning();
    if (!deleted) throw new NotFoundError("Coupon not found");
    return formatCoupon(deleted);
  }
}
