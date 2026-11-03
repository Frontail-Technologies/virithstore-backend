-- Each held vault account remembers the order holding it, so a late payment can never take another order's account.
ALTER TABLE "accounts_vault" ADD COLUMN IF NOT EXISTS "reserved_order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL;--> statement-breakpoint
UPDATE "accounts_vault" AS av SET "reserved_order_id" = o."id"
  FROM "orders" AS o
  WHERE av."is_reserved" = true
    AND av."is_active" = true
    AND av."reserved_order_id" IS NULL
    AND o."payment_status" = 'pending'
    AND o."delivery_data" ->> 'reservedAccountId' = av."id"::text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_vault_reserved_order_idx" ON "accounts_vault" ("reserved_order_id") WHERE "reserved_order_id" IS NOT NULL;--> statement-breakpoint
-- Old index only covered never-held rows; claims also reuse expired holds, so index all unsold rows.
CREATE INDEX IF NOT EXISTS "accounts_vault_unsold_idx" ON "accounts_vault" ("product_id", "cost_id", "created_at") WHERE "is_active" = true;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Expiry sweeper scans unpaid PayWay orders by last activity.
CREATE INDEX IF NOT EXISTS "orders_unpaid_updated_idx" ON "orders" ("updated_at") WHERE "status" = 'pending' AND "payment_status" = 'pending';--> statement-breakpoint
-- Telegram retry scans paid orders that were never announced.
CREATE INDEX IF NOT EXISTS "orders_unnotified_paid_idx" ON "orders" ("created_at") WHERE "payment_status" = 'paid' AND "telegram_notified_at" IS NULL;
