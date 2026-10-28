import { describe, expect, test } from "bun:test";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "./password";
import { isUuid, generateOrderNumber, generateReferralCode } from "./ids";
import { parsePage, toPageMeta } from "./pagination";
import { httpError, isHttpError, notFound } from "./http-error";

describe("password", () => {
  test("verifies hashes created by bcryptjs (existing users keep working)", async () => {
    const legacy = await bcrypt.hash("s3cret-pass", 10);
    expect(await verifyPassword("s3cret-pass", legacy)).toBe(true);
    expect(await verifyPassword("wrong", legacy)).toBe(false);
  });

  test("native hashes verify with bcryptjs too (rollback safe)", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(await bcrypt.compare("s3cret-pass", hash)).toBe(true);
  });
});

describe("ids", () => {
  test("isUuid", () => {
    expect(isUuid("3f2b8c1e-5a4d-4e7b-9c1a-2d3e4f5a6b7c")).toBe(true);
    expect(isUuid("my-product-slug")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  test("generated identifiers have the expected shape", () => {
    expect(generateOrderNumber()).toMatch(/^ORD-\d+-\d{4}$/);
    expect(generateReferralCode()).toMatch(/^VRT-[0-9A-F]{6}$/);
  });
});

describe("pagination", () => {
  test("clamps untrusted input", () => {
    expect(parsePage({ page: "3", limit: "20" })).toEqual({ page: 3, limit: 20, offset: 40 });
    expect(parsePage({ page: "-5", limit: "100000" })).toEqual({ page: 1, limit: 100, offset: 0 });
    expect(parsePage({})).toEqual({ page: 1, limit: 50, offset: 0 });
  });

  test("meta", () => {
    expect(toPageMeta(101, 2, 50)).toEqual({ page: 2, limit: 50, total: 101, totalPages: 3 });
  });
});

describe("http-error", () => {
  test("factories carry status and code and are detectable", () => {
    const err = notFound("Missing");
    expect(isHttpError(err)).toBe(true);
    expect(err).toMatchObject({ statusCode: 404, code: "NOT_FOUND", message: "Missing" });
    expect(isHttpError(new Error("plain"))).toBe(false);
    expect(httpError("x", 418).statusCode).toBe(418);
  });
});

describe("payway transaction lifetime", () => {
  const { paywayTransactionExpiry, isPaywayCheckable, PAYWAY_LIFETIME_MINUTES } = require("./payway");
  const started = 1_790_000_000;
  const tranId = `TXN${started}123`;

  test("derives the expiry from the request time inside the transaction id", () => {
    expect(paywayTransactionExpiry(tranId).getTime()).toBe((started + PAYWAY_LIFETIME_MINUTES * 60) * 1000);
    expect(paywayTransactionExpiry("garbage")).toBeNull();
  });

  test("keeps checking through the lifetime plus grace, then stops", () => {
    const start = started * 1000;
    expect(isPaywayCheckable(tranId, start + 60_000)).toBe(true);
    expect(isPaywayCheckable(tranId, start + PAYWAY_LIFETIME_MINUTES * 60_000 + 30_000)).toBe(true);
    expect(isPaywayCheckable(tranId, start + PAYWAY_LIFETIME_MINUTES * 60_000 + 120_000)).toBe(false);
  });
});
