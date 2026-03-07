import { describe, it, expect } from "vitest";
import { cssVarAlpha } from "./color";

describe("cssVarAlpha", () => {
  it("converts a CSS variable and alpha to color-mix()", () => {
    expect(cssVarAlpha("var(--color-dimension-delivery)", 0.5)).toBe(
      "color-mix(in srgb, var(--color-dimension-delivery) 50%, transparent)"
    );
  });

  it("converts alpha 1 to 100%", () => {
    expect(cssVarAlpha("var(--color-amber)", 1)).toBe(
      "color-mix(in srgb, var(--color-amber) 100%, transparent)"
    );
  });

  it("converts alpha 0 to 0%", () => {
    expect(cssVarAlpha("var(--color-dimension-quality)", 0)).toBe(
      "color-mix(in srgb, var(--color-dimension-quality) 0%, transparent)"
    );
  });

  it("rounds percentage to avoid floating-point artifacts", () => {
    // 0.333... * 100 = 33.3... → should round to 33%
    expect(cssVarAlpha("var(--color-dimension-breadth)", 0.333)).toBe(
      "color-mix(in srgb, var(--color-dimension-breadth) 33%, transparent)"
    );
  });
});
