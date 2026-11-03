import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db, type Tx } from "../../db/client";
import { couponReservations, coupons } from "../../db/schema/coupons";
import { orders } from "../../db/schema/orders";
import type { Product, ProductCostItem } from "../../db/schema/products";
import { badRequest, unauthorized } from "../../libs/http-error";
import { generateOrderNumber, isUuid } from "../../libs/ids";
import { createCheckoutToken } from "../../libs/jwt";
import { formatMoney, parseMoney, toPoints } from "../../libs/money";
import { calculateDiscount } from "../coupons/pricing";
import { recordOrderLog } from "../order-logs/log";
import { getProduct } from "../products/service";
import { applyPointsAdjustment } from "../wallet/service";
import { validateCredentials } from "./credentials";
import { fulfillOrder } from "./fulfil";
import {
  ALL_HELD_MESSAGE,
  OUT_OF_STOCK_MESSAGE,
  RESERVATION_MINUTES,
  claimAccount,
  countUnsold,
  extendHold,
  findHeldAccount,
} from "./inventory";
import type { CreateOrder } from "./model";

type Coupon = typeof coupons.$inferSelect;
type ReservedDelivery = { reservedAccountId?: string } | null;

interface CreateOrderInput extends CreateOrder {
  userId?: string | null;
}

async function loadCoupon(code: string, price: number) {
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.trim().toUpperCase())).limit(1);

  if (!coupon || !coupon.isActive) throw badRequest("Invalid or inactive coupon code");
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) throw badRequest("Coupon has expired");
  const minOrder = parseMoney(coupon.minOrderAmount);
  if (price < minOrder) throw badRequest(`Minimum order amount for this coupon is $${minOrder}`);

  return { coupon, discount: calculateDiscount(coupon, price) };
}

/**
 * Holds one vault account for a new order. When none can be held, tells the buyer whether the package is sold out
 * or every remaining account is in someone else's unpaid checkout.
 */
async function reserveAccount(tx: Tx, productId: string, costId: string, orderId: string): Promise<string> {
  const claimed = await claimAccount(tx, productId, costId, orderId);
  if (claimed) return claimed.id;
  throw badRequest((await countUnsold(tx, productId, costId)) > 0 ? ALL_HELD_MESSAGE : OUT_OF_STOCK_MESSAGE);
}

/** Counts redeemed plus live reservations under a row lock so concurrent checkouts can't oversell a coupon. */
async function assertCouponCapacity(tx: Tx, coupon: Coupon) {
  if (!coupon.usageLimit) return;
  await tx.execute(sql`SELECT ${coupons.id} FROM ${coupons} WHERE ${coupons.id} = ${coupon.id} FOR UPDATE`);
  const active = await tx.execute(sql`
    SELECT count(*)::int AS count FROM ${couponReservations}
    WHERE ${couponReservations.couponId} = ${coupon.id}
      AND ${couponReservations.status} = 'reserved'
      AND ${couponReservations.expiresAt} > NOW()
  `);
  const reserved = Number((active as unknown as Array<{ count: number }>)[0]?.count || 0);
  if (coupon.usedCount + reserved >= coupon.usageLimit) throw badRequest("Coupon usage limit reached");
}

function findPackage(product: Product, packageId: string): ProductCostItem {
  const pkg = product.cost.find((item) => item.id === packageId);
  if (!pkg) throw badRequest("Invalid package selected");
  if (pkg.isActive === false) throw badRequest("This package is currently unavailable");
  // Account stock comes from the vault; the package flags only apply to services.
  if (product.type !== "account" && (pkg.inStock === false || (pkg.stock ?? 1) <= 0)) {
    throw badRequest(OUT_OF_STOCK_MESSAGE);
  }
  return pkg;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

/**
 * A logged-in buyer who taps Pay Now again gets their still-open order back instead of a second order that would
 * hold a second account. The hold and coupon reservation are extended, or re-taken if they were released.
 * Returns null when there is nothing to reuse.
 */
async function reuseOpenOrder(input: {
  userId: string;
  product: Product;
  pkg: ProductCostItem;
  couponCode: string | null;
  credentials: Record<string, unknown>;
}) {
  const windowStart = new Date(Date.now() - (RESERVATION_MINUTES - 2) * 60_000);
  const candidates = await db
    .select()
    .from(orders)
    .where(and(
      eq(orders.userId, input.userId),
      eq(orders.productId, input.product.id),
      eq(orders.packageId, input.pkg.id),
      eq(orders.paymentMethod, "aba-khqr"),
      eq(orders.status, "pending"),
      eq(orders.paymentStatus, "pending"),
      gt(orders.updatedAt, windowStart),
    ))
    .orderBy(desc(orders.updatedAt))
    .limit(5);
  const match = candidates.find((order) => (order.couponCode ?? null) === input.couponCode && sameJson(order.credentials, input.credentials));
  if (!match) return null;

  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, match.id)).for("update").limit(1);
    if (!order || order.status !== "pending" || order.paymentStatus !== "pending") return null;

    let deliveryData = order.deliveryData as ReservedDelivery;
    if (order.productType === "account") {
      const held = await findHeldAccount(tx, deliveryData?.reservedAccountId, order.id);
      if (held) {
        await extendHold(tx, held.id, order.id);
      } else {
        const claimed = await claimAccount(tx, input.product.id, input.pkg.id, order.id);
        if (!claimed) return null; // Let a fresh checkout report the stock problem.
        deliveryData = { reservedAccountId: claimed.id };
      }
    }
    await tx
      .update(couponReservations)
      .set({ expiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60_000) })
      .where(and(eq(couponReservations.orderId, order.id), eq(couponReservations.status, "reserved")));
    const [reused] = await tx
      .update(orders)
      .set({ deliveryData, updatedAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning();
    await recordOrderLog({ orderId: order.id, action: "ORDER_REUSED_ON_RETRY", performedBy: input.userId, details: {} }, tx);
    return reused;
  });
}

