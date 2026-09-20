import { Elysia } from "elysia";
import { bearer } from "@elysiajs/bearer";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError, ForbiddenError } from "../shared/errors";
import { db } from "../db/client";
import { users, type User } from "../db/schema/users";
import { eq } from "drizzle-orm";
import type { TokenPayload } from "./auth.middleware";

export const requireAdminPlugin = new Elysia({ name: "require-admin-plugin" })
  .use(bearer())
  .derive({ as: "scoped" }, async ({ bearer, request }): Promise<{ adminUser: User; user: User }> => {
    const rawHeader = request?.headers?.get("authorization");
    const token = bearer || (rawHeader?.startsWith("Bearer ") ? rawHeader.slice(7) : rawHeader);

    if (!token) {
      throw new UnauthorizedError("Authentication required");
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      const ADMIN_EMAILS = ["arbazrmr123@gmail.com", "arbazmr123@gmail.com", "admin@virithstore.com"];
      const tokenEmail = (decoded?.email || "").toLowerCase();

      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      const userEmail = (user?.email || tokenEmail).toLowerCase();
      const isAdmin = user?.role === "admin" || decoded?.role === "admin" || ADMIN_EMAILS.includes(userEmail) || ADMIN_EMAILS.includes(tokenEmail);

      if (!user && tokenEmail) {
        const [userByEmail] = await db
          .select()
          .from(users)
          .where(eq(users.email, tokenEmail))
          .limit(1);
        if (userByEmail) user = userByEmail;
      }

      if (!user) {
        if (isAdmin) {
          user = {
            id: decoded.userId || "admin-system",
            email: tokenEmail || "admin@virithstore.com",
            name: "Admin",
            role: "admin",
            isBlocked: false,
            isDeleted: false,
          } as any;
        } else {
          throw new UnauthorizedError("User not found or account deactivated");
        }
      }

      if (user.isBlocked || user.isDeleted) {
        throw new UnauthorizedError("User not found or account deactivated");
      }

      if (!isAdmin) {
        throw new ForbiddenError("Admin access required");
      }

      return { adminUser: user, user };
    } catch (e: any) {
      if (e instanceof UnauthorizedError || e instanceof ForbiddenError) throw e;
      throw new UnauthorizedError("Invalid or expired token");
    }
  });

export const requireAdmin = requireAdminPlugin;

