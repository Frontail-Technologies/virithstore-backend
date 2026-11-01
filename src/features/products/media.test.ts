import { describe, expect, test } from "bun:test";
import { isValidYouTubeUrl } from "./service";

describe("product YouTube banners", () => {
  test("accepts supported YouTube URL formats", () => {
    expect(isValidYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isValidYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isValidYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(true);
  });

  test("rejects unrelated or malformed URLs", () => {
    expect(isValidYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isValidYouTubeUrl("not-a-url")).toBe(false);
  });
});
