import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";
import { env } from "../config/env";

const INITIAL_TABLES = [
  "users",
  "categories",
  "products",
  "orders",
  "order_logs",
  "coupons",
  "gifts",
  "spin_prizes",
  "spin_transactions",
  "spin_credits",
  "sliders",
  "settings",
] as const;

const INITIAL_ENUMS = [
  "auth_provider",
  "user_role",
  "product_type",
  "order_status",
  "payment_status",
  "discount_type",
  "gift_reward_type",
  "spin_prize_type",
] as const;

async function baselineLegacySchema(client: postgres.Sql) {
  await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await client`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const [migrationCount] = await client<{ count: number }[]>`
    SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations
  `;
  if ((migrationCount?.count ?? 0) > 0) return;

  const [objects] = await client<{ tables: number; enums: number }[]>`
    SELECT
      (SELECT count(*)::int FROM unnest(${client.array([...INITIAL_TABLES])}) AS name
        WHERE to_regclass('public.' || name) IS NOT NULL) AS tables,
      (SELECT count(*)::int FROM unnest(${client.array([...INITIAL_ENUMS])}) AS name
        WHERE to_regtype('public.' || name) IS NOT NULL) AS enums
  `;

  const tableCount = objects?.tables ?? 0;
  const enumCount = objects?.enums ?? 0;
  if (tableCount === 0 && enumCount === 0) return;
  if (tableCount !== INITIAL_TABLES.length || enumCount !== INITIAL_ENUMS.length) {
    throw new Error(
      `Refusing to baseline a partial legacy schema (${tableCount}/${INITIAL_TABLES.length} tables, ${enumCount}/${INITIAL_ENUMS.length} enums).`,
    );
  }

  const [initialMigration] = readMigrationFiles({ migrationsFolder: "./drizzle/migrations" });
  if (!initialMigration) throw new Error("Initial Drizzle migration was not found.");

  await client`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${initialMigration.hash}, ${initialMigration.folderMillis})
  `;
  console.log("Detected legacy schema; recorded migration 0000 as the baseline.");
}

async function runMigrations() {
  console.log("Running Drizzle migrations on PostgreSQL...");
  const migrationClient = postgres(env.DATABASE_URL, { max: 1 });
  const migrationDb = (await import("drizzle-orm/postgres-js")).drizzle(migrationClient);

  try {
    await baselineLegacySchema(migrationClient);
    await migrate(migrationDb, { migrationsFolder: "./drizzle/migrations" });
    console.log("Migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
