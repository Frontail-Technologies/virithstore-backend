import { sql } from "drizzle-orm";
import { db, type Tx } from "../../db/client";
import { accountsVault } from "../../db/schema/accountsVault";
import { couponReservations, coupons } from "../../db/schema/coupons";
import { orders } from "../../db/schema/orders";
import type { Product, ProductCostItem } from "../../db/schema/products";
import { badRequest, unauthorized } from "../../libs/http-error";
import { generateOrderNumber, isUuid } from "../../libs/ids";
import { createCheckoutToken } from "../../libs/jwt";
import { formatMoney, parseMoney, toPoints } from "../../libs/money";
import { eq } from "drizzle-orm";
import { calculateDiscount } from "../coupons/pricing";
import { recordOrderLog } from "../order-logs/log";
import { getProduct } from "../products/service";
import { applyPointsAdjustment } from "../wallet/service";
import { validateCredentials } from "./credentials";
import { fulfillOrder } from "./fulfil";
import type { CreateOrder } from "./model";

const RESERVATION_MINUTES = 15;

type Coupon = typeof coupons.$inferSelect;

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

/** Claims one available vault account for the package; expired reservations are reusable. */
async function reserveAccount(tx: Tx, productId: string, costId: string): Promise<string> {
  // The inner SELECT locks the row (SKIP LOCKED) so concurrent checkouts never claim the same account.
  const [claimed] = await tx
    .update(accountsVault)
    .set({
      isReserved: true,
      reservedExpiry: sql`NOW() + (${RESERVATION_MINUTES}::int * INTERVAL '1 minute')`,
      updatedAt: new Date(),
    })
    .where(
      eq(
        accountsVault.id,
        sql`(
          SELECT ${accountsVault.id} FROM ${accountsVault}
          WHERE ${accountsVault.productId} = ${productId}
            AND ${accountsVault.costId} = ${costId}
            AND ${accountsVault.isActive} = true
            AND (${accountsVault.isReserved} = false OR ${accountsVault.reservedExpiry} < NOW())
          ORDER BY ${accountsVault.createdAt}
          FOR UPDATE SKIP LOCKED LIMIT 1
        )`,
      ),
    )
    .returning({ id: accountsVault.id });

  if (!claimed) throw badRequest("This package is currently out of stock");
  return claimed.id;
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
  return pkg;
}

/**
 * Creates a pending order, reserving stock and coupon capacity in one transaction.
 * Paying with points debits the wallet in the same transaction, so a failed debit leaves no order behind.
 */
export async function createOrder(input: CreateOrderInput) {
  const product = await getProduct(input.productId);
  if (!product.isAvailable) throw badRequest("Product is currently unavailable");

  const credentials = validateCredentials(product.fields || [], input.credentials);
  const pkg = findPackage(product, input.packageId);

  const isPointsPayment = input.paymentMethod === "points";
  if (isPointsPayment && !input.userId) throw unauthorized("You must be logged in to pay with Virith Points");

  const originalPrice = parseMoney(pkg.price);
  const applied = input.couponCode ? await loadCoupon(input.couponCode, originalPrice) : null;
  const discount = applied?.discount ?? 0;
  const price = Math.max(0, originalPrice - discount);

  const order = await db.transaction(async (tx) => {
    const reservedAccountId = product.type === "account" ? await reserveAccount(tx, product.id, pkg.id) : null;
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
        deliveryData: reservedAccountId ? { reservedAccountId } : undefined,
      })
      .returning();

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
