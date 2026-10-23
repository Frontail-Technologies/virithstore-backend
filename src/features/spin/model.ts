import { t, type Static } from "elysia";

export const PrizeType = t.Union([
  t.Literal("points"),
  t.Literal("discount"),
  t.Literal("cash"),
  t.Literal("product"),
  t.Literal("free_spin"),
]);

export const CreatePrize = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  type: t.Optional(PrizeType),
  value: t.String({ minLength: 1, maxLength: 255 }),
  probability: t.Optional(t.Number({ minimum: 0, maximum: 1000 })),
  color: t.Optional(t.Union([t.String({ maxLength: 50 }), t.Null()])),
  isActive: t.Optional(t.Boolean()),
});
export type CreatePrize = Static<typeof CreatePrize>;

export const UpdatePrize = t.Partial(CreatePrize);
export type UpdatePrize = Static<typeof UpdatePrize>;

export const UpdateSpinStatus = t.Object({
  id: t.String({ minLength: 1 }),
  status: t.String({ minLength: 1, maxLength: 20 }),
});
export type UpdateSpinStatus = Static<typeof UpdateSpinStatus>;
