import { db } from "../../db/client";
import { accountsVault, products } from "../../db/schema";
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";

export class AccountsVaultService {
  static async getAccounts(params: {
    productId?: string;
    costId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const conditions = [];
    if (params.productId && params.productId !== "all") {
      conditions.push(eq(accountsVault.productId, params.productId));
    }
    if (params.costId && params.costId !== "all") {
      conditions.push(eq(accountsVault.costId, params.costId));
    }
    if (params.status === "available") {
      conditions.push(and(eq(accountsVault.isActive, true), eq(accountsVault.isReserved, false))!);
    } else if (params.status === "reserved") {
      conditions.push(eq(accountsVault.isReserved, true));
    } else if (params.status === "inactive") {
      conditions.push(eq(accountsVault.isActive, false));
    }
    if (params.search) {
      conditions.push(or(ilike(accountsVault.email, `%${params.search}%`), ilike(products.name, `%${params.search}%`))!);
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const items = await db
      .select({
        id: accountsVault.id,
        productId: {
          id: products.id,
          name: products.name,
        },
        costId: accountsVault.costId,
        email: accountsVault.email,
        isActive: accountsVault.isActive,
        isReserved: accountsVault.isReserved,
        createdAt: accountsVault.createdAt,
      })
      .from(accountsVault)
      .leftJoin(products, eq(accountsVault.productId, products.id))
      .where(whereClause as any)
      .orderBy(desc(accountsVault.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountsVault)
      .leftJoin(products, eq(accountsVault.productId, products.id))
      .where(whereClause as any);

    return { items, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
  }

  static async getAccountById(id: string) {
    const [account] = await db.select().from(accountsVault).where(eq(accountsVault.id, id)).limit(1);
    return account;
  }

  static async upsertAccount(id?: string, data?: any) {
    const isUUID = (str?: string | null) =>
      typeof str === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const cleanData = { ...data };
    delete cleanData.id;
    delete cleanData._id;

    if (cleanData.productId !== undefined) {
      cleanData.productId = isUUID(cleanData.productId) ? cleanData.productId : null;
    }

    if (id && isUUID(id)) {
      const [updated] = await db
        .update(accountsVault)
        .set({
          ...cleanData,
          updatedAt: new Date(),
        })
        .where(eq(accountsVault.id, id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(accountsVault)
        .values(cleanData)
        .returning();
      return created;
    }
  }

  static async deleteAccount(id: string) {
    await db.delete(accountsVault).where(eq(accountsVault.id, id));
    return true;
  }
}
