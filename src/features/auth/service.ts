import { eq } from "drizzle-orm";
import { env } from "../../config/env";
import { db } from "../../db/client";
import { users, type User } from "../../db/schema/users";
import { badRequest, forbidden, httpError, unauthorized } from "../../libs/http-error";
import { generateReferralCode } from "../../libs/ids";
import { signAccessToken } from "../../libs/jwt";
import { hashPassword, verifyPassword } from "../../libs/password";
import { verifyTelegramLogin } from "../../libs/telegram";
import { toAuthUser } from "./mappers";
import type { Login, OAuthLogin, Register, TelegramLogin } from "./model";

function issueSession(user: User) {
  const token = signAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email || undefined,
    telegramId: user.telegramId || undefined,
  });
  return { user: toAuthUser(user), token };
}

function assertUsable(user: User) {
  if (user.isBlocked) throw forbidden("Account is blocked");
  if (user.isDeleted) throw forbidden("Account is deleted");
}

/** The user who owns a referral code, if the code is valid. */
async function findReferrerId(code?: string): Promise<string | undefined> {
  if (!code) return undefined;
  const [referrer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, code.trim().toUpperCase()))
    .limit(1);
  return referrer?.id;
}

/** Older accounts may not have a referral code yet; one is created on their next login. */
async function ensureReferralCode(user: User): Promise<User> {
  if (user.referralCode) return user;
  const referralCode = generateReferralCode();
  await db.update(users).set({ referralCode }).where(eq(users.id, user.id));
  return { ...user, referralCode };
}

export async function register({ email, password, name, referralCode }: Register) {
  const normalizedEmail = email.toLowerCase();
  const [existing, referredBy, hashedPassword] = await Promise.all([
    db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1),
    findReferrerId(referralCode),
    hashPassword(password),
  ]);
  if (existing.length > 0) throw badRequest("Email already registered");

  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      password: hashedPassword,
      name: name || normalizedEmail.split("@")[0],
      authProvider: "email",
      role: "user",
      referralCode: generateReferralCode(),
      referredBy,
      walletPoints: 0,
      isVerified: true,
    })
    .returning();

  return issueSession(user);
}

export async function login({ email, password, otp }: Login) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user?.password) throw unauthorized("Invalid email or password");
  assertUsable(user);
  if (!(await verifyPassword(password, user.password))) throw unauthorized("Invalid email or password");

  // Admin OTP is only enforced when one is supplied: nothing issues OTPs yet, so requiring it would lock admins out.
  if (user.role === "admin" && otp) {
    if (user.adminLoginOtp !== otp) throw unauthorized("Invalid admin OTP");
    if (user.adminLoginOtpExpiry && new Date() > user.adminLoginOtpExpiry) throw unauthorized("Admin OTP expired");
    await db.update(users).set({ adminLoginOtp: null, adminLoginOtpExpiry: null }).where(eq(users.id, user.id));
  }

  return issueSession(await ensureReferralCode(user));
}

export async function loginWithTelegram(data: TelegramLogin) {
  if (!env.TELEGRAM_BOT_TOKEN) throw httpError("Telegram login is not configured", 503);

  const verdict = verifyTelegramLogin(data, env.TELEGRAM_BOT_TOKEN);
  if (verdict === "bad-signature") throw unauthorized("Invalid Telegram hash verification");
  if (verdict === "expired") throw unauthorized("Telegram login has expired");

  const [existing] = await db.select().from(users).where(eq(users.telegramId, data.id)).limit(1);
  if (existing) {
    assertUsable(existing);
    return issueSession(await ensureReferralCode(existing));
  }

  const displayName = [data.first_name, data.last_name].filter(Boolean).join(" ");
  const [user] = await db
    .insert(users)
    .values({
      telegramId: data.id,
      name: displayName || data.username || `TG_${data.id}`,
      image: data.photo_url || null,
      authProvider: "telegram",
      role: "user",
      referralCode: generateReferralCode(),
      referredBy: await findReferrerId(data.referralCode),
      walletPoints: 0,
      isVerified: true,
    })
    .returning();
  return issueSession(user);
}

/** Called by the Next.js server only (shared-secret protected at the route). Creates or refreshes the user. */
export async function loginWithOAuth(data: OAuthLogin) {
  const email = data.email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!existing) {
    const [user] = await db
      .insert(users)
      .values({
        email,
        name: data.name || email.split("@")[0],
        image: data.image || null,
        authProvider: data.provider ?? "google",
        role: "user",
        referralCode: generateReferralCode(),
        referredBy: await findReferrerId(data.referralCode),
        walletPoints: 0,
        isVerified: true,
      })
      .returning();
    return issueSession(user);
  }

  assertUsable(existing);
  const [user] = await db
    .update(users)
    .set({
      updatedAt: new Date(),
      ...(data.name && { name: data.name }),
      ...(data.image && { image: data.image }),
      ...(!existing.referralCode && { referralCode: generateReferralCode() }),
    })
    .where(eq(users.id, existing.id))
    .returning();
  return issueSession(user);
}
