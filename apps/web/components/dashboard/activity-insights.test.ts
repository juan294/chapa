import { describe, it, expect } from "vitest";
import { computeActivityInsights } from "./activity-insights";
import type { HeatmapDay } from "@chapa/shared";

/** Helper: generate N consecutive days starting from a date. */
function makeDays(
  startDate: string,
  counts: number[],
): HeatmapDay[] {
  const start = new Date(startDate + "T12:00:00");
  return counts.map((count, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { date: localDateStr(d), count };
  });
}

/** Format a Date as YYYY-MM-DD using local calendar (not UTC). */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Get a local calendar date string offset by N days from now. */
function relativeDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return localDateStr(d);
}

describe("computeActivityInsights", () => {
  describe("currentStreak", () => {
    it("counts consecutive active days ending at the last day", () => {
      const data = makeDays("2025-03-01", [0, 0, 3, 5, 2]);
      expect(computeActivityInsights(data).currentStreak).toBe(3);
    });

    it("skips today if it has zero count and counts from yesterday", () => {
      // Last entry is "today" with 0 — day isn't over yet, shouldn't break streak
      const data: HeatmapDay[] = [
        { date: relativeDateStr(-2), count: 5 },
        { date: relativeDateStr(-1), count: 3 },
        { date: relativeDateStr(0), count: 0 },
      ];
      expect(computeActivityInsights(data).currentStreak).toBe(2);
    });

    it("counts today if it has activity", () => {
      const data: HeatmapDay[] = [
        { date: relativeDateStr(-1), count: 3 },
        { date: relativeDateStr(0), count: 7 },
      ];
      expect(computeActivityInsights(data).currentStreak).toBe(2);
    });

    it("returns 0 when yesterday and today are both inactive", () => {
      const data: HeatmapDay[] = [
        { date: relativeDateStr(-2), count: 5 },
        { date: relativeDateStr(-1), count: 0 },
        { date: relativeDateStr(0), count: 0 },
      ];
      expect(computeActivityInsights(data).currentStreak).toBe(0);
    });

    it("returns full length when all days are active", () => {
      const data = makeDays("2025-03-01", [1, 2, 3, 4, 5]);
      expect(computeActivityInsights(data).currentStreak).toBe(5);
    });

    it("returns 0 for empty data", () => {
      expect(computeActivityInsights([]).currentStreak).toBe(0);
    });
  });

  describe("longestStreak", () => {
    it("finds the longest consecutive run of active days", () => {
      const data = makeDays("2025-03-01", [1, 2, 0, 3, 5, 2, 1, 0, 1]);
      expect(computeActivityInsights(data).longestStreak).toBe(4);
    });

    it("returns 0 when all days are inactive", () => {
      const data = makeDays("2025-03-01", [0, 0, 0, 0]);
      expect(computeActivityInsights(data).longestStreak).toBe(0);
    });

    it("handles a single active day", () => {
      const data = makeDays("2025-03-01", [0, 1, 0]);
      expect(computeActivityInsights(data).longestStreak).toBe(1);
    });

    it("returns full length when all days are active", () => {
      const data = makeDays("2025-03-01", [3, 3, 3]);
      expect(computeActivityInsights(data).longestStreak).toBe(3);
    });
  });

  describe("busiestDay", () => {
    it("returns the weekday with the most total contributions", () => {
      // 2025-03-03 is a Monday, 2025-03-10 is also a Monday
      const data = makeDays("2025-03-03", [
        10, // Mon
        1,  // Tue
        1,  // Wed
        1,  // Thu
        1,  // Fri
        0,  // Sat
        0,  // Sun
        10, // Mon again
        1,  // Tue
        1,  // Wed
      ]);
      expect(computeActivityInsights(data).busiestDay).toBe("Mon");
    });

    it("returns empty string for empty data", () => {
      expect(computeActivityInsights([]).busiestDay).toBe("");
    });

    it("returns empty string when all counts are zero", () => {
      const data = makeDays("2025-03-01", [0, 0, 0]);
      expect(computeActivityInsights(data).busiestDay).toBe("");
    });
  });

  describe("avgPerActiveDay", () => {
    it("computes total contributions divided by active days", () => {
      // 3 active days with counts 2, 4, 6 = 12 total / 3 active = 4.0
      const data = makeDays("2025-03-01", [2, 0, 4, 0, 6]);
      expect(computeActivityInsights(data).avgPerActiveDay).toBeCloseTo(4.0);
    });

    it("returns 0 when no active days", () => {
      const data = makeDays("2025-03-01", [0, 0, 0]);
      expect(computeActivityInsights(data).avgPerActiveDay).toBe(0);
    });
  });

  describe("peakDay", () => {
    it("returns the day with the highest count", () => {
      const data = makeDays("2025-03-01", [3, 15, 7, 2]);
      const peak = computeActivityInsights(data).peakDay;
      expect(peak.count).toBe(15);
      expect(peak.date).toBe("2025-03-02");
    });

    it("returns null-like entry for empty data", () => {
      const peak = computeActivityInsights([]).peakDay;
      expect(peak.count).toBe(0);
    });
  });
});
