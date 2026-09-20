import { Elysia } from "elysia";
import { AuthService } from "./auth.service";
import { RegisterSchema, LoginSchema, TelegramAuthSchema } from "./auth.schema";
import { ok } from "../../shared/response";
import { requireAuthPlugin } from "../../middleware/auth.middleware";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/register",
    async ({ body }) => {
      const b = body as any;
      const result = await AuthService.register(b.email, b.password, b.name, b.referralCode);
      return ok(result, "Registration successful");
    },
    { body: RegisterSchema }
  )
  .post(
    "/login",
    async ({ body }) => {
      const b = body as any;
      const result = await AuthService.login(b.email, b.password, b.otp);
      return ok(result, "Login successful");
    },
    { body: LoginSchema }
  )
  .post(
    "/telegram",
    async ({ body }) => {
      const result = await AuthService.telegramAuth(body as any);
      return ok(result, "Telegram authentication successful");
    },
    { body: TelegramAuthSchema }
  )
  .post(
    "/oauth",
    async ({ body }) => {
      const b = body as any;
      const result = await AuthService.oauthAuth(b);
      return ok(result, "OAuth authentication successful");
    }
  )
  .use(requireAuthPlugin)
  .get("/me", ({ user }) => {
    return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      telegramId: user.telegramId,
      authProvider: user.authProvider,
      isVerified: user.isVerified,
    });
  });
