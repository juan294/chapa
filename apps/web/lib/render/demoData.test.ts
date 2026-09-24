import { describe, it, expect } from "vitest";
import { DEMO_STATS, DEMO_IMPACT } from "./demoData";
import { renderableScore } from "@/lib/profile/score-view-model";

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

// #1335 phase 5 — v6 is retired, so DEMO_IMPACT is now the same v7.2
// illustrative ScoreViewModel STUDIO_OBSERVED_DEMO composes (CLAUDE.md:
// Studio sample stays 82 / High / Balanced).
describe("DEMO_IMPACT", () => {
  it("is the curated High/82/Balanced v7.2 sample", () => {
    const drawn = renderableScore(DEMO_IMPACT);
    expect(drawn.composite).toBe(82);
    expect(drawn.tier).toBe("High");
    expect(drawn.archetype).toBe("Balanced");
  });

  it("has dimension scores each in 0-100", () => {
    const drawn = renderableScore(DEMO_IMPACT);
    for (const key of ["delivery", "quality", "consistency", "breadth"] as const) {
      expect(drawn.dimensions[key]).toBeGreaterThanOrEqual(0);
      expect(drawn.dimensions[key]).toBeLessThanOrEqual(100);
    }
  });

  it("is explicitly illustrative, with no publication identity", () => {
    expect(DEMO_IMPACT.illustrative).toBe(true);
    expect(DEMO_IMPACT.identity).toBeNull();
    expect(DEMO_IMPACT.policyVersion).toBe("v7.2");
  });
});

describe("DEMO_STATS heatmap data mapping", () => {
  it("maps all heatmap count values to known LEVEL_TO_COUNT outputs", () => {
    // The only valid count values from LEVEL_TO_COUNT are 0, 1, 4, 8, 12.
    // The ?? 0 fallback would produce 0 for unknown levels.
    const validCounts = new Set([0, 1, 4, 8, 12]);
    for (const day of DEMO_STATS.heatmapData) {
      expect(validCounts.has(day.count)).toBe(true);
    }
  });

  it("includes dates that are sequential across 91 days", () => {
    const dates = DEMO_STATS.heatmapData.map((d) => d.date);
    expect(dates[0]).toBe("2025-01-01");
    // Verify last date is 90 days after start
    const lastDate = new Date("2025-01-01");
    lastDate.setDate(lastDate.getDate() + 90);
    expect(dates[dates.length - 1]).toBe(lastDate.toISOString().slice(0, 10));
  });
});

describe("DEMO_STATS linked platforms", () => {
  it("includes linkedPlatforms array", () => {
    expect(DEMO_STATS.linkedPlatforms).toEqual(["bitbucket", "codeberg", "gitlab"]);
  });

  it("includes linkedPlatformLogins", () => {
    expect(DEMO_STATS.linkedPlatformLogins).toEqual({
      bitbucket: "developer",
      codeberg: "developer",
      gitlab: "developer",
    });
  });
});

describe("DEMO_IMPACT report Craft channel", () => {
  it("includes a scored report Craft channel", () => {
    expect(DEMO_IMPACT.reportCraft).toMatchObject({
      status: "scored",
      report: { result: { point: { displayValue: 72 } } },
    });
  });
});

// renderBadgeSvg integration coverage for DEMO_STATS/DEMO_IMPACT now lives
// with lib/render/BadgeSvg.tsx's own render test suite (owned outside this
// workstream), which exercises the renderer's real (post-#1335) signature.
