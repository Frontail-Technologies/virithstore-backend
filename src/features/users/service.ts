import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { users } from "../../db/schema/users";
import { notFound } from "../../libs/http-error";
import { parsePage, toPageMeta } from "../../libs/pagination";
import { hashPassword } from "../../libs/password";
import type { AdminUpdateUser, UpdateProfile, UsersQuery } from "./model";

/** Columns the admin screens may see: never the password hash or login OTP. */
const adminColumns = {
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
};

export async function listUsers(query: UsersQuery) {
  const { page, limit, offset } = parsePage(query);
  const where = query.search
    ? or(ilike(users.name, `%${query.search}%`), ilike(users.email, `%${query.search}%`), ilike(users.telegramId, `%${query.search}%`))
    : undefined;

  const [items, [{ count }]] = await Promise.all([
    db.select(adminColumns).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return { items, meta: toPageMeta(count, page, limit) };
}

export async function getUser(id: string) {
  const [user] = await db
    .select({ ...adminColumns, isDeleted: users.isDeleted })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!user) throw notFound("User not found");
  return user;
}

export async function updateProfile(userId: string, input: UpdateProfile) {
  const [updated] = await db
    .update(users)
    .set({
      updatedAt: new Date(),
      ...(input.name && { name: input.name }),
      ...(input.image && { image: input.image }),
      ...(input.password && { password: await hashPassword(input.password) }),
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email, name: users.name, image: users.image, role: users.role });
  if (!updated) throw notFound("User not found");
  return updated;
}

export async function updateUserByAdmin(id: string, input: AdminUpdateUser) {
  const [updated] = await db
    .update(users)
    .set({
      updatedAt: new Date(),
      ...(input.role && { role: input.role }),
      ...(input.isBlocked !== undefined && { isBlocked: input.isBlocked }),
      ...(input.isDeleted !== undefined && { isDeleted: input.isDeleted }),
      ...(input.password && { password: await hashPassword(input.password) }),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isBlocked: users.isBlocked,
      isDeleted: users.isDeleted,
    });
  if (!updated) throw notFound("User not found");
  return updated;
}

export async function hardDeleteUser(id: string) {
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id, email: users.email });
  if (!deleted) throw notFound("User not found");
  return deleted;
}
