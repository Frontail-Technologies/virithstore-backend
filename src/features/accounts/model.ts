import { t, type Static } from "elysia";

export const AccountsQuery = t.Object({
  productId: t.Optional(t.String()),
  costId: t.Optional(t.String()),
  status: t.Optional(t.String()),
  search: t.Optional(t.String({ maxLength: 100 })),
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});
export type AccountsQuery = Static<typeof AccountsQuery>;

export const SaveAccount = t.Object({
  productId: t.Optional(t.Union([t.String(), t.Null()])),
  costId: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  email: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  password: t.Optional(t.Union([t.String(), t.Null()])),
  additionalInfo: t.Optional(t.Union([t.String(), t.Null()])),
  isActive: t.Optional(t.Boolean()),
  isReserved: t.Optional(t.Boolean()),
});
export type SaveAccount = Static<typeof SaveAccount>;
