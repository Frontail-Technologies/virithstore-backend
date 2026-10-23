import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { accountsVault } from "../../db/schema/accountsVault";
import { products } from "../../db/schema/products";
import { badRequest, notFound } from "../../libs/http-error";
import { isUuid } from "../../libs/ids";
import { parsePage, toPageMeta } from "../../libs/pagination";
import type { AccountsQuery, SaveAccount } from "./model";

function filtersFor(query: AccountsQuery) {
  const conditions = [];
  if (query.productId && query.productId !== "all") conditions.push(eq(accountsVault.productId, query.productId));
  if (query.costId && query.costId !== "all") conditions.push(eq(accountsVault.costId, query.costId));
  if (query.status === "available") conditions.push(and(eq(accountsVault.isActive, true), eq(accountsVault.isReserved, false))!);
  else if (query.status === "reserved") conditions.push(eq(accountsVault.isReserved, true));
  else if (query.status === "inactive") conditions.push(eq(accountsVault.isActive, false));
  if (query.search) {
    conditions.push(or(ilike(accountsVault.email, `%${query.search}%`), ilike(products.name, `%${query.search}%`))!);
  }
  return conditions.length ? and(...conditions) : undefined;
}

/** Admin inventory list (credentials are intentionally not part of the list rows). */
export async function listAccounts(query: AccountsQuery) {
  const { page, limit, offset } = parsePage(query, { defaultLimit: 25 });
  const where = filtersFor(query);

  const [items, [{ count }]] = await Promise.all([
    db
      .select({
        id: accountsVault.id,
        productId: { id: products.id, name: products.name },
        costId: accountsVault.costId,
        email: accountsVault.email,
        isActive: accountsVault.isActive,
        isReserved: accountsVault.isReserved,
        createdAt: accountsVault.createdAt,
      })
      .from(accountsVault)
      .leftJoin(products, eq(accountsVault.productId, products.id))
      .where(where)
      .orderBy(desc(accountsVault.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountsVault)
      .leftJoin(products, eq(accountsVault.productId, products.id))
      .where(where),
  ]);

  return { items, meta: toPageMeta(count, page, limit) };
}

export async function getAccount(id: string) {
  const [account] = await db.select().from(accountsVault).where(eq(accountsVault.id, id)).limit(1);
  if (!account) throw notFound("Account not found");
  return account;
}

/** A product id that isn't a UUID (e.g. a slug from the form) is stored as "no product". */
const cleanInput = (input: SaveAccount) => ({
  ...input,
  ...(input.productId !== undefined && { productId: isUuid(input.productId) ? input.productId : null }),
});

export async function createAccount(input: SaveAccount) {
  if (!input.email || !input.costId) throw badRequest("email and costId are required");
  const [created] = await db
    .insert(accountsVault)
    .values({ ...cleanInput(input), email: input.email, costId: input.costId })
    .returning();
  return created;
}

export async function updateAccount(id: string, input: SaveAccount) {
  if (!isUuid(id)) throw notFound("Account not found");
  const [updated] = await db
    .update(accountsVault)
    .set({ ...cleanInput(input), updatedAt: new Date() })
    .where(eq(accountsVault.id, id))
    .returning();
  if (!updated) throw notFound("Account not found");
  return updated;
}

export async function deleteAccount(id: string) {
  if (!isUuid(id)) throw notFound("Account not found");
  const [deleted] = await db.delete(accountsVault).where(eq(accountsVault.id, id)).returning({ id: accountsVault.id });
  if (!deleted) throw notFound("Account not found");
  return { success: true };
}
