import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { errorHandler } from "../plugins/error-handler";
import { categoriesFeature } from "./categories";
import { settingsFeature } from "./settings";

const app = new Elysia().use(errorHandler).use(categoriesFeature).use(settingsFeature);

const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

describe("categories feature", () => {
  test("write routes require an admin token", async () => {
    expect((await call("POST", "/categories", { name: "Games" })).status).toBe(401);
    expect((await call("PUT", "/categories/abc", { name: "Games" })).status).toBe(401);
    expect((await call("DELETE", "/categories/abc")).status).toBe(401);
  });

  test("invalid bodies are rejected with a 422 and error code", async () => {
    const res = await call("POST", "/categories", { name: "" });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });
});

describe("settings feature", () => {
  test("admin settings endpoints require an admin token", async () => {
    expect((await call("GET", "/settings/admin/all")).status).toBe(401);
    expect((await call("POST", "/settings/admin/bulk", { a: 1 })).status).toBe(401);
    expect((await call("POST", "/settings/theme", { value: "dark" })).status).toBe(401);
  });

});
