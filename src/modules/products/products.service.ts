import { db } from "../../db/client";
import { products, type NewProduct, type ProductCostItem, type ProductFieldItem } from "../../db/schema/products";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { NotFoundError } from "../../shared/errors";
import { resolveImages } from "../../shared/cloudinary";

export class ProductsService {
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

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return product;
  }

  static async getBySlug(slug: string) {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return product;
  }

  static async create(data: NewProduct) {
    const resolved = await resolveImages(data, "virithstore/products");
    const [created] = await db.insert(products).values(resolved).returning();
    return created;
  }

  static async update(id: string, data: Partial<NewProduct>) {
    const resolved = await resolveImages(data, "virithstore/products");
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
