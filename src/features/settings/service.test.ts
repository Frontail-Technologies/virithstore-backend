import { describe, expect, test } from "bun:test";
import { setSettings } from "./service";

describe("settings service", () => {
  test("rejects bulk payloads that are not objects", () => {
    for (const bad of [["a"], "str", null, 5]) {
      expect(() => setSettings(bad)).toThrow("Settings must be an object");
    }
  });
});
