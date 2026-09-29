import { db } from "../../db/client";
import { products, type NewProduct, type ProductCostItem, type ProductFieldItem } from "../../db/schema/products";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { NotFoundError } from "../../shared/errors";
import { resolveImages } from "../../shared/cloudinary";

export interface HomepageProductDto {
  id: string;
  slug: string;
  name: string;
  nameKh: string | null;
  image: string;
  type: "digital-service" | "account";
  region: string | null;
  isHot: boolean;
  isPopular: boolean;
  inStock: boolean;
  minPrice: string | null;
  originalPrice: string | null;
}

export function toHomepageProduct(product: {
  id: string;
  slug: string;
  name: string;
  nameKh: string | null;
  image: string;
  type: "digital-service" | "account";
  region: string | null;
  isHot: boolean;
  isPopular: boolean;
  stock: boolean;
  cost: ProductCostItem[];
}): HomepageProductDto {
  const purchasable = product.cost.filter((item) => item.isActive !== false && item.inStock !== false && (item.stock ?? 1) > 0);
  const priced = purchasable
    .map((item) => ({ item, value: Number(item.price) }))
    .filter(({ value }) => Number.isFinite(value))
    .sort((a, b) => a.value - b.value);
  const cheapest = priced[0]?.item;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    nameKh: product.nameKh,
    image: product.image,
    type: product.type,
    region: product.region,
    isHot: product.isHot,
    isPopular: product.isPopular,
    inStock: product.stock && purchasable.length > 0,
    minPrice: cheapest?.price ?? null,
    originalPrice: cheapest?.costPrice ?? null,
  };
}

export class ProductsService {
  static async getAdminOptions() {
    return db
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
  }

  static async getHomepageGroups(limit = 12) {
    const publicFields = {
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
    const getGroup = (condition: ReturnType<typeof eq>) => db
      .select(publicFields)
      .from(products)
      .where(and(available, condition))
      .orderBy(desc(products.createdAt))
      .limit(limit);

    const results = await Promise.allSettled([
      db.select(publicFields).from(products).where(and(available, eq(products.type, "digital-service"), eq(products.isFeatured, true))).orderBy(desc(products.createdAt)).limit(limit),
      getGroup(eq(products.type, "account")),
      db.select(publicFields).from(products).where(and(available, eq(products.type, "digital-service"), eq(products.isFeatured, false))).orderBy(desc(products.createdAt)).limit(limit),
    ]);
    const group = (index: number) => {
      const result = results[index];
      if (result?.status === "fulfilled") return result.value;
      console.error("Homepage product group query failed:", result?.reason);
      return [];
    };

    return {
      featuredProducts: group(0).map(toHomepageProduct),
      accountProducts: group(1).map(toHomepageProduct),
      digitalServices: group(2).map(toHomepageProduct),
    };
  }

  static async getAll(params?: {
    type?: "digital-service" | "account";
    categoryId?: string;
    isHot?: boolean;
    isFeatured?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
  }) {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (!params?.includeDeleted) {
      conditions.push(eq(products.isDeleted, false));
    }

    if (params?.type) {
      conditions.push(eq(products.type, params.type));
    }
    if (params?.categoryId) {
      conditions.push(eq(products.categoryId, params.categoryId));
    }
    if (params?.isHot !== undefined) {
      conditions.push(eq(products.isHot, params.isHot));
    }
    if (params?.isFeatured !== undefined) {
      conditions.push(eq(products.isFeatured, params.isFeatured));
    }
    if (params?.search) {
      conditions.push(ilike(products.name, `%${params.search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(whereClause);

    return {
      items,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  static async getById(id: string) {
    if (!id || id === "undefined" || id === "null") {
      throw new NotFoundError("Product not found");
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUUID) {
      return this.getBySlug(id);
    }

    const product = await this.findOne(eq(products.id, id));

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return product;
  }

  static async getBySlug(slug: string) {
    const product = await this.findOne(eq(products.slug, slug));

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return product;
  }

  private static async findOne(condition: ReturnType<typeof eq>) {
    const [product] = await db.select().from(products).where(condition).limit(1);
    return product;
  }

  static async create(data: any) {
    const isUUID = (str?: string | null) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const cleanData: any = { ...data };
    if (!isUUID(cleanData.id)) {
      delete cleanData.id;
    }
    delete cleanData._id;

    if (!isUUID(cleanData.categoryId)) {
      cleanData.categoryId = null;
    }

    if (!Array.isArray(cleanData.slides)) cleanData.slides = [];
    if (!Array.isArray(cleanData.cost)) cleanData.cost = [];
    if (!Array.isArray(cleanData.fields)) cleanData.fields = [];
    if (!Array.isArray(cleanData.spinCostIds)) cleanData.spinCostIds = [];

    const resolved = await resolveImages(cleanData, "virithstore/products");
    const [created] = await db.insert(products).values(resolved).returning();
    return created;
  }

  static async update(id: string, data: any) {
    const isUUID = (str?: string | null) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const cleanData: any = { ...data };
    delete cleanData.id;
    delete cleanData._id;

    if (cleanData.categoryId !== undefined && !isUUID(cleanData.categoryId)) {
      cleanData.categoryId = null;
    }

    const resolved = await resolveImages(cleanData, "virithstore/products");
    const [updated] = await db
      .update(products)
      .set({ ...resolved, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Product not found");
    }

    return updated;
  }

  static async delete(id: string) {
    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundError("Product not found");
    }

    return deleted;
  }

  static async bulkDelete(ids: string[]) {
    await db.delete(products).where(sql`${products.id} = ANY(${ids})`);
    return { deletedCount: ids.length };
  }
}
