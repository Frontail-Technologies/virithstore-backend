import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { gifts, giftTransactions, type GiftClaimRecord } from "../../db/schema/gifts";
import { orders } from "../../db/schema/orders";
import { users } from "../../db/schema/users";
import { createCrudService } from "../../handlers/crud";
import { badRequest, notFound } from "../../libs/http-error";
import { toGiftProgress, toPublicGift } from "./mappers";
import type { CreateGift, GiftProgressResponse, UpdateGift } from "./model";

const crud = createCrudService(gifts, { label: "Gift" });

export const deleteGift = crud.remove;
export const createGift = ({ requiredWagering, ...rest }: CreateGift) =>
  crud.create({ ...rest, requiredWagering: String(requiredWagering) });
export function updateGift(id: string, { requiredWagering, ...rest }: UpdateGift) {
  return crud.update(id, { ...rest, ...(requiredWagering !== undefined && { requiredWagering: String(requiredWagering) }) });
}

export async function listPublicGifts() {
  const rows = await db.select().from(gifts).where(eq(gifts.isActive, true)).orderBy(desc(gifts.requiredWagering));
  return rows.map(toPublicGift);
}

export async function getPublicGift(id: string) {
  return toPublicGift(await crud.getById(id));
}

/** Sum of the user's completed orders: the "wagering" that unlocks gifts. */
async function getTotalSpent(userId: string): Promise<number> {
  const [result] = await db
    .select({ total: sql<string>`COALESCE(SUM(${orders.price}), 0)::text` })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, "completed")));
  return parseFloat(result?.total ?? "0");
}

export async function getUserWagering(userId: string): Promise<GiftProgressResponse> {
  const [spent, activeGifts] = await Promise.all([
    getTotalSpent(userId),
    db.select().from(gifts).where(eq(gifts.isActive, true)),
  ]);
  return { totalSpent: spent.toFixed(2), gifts: activeGifts.map((gift) => toGiftProgress(gift, userId, spent)) };
}

/** Claims a gift once per user. The gift row is locked so concurrent claims can't overwrite each other. */
export async function claimGift(giftId: string, userId: string) {
  const spent = await getTotalSpent(userId);

  return db.transaction(async (tx) => {
    const [gift] = await tx.select().from(gifts).where(eq(gifts.id, giftId)).for("update").limit(1);
    if (!gift || !gift.isActive) throw notFound("Gift box not found");
    if (gift.claimedBy.some((claim) => claim.userId === userId)) throw badRequest("Gift already claimed");

    const required = parseFloat(gift.requiredWagering);
    if (spent < required) throw badRequest(`Requires $${required} total completed orders to unlock`);

    const claims: GiftClaimRecord[] = [...gift.claimedBy, { userId, claimedAt: new Date().toISOString() }];
    await tx.update(gifts).set({ claimedBy: claims, updatedAt: new Date() }).where(eq(gifts.id, giftId));

    // Auditable record for the admin dashboard; cash/product rewards need manual fulfilment, so they start pending.
    await tx.insert(giftTransactions).values({
      userId,
      giftId,
      cost: gift.requiredWagering,
      userWagering: spent.toFixed(2),
      wagering: gift.requiredWagering,
      status: gift.rewardType === "discount" ? "approved" : "pending",
    });

    return { claimed: true, rewardType: gift.rewardType, rewardValue: gift.rewardValue };
  });
}

export const listGiftTransactions = () =>
  db
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
    .orderBy(desc(giftTransactions.createdAt))
    .limit(500);

export async function updateGiftTransactionStatus(id: string, status: string) {
  const [updated] = await db
    .update(giftTransactions)
    .set({ status, updatedAt: new Date() })
    .where(eq(giftTransactions.id, id))
    .returning();
  if (!updated) throw notFound("Gift transaction not found");
  return updated;
}
