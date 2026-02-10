import { describe, it, expect } from "vitest";
import { WARM_AMBER, getHeatmapColor, getTierColor } from "./theme";

describe("WARM_AMBER theme", () => {
  it("has all required color tokens", () => {
    expect(WARM_AMBER.bg).toBeTruthy();
    expect(WARM_AMBER.card).toBeTruthy();
    expect(WARM_AMBER.textPrimary).toBeTruthy();
    expect(WARM_AMBER.textSecondary).toBeTruthy();
    expect(WARM_AMBER.accent).toBeTruthy();
    expect(WARM_AMBER.stroke).toBeTruthy();
  });

  it("has 5 heatmap intensity colors", () => {
    expect(WARM_AMBER.heatmap).toHaveLength(5);
  });
});

describe("getHeatmapColor", () => {
  it("returns intensity 0 color for 0 contributions", () => {
    expect(getHeatmapColor(0)).toBe(WARM_AMBER.heatmap[0]);
  });

  it("returns intensity 4 for high contributions", () => {
    expect(getHeatmapColor(20)).toBe(WARM_AMBER.heatmap[4]);
  });

  it("returns mid-range intensities for moderate counts", () => {
    const color = getHeatmapColor(3);
    expect(WARM_AMBER.heatmap).toContain(color);
  });
});

describe("getTierColor", () => {
  it("returns accent for Elite", () => {
    expect(getTierColor("Elite")).toBe(WARM_AMBER.accent);
  });

  it("returns a color for each tier", () => {
    for (const tier of ["Emerging", "Solid", "High", "Elite"] as const) {
      expect(getTierColor(tier)).toBeTruthy();
    }
  });
});
