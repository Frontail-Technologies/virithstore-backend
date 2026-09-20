import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Migrating products table with all fields (banner, slides, game, region, spin, etc.)...");

  // 1. Try to add 'topup' to product_type enum if not exists
  try {
    await db.execute(sql.raw("ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'topup'"));
  } catch (e) {
    console.log("Enum alteration note:", (e as any)?.message);
  }

  // 2. Add missing columns
  const alterQueries = [
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS slides JSONB DEFAULT '[]'::jsonb NOT NULL",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS banner TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS game VARCHAR(255) DEFAULT ''",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS region VARCHAR(100)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS name_kh VARCHAR(255)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS spin_active BOOLEAN DEFAULT false NOT NULL",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS spin_cost_ids JSONB DEFAULT '[]'::jsonb NOT NULL",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_server_id BOOLEAN DEFAULT false",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_user_id BOOLEAN DEFAULT false",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_char_name BOOLEAN DEFAULT false",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_testing BOOLEAN DEFAULT false",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_url_input BOOLEAN DEFAULT false",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS url_input_label VARCHAR(255)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS url_input_type VARCHAR(50)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_link BOOLEAN DEFAULT false",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS link TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_api BOOLEAN DEFAULT false",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS api_name VARCHAR(100)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS stock BOOLEAN DEFAULT true NOT NULL",
  ];

  for (const q of alterQueries) {
    await db.execute(sql.raw(q));
    console.log("Executed:", q);
  }

  console.log("✅ Successfully updated products table schema!");
}

main().then(() => process.exit(0)).catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
