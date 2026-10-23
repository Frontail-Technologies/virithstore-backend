import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { products } from "../../db/schema/products";
import { resolveImages } from "../../libs/cloudinary";
import { notFound } from "../../libs/http-error";
import { isUuid } from "../../libs/ids";
import { parsePage, toPageMeta } from "../../libs/pagination";
import { slugify } from "../../libs/slug";
import { normalizeCostItems, toHomepageProduct } from "./mappers";
import type { CreateProduct, ProductsQuery, UpdateProduct } from "./model";

const IMAGE_FOLDER = "virithstore/products";

const parseBool = (value?: string) => (value === "true" ? true : value === "false" ? false : undefined);

export async function listProducts(query: ProductsQuery) {
  const { page, limit, offset } = parsePage(query);
  const isHot = parseBool(query.isHot);
  const isFeatured = parseBool(query.isFeatured);

  const conditions = [eq(products.isDeleted, false)];
  if (query.type) conditions.push(eq(products.type, query.type));
  if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));
  if (isHot !== undefined) conditions.push(eq(products.isHot, isHot));
  if (isFeatured !== undefined) conditions.push(eq(products.isFeatured, isFeatured));
  if (query.search) conditions.push(ilike(products.name, `%${query.search}%`));
  const where = and(...conditions);

  const [items, [{ count }]] = await Promise.all([
    db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
  ]);
  return { items, meta: toPageMeta(count, page, limit) };
}

export const listProductOptions = () =>
  db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      type: products.type,
      isAvailable: products.isAvailable,
      cost: products.cost,
    })
    .from(products)
    .where(eq(products.isDeleted, false))
    .orderBy(products.name);

async function findProduct(condition: ReturnType<typeof eq>) {
  const [product] = await db.select().from(products).where(and(condition, eq(products.isDeleted, false))).limit(1);
  return product;
}

export async function getProductBySlug(slug: string) {
  const product = await findProduct(eq(products.slug, slug));
  if (!product) throw notFound("Product not found");
  return product;
}

/** Accepts either the product id or its slug. */
export async function getProduct(idOrSlug: string) {
  if (!idOrSlug || idOrSlug === "undefined" || idOrSlug === "null") throw notFound("Product not found");
  if (!isUuid(idOrSlug)) return getProductBySlug(idOrSlug);

  const product = await findProduct(eq(products.id, idOrSlug));
  if (!product) throw notFound("Product not found");
  return product;
}

/** The dashboard sends slugs/placeholders for categories it hasn't saved yet; only real ids are kept. */
const categoryIdOrNull = (value: string | null | undefined) => (isUuid(value) ? value : null);

export async function createProduct({ cost, categoryId, slug, ...rest }: CreateProduct) {
  const resolved = await resolveImages(
    {
      ...rest,
      slug: slug ?? slugify(rest.name),
      categoryId: categoryIdOrNull(categoryId),
      slides: rest.slides ?? [],
      cost: normalizeCostItems(cost ?? []),
      fields: rest.fields ?? [],
      spinCostIds: rest.spinCostIds ?? [],
    },
    IMAGE_FOLDER,
  );
  const [created] = await db.insert(products).values(resolved).returning();
  return created;
}

export async function updateProduct(id: string, { cost, categoryId, ...rest }: UpdateProduct) {
  const resolved = await resolveImages(
    {
      ...rest,
      ...(categoryId !== undefined && { categoryId: categoryIdOrNull(categoryId) }),
      ...(cost && { cost: normalizeCostItems(cost) }),
    },
    IMAGE_FOLDER,
  );
  const [updated] = await db
    .update(products)
    .set({ ...resolved, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  if (!updated) throw notFound("Product not found");
  return updated;
}

/**
 * Soft delete: hides the product but keeps its orders and vault accounts intact.
 * The slug is freed so a replacement product can reuse it.
 */
export async function deleteProduct(id: string) {
  const [existing] = await db.select({ slug: products.slug }).from(products).where(eq(products.id, id)).limit(1);
  if (!existing) throw notFound("Product not found");

  const [deleted] = await db
    .update(products)
    .set({ isDeleted: true, isAvailable: false, slug: `${existing.slug}-deleted-${Date.now()}`, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return deleted;
}

export async function bulkDeleteProducts(ids: string[]) {
  const validIds = ids.filter(isUuid);
  if (validIds.length === 0) return { deletedCount: 0 };

  const rows = await db.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.id, validIds));
  await Promise.all(rows.map((row) => deleteProduct(row.id)));
  return { deletedCount: rows.length };
}

/** Three storefront rows (featured services, accounts, other services); a failing row degrades to empty. */
export async function listHomepageProductGroups(limit = 12) {
  const card = {
    id: products.id,
    slug: products.slug,
    name: products.name,
    nameKh: products.nameKh,
    image: products.image,
    type: products.type,
    region: products.region,
    isHot: products.isHot,
    isPopular: products.isPopular,
    stock: products.stock,
    cost: products.cost,
  };
  const available = and(eq(products.isDeleted, false), eq(products.isAvailable, true));
  const group = (...conditions: ReturnType<typeof eq>[]) =>
    db.select(card).from(products).where(and(available, ...conditions)).orderBy(desc(products.createdAt)).limit(limit);

  const results = await Promise.allSettled([
    group(eq(products.type, "digital-service"), eq(products.isFeatured, true)),
    group(eq(products.type, "account")),
    group(eq(products.type, "digital-service"), eq(products.isFeatured, false)),
  ]);
  const rows = (index: number) => {
    const result = results[index];
    if (result.status === "fulfilled") return result.value.map(toHomepageProduct);
    console.error("Homepage product group query failed:", result.reason);
    return [];
  };

  return { featuredProducts: rows(0), accountProducts: rows(1), digitalServices: rows(2) };
}
