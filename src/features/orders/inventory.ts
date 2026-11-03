import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "../../db/client";
import { accountsVault, type AccountVault } from "../../db/schema/accountsVault";
import { PAYWAY_LIFETIME_MINUTES } from "../../libs/payway";

/** How long checkout holds an account. Matches the PayWay transaction lifetime so both expire together. */
export const RESERVATION_MINUTES = PAYWAY_LIFETIME_MINUTES;

const holdExpiry = sql`NOW() + (${RESERVATION_MINUTES}::int * INTERVAL '1 minute')`;

/**
 * Holds one unsold vault account for an order. Expired holds can be taken over.
 * The inner SELECT locks the row (SKIP LOCKED), so two checkouts can never hold the same account.
 */
export async function claimAccount(tx: Tx, productId: string, costId: string, orderId: string): Promise<AccountVault | null> {
  const [claimed] = await tx
    .update(accountsVault)
    .set({ isReserved: true, reservedExpiry: holdExpiry, reservedOrderId: orderId, updatedAt: new Date() })
    .where(
      eq(
        accountsVault.id,
        sql`(
          SELECT ${accountsVault.id} FROM ${accountsVault}
          WHERE ${accountsVault.productId} = ${productId}
            AND ${accountsVault.costId} = ${costId}
            AND ${accountsVault.isActive} = true
            AND (${accountsVault.isReserved} = false OR ${accountsVault.reservedExpiry} < NOW())
          ORDER BY ${accountsVault.createdAt}
          FOR UPDATE SKIP LOCKED LIMIT 1
        )`,
      ),
    )
    .returning();
  return claimed ?? null;
}

/** The account this order still holds (locked), or null when the hold was released or taken over. */
export async function findHeldAccount(tx: Tx, accountId: string | undefined, orderId: string): Promise<AccountVault | null> {
  if (!accountId) return null;
  const [account] = await tx
    .select()
    .from(accountsVault)
    .where(and(eq(accountsVault.id, accountId), eq(accountsVault.isActive, true), eq(accountsVault.reservedOrderId, orderId)))
    .for("update")
    .limit(1);
  return account ?? null;
}

/** Pushes the hold time forward for an order that is still trying to pay. */
export async function extendHold(tx: Tx, accountId: string, orderId: string) {
  await tx
    .update(accountsVault)
    .set({ isReserved: true, reservedExpiry: holdExpiry, updatedAt: new Date() })
    .where(and(eq(accountsVault.id, accountId), eq(accountsVault.reservedOrderId, orderId), eq(accountsVault.isActive, true)));
}

/** Marks an account sold. It leaves stock for good. */
export async function sellAccount(tx: Tx, accountId: string) {
  await tx
    .update(accountsVault)
    .set({ isActive: false, isReserved: false, reservedExpiry: null, reservedOrderId: null, updatedAt: new Date() })
    .where(eq(accountsVault.id, accountId));
}

/** Gives every unsold account held by this order back to stock. */
export async function releaseHolds(tx: Tx, orderId: string) {
  await tx
    .update(accountsVault)
    .set({ isReserved: false, reservedExpiry: null, reservedOrderId: null, updatedAt: new Date() })
    .where(and(eq(accountsVault.reservedOrderId, orderId), eq(accountsVault.isActive, true)));
}

/** Unsold accounts for a package, held or not. Used to tell "sold out" apart from "everything is being bought". */
export async function countUnsold(tx: Tx, productId: string, costId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(accountsVault)
    .where(and(eq(accountsVault.productId, productId), eq(accountsVault.costId, costId), eq(accountsVault.isActive, true)));
  return Number(row?.count ?? 0);
}

export const ALL_HELD_MESSAGE = "All accounts in this package are being purchased right now. Please try again in a few minutes.";
export const OUT_OF_STOCK_MESSAGE = "This package is currently out of stock";
