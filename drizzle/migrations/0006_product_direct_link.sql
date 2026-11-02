ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_link" boolean DEFAULT false;--> statement-breakpoint
UPDATE "products" SET "is_link" = false WHERE "is_link" IS NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "is_link" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "is_link" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "link" text;
