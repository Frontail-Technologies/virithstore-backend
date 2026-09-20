import { Elysia } from "elysia";
import { bearer } from "@elysiajs/bearer";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../shared/errors";
import { db } from "../db/client";
import { users, type User } from "../db/schema/users";
import { eq } from "drizzle-orm";

export interface TokenPayload {
  userId: string;
  email?: string;
  role: "admin" | "user";
  telegramId?: string;
}

export const authPlugin = new Elysia({ name: "auth-plugin" })
  .use(bearer())
  .derive({ as: "scoped" }, async ({ bearer }): Promise<{ user: User | null }> => {
    if (!bearer) {
      return { user: null };
    }

    try {
      const decoded = jwt.verify(bearer, env.JWT_SECRET) as TokenPayload;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (!user || user.isBlocked || user.isDeleted) {
        return { user: null };
      }

      return { user };
    } catch {
      return { user: null };
    }
  });

export const requireAuthPlugin = new Elysia({ name: "require-auth-plugin" })
  .use(bearer())
  .derive({ as: "scoped" }, async ({ bearer }): Promise<{ user: User }> => {
    if (!bearer) {
      throw new UnauthorizedError("Authentication required");
    }

    try {
      const decoded = jwt.verify(bearer, env.JWT_SECRET) as TokenPayload;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (!user || user.isBlocked || user.isDeleted) {
        throw new UnauthorizedError("User not found or account deactivated");
      }

      return { user };
    } catch (e: any) {
      if (e instanceof UnauthorizedError) throw e;
      throw new UnauthorizedError("Invalid or expired token");
    }
  });

export const authMiddleware = authPlugin;
export const requireAuth = requireAuthPlugin;
