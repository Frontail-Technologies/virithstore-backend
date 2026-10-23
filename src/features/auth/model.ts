import { t, type Static } from "elysia";

export const Register = t.Object({
  email: t.String({ format: "email", maxLength: 255 }),
  password: t.String({ minLength: 6, maxLength: 128 }),
  name: t.Optional(t.String({ maxLength: 255 })),
  referralCode: t.Optional(t.String({ maxLength: 32 })),
});
export type Register = Static<typeof Register>;

export const Login = t.Object({
  email: t.String({ format: "email", maxLength: 255 }),
  password: t.String({ maxLength: 128 }),
  otp: t.Optional(t.String({ maxLength: 20 })),
});
export type Login = Static<typeof Login>;

export const TelegramLogin = t.Object({
  id: t.String(),
  first_name: t.Optional(t.String()),
  last_name: t.Optional(t.String()),
  username: t.Optional(t.String()),
  photo_url: t.Optional(t.String()),
  auth_date: t.String(),
  hash: t.String(),
  referralCode: t.Optional(t.String({ maxLength: 32 })),
});
export type TelegramLogin = Static<typeof TelegramLogin>;

/** Identity asserted by the Next.js server after NextAuth verified the provider login. */
export const OAuthLogin = t.Object({
  email: t.String({ format: "email", maxLength: 255 }),
  name: t.Optional(t.String({ maxLength: 255 })),
  image: t.Optional(t.String({ maxLength: 2048 })),
  provider: t.Optional(t.Union([t.Literal("google"), t.Literal("email"), t.Literal("telegram")])),
  referralCode: t.Optional(t.String({ maxLength: 32 })),
});
export type OAuthLogin = Static<typeof OAuthLogin>;

export const OAuthHeaders = t.Object({ "x-oauth-secret": t.String() });
