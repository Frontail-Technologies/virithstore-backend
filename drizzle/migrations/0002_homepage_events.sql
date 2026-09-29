ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "cost_id" varchar(255);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "starts_at" timestamp;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ends_at" timestamp;
