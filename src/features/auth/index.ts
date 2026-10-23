import crypto from "node:crypto";
import { Elysia } from "elysia";
import { env } from "../../config/env";
import { authPlugin } from "../../plugins/auth";
import { rateLimiter } from "../../plugins/rate-limit";
import { forbidden } from "../../libs/http-error";
import { ok } from "../../libs/response";
import { Login, OAuthHeaders, OAuthLogin, Register, TelegramLogin } from "./model";
import { toSessionUser } from "./mappers";
import { login, loginWithOAuth, loginWithTelegram, register } from "./service";

const secretMatches = (provided: string, expected: string) => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Credential endpoints are brute-force targets, so they are rate limited per client.
const credentialRoutes = new Elysia({ name: "auth.credentials" })
  .use(rateLimiter(10))
  .post("/register", async ({ body }) => ok(await register(body), "Registration successful"), { body: Register })
  .post("/login", async ({ body }) => ok(await login(body), "Login successful"), { body: Login })
  .post("/telegram", async ({ body }) => ok(await loginWithTelegram(body), "Telegram authentication successful"), {
    body: TelegramLogin,
  });

export const authFeature = new Elysia({ prefix: "/auth", name: "feature.auth", tags: ["Auth"] })
  .use(authPlugin)
  .use(credentialRoutes)
  // Only the Next.js server (after NextAuth verified the provider login) may mint tokens here.
  .post(
    "/oauth",
    async ({ body, headers }) => {
      if (!secretMatches(headers["x-oauth-secret"], env.OAUTH_SHARED_SECRET)) {
        throw forbidden("OAuth exchange is not allowed");
      }
      return ok(await loginWithOAuth(body), "OAuth authentication successful");
    },
    { headers: OAuthHeaders, body: OAuthLogin },
  )
  .get("/me", ({ user }) => ok(toSessionUser(user)), { auth: true });
