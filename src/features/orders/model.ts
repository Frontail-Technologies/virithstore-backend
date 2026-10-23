import { t, type Static } from "elysia";

export const OrderStatus = t.Union([
  t.Literal("pending"),
  t.Literal("processing"),
  t.Literal("completed"),
  t.Literal("cancelled"),
  t.Literal("failed"),
]);
export type OrderStatus = Static<typeof OrderStatus>;

export const PaymentStatus = t.Union([t.Literal("pending"), t.Literal("paid"), t.Literal("failed"), t.Literal("refunded")]);
export type PaymentStatus = Static<typeof PaymentStatus>;

export const PaymentMethod = t.Union([t.Literal("aba-khqr"), t.Literal("points")]);
export type PaymentMethod = Static<typeof PaymentMethod>;

export const CreateOrder = t.Object({
  productId: t.String({ minLength: 1 }),
  packageId: t.String({ minLength: 1 }),
  couponCode: t.Optional(t.String({ maxLength: 50 })),
  userEmail: t.Optional(t.String({ maxLength: 255 })),
  paymentMethod: t.Optional(PaymentMethod),
  credentials: t.Optional(t.Record(t.String(), t.Any())),
});
export type CreateOrder = Static<typeof CreateOrder>;

export const OrderNumberParam = t.Object({ orderNumber: t.String({ minLength: 1, maxLength: 50 }) });

export const OrdersQuery = t.Object({
  id: t.Optional(t.String()),
  status: t.Optional(OrderStatus),
  paymentStatus: t.Optional(PaymentStatus),
  search: t.Optional(t.String({ maxLength: 100 })),
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});
export type OrdersQuery = Static<typeof OrdersQuery>;

export const UpdateOrderStatus = t.Object({
  status: OrderStatus,
  deliveryData: t.Optional(t.Record(t.String(), t.Any())),
});
export type UpdateOrderStatus = Static<typeof UpdateOrderStatus>;
