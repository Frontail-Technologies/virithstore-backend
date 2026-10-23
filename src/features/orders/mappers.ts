import type { Order } from "../../db/schema/orders";

/** What the buyer sees for their own order; delivery secrets only appear once paid. */
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

/** Lookup by order number is unauthenticated, so it reveals progress only. */
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

interface LiveFeedRow {
  id: string;
  orderNumber: string | null;
  productName: string;
  packageName: string;
  price: string;
  status: Order["status"];
  paymentStatus: Order["paymentStatus"];
  createdAt: Date;
}

export function toLiveFeedItem(row: LiveFeedRow) {
  const reference = row.orderNumber || row.id;
  return {
    id: row.id,
    maskedId: reference.length > 4 ? `ORD-***${reference.slice(-4)}` : `ORD-${reference}`,
    productName: row.productName,
    packageName: row.packageName,
    amount: row.price,
    status: row.status,
    paymentStatus: row.paymentStatus,
    timestamp: row.createdAt,
  };
}
