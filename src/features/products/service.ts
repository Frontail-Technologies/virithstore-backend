import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { accountsVault } from "../../db/schema/accountsVault";
import { products } from "../../db/schema/products";
import type { Product, ProductCostItem } from "../../db/schema/products";
import { resolveImages } from "../../libs/cloudinary";
import { notFound, validationError } from "../../libs/http-error";
import { isUuid } from "../../libs/ids";
import { parsePage, toPageMeta } from "../../libs/pagination";
import { slugify } from "../../libs/slug";
import { normalizeCostItems, toHomepageProduct } from "./mappers";
import type { CreateProduct, ProductsQuery, UpdateProduct } from "./model";

const IMAGE_FOLDER = "virithstore/products";

const parseBool = (value?: string) => (value === "true" ? true : value === "false" ? false : undefined);

const inventoryKey = (productId: string, costId: string) => `${productId}:${costId}`;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
export function isValidYouTubeUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    const id = host === "youtu.be"
      ? parts[0]
      : ["youtube.com", "youtube-nocookie.com"].includes(host)
        ? url.searchParams.get("v") || (["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : null)
        : null;
    return Boolean(id && YOUTUBE_ID.test(id));
  } catch {
    return false;
  }
}

function validateBannerMedia(input: Pick<CreateProduct, "banner" | "bannerType"> | Pick<UpdateProduct, "banner" | "bannerType">) {
  if (input.bannerType === "youtube" && input.banner && !isValidYouTubeUrl(input.banner)) {
    throw validationError("Enter a valid YouTube URL", [{ field: "banner", code: "invalid_url" }]);
  }
}

/** A direct link is an http(s) URL or a same-site path ("/product/x"); "//host" and other schemes are refused. */
export function normalizeDirectLink(value: string | null | undefined) {
  const link = value?.trim();
  if (!link) return null;
  if (link.startsWith("/") && !link.startsWith("//")) return link;
  try {
    const url = new URL(link);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // Falls through to the validation error below.
  }
  throw validationError("Enter a valid link starting with https://", [{ field: "link", code: "invalid_url" }]);
}

/** Normalizes `link` and requires one whenever the product is switched to a direct link. */
function withDirectLink<T extends { isLink?: boolean; link?: string | null }>(input: T): T {
  const link = input.link === undefined ? undefined : normalizeDirectLink(input.link);
  if (input.isLink && !link) {
    throw validationError("Add the link customers should be sent to", [{ field: "link", code: "required" }]);
  }
  return link === undefined ? input : { ...input, link };
}

type InventoryProduct =Pick<Product, "id" | "type" | "cost">;

/** Adds live vault availability without replacing the package's admin-controlled inStock flag. */
export function mergeAccountInventory<T extends InventoryProduct>(product: T, counts: ReadonlyMap<string, number>) {
  if (product.type !== "account") return product;

  return {
    ...product,
    cost: product.cost.map((item: ProductCostItem) => {
      const availableStock = counts.get(inventoryKey(product.id, item.id)) ?? 0;
      return { ...item, availableStock, inventoryAvailable: availableStock > 0 };
    }),
  };
}

async function withAccountInventory<T extends InventoryProduct>(productRows: T[]) {
  const accountProductIds = productRows.filter((product) => product.type === "account").map((product) => product.id);
  if (accountProductIds.length === 0) return productRows;

  const inventoryRows = await db
    .select({
      productId: accountsVault.productId,
      costId: accountsVault.costId,
      availableStock: sql<number>`count(*)::int`,
    })
    .from(accountsVault)
    // Unsold accounts, held or not: stock only drops when an account is actually sold (unpaid checkouts don't cut it).
    .where(and(inArray(accountsVault.productId, accountProductIds), eq(accountsVault.isActive, true)))
    .groupBy(accountsVault.productId, accountsVault.costId);

  const counts = new Map<string, number>();
  for (const row of inventoryRows) {
    if (row.productId) counts.set(inventoryKey(row.productId, row.costId), Number(row.availableStock));
  }

  return productRows.map((product) => mergeAccountInventory(product, counts));
}

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

  const [productRows, [{ count }]] = await Promise.all([
    db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
  ]);
  const items = await withAccountInventory(productRows);
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
  return (await withAccountInventory([product]))[0]!;
}

/** Accepts either the product id or its slug. */
export async function getProduct(idOrSlug: string) {
  if (!idOrSlug || idOrSlug === "undefined" || idOrSlug === "null") throw notFound("Product not found");
  if (!isUuid(idOrSlug)) return getProductBySlug(idOrSlug);

  const product = await findProduct(eq(products.id, idOrSlug));
  if (!product) throw notFound("Product not found");
  return (await withAccountInventory([product]))[0]!;
}

/** The dashboard sends slugs/placeholders for categories it hasn't saved yet; only real ids are kept. */
const categoryIdOrNull = (value: string | null | undefined) => (isUuid(value) ? value : null);

export async function createProduct(input: CreateProduct) {
  const { cost, categoryId, slug, ...rest } = withDirectLink(input);
  validateBannerMedia(rest);
  const resolved = await resolveImages(
    {
      ...rest,
      // Always URL-safe: an admin-typed "TikTok Like" becomes "tiktok-like".
      slug: slugify(slug || rest.name),
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

export async function updateProduct(id: string, input: UpdateProduct) {
  const { cost, categoryId, slug, ...rest } = withDirectLink(input);
  validateBannerMedia(rest);
  const resolved = await resolveImages(
    {
      ...rest,
      // Re-saving a product also repairs a slug that was stored with spaces or capitals.
      ...(slug !== undefined && { slug: slugify(slug) || slugify(rest.name || "") || undefined }),
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
    isLink: products.isLink,
    link: products.link,
  };
  const available = and(eq(products.isDeleted, false), eq(products.isAvailable, true));
  const group = (...conditions: ReturnType<typeof eq>[]) =>
    db.select(card).from(products).where(and(available, ...conditions)).orderBy(desc(products.createdAt)).limit(limit);

  const results = await Promise.allSettled([
    group(eq(products.type, "digital-service"), eq(products.isFeatured, true)),
    group(eq(products.type, "account")),
    group(eq(products.type, "digital-service"), eq(products.isFeatured, false)),
  ]);
  const rows = async (index: number) => {
    const result = results[index];
    if (result.status === "fulfilled") return (await withAccountInventory(result.value)).map(toHomepageProduct);
    console.error("Homepage product group query failed:", result.reason);
    return [];
  };

  const [featuredProducts, accountProducts, digitalServices] = await Promise.all([rows(0), rows(1), rows(2)]);
  return { featuredProducts, accountProducts, digitalServices };
}
