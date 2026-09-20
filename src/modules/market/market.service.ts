import { db } from "../../db/client";
import { marketAccounts, marketCategories } from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";

export class MarketService {
  static async getAccounts(category?: string) {
    let whereClause = eq(marketAccounts.isActive, true);
    if (category && category !== "all") {
      whereClause = and(eq(marketAccounts.isActive, true), eq(marketAccounts.category, category)) as any;
    }
    return db.select().from(marketAccounts).where(whereClause).orderBy(desc(marketAccounts.createdAt));
  }

  static async getAllAdminAccounts() {
    return db.select().from(marketAccounts).orderBy(desc(marketAccounts.createdAt));
  }

  static async getAccountById(id: string) {
    const [acc] = await db.select().from(marketAccounts).where(eq(marketAccounts.id, id));
    return acc || null;
  }

  static async upsertAccount(id?: string, data?: any) {
    if (id) {
      const [updated] = await db
        .update(marketAccounts)
        .set({
          ...data,
          price: String(data.price),
          updatedAt: new Date(),
        })
        .where(eq(marketAccounts.id, id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(marketAccounts)
        .values({
          ...data,
          price: String(data.price),
        })
        .returning();
      return created;
    }
  }

  static async deleteAccount(id: string) {
    await db.delete(marketAccounts).where(eq(marketAccounts.id, id));
    return true;
  }

  static async getCategories() {
    return db.select().from(marketCategories).orderBy(marketCategories.name);
  }

  static async createCategory(name: string, description?: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const [created] = await db
      .insert(marketCategories)
      .values({ name, slug, description })
      .returning();
    return created;
  }

  static async updateCategory(id: string, name: string, description?: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const [updated] = await db
      .update(marketCategories)
      .set({ name, slug, description })
      .where(eq(marketCategories.id, id))
      .returning();
    return updated;
  }

  static async deleteCategory(id: string) {
    await db.delete(marketCategories).where(eq(marketCategories.id, id));
    return true;
  }
}
