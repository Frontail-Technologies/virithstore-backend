import { db } from "../../db/client";
import { gifts, giftTransactions, type NewGift, type GiftClaimRecord } from "../../db/schema/gifts";
import { orders } from "../../db/schema/orders";
import { users } from "../../db/schema/users";
import { eq, desc, sql } from "drizzle-orm";
import { NotFoundError, AppError } from "../../shared/errors";

export class GiftsService {
  static async getAll() {
    return await db.select().from(gifts).orderBy(desc(gifts.requiredWagering));
  }

  static async getById(id: string) {
    const [gift] = await db.select().from(gifts).where(eq(gifts.id, id)).limit(1);
    if (!gift) throw new NotFoundError("Gift not found");
    return gift;
  }

  static async getUserWagering(userId: string) {
    const [result] = await db
      .select({
        totalSpent: sql<string>`COALESCE(SUM(${orders.price}), 0)::text`,
      })
      .from(orders)
      .where(sql`${orders.userId} = ${userId} AND ${orders.status} = 'completed'`);

    const spent = parseFloat(result?.totalSpent || "0");
    const allGifts = await db.select().from(gifts).where(eq(gifts.isActive, true));

    const giftStatus = allGifts.map((gift) => {
      const required = parseFloat(gift.requiredWagering);
      const isClaimed = gift.claimedBy.some((c) => c.userId === userId);
      const isEligible = spent >= required && !isClaimed;

      return {
        id: gift.id,
        name: gift.name,
        image: gift.image,
        requiredWagering: gift.requiredWagering,
        rewardType: gift.rewardType,
        rewardValue: gift.rewardValue,
        isClaimed,
        isEligible,
        progress: Math.min(100, Math.round((spent / required) * 100)),
      };
    });

    return {
      totalSpent: spent.toFixed(2),
      gifts: giftStatus,
    };
  }

  static async claimGift(giftId: string, userId: string) {
    const [gift] = await db
      .select()
      .from(gifts)
      .where(eq(gifts.id, giftId))
      .limit(1);

    if (!gift || !gift.isActive) {
      throw new NotFoundError("Gift box not found");
    }

    if (gift.claimedBy.some((c) => c.userId === userId)) {
      throw new AppError("Gift already claimed", 400);
    }

    // Verify wagering
    const [result] = await db
      .select({
        totalSpent: sql<string>`COALESCE(SUM(${orders.price}), 0)::text`,
      })
      .from(orders)
      .where(sql`${orders.userId} = ${userId} AND ${orders.status} = 'completed'`);

    const spent = parseFloat(result?.totalSpent || "0");
    const required = parseFloat(gift.requiredWagering);

    if (spent < required) {
      throw new AppError(`Requires $${required} total completed orders to unlock`, 400);
    }

    const updatedClaims: GiftClaimRecord[] = [
      ...gift.claimedBy,
      { userId, claimedAt: new Date().toISOString() },
    ];

    await db
      .update(gifts)
      .set({ claimedBy: updatedClaims, updatedAt: new Date() })
      .where(eq(gifts.id, giftId));

    // Record the claim as an auditable transaction for the admin dashboard —
    // cash/product rewards need manual fulfillment, so this starts "pending".
    await db.insert(giftTransactions).values({
      userId,
      giftId,
      cost: gift.requiredWagering,
      userWagering: spent.toFixed(2),
      wagering: gift.requiredWagering,
      status: gift.rewardType === "discount" ? "approved" : "pending",
    });

    return {
      claimed: true,
      rewardType: gift.rewardType,
      rewardValue: gift.rewardValue,
    };
  }

  static async getAllTransactions() {
    return await db
      .select({
        id: giftTransactions.id,
        userId: giftTransactions.userId,
        userEmail: users.email,
        userName: users.name,
        giftId: giftTransactions.giftId,
        giftName: gifts.name,
        rewardType: gifts.rewardType,
        rewardValue: gifts.rewardValue,
        cost: giftTransactions.cost,
        userWagering: giftTransactions.userWagering,
        wagering: giftTransactions.wagering,
        status: giftTransactions.status,
        createdAt: giftTransactions.createdAt,
      })
      .from(giftTransactions)
      .leftJoin(users, eq(giftTransactions.userId, users.id))
      .leftJoin(gifts, eq(giftTransactions.giftId, gifts.id))
      .orderBy(desc(giftTransactions.createdAt));
  }

  static async updateTransactionStatus(id: string, status: string) {
    const [updated] = await db
      .update(giftTransactions)
      .set({ status, updatedAt: new Date() })
      .where(eq(giftTransactions.id, id))
      .returning();

    if (!updated) throw new NotFoundError("Gift transaction not found");
    return updated;
  }

  static async create(data: NewGift) {
    const [created] = await db.insert(gifts).values(data).returning();
    return created;
  }

  static async update(id: string, data: Partial<NewGift>) {
    const [updated] = await db
      .update(gifts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(gifts.id, id))
      .returning();

    if (!updated) throw new NotFoundError("Gift not found");
    return updated;
  }

  static async delete(id: string) {
    const [deleted] = await db.delete(gifts).where(eq(gifts.id, id)).returning();
    if (!deleted) throw new NotFoundError("Gift not found");
    return deleted;
  }
}
