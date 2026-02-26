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

        it("has 4 dimensions between 0 and 100", () => {
          const dims = impact.dimensions;
          for (const key of ["delivery", "quality", "consistency", "breadth"] as const) {
            expect(dims[key]).toBeGreaterThanOrEqual(0);
            expect(dims[key]).toBeLessThanOrEqual(100);
          }
        });

        it("has valid tier", () => {
          expect(["Emerging", "Growing", "Established", "High", "Exceptional"]).toContain(impact.tier);
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
  });
});
