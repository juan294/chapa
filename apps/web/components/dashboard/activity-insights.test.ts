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

  describe("weekdayDistribution", () => {
    it("sums contributions by weekday", () => {
      // 2025-03-03 is Monday
      const data = makeDays("2025-03-03", [10, 5, 3, 0, 2, 0, 0]);
      const dist = computeActivityInsights(data).weekdayDistribution;
      expect(dist[1]).toBe(10); // Monday
      expect(dist[2]).toBe(5);  // Tuesday
      expect(dist[3]).toBe(3);  // Wednesday
      expect(dist[5]).toBe(2);  // Friday
    });

    it("returns all zeros for empty data", () => {
      const dist = computeActivityInsights([]).weekdayDistribution;
      expect(dist).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });
  });

  describe("weeklyAverage", () => {
    it("computes mean of complete weekly totals excluding current week", () => {
      // Two full weeks + partial third
      const data = makeDays("2025-03-03", [
        1, 1, 1, 1, 1, 1, 1,   // week 1: total 7
        2, 2, 2, 2, 2, 2, 2,   // week 2: total 14
        3, 3, 3,                 // week 3 (partial): total 9
      ]);
      const insights = computeActivityInsights(data);
      // Average of completed weeks (7 + 14) / 2 = 10.5
      expect(insights.weeklyAverage).toBeCloseTo(10.5);
      expect(insights.thisWeekTotal).toBe(9);
    });

    it("uses single week as average when only one week exists", () => {
      const data = makeDays("2025-03-03", [3, 5, 2]);
      const insights = computeActivityInsights(data);
      expect(insights.thisWeekTotal).toBe(10);
    });
  });

  describe("last7DaysActive", () => {
    it("returns boolean array for last 7 entries", () => {
      const data = makeDays("2025-03-01", [0, 5, 3, 0, 0, 2, 1]);
      const last7 = computeActivityInsights(data).last7DaysActive;
      expect(last7).toEqual([false, true, true, false, false, true, true]);
    });

    it("returns fewer entries when data is shorter than 7 days", () => {
      const data = makeDays("2025-03-01", [5, 0, 3]);
      const last7 = computeActivityInsights(data).last7DaysActive;
      expect(last7).toEqual([true, false, true]);
    });
  });

  describe("summary", () => {
    it("returns contextual summary for active data", () => {
      const data = makeDays("2025-03-03", [
        1, 1, 1, 1, 1, 1, 1,
        10, 10, 10, 10, 10, 10, 10,
      ]);
      const summary = computeActivityInsights(data).summary;
      // Best week (70) is 10x average of first week (7).
      expect(summary).toMatchObject({
        kind: "most-active-week",
        ratio: 10,
      });
    });

    it("falls back to peak day when no week is notably above average", () => {
      const data = makeDays("2025-03-03", [5, 5, 5, 5, 5, 5, 5]);
      const summary = computeActivityInsights(data).summary;
      expect(summary).toMatchObject({ kind: "peak-day", count: 5 });
    });

    it("returns empty-state message for no data", () => {
      expect(computeActivityInsights([]).summary).toEqual({ kind: "none" });
    });
  });

  describe("busiestDayIndex", () => {
    it("returns the JS day index of the busiest weekday", () => {
      // 2025-03-07 is Friday
      const data = makeDays("2025-03-07", [100, 1, 1]);
      expect(computeActivityInsights(data).busiestDayIndex).toBe(5); // Friday
    });

    it("returns -1 for empty data", () => {
      expect(computeActivityInsights([]).busiestDayIndex).toBe(-1);
    });
  });
});
