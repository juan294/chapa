import { describe, it, expect } from "vitest";
import { formatIsoDate, toDateString } from "./date";

describe("formatIsoDate", () => {
  it("formats a date string into short human-readable form", () => {
    const result = formatIsoDate("2025-01-15");
    expect(result).toMatch(/Wed/);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it("handles month boundaries", () => {
    const result = formatIsoDate("2025-12-31");
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/31/);
  });

  it("handles leap year date", () => {
    const result = formatIsoDate("2024-02-29");
    expect(result).toMatch(/Feb/);
    expect(result).toMatch(/29/);
  });
});

describe("toDateString", () => {
  it("converts a Date to YYYY-MM-DD string", () => {
    const date = new Date("2025-06-15T12:00:00Z");
    expect(toDateString(date)).toBe("2025-06-15");
  });

  it("pads single-digit months and days", () => {
    const date = new Date("2025-01-05T12:00:00Z");
    expect(toDateString(date)).toBe("2025-01-05");
  });

  it("handles epoch date", () => {
    const date = new Date("1970-01-01T00:00:00Z");
    expect(toDateString(date)).toBe("1970-01-01");
  });
});
