import { db } from "../../db/client";
import { spinPrizes, spinTransactions, spinCredits, type NewSpinPrize } from "../../db/schema/spin";
import { eq, desc, and, sql } from "drizzle-orm";
import { NotFoundError, AppError } from "../../shared/errors";

export class SpinService {
  static async getPrizes() {
    return await db.select().from(spinPrizes).where(eq(spinPrizes.isActive, true));
  }

  static async getAllPrizes() {
    return await db.select().from(spinPrizes).orderBy(desc(spinPrizes.createdAt));
  }

  /**
   * Grants one spin credit to a user after a qualifying purchase (called from order
   * fulfillment when the product has spinActive + the purchased package in
   * spinCostIds). Spins are an earned feature, not something every visitor gets.
   */
  static async grantCredit(userId: string, orderId: string) {
    const [credit] = await db.insert(spinCredits).values({ userId, orderId }).returning();
    return credit;
  }

  static async getAvailableCredits(userId: string) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(spinCredits)
      .where(and(eq(spinCredits.userId, userId), eq(spinCredits.isUsed, false)));
    return count;
  }

  static async spin(userId: string) {
    // Atomically claim one unused credit so concurrent requests can't both spend
    // the same one.
    const [claimedCredit] = await db
      .update(spinCredits)
      .set({ isUsed: true, usedAt: new Date() })
      .where(
        eq(
          spinCredits.id,
          sql`(SELECT id FROM ${spinCredits} WHERE ${spinCredits.userId} = ${userId} AND ${spinCredits.isUsed} = false ORDER BY ${spinCredits.createdAt} ASC LIMIT 1)`
        )
      )
      .returning();

    if (!claimedCredit) {
      throw new AppError("You don't have any spin credits. Purchase a qualifying product to earn one.", 403);
    }

    const prizes = await db
      .select()
      .from(spinPrizes)
      .where(eq(spinPrizes.isActive, true));

    if (prizes.length === 0) {
      throw new AppError("No prizes available for spin", 400);
    }

    // Weighted random selection based on prize probability
    const totalWeight = prizes.reduce((acc, p) => acc + p.probability, 0);
    let random = Math.random() * totalWeight;
    let selectedPrize = prizes[0];

    for (const prize of prizes) {
      if (random < prize.probability) {
        selectedPrize = prize;
        break;
      }
      random -= prize.probability;
    }

    // Record transaction
    const [transaction] = await db
      .insert(spinTransactions)
      .values({
        userId,
        prizeId: selectedPrize.id,
        prizeName: selectedPrize.name,
        prizeValue: selectedPrize.value,
        isClaimed: false,
      })
      .returning();

    return {
      prize: selectedPrize,
      transaction,
    };
  }

  static async getUserHistory(userId: string) {
    return await db
      .select()
      .from(spinTransactions)
      .where(eq(spinTransactions.userId, userId))
      .orderBy(desc(spinTransactions.createdAt))
      .limit(50);
  }

  static async getAllHistory() {
    return await db
      .select()
      .from(spinTransactions)
      .orderBy(desc(spinTransactions.createdAt))
      .limit(100);
  }

  static async updateTransactionStatus(id: string, status: string) {
    const [updated] = await db
      .update(spinTransactions)
      .set({ status, isClaimed: status === "success" })
      .where(eq(spinTransactions.id, id))
      .returning();

    if (!updated) throw new NotFoundError("Spin transaction not found");
    return updated;
  }

  static async createPrize(data: NewSpinPrize) {
    const [created] = await db.insert(spinPrizes).values(data).returning();
    return created;
  }

  static async updatePrize(id: string, data: Partial<NewSpinPrize>) {
    const [updated] = await db
      .update(spinPrizes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(spinPrizes.id, id))
      .returning();

    if (!updated) throw new NotFoundError("Prize not found");
    return updated;
  }

  static async deletePrize(id: string) {
    const [deleted] = await db.delete(spinPrizes).where(eq(spinPrizes.id, id)).returning();
    if (!deleted) throw new NotFoundError("Prize not found");
    return deleted;
  }
}
