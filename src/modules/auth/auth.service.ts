import { db } from "../../db/client";
import { users } from "../../db/schema/users";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../../config/env";
import { AppError, UnauthorizedError } from "../../shared/errors";

export class AuthService {
  static async register(email: string, password: string, name?: string, referralCode?: string) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      throw new AppError("Email already registered", 400);
    }

    // Resolve referrer if code was provided
    let referredBy: string | null = null;
    if (referralCode) {
      const [referrer] = await db
        .select()
        .from(users)
        .where(eq(users.referralCode, referralCode.trim().toUpperCase()))
        .limit(1);
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newRefCode = "VRT-" + crypto.randomBytes(3).toString("hex").toUpperCase();

    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || email.split("@")[0],
        authProvider: "email",
        role: "user",
        referralCode: newRefCode,
        referredBy: referredBy || undefined,
        walletPoints: 0,
        isVerified: true,
      })
      .returning();

    const token = this.generateToken(user.id, user.role, user.email || undefined);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
        referralCode: user.referralCode,
        walletPoints: user.walletPoints || 0,
      },
      token,
    };
  }

  static async login(email: string, password: string, otp?: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.password) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (user.isBlocked) throw new AppError("Account is blocked", 403);
    if (user.isDeleted) throw new AppError("Account is deleted", 403);

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Admin OTP check if admin
    if (user.role === "admin" && otp) {
      if (user.adminLoginOtp !== otp) {
        throw new UnauthorizedError("Invalid admin OTP");
      }
      if (user.adminLoginOtpExpiry && new Date() > user.adminLoginOtpExpiry) {
        throw new UnauthorizedError("Admin OTP expired");
      }

      // Clear OTP
      await db
        .update(users)
        .set({ adminLoginOtp: null, adminLoginOtpExpiry: null })
        .where(eq(users.id, user.id));
    }

    const token = this.generateToken(user.id, user.role, user.email || undefined);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
      },
      token,
    };
  }

  static async telegramAuth(data: {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: string;
    hash: string;
  }) {
    if (env.TELEGRAM_BOT_TOKEN) {
      const secretKey = crypto.createHash("sha256").update(env.TELEGRAM_BOT_TOKEN.trim()).digest();
      const checkString = Object.entries(data)
        .filter(([key]) => key !== "hash")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");

      const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
      if (hmac !== data.hash) {
        throw new UnauthorizedError("Invalid Telegram hash verification");
      }
    }

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.telegramId, data.id))
      .limit(1);

    if (!user) {
      const displayName = [data.first_name, data.last_name].filter(Boolean).join(" ");
      [user] = await db
        .insert(users)
        .values({
          telegramId: data.id,
          name: displayName || data.username || `TG_${data.id}`,
          image: data.photo_url || null,
          authProvider: "telegram",
          role: "user",
          isVerified: true,
        })
        .returning();
    }

    const token = this.generateToken(user.id, user.role, user.email || undefined, user.telegramId || undefined);

    return {
      user: {
        id: user.id,
        name: user.name,
        telegramId: user.telegramId,
        role: user.role,
        image: user.image,
      },
      token,
    };
  }

  static async oauthAuth(data: { email: string; name?: string; image?: string; provider?: string }) {
    const ADMIN_EMAILS = ["arbazrmr123@gmail.com", "arbazmr123@gmail.com", "admin@virithstore.com"];
    const isAdminEmail = ADMIN_EMAILS.includes(data.email.toLowerCase());

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1);

    if (!user) {
      const newRefCode = "VRT-" + crypto.randomBytes(3).toString("hex").toUpperCase();
      [user] = await db
        .insert(users)
        .values({
          email: data.email.toLowerCase(),
          name: data.name || data.email.split("@")[0],
          image: data.image || null,
          authProvider: (data.provider as "email" | "google" | "telegram") || "google",
          role: isAdminEmail ? "admin" : "user",
          referralCode: newRefCode,
          walletPoints: 0,
          isVerified: true,
        })
        .returning();
    } else {
      const updates: any = { updatedAt: new Date() };
      if (data.name) updates.name = data.name;
      if (data.image) updates.image = data.image;
      if (isAdminEmail && user.role !== "admin") updates.role = "admin";

      [user] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id))
        .returning();
    }

    const token = this.generateToken(user.id, user.role, user.email || undefined, user.telegramId || undefined);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
      },
      token,
    };
  }

  static generateToken(userId: string, role: "admin" | "user", email?: string, telegramId?: string) {
    return jwt.sign(
      { userId, role, email, telegramId },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );
  }
}
