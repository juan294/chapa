import { describe, it, expect } from "vitest";
import { TIER_THRESHOLDS } from "@chapa/shared";
import { normalize, getTier } from "./utils";

// ---------------------------------------------------------------------------
// normalize(x, cap)
// ---------------------------------------------------------------------------

describe("normalize", () => {
  it("returns 0 when x is 0", () => {
    expect(normalize(0, 10)).toBe(0);
  });

  it("returns 0 for negative input", () => {
    expect(normalize(-1, 10)).toBe(0);
    expect(normalize(-100, 5)).toBe(0);
  });

  it("returns ln(2)/ln(11) for normalize(1, 10)", () => {
    const expected = Math.log(2) / Math.log(11);
    expect(normalize(1, 10)).toBeCloseTo(expected, 10);
  });

  it("returns 1.0 when x equals cap", () => {
    expect(normalize(10, 10)).toBeCloseTo(1.0, 10);
  });

  it("returns 1.0 when x exceeds cap (clamped)", () => {
    expect(normalize(100, 10)).toBeCloseTo(1.0, 10);
    expect(normalize(999, 5)).toBeCloseTo(1.0, 10);
  });

  it("handles fractional inputs correctly", () => {
    const expected = Math.log(1.5) / Math.log(2);
    expect(normalize(0.5, 1)).toBeCloseTo(expected, 10);
  });

  it("handles cap of 1 with x = 1", () => {
    expect(normalize(1, 1)).toBeCloseTo(1.0, 10);
  });

  it("handles large cap with small x", () => {
    const expected = Math.log(2) / Math.log(10001);
    expect(normalize(1, 10000)).toBeCloseTo(expected, 10);
  });

  it("returns a value between 0 and 1 for typical inputs", () => {
    const result = normalize(25, 200);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// getTier(adjustedScore)
// ---------------------------------------------------------------------------

describe("getTier", () => {
  it("maps threshold boundaries through shared constants", () => {
    expect(getTier(TIER_THRESHOLDS.S)).toBe("Elite");
    expect(getTier(TIER_THRESHOLDS.A)).toBe("High");
    expect(getTier(TIER_THRESHOLDS.C)).toBe("Solid");
    expect(getTier(TIER_THRESHOLDS.C - 1)).toBe("Emerging");
  });

  it("returns Emerging for score 0", () => {
    expect(getTier(0)).toBe("Emerging");
  });

  it("returns Emerging for score 29", () => {
    expect(getTier(29)).toBe("Emerging");
  });

  it("returns Solid for score 30", () => {
    expect(getTier(30)).toBe("Solid");
  });

  it("returns Solid for score 69", () => {
    expect(getTier(69)).toBe("Solid");
  });

  it("returns High for score 70", () => {
    expect(getTier(70)).toBe("High");
  });

  it("returns High for score 84", () => {
    expect(getTier(84)).toBe("High");
  });

  it("returns Elite for score 85", () => {
    expect(getTier(85)).toBe("Elite");
  });

  it("returns Elite for score 100", () => {
    expect(getTier(100)).toBe("Elite");
  });

  it("returns Emerging for negative score", () => {
    expect(getTier(-5)).toBe("Emerging");
  });

  it("returns Elite for score above 100", () => {
    expect(getTier(150)).toBe("Elite");
  });
});
