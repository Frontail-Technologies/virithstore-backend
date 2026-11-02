import { describe, expect, test } from "bun:test";
import { normalizeDirectLink } from "./service";

describe("product direct link", () => {
  test("accepts http(s) URLs and same-site paths", () => {
    expect(normalizeDirectLink(" https://t.me/example ")).toBe("https://t.me/example");
    expect(normalizeDirectLink("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
    expect(normalizeDirectLink("/product/netflix")).toBe("/product/netflix");
  });

  test("treats empty values as no link", () => {
    expect(normalizeDirectLink("")).toBeNull();
    expect(normalizeDirectLink("   ")).toBeNull();
    expect(normalizeDirectLink(null)).toBeNull();
    expect(normalizeDirectLink(undefined)).toBeNull();
  });

  test("refuses other schemes and protocol-relative links", () => {
    for (const bad of ["javascript:alert(1)", "//evil.example", "t.me/example", "ftp://example.com"]) {
      expect(() => normalizeDirectLink(bad)).toThrow();
    }
  });
});
