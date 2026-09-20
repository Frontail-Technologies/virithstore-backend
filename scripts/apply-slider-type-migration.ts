import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

async function applyMigration() {
  try {
    console.log("🚀 Applying Sliders type column migration...");

    // 1. Add type column to sliders table
    await db.execute(sql`
      ALTER TABLE "sliders" 
      ADD COLUMN IF NOT EXISTS "type" varchar(50) DEFAULT 'home' NOT NULL;
    `);

    // 2. Ensure existing sliders have type = 'home'
    await db.execute(sql`
      UPDATE "sliders" SET "type" = 'home' WHERE "type" IS NULL;
    `);

    // 3. Check if referral slider already exists, if not seed default referral slider
    const existingRef = (await db.execute(sql`SELECT id FROM "sliders" WHERE "type" = 'referral'`)) as any;
    const refRows = existingRef.rows || existingRef;
    if (!refRows.length) {
      await db.execute(sql`
        INSERT INTO "sliders" ("id", "type", "images", "created_at", "updated_at")
        VALUES (
          gen_random_uuid(),
          'referral',
          '[{"url": "/images/banners/referral-banner.jpg"}]'::jsonb,
          now(),
          now()
        );
      `);
      console.log("✅ Seeded default referral slider with referral-banner.jpg");
    }

    console.log("🎉 Sliders migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

applyMigration();
