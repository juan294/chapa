import { describe, it, expect } from "vitest";
import {
  BUILDER_STATS,
  BUILDER_IMPACT,
  GUARDIAN_STATS,
  GUARDIAN_IMPACT,
  MARATHONER_STATS,
  MARATHONER_IMPACT,
  POLYMATH_STATS,
  POLYMATH_IMPACT,
  BALANCED_STATS,
  BALANCED_IMPACT,
  EMERGING_STATS,
  EMERGING_IMPACT,
  ARTIFICER_STATS,
  ARTIFICER_IMPACT,
} from "./archetypeDemoData";

describe("archetypeDemoData", () => {
  describe("data integrity", () => {
    const archetypes = [
      { name: "Builder", stats: BUILDER_STATS, impact: BUILDER_IMPACT },
      { name: "Guardian", stats: GUARDIAN_STATS, impact: GUARDIAN_IMPACT },
      { name: "Marathoner", stats: MARATHONER_STATS, impact: MARATHONER_IMPACT },
      { name: "Polymath", stats: POLYMATH_STATS, impact: POLYMATH_IMPACT },
      { name: "Balanced", stats: BALANCED_STATS, impact: BALANCED_IMPACT },
      { name: "Emerging", stats: EMERGING_STATS, impact: EMERGING_IMPACT },
      { name: "Artificer", stats: ARTIFICER_STATS, impact: ARTIFICER_IMPACT },
    ];

    for (const { name, stats, impact } of archetypes) {
      describe(name, () => {
        it("has matching handle in stats and impact", () => {
          expect(stats.handle).toBe(impact.handle);
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
          const dims = impact.dimensions;
          for (const key of ["delivery", "quality", "consistency", "breadth"] as const) {
            expect(dims[key]).toBeGreaterThanOrEqual(0);
            expect(dims[key]).toBeLessThanOrEqual(100);
          }
          if (dims.craft !== undefined) {
            expect(dims.craft).toBeGreaterThanOrEqual(0);
            expect(dims.craft).toBeLessThanOrEqual(100);
          }
        });

        it("has valid tier", () => {
          expect(["Emerging", "Solid", "High", "Elite"]).toContain(impact.tier);
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
      expect(BUILDER_IMPACT.archetype).toBe("Builder");
      expect(BUILDER_IMPACT.dimensions.delivery).toBeGreaterThan(BUILDER_IMPACT.dimensions.quality);
      expect(BUILDER_IMPACT.dimensions.delivery).toBeGreaterThan(BUILDER_IMPACT.dimensions.consistency);
      expect(BUILDER_IMPACT.dimensions.delivery).toBeGreaterThan(BUILDER_IMPACT.dimensions.breadth);
    });

    it("Guardian (Quality Champion) has the highest quality dimension", () => {
      expect(GUARDIAN_IMPACT.archetype).toBe("Quality Champion");
      expect(GUARDIAN_IMPACT.dimensions.quality).toBeGreaterThan(GUARDIAN_IMPACT.dimensions.delivery);
    });

    it("Marathoner has the highest consistency dimension", () => {
      expect(MARATHONER_IMPACT.archetype).toBe("Marathoner");
      expect(MARATHONER_IMPACT.dimensions.consistency).toBeGreaterThan(MARATHONER_IMPACT.dimensions.delivery);
    });

    it("Polymath has the highest breadth dimension", () => {
      expect(POLYMATH_IMPACT.archetype).toBe("Polymath");
      expect(POLYMATH_IMPACT.dimensions.breadth).toBeGreaterThan(POLYMATH_IMPACT.dimensions.delivery);
    });

    it("Balanced has all dimensions within 10 points of each other", () => {
      const dims = BALANCED_IMPACT.dimensions;
      const values = [dims.delivery, dims.quality, dims.consistency, dims.breadth];
      const max = Math.max(...values);
      const min = Math.min(...values);
      expect(max - min).toBeLessThanOrEqual(10);
    });

    it("Emerging has all dimensions below 30", () => {
      const dims = EMERGING_IMPACT.dimensions;
      for (const key of ["delivery", "quality", "consistency", "breadth"] as const) {
        expect(dims[key]).toBeLessThan(30);
      }
    });

    it("Emerging has solo profile type", () => {
      expect(EMERGING_IMPACT.profileType).toBe("solo");
    });

    it("Artificer has craft as the highest dimension", () => {
      expect(ARTIFICER_IMPACT.archetype).toBe("Artificer");
      expect(ARTIFICER_IMPACT.dimensions.craft).toBeGreaterThan(ARTIFICER_IMPACT.dimensions.delivery);
      expect(ARTIFICER_IMPACT.dimensions.craft).toBeGreaterThan(ARTIFICER_IMPACT.dimensions.quality);
    });
  });
});
