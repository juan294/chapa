import { describe, it, expect } from "vitest";
import { DIMENSION_COLORS, INTENSITY_COLORS } from "./dimension-colors";

describe("DIMENSION_COLORS", () => {
  it("resolves each dimension to its CSS custom property, not a hardcoded hex", () => {
    expect(DIMENSION_COLORS.delivery).toBe("var(--color-dimension-delivery)");
    expect(DIMENSION_COLORS.quality).toBe("var(--color-dimension-quality)");
    expect(DIMENSION_COLORS.consistency).toBe(
      "var(--color-dimension-consistency)",
    );
    expect(DIMENSION_COLORS.breadth).toBe("var(--color-dimension-breadth)");
  });

  it("does not contain any literal hex color values", () => {
    for (const value of Object.values(DIMENSION_COLORS)) {
      expect(value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(value).toMatch(/^var\(--color-dimension-/);
    }
  });
});

describe("INTENSITY_COLORS", () => {
  it("has entries for levels 0 through 4, using the jade accent ramp", () => {
    for (let i = 0; i <= 4; i++) {
      expect(INTENSITY_COLORS[i]).toBeDefined();
      expect(INTENSITY_COLORS[i]).toMatch(/^rgba\(27,208,147,/);
    }
  });

  it("opacity increases monotonically with level", () => {
    const alphas = [0, 1, 2, 3, 4].map((level) => {
      const match = INTENSITY_COLORS[level]!.match(/,([\d.]+)\)$/);
      return parseFloat(match?.[1] ?? "0");
    });
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]!).toBeGreaterThan(alphas[i - 1]!);
    }
  });
});
