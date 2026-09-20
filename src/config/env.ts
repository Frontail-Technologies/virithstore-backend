export const env = {
  NODE_ENV: Bun.env.NODE_ENV || "development",
  PORT: Number(Bun.env.BACKEND_PORT || 4000),
  DATABASE_URL: Bun.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/virithstore",
  JWT_SECRET: Bun.env.JWT_SECRET || "virithstore_super_secret_jwt_key_2026",
  TELEGRAM_BOT_TOKEN: Bun.env.TELEGRAM_BOT_TOKEN || "",
  GOOGLE_CLIENT_ID: Bun.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: Bun.env.GOOGLE_CLIENT_SECRET || "",
  CLOUDINARY_CLOUD_NAME: Bun.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: Bun.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: Bun.env.CLOUDINARY_API_SECRET || "",
  CORS_ORIGIN: Bun.env.CORS_ORIGIN || "http://localhost:3000",
  // ABA PayWay Config
  PAYWAY_MERCHANT_KEY: Bun.env.PAYWAY_MERCHANT_KEY || "ec439775",
  PAYWAY_PUBLIC_KEY: Bun.env.PAYWAY_PUBLIC_KEY || "aba-public-key",
  PAYWAY_API_URL: Bun.env.PAYWAY_API_URL || "https://checkout.payway.com.kh/api/payment-gateway/v1/payments/purchase",
  NEXT_PUBLIC_BASE_URL: Bun.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
};
