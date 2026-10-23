import { and, desc, eq, sql } from "drizzle-orm";
import { db, type Tx } from "../../db/client";
import { users } from "../../db/schema/users";
import { walletTransactions } from "../../db/schema/wallet";
import { badRequest, notFound } from "../../libs/http-error";
import type { PointsAdjustment } from "./model";

export async function getWalletSummary(userId: string) {
  const wallet = walletTransactions;
  const [[user], [totals]] = await Promise.all([
    db
      .select({
        id: users.id,
        walletPoints: users.walletPoints,
        totalReferralPointsEarned: users.totalReferralPointsEarned,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    // Totals are aggregated in SQL instead of loading every transaction row.
    db
      .select({
        spent: sql<number>`COALESCE(SUM(-${wallet.points}) FILTER (WHERE ${wallet.points} < 0 AND ${wallet.status} = 'completed'), 0)::int`,
        deposited: sql<number>`COALESCE(SUM(${wallet.points}) FILTER (WHERE ${wallet.type} = 'deposit' AND ${wallet.status} = 'completed' AND ${wallet.points} >= 0), 0)::int`,
      })
      .from(wallet)
      .where(eq(wallet.userId, userId)),
  ]);

  if (!user) throw notFound("User not found");

  return {
    walletPoints: user.walletPoints,
    totalReferralPointsEarned: user.totalReferralPointsEarned,
    totalPointsSpent: totals?.spent ?? 0,
    totalPointsDeposited: totals?.deposited ?? 0,
  };
}

export const listWalletTransactions = (userId: string, limit: number, offset: number) =>
  db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit)
    .offset(offset);

/**
 * Credits or debits points inside an existing transaction.
 * The balance change is a single guarded UPDATE, so concurrent debits can never overdraw the wallet.
 */
export async function applyPointsAdjustment(tx: Tx, { userId, points, type, description, orderId, referenceId }: PointsAdjustment) {
  const [updated] = await tx
    .update(users)
    .set({
      walletPoints: sql`${users.walletPoints} + ${points}`,
      ...(type === "referral_reward" && { totalReferralPointsEarned: sql`${users.totalReferralPointsEarned} + ${points}` }),
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), sql`${users.walletPoints} + ${points} >= 0`))
    .returning({ walletPoints: users.walletPoints });

  if (!updated) {
    const [user] = await tx.select({ balance: users.walletPoints }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw notFound("User not found");
    throw badRequest(`Insufficient Points balance. You have ${user.balance} PTS, needed ${Math.abs(points)} PTS.`);
  }

  const balanceAfter = updated.walletPoints;
  const [transaction] = await tx
    .insert(walletTransactions)
    .values({
      userId,
      type,
      points,
      balanceBefore: balanceAfter - points,
      balanceAfter,
      orderId,
      referenceId,
      description,
      status: "completed",
    })
    .returning();

  return { transaction, newBalance: balanceAfter };
}

/** Credits or debits points in its own transaction. */
export const adjustPoints = (adjustment: PointsAdjustment) => db.transaction((tx) => applyPointsAdjustment(tx, adjustment));
