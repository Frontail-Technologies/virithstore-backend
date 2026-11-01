ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "banner_type" varchar(20) DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "telegram_chat_id" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "telegram_message_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "telegram_notified_at" timestamp;
