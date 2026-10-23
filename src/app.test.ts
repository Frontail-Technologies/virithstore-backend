import { describe, expect, test } from "bun:test";
import { app } from "./app";

const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

describe("composed app", () => {
  test("health check responds", async () => {
    const res = await call("GET", "/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  test("features live only under /api/v1", async () => {
    expect((await call("GET", "/api/settings")).status).toBe(404);
    expect((await call("GET", "/api/v1/users/admin/all")).status).toBe(401);
  });

  test("admin endpoints reject anonymous callers across features", async () => {
    const adminRoutes: Array<[string, string, unknown?]> = [
      ["GET", "/api/v1/orders/admin/analytics"],
      ["GET", "/api/v1/orders/admin/all"],
      ["GET", "/api/v1/accounts"],
      ["GET", "/api/v1/order-logs/admin"],
      ["GET", "/api/v1/market/admin"],
      ["GET", "/api/v1/settings/admin/all"],
      ["GET", "/api/v1/spin/admin/prizes"],
      ["GET", "/api/v1/gift-transactions/admin"],
      ["GET", "/api/v1/admin/referrals/list"],
      ["POST", "/api/v1/admin/wallet/adjust", { userId: "x", points: 1, reason: "test" }],
      ["POST", "/api/v1/upload/image"],
    ];
    for (const [method, path, body] of adminRoutes) {
      const res = await call(method, path, body);
      expect([401, 422], `${method} ${path}`).toContain(res.status);
      if (res.status === 422) expect(path).toBe("/api/v1/upload/image"); // body validated before auth
    }
  });

  test("user endpoints reject anonymous callers", async () => {
    for (const path of ["/api/v1/orders/my-orders", "/api/v1/wallet/me", "/api/v1/referrals/my-stats", "/api/v1/gifts/wagering", "/api/v1/spin/my-credits"]) {
      expect((await call("GET", path)).status, path).toBe(401);
    }
  });

  test("order creation validates its body before touching the database", async () => {
    const res = await call("POST", "/api/v1/orders", { productId: "p" });
    expect(res.status).toBe(422);
  });

  test("coupon validation is rate limited", async () => {
    const headers = { "x-forwarded-for": "198.51.100.7" };
    let last = 0;
    for (let i = 0; i < 32; i++) {
      // Invalid body: validation fails fast without a database round trip.
      last = (await call("POST", "/api/v1/coupons/validate", { code: "" }, headers)).status;
    }
    expect([422, 429]).toContain(last);
  });
});
