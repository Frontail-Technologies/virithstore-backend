import { describe, expect, test } from "bun:test";
import { escapeTelegramHtml } from "./telegram-orders";

describe("Telegram manual-order formatting", () => {
  test("escapes user-controlled HTML", () => {
    expect(escapeTelegramHtml(`<a href="x">A&B</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;A&amp;B&lt;/a&gt;");
  });
});
