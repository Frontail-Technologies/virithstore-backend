import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { spinCredits, spinPrizes, spinTransactions } from "../../db/schema/spin";
import { createCrudService } from "../../handlers/crud";
import { badRequest, forbidden, notFound } from "../../libs/http-error";
import { pickWeightedPrize } from "./selection";
import type { CreatePrize, UpdatePrize } from "./model";

const prizes = createCrudService(spinPrizes, { label: "Prize", orderBy: desc(spinPrizes.createdAt) });

export const listAllPrizes = prizes.list;
export const deletePrize = prizes.remove;
export const createPrize = (input: CreatePrize) => prizes.create(input);
export const updatePrize = (id: string, input: UpdatePrize) => prizes.update(id, input);

export const listActivePrizes = () => db.select().from(spinPrizes).where(eq(spinPrizes.isActive, true));

/**
 * Grants one spin credit after a qualifying purchase (order fulfilment, product.spinActive + spinCostIds).
 * The unique order id makes this idempotent per order.
 */
export async function grantSpinCredit(userId: string, orderId: string) {
  const [credit] = await db.insert(spinCredits).values({ userId, orderId }).onConflictDoNothing().returning();
  return credit;
}

export async function countAvailableCredits(userId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(spinCredits)
    .where(and(eq(spinCredits.userId, userId), eq(spinCredits.isUsed, false)));
  return count;
}

/** Spends one credit and records the prize in a single transaction, so a failure never burns a credit. */
export async function playSpin(userId: string) {
  return db.transaction(async (tx) => {
    // Atomically claim the oldest unused credit so concurrent requests can't spend the same one.
    const [claimedCredit] = await tx
      .update(spinCredits)
      .set({ isUsed: true, usedAt: new Date() })
      .where(
        eq(
          spinCredits.id,
          sql`(SELECT id FROM ${spinCredits} WHERE ${spinCredits.userId} = ${userId} AND ${spinCredits.isUsed} = false ORDER BY ${spinCredits.createdAt} ASC LIMIT 1 FOR UPDATE SKIP LOCKED)`,
        ),
      )
      .returning();

    if (!claimedCredit) {
      throw forbidden("You don't have any spin credits. Purchase a qualifying product to earn one.");
    }

    const available = await tx.select().from(spinPrizes).where(eq(spinPrizes.isActive, true));
    if (available.length === 0) throw badRequest("No prizes available for spin");

    const prize = pickWeightedPrize(available);
    const [transaction] = await tx
      .insert(spinTransactions)
      .values({ userId, prizeId: prize.id, prizeName: prize.name, prizeValue: prize.value, isClaimed: false })
      .returning();

    return { prize, transaction };
  });
}

export const listUserSpinHistory = (userId: string) =>
  db.select().from(spinTransactions).where(eq(spinTransactions.userId, userId)).orderBy(desc(spinTransactions.createdAt)).limit(50);

export const listAllSpinHistory = () =>
  db.select().from(spinTransactions).orderBy(desc(spinTransactions.createdAt)).limit(100);

export async function updateSpinStatus(id: string, status: string) {
  const [updated] = await db
    .update(spinTransactions)
    .set({ status, isClaimed: status === "success" })
    .where(eq(spinTransactions.id, id))
    .returning();
  if (!updated) throw notFound("Spin transaction not found");
  return updated;
}
