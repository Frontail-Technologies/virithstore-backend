import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./client";
import postgres from "postgres";
import { env } from "../config/env";

async function runMigrations() {
  console.log("Running Drizzle migrations on PostgreSQL...");
  const migrationClient = postgres(env.DATABASE_URL, { max: 1 });
  const migrationDb = (await import("drizzle-orm/postgres-js")).drizzle(migrationClient);

  try {
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
