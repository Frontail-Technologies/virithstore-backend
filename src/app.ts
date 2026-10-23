import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { env } from "./config/env";
import { errorHandler } from "./plugins/error-handler";

import { accountsFeature } from "./features/accounts";
import { authFeature } from "./features/auth";
import { categoriesFeature } from "./features/categories";
import { couponsFeature } from "./features/coupons";
import { eventsFeature } from "./features/events";
import { giftTransactionsFeature, giftsFeature } from "./features/gifts";
import { homepageFeature } from "./features/homepage";
import { marketFeature } from "./features/market";
import { orderLogsFeature } from "./features/order-logs";
import { ordersFeature } from "./features/orders";
import { paymentFeature } from "./features/payment";
import { productsFeature } from "./features/products";
import { adminReferralsFeature, referralsFeature } from "./features/referrals";
import { settingsFeature } from "./features/settings";
import { slidersFeature } from "./features/sliders";
import { spinFeature } from "./features/spin";
import { uploadFeature } from "./features/upload";
import { usersFeature } from "./features/users";
import { adminWalletFeature, walletFeature } from "./features/wallet";

/** Every feature, mounted once under `/api/v1`. */
const api = new Elysia({ prefix: "/api/v1", name: "api.v1" })
  .use(authFeature)
  .use(productsFeature)
  .use(categoriesFeature)
  .use(ordersFeature)
  .use(couponsFeature)
  .use(giftsFeature)
  .use(giftTransactionsFeature)
  .use(spinFeature)
  .use(slidersFeature)
  .use(settingsFeature)
  .use(usersFeature)
  .use(uploadFeature)
  .use(paymentFeature)
  .use(eventsFeature)
  .use(marketFeature)
  .use(accountsFeature)
  .use(orderLogsFeature)
  .use(walletFeature)
  .use(adminWalletFeature)
  .use(referralsFeature)
  .use(adminReferralsFeature)
  .use(homepageFeature);

export const app = new Elysia()
  .use(errorHandler)
  .use(
    cors({
      origin: env.IS_PRODUCTION ? [env.CORS_ORIGIN] : [env.CORS_ORIGIN, "http://localhost:3000"],
      maxAge: 86400,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Checkout-Token"],
    }),
  )
  // API docs are a development aid only.
  .use((instance) =>
    env.IS_PRODUCTION
      ? instance
      : instance.use(
          swagger({
            path: "/docs",
            documentation: {
              info: {
                title: "Virithstore API Documentation",
                version: "1.0.0",
                description: "Elysia + Bun backend for Virithstore (digital & account services)",
              },
            },
          }),
        ),
  )
  .get("/health", () => ({
    status: "ok",
    service: "virithstore-backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  }))
  .use(api);

export type App = typeof app;
