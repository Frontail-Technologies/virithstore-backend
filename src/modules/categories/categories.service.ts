import { db } from "../../db/client";
import { categories, type NewCategory } from "../../db/schema/categories";
import { eq, asc } from "drizzle-orm";
import { NotFoundError } from "../../shared/errors";

export class CategoriesService {
  static async getAll() {
    return await db
      .select()
      .from(categories)
      .orderBy(asc(categories.order));
  }

  static async getById(id: string) {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    return category;
  }

  static async create(data: NewCategory) {
    const [created] = await db.insert(categories).values(data).returning();
    return created;
  }

  static async update(id: string, data: Partial<NewCategory>) {
    const [updated] = await db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Category not found");
    }

    return updated;
  }

  static async delete(id: string) {
    const [deleted] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundError("Category not found");
    }

    return deleted;
  }
}