/**
 * Creates a pending order, reserving stock and coupon capacity in one transaction.
 * Paying with points debits the wallet in the same transaction, so a failed debit leaves no order behind.
 */
export async function createOrder(input: CreateOrderInput) {
  const product = await getProduct(input.productId);
  if (!product.isAvailable || product.isDeleted) throw badRequest("Product is currently unavailable");
  if (product.isLink) throw badRequest("This product is bought on its own website, not through checkout");

  const credentials = validateCredentials(product.fields || [], input.credentials);
  const pkg = findPackage(product, input.packageId);

  const isPointsPayment = input.paymentMethod === "points";
  if (isPointsPayment && !input.userId) throw unauthorized("You must be logged in to pay with Virith Points");

  const originalPrice = parseMoney(pkg.price);
  const applied = input.couponCode ? await loadCoupon(input.couponCode, originalPrice) : null;
  const discount = applied?.discount ?? 0;
  const price = Math.max(0, originalPrice - discount);

  if (!isPointsPayment && isUuid(input.userId)) {
    const reused = await reuseOpenOrder({
      userId: input.userId!,
      product,
      pkg,
      couponCode: applied?.coupon.code ?? null,
      credentials,
    });
    if (reused) return { ...reused, checkoutToken: undefined };
  }

  const order = await db.transaction(async (tx) => {
    if (applied) await assertCouponCapacity(tx, applied.coupon);

    const [createdOrder] = await tx
      .insert(orders)
      .values({
        orderNumber: generateOrderNumber(),
        userId: isUuid(input.userId) ? input.userId : null,
        userEmail: input.userEmail || null,
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        productType: product.type,
        packageId: pkg.id,
        packageName: pkg.name || pkg.amount || "Package",
        price: formatMoney(price),
        originalPrice: formatMoney(originalPrice),
        couponCode: applied?.coupon.code ?? null,
        discount: formatMoney(discount),
        status: "pending",
        paymentMethod: input.paymentMethod ?? "aba-khqr",
        paymentStatus: "pending",
        credentials,
      })
      .returning();

    // The order row must exist first: the vault row points at it.
    if (product.type === "account") {
      const reservedAccountId = await reserveAccount(tx, product.id, pkg.id, createdOrder.id);
      const [withHold] = await tx
        .update(orders)
        .set({ deliveryData: { reservedAccountId } })
        .where(eq(orders.id, createdOrder.id))
        .returning();
      Object.assign(createdOrder, withHold);
    }

    if (applied) {
      await tx.insert(couponReservations).values({
        couponId: applied.coupon.id,
        orderId: createdOrder.id,
        expiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
      });
    }

    await recordOrderLog(
      {
        orderId: createdOrder.id,
        action: isPointsPayment ? "ORDER_PAID_WITH_POINTS" : "ORDER_CREATED",
        performedBy: input.userEmail || input.userId || "guest",
        details: { price, credentialFields: Object.keys(credentials), isPointsPayment },
      },
      tx,
    );

    if (isPointsPayment) {
      const points = toPoints(price);
      await applyPointsAdjustment(tx, {
        userId: input.userId!,
        points: -points,
        type: "order_payment",
        description: `Instant Points checkout: ${product.name} - ${pkg.name || pkg.amount} (${points} PTS)`,
        orderId: createdOrder.id,
      });
    }

    return createdOrder;
  });

  if (isPointsPayment) {
    const fulfilled = await fulfillOrder(order.id);
    return { ...(fulfilled ?? order), checkoutToken: undefined };
  }
  return { ...order, checkoutToken: order.userId ? undefined : createCheckoutToken(order.id) };
}
