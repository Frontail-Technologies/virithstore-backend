-- Indexes for the hot read paths (user history, live feed, webhook lookup, checkout claim, homepage, admin lists).
-- Postgres does not index foreign keys automatically, and none of these columns were indexed before.

CREATE INDEX IF NOT EXISTS "orders_user_created_idx" ON "orders" ("user_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_created_idx" ON "orders" ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_created_idx" ON "orders" ("status", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_payment_transaction_idx" ON "orders" ("payment_transaction_id") WHERE "payment_transaction_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_product_idx" ON "orders" ("product_id");--> statement-breakpoint

-- Checkout claims one available vault row per product/cost (FOR UPDATE SKIP LOCKED).
CREATE INDEX IF NOT EXISTS "accounts_vault_available_idx" ON "accounts_vault" ("product_id", "cost_id", "created_at") WHERE "is_active" = true AND "is_reserved" = false;--> statement-breakpoint

-- Storefront lists and homepage groups only read live, available products.
CREATE INDEX IF NOT EXISTS "products_storefront_idx" ON "products" ("type", "created_at" DESC) WHERE "is_deleted" = false AND "is_available" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "wallet_transactions_user_created_idx" ON "wallet_transactions" ("user_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_transactions_order_idx" ON "wallet_transactions" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spin_transactions_user_created_idx" ON "spin_transactions" ("user_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spin_credits_user_available_idx" ON "spin_credits" ("user_id", "created_at") WHERE "is_used" = false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_transactions_user_idx" ON "gift_transactions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_transactions_gift_idx" ON "gift_transactions" ("gift_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_transactions_created_idx" ON "gift_transactions" ("created_at" DESC);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "order_logs_order_idx" ON "order_logs" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_logs_created_idx" ON "order_logs" ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_reservations_coupon_idx" ON "coupon_reservations" ("coupon_id", "status", "expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_transactions_referrer_idx" ON "referral_transactions" ("referrer_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_referred_by_idx" ON "users" ("referred_by") WHERE "referred_by" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_created_idx" ON "users" ("created_at" DESC);
