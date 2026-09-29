ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "verification" jsonb;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "coupon_redeemed_at" timestamp;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfilled_at" timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS "spin_credits_order_id_unique" ON "spin_credits" ("order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "referral_transactions_order_id_unique" ON "referral_transactions" ("order_id");
CREATE TABLE IF NOT EXISTS "coupon_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL REFERENCES "coupons"("id") ON DELETE cascade,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
  "status" varchar(20) DEFAULT 'reserved' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "redeemed_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "coupon_reservations_order_id_unique" ON "coupon_reservations" ("order_id");
