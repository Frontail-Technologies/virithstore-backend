import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { db } from "../../db/client";
import { marketAccounts, marketCategories } from "../../db/schema/marketAccounts";
import { createCrudService } from "../../handlers/crud";
import { notFound } from "../../libs/http-error";
import { isUuid } from "../../libs/ids";
import { slugify } from "../../libs/slug";
import type { SaveMarketAccount, SaveMarketCategory, UpdateMarketAccount } from "./model";

// Public listings must never include the delivery credentials.
const { credentials: _credentials, ...publicAccountColumns } = getTableColumns(marketAccounts);

const PUBLIC_LIST_LIMIT = 200;

export async function listPublicAccounts(category?: string) {
  const filters = [eq(marketAccounts.isActive, true)];
  if (category && category !== "all") filters.push(eq(marketAccounts.category, category));
  return db
    .select(publicAccountColumns)
    .from(marketAccounts)
    .where(and(...filters))
    .orderBy(desc(marketAccounts.createdAt))
    .limit(PUBLIC_LIST_LIMIT);
}

export async function getPublicAccount(id: string) {
  if (!isUuid(id)) return null;
  const [account] = await db
    .select(publicAccountColumns)
    .from(marketAccounts)
    .where(and(eq(marketAccounts.id, id), eq(marketAccounts.isActive, true)));
  return account ?? null;
}

export const listAdminAccounts = () => db.select().from(marketAccounts).orderBy(desc(marketAccounts.createdAt));

/** Money columns are `numeric` (strings); the dashboard sends numbers. */
const toMoney = (value: number | string | null | undefined) => (value === null || value === undefined ? value : String(value));
const toColumns = <T extends UpdateMarketAccount>(input: T) => ({
  ...input,
  ...(input.price !== undefined && { price: String(input.price) }),
  ...(input.originalPrice !== undefined && { originalPrice: toMoney(input.originalPrice) }),
  ...(input.stock !== undefined && { stock: String(input.stock) }),
});

export async function createMarketAccount(input: SaveMarketAccount) {
  const [created] = await db
    .insert(marketAccounts)
    .values({ ...toColumns(input), price: String(input.price) })
    .returning();
  return created;
}

export async function updateMarketAccount(id: string, input: UpdateMarketAccount) {
  const [updated] = await db
    .update(marketAccounts)
    .set({ ...toColumns(input), updatedAt: new Date() })
    .where(eq(marketAccounts.id, id))
    .returning();
  if (!updated) throw notFound("Market account not found");
  return updated;
}

export async function deleteMarketAccount(id: string) {
  const [deleted] = await db.delete(marketAccounts).where(eq(marketAccounts.id, id)).returning({ id: marketAccounts.id });
  if (!deleted) throw notFound("Market account not found");
  return { success: true };
}

const categories = createCrudService(marketCategories, { label: "Category" });

export const listMarketCategories = () => db.select().from(marketCategories).orderBy(marketCategories.name);
export const createMarketCategory = (input: SaveMarketCategory) =>
  categories.create({ name: input.name, description: input.description, slug: slugify(input.name) });
export const updateMarketCategory = (id: string, input: SaveMarketCategory) =>
  categories.update(id, { name: input.name, description: input.description, slug: slugify(input.name) });
export const deleteMarketCategory = async (id: string) => {
  await categories.remove(id);
  return { success: true };
};
