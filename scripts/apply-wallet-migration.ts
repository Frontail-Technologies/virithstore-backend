import { db } from "../src/db/client";
import { sql } from "drizzle-orm";
import crypto from "crypto";

async function applyMigration() {
  try {
    console.log("🚀 Applying Wallet & Referral DB Schema updates...");

    // 1. Add columns to users table if they don't exist
    await db.execute(sql`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "wallet_points" integer DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS "referral_code" varchar(20),
      ADD COLUMN IF NOT EXISTS "referred_by" uuid,
      ADD COLUMN IF NOT EXISTS "total_referral_points_earned" integer DEFAULT 0 NOT NULL;
    `);

    // 2. Generate unique referral codes for any existing users
    const existingUsers = (await db.execute(sql`SELECT id, email, referral_code FROM "users"`)) as any;
    const userRows = existingUsers.rows || existingUsers;
    for (const u of userRows) {
      if (!u.referral_code) {
        const randomCode = "VRT-" + crypto.randomBytes(3).toString("hex").toUpperCase();
        await db.execute(sql`UPDATE "users" SET "referral_code" = ${randomCode} WHERE "id" = ${u.id}`);
        console.log(`Generated referral code ${randomCode} for user ${u.email}`);
      }
    }

    // 3. Add unique constraint on referral_code if not present
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_referral_code_unique'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "users_referral_code_unique" UNIQUE ("referral_code");
        END IF;
      END $$;
    `);

    // 4. Create wallet enum types if not exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_transaction_type') THEN
          CREATE TYPE "public"."wallet_transaction_type" AS ENUM(
            'deposit', 'referral_reward', 'order_payment', 'refund', 'admin_adjustment', 'spin_reward'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_transaction_status') THEN
          CREATE TYPE "public"."wallet_transaction_status" AS ENUM(
            'pending', 'completed', 'failed', 'cancelled'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_status') THEN
          CREATE TYPE "public"."referral_status" AS ENUM(
            'pending', 'completed', 'cancelled'
          );
        END IF;
      END $$;
    `);

    // 5. Create wallet_transactions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "wallet_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" "wallet_transaction_type" NOT NULL,
        "points" integer NOT NULL,
        "balance_before" integer NOT NULL,
        "balance_after" integer NOT NULL,
        "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
        "reference_id" varchar(255),
        "description" text NOT NULL,
        "status" "wallet_transaction_status" DEFAULT 'completed' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    // 6. Create referral_transactions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "referral_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "referrer_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "referee_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "order_amount" numeric(10, 2) NOT NULL,
        "points_earned" integer NOT NULL,
        "status" "referral_status" DEFAULT 'completed' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    // 7. Seed default referral settings in settings table if not present
    const referralSettingKey = "referral_config";
    const existingSetting = (await db.execute(sql`SELECT * FROM "settings" WHERE "key" = ${referralSettingKey}`)) as any;
    const settingRows = existingSetting.rows || existingSetting;
    if (!settingRows.length) {
      const defaultConfig = {
        isEnabled: true,
        rewardType: "percentage", // 'percentage' or 'fixed'
        commissionValue: 5, // 5% of order spend or 100 points
        pointsPerDollar: 100, // 100 Points = $1.00 USD
        minOrderAmount: 1.0, // Minimum order $1 to trigger referral reward
        refereeDiscountPercent: 5, // 5% discount for referee
        terms: "Share your referral link with friends. When they place an order on Virith Store, you will instantly earn Points credited to your wallet!",
      };
      await db.execute(sql`
        INSERT INTO "settings" ("key", "value", "updated_at")
        VALUES (${referralSettingKey}, ${JSON.stringify(defaultConfig)}::jsonb, now())
      `);
      console.log("✅ Seeded default referral_config settings");
    }

    console.log("🎉 Wallet & Referral DB schema applied successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

applyMigration();
