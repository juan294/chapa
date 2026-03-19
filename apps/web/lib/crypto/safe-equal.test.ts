import { describe, it, expect } from "vitest";
import { safeEqual } from "./safe-equal";

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual("secret-token-123", "secret-token-123")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(safeEqual("aaaa", "bbbb")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(safeEqual("short", "a-longer-string")).toBe(false);
  });

  it("returns false for empty vs non-empty", () => {
    expect(safeEqual("", "non-empty")).toBe(false);
    expect(safeEqual("non-empty", "")).toBe(false);
  });

  it("returns true for both empty strings", () => {
    expect(safeEqual("", "")).toBe(true);
  });

  it("handles unicode/multi-byte characters correctly", () => {
    expect(safeEqual("café", "café")).toBe(true);
    expect(safeEqual("café", "cafe")).toBe(false);
    // Different unicode representations of same visual character
    expect(safeEqual("\u00e9", "\u0065\u0301")).toBe(false); // precomposed vs decomposed
  });

  it("returns false when inputs cause an error", () => {
    // Force the catch branch by passing values that would throw
    // during Buffer.from — null/undefined cast to string by the caller,
    // but we can test the safety net with type coercion
    expect(safeEqual(null as unknown as string, "test")).toBe(false);
    expect(safeEqual("test", undefined as unknown as string)).toBe(false);
  });
});
