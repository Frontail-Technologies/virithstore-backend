import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql.raw("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products'"));
  console.log("Columns:", result);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
