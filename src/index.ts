import { app } from "./app";
import { env } from "./config/env";
import { startOrderMaintenance } from "./features/orders/expiry";

app.listen({
  port: env.PORT,
  hostname: "0.0.0.0",
});

// Expires unpaid orders, frees abandoned account holds and retries missed Telegram alerts every minute.
startOrderMaintenance();

console.log(`🚀 Virithstore Elysia Backend running at http://localhost:${env.PORT}`);
if (!env.IS_PRODUCTION) {
  console.log(`📚 Swagger API Docs available at http://localhost:${env.PORT}/docs`);
}

export { app };
export type { App } from "./app";
