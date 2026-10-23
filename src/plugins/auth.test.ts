import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { authPlugin } from "./auth";
import { errorHandler } from "./error-handler";

const app = new Elysia()
  .use(errorHandler)
  .use(authPlugin)
  .get("/public", () => "ok")
  .get("/me", ({ user }) => ({ id: user.id }), { auth: true })
  .get("/admin", ({ user }) => ({ id: user.id }), { admin: true });

const get = (path: string, headers: Record<string, string> = {}) =>
  app.handle(new Request(`http://localhost${path}`, { headers }));

describe("auth plugin", () => {
  test("public routes need no token", async () => {
    expect((await get("/public")).status).toBe(200);
  });

  test("auth and admin routes reject missing tokens with 401", async () => {
    expect((await get("/me")).status).toBe(401);
    expect((await get("/admin")).status).toBe(401);
  });

  test("garbage tokens are rejected with 401", async () => {
    const headers = { authorization: "Bearer not-a-jwt" };
    expect((await get("/me", headers)).status).toBe(401);
    expect((await get("/admin", headers)).status).toBe(401);
  });
});
