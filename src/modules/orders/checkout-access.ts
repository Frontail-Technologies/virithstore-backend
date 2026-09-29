import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import type { Order } from "../../db/schema/orders";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors";

interface CheckoutTokenPayload {
  purpose: "guest-checkout";
  orderId: string;
}

export function createCheckoutToken(orderId: string): string {
  return jwt.sign({ purpose: "guest-checkout", orderId } satisfies CheckoutTokenPayload, env.JWT_SECRET, {
    expiresIn: "30m",
    issuer: "virithstore",
    audience: "checkout",
  });
}

export function verifyCheckoutToken(token: string | undefined, orderId: string): boolean {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: "virithstore",
      audience: "checkout",
    }) as CheckoutTokenPayload;
    return payload.purpose === "guest-checkout" && payload.orderId === orderId;
  } catch {
    return false;
  }
}

export function assertOrderAccess(
  order: Pick<Order, "id" | "userId">,
  userId: string | undefined,
  checkoutToken: string | undefined,
): void {
  if (order.userId && order.userId === userId) return;
  if (!order.userId && verifyCheckoutToken(checkoutToken, order.id)) return;
  if (!userId && !checkoutToken) throw new UnauthorizedError("Order access token required");
  throw new ForbiddenError("You cannot access this order");
}

export function toOrderStatusDto(order: Order) {
  return {
    id: order.id,
    productId: order.productId,
    orderNumber: order.orderNumber,
    productName: order.productName,
    productImage: order.productImage,
    packageName: order.packageName,
    price: order.price,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    deliveredCredentials: order.paymentStatus === "paid" ? order.deliveryData : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toPublicOrderStatusDto(order: Order) {
  return {
    orderNumber: order.orderNumber,
    productName: order.productName,
    packageName: order.packageName,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
  };
}
