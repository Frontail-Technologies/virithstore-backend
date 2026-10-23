import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { errorHandler } from "../../plugins/error-handler";
import { authFeature } from "./index";

const app = new Elysia().use(errorHandler).use(authFeature);

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.handle(
    new Request(`http://localhost/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

describe("auth feature", () => {
  test("/oauth rejects calls without the shared secret", async () => {
    const res = await post("/oauth", { email: "victim@example.com" }, { "x-oauth-secret": "wrong" });
    expect(res.status).toBe(403);
  });

  test("/oauth is not affected by the credential rate limiter", async () => {
    for (let i = 0; i < 15; i++) {
      const res = await post("/oauth", { email: "a@example.com" }, { "x-oauth-secret": "wrong" });
      expect(res.status).toBe(403);
    }
  });

  test("/me requires a token", async () => {
    const res = await app.handle(new Request("http://localhost/auth/me"));
    expect(res.status).toBe(401);
  });

  test("credential endpoints are rate limited per client", async () => {
    const headers = { "x-forwarded-for": "203.0.113.9" };
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      // Unknown email: rejected (or fails to reach the DB) before any password work happens.
      statuses.push((await post("/login", { email: "nobody@example.com", password: "wrong-password" }, headers)).status);
    }
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});
