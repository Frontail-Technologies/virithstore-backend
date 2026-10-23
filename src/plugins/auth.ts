import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users, type User } from "../db/schema/users";
import { forbidden, unauthorized } from "../libs/http-error";
import { verifyAccessToken } from "../libs/jwt";

const bearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
};

const isActive = (user: User | undefined): user is User => !!user && !user.isBlocked && !user.isDeleted;

async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

/** Resolves the active user for a request, or null when there is no valid bearer token. */
async function resolveUser(request: Request): Promise<User | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  const user = await findUserById(payload.userId);
  return isActive(user) ? user : null;
}

/**
 * Route-level authentication via macros (one lookup per request, no dependence on `.use()` order):
 *   { optionalUser: true }  -> `user: User | null`
 *   { auth: true }          -> `user: User` or 401
 *   { admin: true }         -> `user: User` with role admin, or 401/403 (role comes from the database, never the token)
 */
export const authPlugin = new Elysia({ name: "auth" }).macro({
  optionalUser: {
    async resolve({ request }) {
      return { user: await resolveUser(request) };
    },
  },
  auth: {
    async resolve({ request }) {
      const token = bearerToken(request);
      if (!token) throw unauthorized("Authentication required");
      const payload = verifyAccessToken(token);
      if (!payload) throw unauthorized("Invalid or expired token");

      let user = await findUserById(payload.userId);
      if (!user && payload.email) {
        // Tokens issued before an id migration still carry the email.
        [user] = await db.select().from(users).where(eq(users.email, payload.email.toLowerCase())).limit(1);
      }
      if (!isActive(user)) throw unauthorized("User not found or account deactivated");
      return { user };
    },
  },
  admin: {
    async resolve({ request }) {
      const token = bearerToken(request);
      if (!token) throw unauthorized("Authentication required");
      const payload = verifyAccessToken(token);
      if (!payload) throw unauthorized("Invalid or expired token");

      const user = await findUserById(payload.userId);
      if (!isActive(user)) throw unauthorized("User not found or account deactivated");
      if (user.role !== "admin") throw forbidden("Admin access required");
      return { user };
    },
  },
});
