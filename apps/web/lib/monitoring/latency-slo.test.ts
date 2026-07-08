import { describe, expect, it } from "vitest";
import {
  BADGE_LATENCY_SLO_MS,
  evaluateBadgeLatency,
  formatServerTiming,
  serverTimingIndicatesCacheHit,
} from "./latency-slo";

describe("evaluateBadgeLatency", () => {
  it("selects the cache-hit budget and does not breach when under it", () => {
    const result = evaluateBadgeLatency({ durationMs: 500, cacheHit: true });
    expect(result.budgetMs).toBe(BADGE_LATENCY_SLO_MS.cacheHit);
    expect(result.breached).toBe(false);
  });

  it("breaches when a cache-hit response exceeds the cache-hit budget", () => {
    const result = evaluateBadgeLatency({
      durationMs: BADGE_LATENCY_SLO_MS.cacheHit + 1,
      cacheHit: true,
    });
    expect(result.breached).toBe(true);
  });

  it("does not breach exactly at the budget boundary", () => {
    const result = evaluateBadgeLatency({
      durationMs: BADGE_LATENCY_SLO_MS.cacheHit,
      cacheHit: true,
    });
    expect(result.breached).toBe(false);
  });

  it("selects the larger cache-miss budget for cold renders", () => {
    const result = evaluateBadgeLatency({ durationMs: 2500, cacheHit: false });
    expect(result.budgetMs).toBe(BADGE_LATENCY_SLO_MS.cacheMiss);
    expect(result.breached).toBe(false);
  });

  it("breaches when a cache-miss response exceeds the cache-miss budget", () => {
    const result = evaluateBadgeLatency({
      durationMs: BADGE_LATENCY_SLO_MS.cacheMiss + 1,
      cacheHit: false,
    });
    expect(result.breached).toBe(true);
  });
});

describe("formatServerTiming", () => {
  it("formats a single metric with a duration", () => {
    expect(formatServerTiming([{ name: "total", durMs: 12 }])).toBe(
      "total;dur=12",
    );
  });

  it("includes an optional description and joins multiple metrics", () => {
    const header = formatServerTiming([
      { name: "cache", desc: "hit", durMs: 3 },
      { name: "total", durMs: 4 },
    ]);
    expect(header).toBe('cache;desc="hit";dur=3, total;dur=4');
  });
});

describe("serverTimingIndicatesCacheHit", () => {
  it("is true when the header carries a cache metric", () => {
    expect(
      serverTimingIndicatesCacheHit('cache;desc="hit";dur=3, total;dur=4'),
    ).toBe(true);
  });

  it("is false for a cache-miss breakdown", () => {
    expect(
      serverTimingIndicatesCacheHit(
        "materialize;dur=120, render;dur=40, total;dur=170",
      ),
    ).toBe(false);
  });

  it("is false for an empty header", () => {
    expect(serverTimingIndicatesCacheHit("")).toBe(false);
  });
});
