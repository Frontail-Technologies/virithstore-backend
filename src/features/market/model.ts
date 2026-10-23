import { t, type Static } from "elysia";

const Money = t.Union([t.Number({ minimum: 0 }), t.String({ minLength: 1, maxLength: 20 })]);

export const MarketQuery = t.Object({ category: t.Optional(t.String({ maxLength: 255 })) });

export const SaveMarketAccount = t.Object({
  accountId: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  category: t.String({ minLength: 1, maxLength: 255 }),
  title: t.String({ minLength: 1, maxLength: 255 }),
  price: Money,
  originalPrice: t.Optional(t.Union([Money, t.Null()])),
  stock: t.Optional(t.Union([t.Number(), t.String()])),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  slides: t.Optional(t.Array(t.Any())),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  attributes: t.Optional(t.Array(t.Any())),
  credentials: t.Optional(t.Record(t.String(), t.Any())),
  isSoldOut: t.Optional(t.Boolean()),
  buyLink: t.Optional(t.Union([t.String(), t.Null()])),
  isActive: t.Optional(t.Boolean()),
});
export type SaveMarketAccount = Static<typeof SaveMarketAccount>;

export const UpdateMarketAccount = t.Partial(SaveMarketAccount);
export type UpdateMarketAccount = Static<typeof UpdateMarketAccount>;

export const SaveMarketCategory = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.Union([t.String(), t.Null()])),
});
export type SaveMarketCategory = Static<typeof SaveMarketCategory>;
