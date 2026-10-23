import { app } from "./app";
import { env } from "./config/env";

app.listen({
  port: env.PORT,
  hostname: "0.0.0.0",
});

console.log(`🚀 Virithstore Elysia Backend running at http://localhost:${env.PORT}`);
if (!env.IS_PRODUCTION) {
  console.log(`📚 Swagger API Docs available at http://localhost:${env.PORT}/docs`);
}

export { app };
export type { App } from "./app";
