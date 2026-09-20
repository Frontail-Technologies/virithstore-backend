import { db } from "../../db/client";
import { users } from "../../db/schema/users";
import { walletTransactions, type NewWalletTransaction } from "../../db/schema/wallet";
import { eq, desc, sql } from "drizzle-orm";
import { AppError } from "../../shared/errors";

export class WalletService {
  /**
   * Get user wallet info & summary
   */
  static async getUserWallet(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        walletPoints: users.walletPoints,
        totalReferralPointsEarned: users.totalReferralPointsEarned,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Calculate total spent & total deposited
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId));

    let totalPointsSpent = 0;
    let totalPointsDeposited = 0;

    for (const tx of transactions) {
      if (tx.points < 0 && tx.status === "completed") {
        totalPointsSpent += Math.abs(tx.points);
      } else if (tx.type === "deposit" && tx.status === "completed") {
        totalPointsDeposited += tx.points;
      }
    }

    return {
      walletPoints: user.walletPoints || 0,
      totalReferralPointsEarned: user.totalReferralPointsEarned || 0,
      totalPointsSpent,
      totalPointsDeposited,
    };
  }

  /**
   * Get user transaction history with pagination
   */
  static async getUserTransactions(userId: string, limit = 50, offset = 0) {
    const txs = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    return txs;
  }

  /**
   * Credit or Debit points with atomic balance tracking
   */
  static async adjustPoints(params: {
    userId: string;
    points: number; // positive = credit, negative = debit
    type: "deposit" | "referral_reward" | "order_payment" | "refund" | "admin_adjustment" | "spin_reward";
    description: string;
    orderId?: string;
    referenceId?: string;
  }) {
    const { userId, points, type, description, orderId, referenceId } = params;

    return await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const balanceBefore = user.walletPoints || 0;
      const balanceAfter = balanceBefore + points;

      if (balanceAfter < 0) {
        throw new AppError(`Insufficient Points balance. You have ${balanceBefore} PTS, needed ${Math.abs(points)} PTS.`, 400);
      }

      // 1. Update user points
      await tx
        .update(users)
        .set({
          walletPoints: balanceAfter,
          ...(type === "referral_reward"
            ? { totalReferralPointsEarned: (user.totalReferralPointsEarned || 0) + points }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // 2. Insert transaction record
      const [createdTx] = await tx
        .insert(walletTransactions)
        .values({
          userId,
          type,
          points,
          balanceBefore,
          balanceAfter,
          orderId,
          referenceId,
          description,
          status: "completed",
        })
        .returning();

      return {
        transaction: createdTx,
        newBalance: balanceAfter,
      };
    });
  }

  /**
   * Point top-up packages list
   */
  static getTopUpPackages() {
    return [
      { id: "pkg_500", name: "Starter Pack", usdPrice: 5.0, points: 500, bonusPoints: 0, tag: null },
      { id: "pkg_1000", name: "Popular Pack", usdPrice: 10.0, points: 1000, bonusPoints: 50, tag: "POPULAR" },
      { id: "pkg_2000", name: "Pro Gamer Pack", usdPrice: 20.0, points: 2000, bonusPoints: 150, tag: "HOT" },
      { id: "pkg_5000", name: "Ultimate VIP Pack", usdPrice: 50.0, points: 5000, bonusPoints: 500, tag: "BEST VALUE" },
      { id: "pkg_10000", name: "Legendary Vault", usdPrice: 100.0, points: 10000, bonusPoints: 1200, tag: "12% BONUS" },
    ];
  }
}
