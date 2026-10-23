const isTest = Bun.env.NODE_ENV === "test";
const isProduction = Bun.env.NODE_ENV === "production";

const missing: string[] = [];

/** Reads a required variable; in tests a placeholder is used so pure-function tests can import modules. */
function required(name: string, testFallback: string, minLength = 1): string {
  const value = Bun.env[name]?.trim();
  if (!value) {
    if (isTest) return testFallback;
    missing.push(`${name} is required`);
    return "";
  }
  if (value.length < minLength) {
    missing.push(`${name} must be at least ${minLength} characters`);
  }
  return value;
}

/** Required only in production (payment/upload integrations that are optional in local dev). */
function requiredInProduction(name: string): string {
  const value = Bun.env[name]?.trim() || "";
  if (!value && isProduction) missing.push(`${name} is required in production`);
  return value;
}

const PAYWAY_SANDBOX = "https://checkout-sandbox.payway.com.kh";

export const env = {
  NODE_ENV: Bun.env.NODE_ENV || "development",
  IS_PRODUCTION: isProduction,
  PORT: Number(Bun.env.BACKEND_PORT || Bun.env.PORT || 4000),
  DATABASE_URL: required("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/virithstore"),
  JWT_SECRET: required("JWT_SECRET", "test-only-jwt-secret-not-for-production-use", 32),
  // Shared secret the Next.js server sends to /auth/oauth after NextAuth has verified the provider login.
  OAUTH_SHARED_SECRET: required("OAUTH_SHARED_SECRET", "test-only-oauth-shared-secret-0000", 32),
  TELEGRAM_BOT_TOKEN: Bun.env.TELEGRAM_BOT_TOKEN || "",
  CLOUDINARY_CLOUD_NAME: Bun.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: Bun.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: Bun.env.CLOUDINARY_API_SECRET || "",
  CORS_ORIGIN: Bun.env.CORS_ORIGIN || "http://localhost:3000",
  // ABA PayWay config. PAYWAY_MERCHANT_KEY is the merchant id and PAYWAY_PUBLIC_KEY is the HMAC secret
  // (legacy names kept so existing deployments keep working).
  PAYWAY_MERCHANT_KEY: requiredInProduction("PAYWAY_MERCHANT_KEY"),
  PAYWAY_PUBLIC_KEY: requiredInProduction("PAYWAY_PUBLIC_KEY"),
  // Endpoints differ between sandbox and production, so production must set them explicitly.
  PAYWAY_API_URL: requiredInProduction("PAYWAY_API_URL") || `${PAYWAY_SANDBOX}/api/payment-gateway/v1/payments/purchase`,
  PAYWAY_CHECK_URL: requiredInProduction("PAYWAY_CHECK_URL") || `${PAYWAY_SANDBOX}/api/payment-gateway/v1/payments/check-transaction-2`,
  // Public URL of the storefront: PayWay return/continue/cancel links point here.
  FRONTEND_URL: (requiredInProduction("FRONTEND_URL") || "http://localhost:3000").replace(/\/$/, ""),
};

if (missing.length > 0) {
  console.error(`Invalid environment configuration:\n${missing.map((m) => `  - ${m}`).join("\n")}`);
  process.exit(1);
}
