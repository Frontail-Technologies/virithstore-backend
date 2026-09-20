import { db } from "../../db/client";
import { users } from "../../db/schema/users";
import { eq, desc, sql, ilike, or } from "drizzle-orm";
import { NotFoundError } from "../../shared/errors";
import bcrypt from "bcryptjs";

export class UsersService {
  static async getAll(params?: { search?: string; page?: number; limit?: number }) {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const offset = (page - 1) * limit;

    const whereClause = params?.search
      ? or(
          ilike(users.name, `%${params.search}%`),
          ilike(users.email, `%${params.search}%`),
          ilike(users.telegramId, `%${params.search}%`)
        )
      : undefined;

    const items = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        telegramId: users.telegramId,
        authProvider: users.authProvider,
        role: users.role,
        isVerified: users.isVerified,
        isBlocked: users.isBlocked,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
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

  static async updateProfile(userId: string, data: { name?: string; image?: string; password?: string }) {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.name) updateData.name = data.name;
    if (data.image) updateData.image = data.image;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new NotFoundError("User not found");
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      image: updated.image,
      role: updated.role,
    };
  }

  static async getById(id: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        telegramId: users.telegramId,
        authProvider: users.authProvider,
        role: users.role,
        isVerified: users.isVerified,
        isBlocked: users.isBlocked,
        isDeleted: users.isDeleted,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  static async updateUserByAdmin(id: string, data: { role?: "admin" | "user"; isBlocked?: boolean; isDeleted?: boolean; password?: string }) {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.role) updateData.role = data.role;
    if (data.isBlocked !== undefined) updateData.isBlocked = data.isBlocked;
    if (data.isDeleted !== undefined) updateData.isDeleted = data.isDeleted;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isBlocked: users.isBlocked,
        isDeleted: users.isDeleted,
      });

    if (!updated) throw new NotFoundError("User not found");
    return updated;
  }

  static async softDelete(id: string) {
    const [deleted] = await db
      .update(users)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, email: users.email, isDeleted: users.isDeleted });

    if (!deleted) throw new NotFoundError("User not found");
    return deleted;
  }
}
