// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import fs from "fs";
import { resolve } from "path";

const SOURCE = fs.readFileSync(
  resolve(__dirname, "page.tsx"),
  "utf-8"
);

describe("HexmapExperimentPage — no hardcoded colors", () => {
  it("uses CSS variables for dimension colors, not hardcoded hex", () => {
    expect(SOURCE).toContain("var(--color-dimension-delivery)");
    expect(SOURCE).toContain("var(--color-dimension-quality)");
    expect(SOURCE).toContain("var(--color-dimension-consistency)");
    expect(SOURCE).toContain("var(--color-dimension-breadth)");

    const dimColorsBlock = SOURCE.match(
      /DIMENSION_COLORS[\s\S]*?};/
    )?.[0] ?? "";
    expect(dimColorsBlock).not.toContain('"#22c55e"');
    expect(dimColorsBlock).not.toContain('"#f97316"');
    expect(dimColorsBlock).not.toContain('"#06b6d4"');
    expect(dimColorsBlock).not.toContain('"#ec4899"');
  });

  it("does not use hardcoded bg-[#06060A] — uses bg-dark-section instead", () => {
    expect(SOURCE).not.toContain("bg-[#06060A]");
  });

  it("does not use hardcoded rgba() colors — uses CSS variable tokens instead", () => {
    // The glow variant's empty cell color should use a CSS variable, not raw rgba()
    // Allowed: rgba() inside cssVarAlpha() calls (those reference CSS variables already)
    // Disallowed: raw string literals like "rgba(255, 255, 255, 0.03)"
    const lines = SOURCE.split("\n");
    const rawRgbaLiterals = lines.filter(
      (line) =>
        line.includes("rgba(") &&
        !line.includes("cssVarAlpha") &&
        !line.includes("//") &&
        !line.includes("/*") &&
        !line.includes("var(--")
    );
    expect(rawRgbaLiterals).toHaveLength(0);
  });
});
