import { describe, it, expect } from "vitest";
import { DEMO_STATS, DEMO_IMPACT } from "./demoData";
import { renderBadgeSvg } from "./BadgeSvg";

describe("DEMO_STATS", () => {
  it("has a valid handle", () => {
    expect(DEMO_STATS.handle).toBe("developer");
  });

  it("has a display name", () => {
    expect(DEMO_STATS.displayName).toBe("Bertram Gilfoyle");
  });

  it("has commit count within cap (0-600)", () => {
    expect(DEMO_STATS.commitsTotal).toBeGreaterThanOrEqual(0);
    expect(DEMO_STATS.commitsTotal).toBeLessThanOrEqual(600);
  });

  it("has activeDays within range (0-365)", () => {
    expect(DEMO_STATS.activeDays).toBeGreaterThanOrEqual(0);
    expect(DEMO_STATS.activeDays).toBeLessThanOrEqual(365);
  });

  it("has heatmapData with 91 entries (13 weeks x 7 days)", () => {
    expect(DEMO_STATS.heatmapData).toHaveLength(91);
  });

  it("has heatmapData entries with date strings and non-negative counts", () => {
    for (const day of DEMO_STATS.heatmapData) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.count).toBeGreaterThanOrEqual(0);
    }
  });

  it("has non-negative repo metrics", () => {
    expect(DEMO_STATS.totalStars).toBeGreaterThanOrEqual(0);
    expect(DEMO_STATS.totalForks).toBeGreaterThanOrEqual(0);
    expect(DEMO_STATS.totalWatchers).toBeGreaterThanOrEqual(0);
  });
});

describe("DEMO_IMPACT", () => {
  it("has a valid tier", () => {
    expect(["Emerging", "Solid", "High", "Elite"]).toContain(DEMO_IMPACT.tier);
  });

  it("has a valid archetype", () => {
    expect(["Builder", "Guardian", "Marathoner", "Polymath", "Balanced", "Emerging"]).toContain(
      DEMO_IMPACT.archetype,
    );
  });

  it("has adjustedComposite in 0-100", () => {
    expect(DEMO_IMPACT.adjustedComposite).toBeGreaterThanOrEqual(0);
    expect(DEMO_IMPACT.adjustedComposite).toBeLessThanOrEqual(100);
  });

  it("has confidence in 50-100", () => {
    expect(DEMO_IMPACT.confidence).toBeGreaterThanOrEqual(50);
    expect(DEMO_IMPACT.confidence).toBeLessThanOrEqual(100);
  });

  it("has dimension scores each in 0-100", () => {
    for (const key of ["building", "guarding", "consistency", "breadth"] as const) {
      expect(DEMO_IMPACT.dimensions[key]).toBeGreaterThanOrEqual(0);
      expect(DEMO_IMPACT.dimensions[key]).toBeLessThanOrEqual(100);
    }
  });
});

describe("renderBadgeSvg with demo data", () => {
  it("returns a valid SVG string", () => {
    const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      includeGithubBranding: true,
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("does not contain undefined or NaN values", () => {
    const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT);
    expect(svg).not.toContain("undefined");
    expect(svg).not.toContain("NaN");
  });

  it("includes the demo handle in the output", () => {
    const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT);
    expect(svg).toContain("Bertram Gilfoyle");
  });

  it("includes verification strip when hash and date are provided", () => {
    const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      verificationHash: "a1b2c3d4",
      verificationDate: "2025-01-01",
    });
    expect(svg).toContain("VERIFIED");
    expect(svg).toContain("a1b2c3d4");
  });
});
