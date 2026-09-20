import { t } from "elysia";

export const RegisterSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  name: t.Optional(t.String()),
  referralCode: t.Optional(t.String()),
});

export const LoginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String(),
  otp: t.Optional(t.String()),
});

export const TelegramAuthSchema = t.Object({
  id: t.String(),
  first_name: t.Optional(t.String()),
  last_name: t.Optional(t.String()),
  username: t.Optional(t.String()),
  photo_url: t.Optional(t.String()),
  auth_date: t.String(),
  hash: t.String(),
});
