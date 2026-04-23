import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  WARM_AMBER,
  getArchetypeColor,
  getHeatmapColor,
  getTierColor,
} from "./theme";

const globalsCss = readFileSync(
  new URL("../../styles/globals.css", import.meta.url),
  "utf8",
);

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

  it("keeps tier colors aligned with the CSS brand tokens", () => {
    expect(globalsCss).toContain("--color-amber: #8B5CF6;");
    expect(globalsCss).toContain("--color-amber-light: #A78BFA;");
    expect(getTierColor("Elite")).toBe("#8B5CF6");
    expect(getTierColor("High")).toBe("#A78BFA");
  });
});

describe("getArchetypeColor", () => {
  it("keeps archetype colors aligned with globals.css tokens", () => {
    expect(globalsCss).toContain("--color-archetype-builder: #8B5CF6;");
    expect(globalsCss).toContain("--color-archetype-guardian: #EC4899;");
    expect(globalsCss).toContain("--color-archetype-marathoner: #22C55E;");
    expect(globalsCss).toContain("--color-archetype-polymath: #EAB308;");
    expect(globalsCss).toContain("--color-archetype-balanced: #0EA5E9;");
    expect(globalsCss).toContain("--color-archetype-emerging: #F97316;");
    expect(globalsCss).toContain("--color-archetype-artificer: #F59E0B;");

    expect(getArchetypeColor("Builder")).toBe("#8B5CF6");
    expect(getArchetypeColor("Quality Champion")).toBe("#EC4899");
    expect(getArchetypeColor("Marathoner")).toBe("#22C55E");
    expect(getArchetypeColor("Polymath")).toBe("#EAB308");
    expect(getArchetypeColor("Balanced")).toBe("#0EA5E9");
    expect(getArchetypeColor("Emerging")).toBe("#F97316");
    expect(getArchetypeColor("Artificer")).toBe("#F59E0B");
  });
});
