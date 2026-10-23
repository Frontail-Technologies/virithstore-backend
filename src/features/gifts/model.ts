import { t, type Static } from "elysia";

export const RewardType = t.Union([t.Literal("discount"), t.Literal("product"), t.Literal("cash")]);

const Numeric = t.Union([t.Number({ minimum: 0 }), t.String({ minLength: 1, maxLength: 20 })]);

export const CreateGift = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  requiredWagering: Numeric,
  rewardType: t.Optional(RewardType),
  rewardValue: t.String({ minLength: 1, maxLength: 255 }),
  isActive: t.Optional(t.Boolean()),
});
export type CreateGift = Static<typeof CreateGift>;

export const UpdateGift = t.Partial(CreateGift);
export type UpdateGift = Static<typeof UpdateGift>;

export const UpdateGiftTransactionStatus = t.Object({ status: t.String({ minLength: 1, maxLength: 50 }) });

/** What `GET /gifts/wagering` returns (canonical wagering names, no legacy `targetWager`). */
export const GiftProgressItem = t.Object({
  id: t.String(),
  name: t.String(),
  image: t.Union([t.String(), t.Null()]),
  requiredWagering: t.String(),
  rewardType: RewardType,
  rewardValue: t.String(),
  isClaimed: t.Boolean(),
  isEligible: t.Boolean(),
  progress: t.Number(),
});
export type GiftProgressItem = Static<typeof GiftProgressItem>;

export const GiftProgressResponse = t.Object({
  totalSpent: t.String(),
  gifts: t.Array(GiftProgressItem),
});
export type GiftProgressResponse = Static<typeof GiftProgressResponse>;
