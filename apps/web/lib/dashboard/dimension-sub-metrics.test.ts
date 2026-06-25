import { describe, expect, it } from "vitest";
import type { CraftResult } from "@chapa/shared";
import { BATCH_SIZE_DEFAULT } from "@chapa/shared";
import { makeStats } from "@/lib/test-helpers/fixtures";
import { getDimensionSubMetrics } from "./dimension-sub-metrics";

function makeCraftResult(overrides: Partial<CraftResult> = {}): CraftResult {
  return {
    tool: "claude-code",
    dimensions: {
      proficiency: 34,
      effectiveness: 82,
      sophistication: 91,
    },
    craftScore: 69,
    tier: "Expert",
    reportPeriod: {
      start: "2026-06-01",
      end: "2026-06-25",
    },
    computedAt: "2026-06-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("getDimensionSubMetrics", () => {
  it("returns v6 delivery keys with log-normalized count values", () => {
    const metrics = getDimensionSubMetrics(
      "delivery",
      makeStats({
        prsMergedWeight: 47,
        prsMergedCount: 31,
        issuesClosedCount: 12,
        commitsTotal: 312,
      }),
      "collaborative",
    );

    expect(metrics.map((m) => [m.key, m.weight])).toEqual([
      ["prWeight", "70%"],
      ["issues", "20%"],
      ["commits", "10%"],
    ]);
    expect(metrics[0]!.normalizedValue).toBeCloseTo(0.94, 2);
    expect(metrics[1]!.normalizedValue).toBeCloseTo(0.69, 2);
    expect(metrics[2]!.normalizedValue).toBe(1);
    expect(metrics[0]!.rawLabelKey).toBe("prsMerged");
    expect(metrics[0]!.rawLabelParams).toEqual({ count: "31" });
  });

  it("returns collaborative quality keys using reviews, review ratio, and batch size", () => {
    const metrics = getDimensionSubMetrics(
      "quality",
      makeStats({
        prsMergedCount: 20,
        reviewsSubmittedCount: 30,
        batchSizeScore: 0.8,
      }),
      "collaborative",
    );

    expect(metrics.map((m) => [m.key, m.weight])).toEqual([
      ["reviews", "60%"],
      ["reviewRatio", "25%"],
      ["batchSize", "15%"],
    ]);
    expect(metrics[0]!.normalizedValue).toBeCloseTo(0.78, 2);
    expect(metrics[1]!.normalizedValue).toBe(0.3);
    expect(metrics[2]!.normalizedValue).toBe(0.8);
    expect(metrics[2]!.rawLabelKey).toBe("reviewableBatchSize");
    expect(metrics[2]!.rawLabelParams).toEqual({ percent: "80%" });
  });

  it("uses the conservative batch-size default when quality batch size is unavailable", () => {
    const metrics = getDimensionSubMetrics(
      "quality",
      makeStats({ batchSizeScore: undefined }),
      "collaborative",
    );

    expect(metrics[2]!.key).toBe("batchSize");
    expect(metrics[2]!.normalizedValue).toBe(BATCH_SIZE_DEFAULT);
    expect(metrics[2]!.rawLabelKey).toBe("reviewableBatchSize");
    expect(metrics[2]!.rawLabelParams).toEqual({ percent: "30%" });
  });

  it("returns solo quality keys using PR hygiene signals and batch size", () => {
    const metrics = getDimensionSubMetrics(
      "quality",
      makeStats({
        prDescriptionRate: 0.75,
        featureBranchRate: 0.9,
        issueLinkageRate: 0.4,
        batchSizeScore: 0.6,
      }),
      "solo",
    );

    expect(metrics.map((m) => [m.key, m.weight])).toEqual([
      ["prDescription", "40%"],
      ["featureBranch", "25%"],
      ["issueLinkage", "20%"],
      ["batchSize", "15%"],
    ]);
    expect(metrics.map((m) => m.normalizedValue)).toEqual([0.75, 0.9, 0.4, 0.6]);
  });

  it("returns consistency keys using real heatmap evenness and week coverage", () => {
    const heatmapData = [
      { date: "2026-01-04", count: 2 },
      { date: "2026-01-11", count: 2 },
      { date: "2026-01-18", count: 2 },
      { date: "2026-01-25", count: 2 },
    ];

    const metrics = getDimensionSubMetrics(
      "consistency",
      makeStats({ activeDays: 4, heatmapData }),
      "collaborative",
    );

    expect(metrics.map((m) => [m.key, m.weight])).toEqual([
      ["activeDays", "45%"],
      ["evenness", "40%"],
      ["weekCoverage", "15%"],
    ]);
    expect(metrics[0]!.normalizedValue).toBeCloseTo(0.1, 2);
    expect(metrics[1]!.normalizedValue).toBe(1);
    expect(metrics[2]!.normalizedValue).toBe(1);
  });

  it("returns breadth and craft stable keys", () => {
    expect(
      getDimensionSubMetrics("breadth", makeStats(), "collaborative").map((m) => m.key),
    ).toEqual(["repos", "spread", "stars", "forks", "docs"]);
    expect(
      getDimensionSubMetrics("craft", makeStats(), "collaborative").map((m) => m.key),
    ).toEqual(["aiToolProficiency", "effectiveness", "sophistication"]);
  });

  it("uses uploaded Craft sub-dimension scores when available", () => {
    const metrics = getDimensionSubMetrics(
      "craft",
      makeStats(),
      "collaborative",
      makeCraftResult(),
    );

    expect(metrics.map((m) => [m.key, m.weight])).toEqual([
      ["aiToolProficiency", "34%"],
      ["effectiveness", "33%"],
      ["sophistication", "33%"],
    ]);
    expect(metrics.map((m) => m.normalizedValue)).toEqual([0.34, 0.82, 0.91]);
    expect(metrics.map((m) => m.rawLabelKey)).toEqual([
      "craftSubscore",
      "craftSubscore",
      "craftSubscore",
    ]);
    expect(metrics.map((m) => m.rawLabelParams)).toEqual([
      { score: "34" },
      { score: "82" },
      { score: "91" },
    ]);
  });
});
