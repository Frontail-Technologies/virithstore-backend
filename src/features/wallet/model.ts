import { t, type Static } from "elysia";

export const WalletTransactionType = t.Union([
  t.Literal("deposit"),
  t.Literal("referral_reward"),
  t.Literal("order_payment"),
  t.Literal("refund"),
  t.Literal("admin_adjustment"),
  t.Literal("spin_reward"),
]);
export type WalletTransactionType = Static<typeof WalletTransactionType>;

export const AdminAdjustWallet = t.Object({
  userId: t.String({ minLength: 1 }),
  points: t.Integer(),
  reason: t.String({ maxLength: 500 }),
});
export type AdminAdjustWallet = Static<typeof AdminAdjustWallet>;

/** positive points = credit, negative = debit */
export interface PointsAdjustment {
  userId: string;
  points: number;
  type: WalletTransactionType;
  description: string;
  orderId?: string;
  referenceId?: string;
}
