import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { env } from "./config/env";

process.env.PORT = String(env.PORT);
import { AppError } from "./shared/errors";
import { fail } from "./shared/response";

// Route modules
import { authRoutes } from "./modules/auth/auth.routes";
import { productsRoutes } from "./modules/products/products.routes";
import { categoriesRoutes } from "./modules/categories/categories.routes";
import { ordersRoutes } from "./modules/orders/orders.routes";
import { couponsRoutes } from "./modules/coupons/coupons.routes";
import { giftsRoutes } from "./modules/gifts/gifts.routes";
import { spinRoutes } from "./modules/spin/spin.routes";
import { slidersRoutes } from "./modules/sliders/sliders.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { uploadRoutes } from "./modules/upload/upload.routes";
import { paymentRoutes } from "./modules/payment/payment.routes";
import { eventsRoutes } from "./modules/events/events.routes";
import { marketRoutes } from "./modules/market/market.routes";
import { accountsRoutes } from "./modules/accounts/accounts.routes";
import { orderLogsRoutes } from "./modules/orderLogs/orderLogs.routes";
import { giftTransactionsRoutes } from "./modules/gifts/gifts.routes";

const PG_CLIENT_ERROR_CODES: Record<
  string,
  { status: number; message: string }
> = {
  "22P02": { status: 400, message: "Invalid ID or parameter format" },
  "23505": { status: 409, message: "This value already exists" },
  "23503": { status: 400, message: "Referenced record does not exist" },
  "23502": { status: 400, message: "A required field is missing" },
  "22007": { status: 400, message: "Invalid date/time format" },
};

const app = new Elysia()
  // Global error handler
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return fail(error.message, { code: error.code });
    }

    if (code === "NOT_FOUND" || (error as any)?.code === "NOT_FOUND") {
      set.status = 404;
      return fail("Endpoint not found", { code: "NOT_FOUND" });
    }

    const pgCode = (error as any)?.cause?.code || (error as any)?.code;
    const pgError = pgCode ? PG_CLIENT_ERROR_CODES[pgCode] : undefined;

    console.error("Unhandled Error:", error);

    if (pgError) {
      set.status = pgError.status;
      return fail(pgError.message, { code: "BAD_REQUEST" });
    }

    set.status = 500;
    return fail("Internal server error", { code: "INTERNAL_ERROR" });
  })
  // CORS plugin
  .use(
    cors({
      origin: [env.CORS_ORIGIN, "http://localhost:3000"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  // Swagger documentation
  .use(
    swagger({
      documentation: {
        info: {
          title: "Virithstore API Documentation",
          version: "1.0.0",
          description:
            "Production Elysia + Bun backend for Virithstore (digital & account services)",
        },
        tags: [
          { name: "Auth", description: "Authentication endpoints" },
          {
            name: "Products",
            description: "Digital and account product endpoints",
          },
          { name: "Orders", description: "Order creation and management" },
          { name: "Spin", description: "Lucky spin wheel" },
          { name: "Gifts", description: "Gift boxes and wagering claims" },
          { name: "Coupons", description: "Discount coupon validation" },
          { name: "Sliders", description: "Banners and sliders" },
          { name: "Settings", description: "Global site settings" },
          {
            name: "Users",
            description: "User profiles and customer management",
          },
        ],
      },
      path: "/docs",
    }),
  )
  // Health check
  .get("/health", () => ({
    status: "ok",
    service: "virithstore-backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  }))
  // Mount feature routes under both /api and /api/v1
  .group("/api", (api) =>
    api
      .use(authRoutes)
      .use(productsRoutes)
      .use(categoriesRoutes)
      .use(ordersRoutes)
      .use(couponsRoutes)
      .use(giftsRoutes)
      .use(giftTransactionsRoutes)
      .use(spinRoutes)
      .use(slidersRoutes)
      .use(settingsRoutes)
      .use(usersRoutes)
      .use(uploadRoutes)
      .use(paymentRoutes)
      .use(eventsRoutes)
      .use(marketRoutes)
      .use(accountsRoutes)
      .use(orderLogsRoutes),
  )
  .group("/api/v1", (api) =>
    api
      .use(authRoutes)
      .use(productsRoutes)
      .use(categoriesRoutes)
      .use(ordersRoutes)
      .use(couponsRoutes)
      .use(giftsRoutes)
      .use(giftTransactionsRoutes)
      .use(spinRoutes)
      .use(slidersRoutes)
      .use(settingsRoutes)
      .use(usersRoutes)
      .use(uploadRoutes)
      .use(paymentRoutes)
      .use(eventsRoutes)
      .use(marketRoutes)
      .use(accountsRoutes)
      .use(orderLogsRoutes),
  )
  .listen({
    port: env.PORT,
    hostname: "0.0.0.0",
  });

console.log(
  `🚀 Virithstore Elysia Backend running at http://localhost:${env.PORT}`,
);
console.log(
  `📚 Swagger API Docs available at http://localhost:${env.PORT}/docs`,
);

export type App = typeof app;
