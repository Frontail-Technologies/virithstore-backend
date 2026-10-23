import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../config/env";

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
/** A transaction handle, as passed to `db.transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
