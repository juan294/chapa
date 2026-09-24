import { describe, it, expect } from "vitest";
import { renderableScore } from "@/lib/profile/score-view-model";
import {
  BUILDER_STATS,
  BUILDER_SCORING,
  GUARDIAN_STATS,
  GUARDIAN_SCORING,
  MARATHONER_STATS,
  MARATHONER_SCORING,
  POLYMATH_STATS,
  POLYMATH_SCORING,
  BALANCED_STATS,
  BALANCED_SCORING,
  EMERGING_STATS,
  EMERGING_SCORING,
  ARTIFICER_STATS,
  ARTIFICER_SCORING,
} from "./archetypeDemoData";

// #1335 phase 5 — v6 is retired. Each archetype's `*_SCORING` constant is a
// real v7.2 ScoreViewModel produced by the production `calculateObservedCoreV7`
// arithmetic from tuned evidence counts, not a hand-picked display score.

describe("archetypeDemoData", () => {
  describe("data integrity", () => {
    const archetypes = [
      { name: "Builder", stats: BUILDER_STATS, scoring: BUILDER_SCORING },
      { name: "Guardian", stats: GUARDIAN_STATS, scoring: GUARDIAN_SCORING },
      { name: "Marathoner", stats: MARATHONER_STATS, scoring: MARATHONER_SCORING },
      { name: "Polymath", stats: POLYMATH_STATS, scoring: POLYMATH_SCORING },
      { name: "Balanced", stats: BALANCED_STATS, scoring: BALANCED_SCORING },
      { name: "Emerging", stats: EMERGING_STATS, scoring: EMERGING_SCORING },
      { name: "Artificer", stats: ARTIFICER_STATS, scoring: ARTIFICER_SCORING },
    ];

    for (const { name, stats, scoring } of archetypes) {
      describe(name, () => {
        it("has matching handle in stats and scoring", () => {
          expect(stats.handle).toBe(scoring.handle);
        });

        it("has heatmap data", () => {
          expect(stats.heatmapData.length).toBeGreaterThan(0);
        });

        it("heatmap days have date and count", () => {
          const day = stats.heatmapData[0]!;
          expect(day).toHaveProperty("date");
          expect(day).toHaveProperty("count");
          expect(typeof day.date).toBe("string");
          expect(typeof day.count).toBe("number");
        });

        it("has core dimensions between 0 and 100", () => {
          const drawn = renderableScore(scoring);
          for (const key of ["delivery", "quality", "consistency", "breadth"] as const) {
            expect(drawn.dimensions[key]).toBeGreaterThanOrEqual(0);
            expect(drawn.dimensions[key]).toBeLessThanOrEqual(100);
          }
        });

        it("has a valid tier", () => {
          expect(["Emerging", "Solid", "High", "Elite"]).toContain(scoring.tier);
        });

        it("is explicitly illustrative, with no publication identity", () => {
          expect(scoring.illustrative).toBe(true);
          expect(scoring.identity).toBeNull();
          expect(scoring.policyVersion).toBe("v7.2");
        });
      });
    }
  });

  describe("buildHeatmap (via exports)", () => {
    it("generates heatmap with correct date format", () => {
      const day = BUILDER_STATS.heatmapData[0]!;
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("generates consistent heatmap length across archetypes", () => {
      // All grids are 13 weeks x 7 days = 91 days
      expect(BUILDER_STATS.heatmapData).toHaveLength(91);
      expect(GUARDIAN_STATS.heatmapData).toHaveLength(91);
      expect(MARATHONER_STATS.heatmapData).toHaveLength(91);
    });

    it("maps grid level 0 to count 0", () => {
      // Emerging grid starts with [0, 0, 1, 0, 0, 0, 0]
      // First day is level 0 => count 0
      expect(EMERGING_STATS.heatmapData[0]!.count).toBe(0);
    });

    it("maps all grid levels to known LEVEL_TO_COUNT values only", () => {
      // All archetypes use levels 0-4 which map to 0, 1, 4, 8, 12.
      // The ?? 0 fallback covers unknown levels.
      const validCounts = new Set([0, 1, 4, 8, 12]);
      const allStats = [
        BUILDER_STATS, GUARDIAN_STATS, MARATHONER_STATS,
        POLYMATH_STATS, BALANCED_STATS, EMERGING_STATS, ARTIFICER_STATS,
      ];
      for (const stats of allStats) {
        for (const day of stats.heatmapData) {
          expect(validCounts.has(day.count)).toBe(true);
        }
      }
    });

    it("maps grid level 1 to count 1", () => {
      // Emerging grid: [0, 0, 1, 0, 0, 0, 0] — third day is level 1
      expect(EMERGING_STATS.heatmapData[2]!.count).toBe(1);
    });

    it("maps grid level 4 to count 12", () => {
      // Builder grid starts with [0, 3, 4, 4, 3, 1, 0] — third day is level 4
      expect(BUILDER_STATS.heatmapData[2]!.count).toBe(12);
    });

    it("maps grid level 3 to count 8", () => {
      // Builder grid starts with [0, 3, 4, 4, 3, 1, 0] — second day is level 3
      expect(BUILDER_STATS.heatmapData[1]!.count).toBe(8);
    });

    it("maps grid level 2 to count 4", () => {
      // Guardian grid starts with [0, 2, 2, 2, 2, 0, 0] — second day is level 2
      expect(GUARDIAN_STATS.heatmapData[1]!.count).toBe(4);
    });
  });

  describe("archetype-specific characteristics", () => {
    it("Builder has the highest delivery dimension", () => {
      const drawn = renderableScore(BUILDER_SCORING);
      expect(drawn.archetype).toBe("Builder");
      expect(drawn.dimensions.delivery).toBeGreaterThan(drawn.dimensions.quality);
      expect(drawn.dimensions.delivery).toBeGreaterThan(drawn.dimensions.consistency);
      expect(drawn.dimensions.delivery).toBeGreaterThan(drawn.dimensions.breadth);
    });

    it("Guardian (Quality Champion) has the highest quality dimension", () => {
      const drawn = renderableScore(GUARDIAN_SCORING);
      expect(drawn.archetype).toBe("Quality Champion");
      expect(drawn.dimensions.quality).toBeGreaterThan(drawn.dimensions.delivery);
    });

    it("Marathoner has the highest consistency dimension", () => {
      const drawn = renderableScore(MARATHONER_SCORING);
      expect(drawn.archetype).toBe("Marathoner");
      expect(drawn.dimensions.consistency).toBeGreaterThan(drawn.dimensions.delivery);
    });

    it("Polymath has the highest breadth dimension", () => {
      const drawn = renderableScore(POLYMATH_SCORING);
      expect(drawn.archetype).toBe("Polymath");
      expect(drawn.dimensions.breadth).toBeGreaterThan(drawn.dimensions.delivery);
    });

    it("Balanced has all dimensions within 10 points of each other", () => {
      const drawn = renderableScore(BALANCED_SCORING);
      const values = [drawn.dimensions.delivery, drawn.dimensions.quality, drawn.dimensions.consistency, drawn.dimensions.breadth];
      const max = Math.max(...values);
      const min = Math.min(...values);
      expect(max - min).toBeLessThanOrEqual(10);
      expect(drawn.archetype).toBe("Balanced");
    });

    it("Emerging has all dimensions below 30", () => {
      const drawn = renderableScore(EMERGING_SCORING);
      for (const key of ["delivery", "quality", "consistency", "breadth"] as const) {
        expect(drawn.dimensions[key]).toBeLessThan(30);
      }
      expect(drawn.archetype).toBe("Emerging");
    });

    it("Artificer has a Balanced-shaped core but a scored report Craft channel the others lack", () => {
      const drawn = renderableScore(ARTIFICER_SCORING);
      // coreArchetypeV7 never returns "Artificer" (see archetypeDemoData.ts
      // module doc) — the persona reads through Craft, not the core shape.
      expect(drawn.archetype).toBe("Balanced");
      expect(ARTIFICER_SCORING.reportCraft?.status).toBe("scored");
      expect(BUILDER_SCORING.reportCraft?.status).toBe("no_report");
      if (ARTIFICER_SCORING.reportCraft?.status === "scored") {
        expect(ARTIFICER_SCORING.reportCraft.report.result.point.displayValue).toBeGreaterThan(90);
      }
    });
  });
});
