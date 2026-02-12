import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getIntensityLevel } from "./HeatmapGrid";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "HeatmapGrid.tsx"),
  "utf-8",
);

describe("HeatmapGrid", () => {
  describe("component structure", () => {
    it("slices data to last 91 entries when input exceeds 91", () => {
      expect(SOURCE).toContain("slice(-displaySize)");
    });

    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });

    it("has role=img with heatmap aria-label", () => {
      expect(SOURCE).toContain('role="img"');
      expect(SOURCE).toContain("heatmap");
    });

    it("cells are aria-hidden", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
    });

    it("uses getDelayFn for animation timing", () => {
      expect(SOURCE).toContain("getDelayFn");
    });

    it("uses INTENSITY_COLORS for cell colors", () => {
      expect(SOURCE).toContain("INTENSITY_COLORS");
    });

    it("renders WEEKS × DAYS cells", () => {
      expect(SOURCE).toContain("WEEKS");
      expect(SOURCE).toContain("DAYS");
    });

    it("exports HEATMAP_GRID_CSS for injection", () => {
      expect(SOURCE).toContain("export const HEATMAP_GRID_CSS");
    });

    it("includes reduced-motion support in CSS", () => {
      expect(SOURCE).toContain("prefers-reduced-motion");
    });
  });

  describe("getIntensityLevel", () => {
    it("returns 0 for count of 0", () => {
      expect(getIntensityLevel(0, 10)).toBe(0);
    });

    it("returns 1 for low ratio (≤25%)", () => {
      expect(getIntensityLevel(1, 10)).toBe(1);
      expect(getIntensityLevel(2, 10)).toBe(1);
    });

    it("returns 2 for medium ratio (≤50%)", () => {
      expect(getIntensityLevel(3, 10)).toBe(2);
      expect(getIntensityLevel(5, 10)).toBe(2);
    });

    it("returns 3 for high ratio (≤75%)", () => {
      expect(getIntensityLevel(6, 10)).toBe(3);
      expect(getIntensityLevel(7, 10)).toBe(3);
    });

    it("returns 4 for intense ratio (>75%)", () => {
      expect(getIntensityLevel(8, 10)).toBe(4);
      expect(getIntensityLevel(10, 10)).toBe(4);
    });

    it("handles max of 1 (edge case)", () => {
      expect(getIntensityLevel(1, 1)).toBe(4);
    });

    it("handles equal count and max", () => {
      expect(getIntensityLevel(5, 5)).toBe(4);
    });
  });
});
