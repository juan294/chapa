import { describe, expect, it, vi } from "vitest";
import { createScoringWindow, isWithinScoringWindow, scoringDates, utcIsoWeek } from "./scoring-window";

describe("v7 explicit UTC window", () => {
  it.each(["2024-03-31T01:30:00.000Z", "2024-10-27T01:30:00.000Z", "2024-02-29T12:00:00.000Z"])("has exactly 365 unique calendar dates across DST and leap dates: %s", (referenceTime) => {
    const window = createScoringWindow(referenceTime);
    const dates = scoringDates(window);
    expect(dates).toHaveLength(365);
    expect(new Set(dates).size).toBe(365);
    expect(dates.at(-1)).toBe(referenceTime.slice(0, 10));
  });
  it("includes start and reference instant, excludes older and future same-day events", () => {
    const window = createScoringWindow("2024-03-01T12:00:00.000Z");
    expect(window.startInclusive).toBe("2023-03-03T00:00:00.000Z");
    expect(window.endExclusive).toBe("2024-03-02T00:00:00.000Z");
    expect(scoringDates(window)).toContain("2024-02-29");
    expect(isWithinScoringWindow(window.startInclusive, window)).toBe(true);
    expect(isWithinScoringWindow(window.referenceTime, window)).toBe(true);
    expect(isWithinScoringWindow("2023-03-02T23:59:59.999Z", window)).toBe(false);
    expect(isWithinScoringWindow("2024-03-01T12:00:00.001Z", window)).toBe(false);
    expect(isWithinScoringWindow(window.endExclusive, window)).toBe(false);
  });
  it("canonicalizes explicit offsets without consulting the ambient clock", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime("2000-01-01");
      const first = createScoringWindow("2024-03-31T03:30:00+02:00");
      vi.setSystemTime("2099-12-31");
      expect(createScoringWindow("2024-03-31T03:30:00+02:00")).toEqual(first);
      expect(first.referenceTime).toBe("2024-03-31T01:30:00.000Z");
    } finally { vi.useRealTimers(); }
  });
  it.each(["", "2024-02-30T00:00:00Z", "2024-01-01", "2024-01-01T12:00:00", "invalid"])("rejects ambiguous or invalid instants: %s", (instant) => {
    expect(() => createScoringWindow(instant)).toThrow();
  });
  it("uses ISO week-year at year boundaries", () => {
    expect(utcIsoWeek("2021-01-01T12:00:00Z")).toBe("2020-W53");
    expect(utcIsoWeek("2021-01-04T00:00:00Z")).toBe("2021-W01");
  });
});
