import { describe, it, expect } from "vitest";
import type { ImpactV4Result } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";
import { generateInsights } from "./generate-insights";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockImpact: ImpactV4Result = {
  handle: "testuser",
  profileType: "collaborative",
  dimensions: { delivery: 85, quality: 60, consistency: 70, breadth: 50 },
  archetype: "Builder",
  compositeScore: 66,
  confidence: 80,
  confidencePenalties: [],
  adjustedComposite: 53,
  tier: "Solid",
  computedAt: "2026-02-28T00:00:00Z",
};

const mockTrendSummary: TrendSummary = {
  direction: "improving",
  avgDelta: 2.5,
  compositeValues: [
    { date: "2026-02-21", value: 50 },
    { date: "2026-02-22", value: 52 },
    { date: "2026-02-23", value: 53 },
  ],
  dimensions: {
    delivery: { avgDelta: 3.0, values: [{ date: "2026-02-21", value: 80 }] },
    quality: { avgDelta: 1.0, values: [{ date: "2026-02-21", value: 58 }] },
    consistency: { avgDelta: 2.0, values: [{ date: "2026-02-21", value: 68 }] },
    breadth: { avgDelta: -0.5, values: [{ date: "2026-02-21", value: 49 }] },
  },
};

const mockDiff: SnapshotDiff = {
  direction: "improving",
  daysBetween: 7,
  compositeScore: 5,
  adjustedComposite: 4,
  confidence: 2,
  dimensions: { delivery: 8, quality: 3, consistency: 2, breadth: -1 },
  stats: {
    commitsTotal: 20,
    prsMergedCount: 5,
    prsMergedWeight: 5,
    reviewsSubmittedCount: 3,
    issuesClosedCount: 2,
    reposContributed: 1,
    activeDays: 3,
    linesAdded: 1000,
    linesDeleted: 200,
    totalStars: 5,
    totalForks: 1,
    totalWatchers: 2,
    topRepoShare: -0.05,
  },
  archetype: null,
  tier: null,
  profileType: null,
  penaltyChanges: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateInsights", () => {
  it("returns archetype context insight for any impact data", () => {
    const insights = generateInsights(mockImpact, null, null);
    const archetype = insights.find((i) => i.id === "tip-archetype");
    expect(archetype).toBeDefined();
    expect(archetype!.type).toBe("tip");
    expect(archetype!.icon).toBe("target");
    expect(archetype!.headline).toBe("You're a Builder");
    expect(archetype!.body).toMatch(/Your profile is driven by output/);
    // Body should be only the first sentence
    expect(archetype!.body).not.toContain("Delivery is clearly");
  });

  it("returns next-tier insight with correct gap calculation", () => {
    // Solid tier, adjustedComposite=53, next threshold=70 (High), gap=17
    const insights = generateInsights(mockImpact, null, null);
    const nextTier = insights.find((i) => i.id === "next-tier");
    expect(nextTier).toBeDefined();
    expect(nextTier!.type).toBe("next-tier");
    expect(nextTier!.icon).toBe("arrow-up");
    expect(nextTier!.headline).toBe("17 points to High");
    expect(nextTier!.body).toContain("17 points away from High tier");
  });

  it("returns weakest dimension tip (skips Balanced/Emerging)", () => {
    // Weakest dimension is breadth (50)
    const insights = generateInsights(mockImpact, null, null);
    const tip = insights.find((i) => i.id === "tip-breadth");
    expect(tip).toBeDefined();
    expect(tip!.type).toBe("tip");
    expect(tip!.icon).toBe("lightbulb");
    expect(tip!.headline).toBe("Grow your Breadth");
    expect(tip!.dimension).toBe("breadth");
    expect(tip!.body).toContain("contribute to repos outside your main project");

    // Verify it is skipped for Balanced
    const balancedImpact = { ...mockImpact, archetype: "Balanced" as const };
    const balancedInsights = generateInsights(balancedImpact, null, null);
    const balancedTip = balancedInsights.find((i) => i.type === "tip" && i.dimension !== undefined);
    expect(balancedTip).toBeUndefined();

    // Verify it is skipped for Emerging
    const emergingImpact = { ...mockImpact, archetype: "Emerging" as const };
    const emergingInsights = generateInsights(emergingImpact, null, null);
    const emergingTip = emergingInsights.find(
      (i) => i.type === "tip" && i.dimension !== undefined,
    );
    expect(emergingTip).toBeUndefined();
  });

  it("returns trend-based insight when direction is improving", () => {
    const insights = generateInsights(mockImpact, mockTrendSummary, null);
    const trend = insights.find((i) => i.id === "trend-overall");
    expect(trend).toBeDefined();
    expect(trend!.type).toBe("trend");
    expect(trend!.icon).toBe("trending-up");
    expect(trend!.headline).toBe("Your impact is trending upward");
    expect(trend!.body).toContain("+2.5/day");
    expect(trend!.body).toContain("3 days");
  });

  it("returns trend-based insight when direction is declining", () => {
    const decliningTrend: TrendSummary = {
      ...mockTrendSummary,
      direction: "declining",
      avgDelta: -1.5,
      dimensions: {
        delivery: { avgDelta: -0.5, values: [{ date: "2026-02-21", value: 80 }] },
        quality: { avgDelta: -2.0, values: [{ date: "2026-02-21", value: 58 }] },
        consistency: { avgDelta: 0.5, values: [{ date: "2026-02-21", value: 68 }] },
        breadth: { avgDelta: -3.0, values: [{ date: "2026-02-21", value: 49 }] },
      },
    };
    const insights = generateInsights(mockImpact, decliningTrend, null);
    const trend = insights.find((i) => i.id === "trend-overall");
    expect(trend).toBeDefined();
    expect(trend!.icon).toBe("trending-down");
    expect(trend!.headline).toBe("Your impact is trending downward");
    expect(trend!.body).toContain("-1.5/day");
    // worstDimension should be breadth (avgDelta: -3.0 is the lowest)
    expect(trend!.body).toContain("Breadth");
  });

  it("returns no trend insight when direction is stable", () => {
    const stableTrend: TrendSummary = {
      ...mockTrendSummary,
      direction: "stable",
      avgDelta: 0.2,
    };
    const insights = generateInsights(mockImpact, stableTrend, null);
    const trend = insights.find((i) => i.id === "trend-overall");
    expect(trend).toBeUndefined();
  });

  it("returns dimension improvement insight when diff dimension > 5", () => {
    // delivery delta = 8 (> 5), others are <= 5
    const insights = generateInsights(mockImpact, null, mockDiff);
    const dimImprovement = insights.find((i) => i.id === "trend-delivery");
    expect(dimImprovement).toBeDefined();
    expect(dimImprovement!.type).toBe("trend");
    expect(dimImprovement!.icon).toBe("trending-up");
    expect(dimImprovement!.headline).toBe("Delivery improved by +8");
    expect(dimImprovement!.body).toContain("delivery score jumped significantly");
    expect(dimImprovement!.dimension).toBe("delivery");
  });

  it("returns tier change achievement when diff.tier is non-null", () => {
    const tierUpDiff: SnapshotDiff = {
      ...mockDiff,
      tier: { from: "Solid", to: "High" },
    };
    const insights = generateInsights(mockImpact, null, tierUpDiff);
    const achievement = insights.find((i) => i.id === "achievement-tier");
    expect(achievement).toBeDefined();
    expect(achievement!.type).toBe("achievement");
    expect(achievement!.icon).toBe("trophy");
    expect(achievement!.headline).toBe("You leveled up to High!");
    expect(achievement!.body).toContain("welcome to High tier");
    expect(achievement!.priority).toBe(1);

    // Downgrade case
    const tierDownDiff: SnapshotDiff = {
      ...mockDiff,
      tier: { from: "High", to: "Solid" },
    };
    const downInsights = generateInsights(mockImpact, null, tierDownDiff);
    const downAchievement = downInsights.find((i) => i.id === "achievement-tier");
    expect(downAchievement).toBeDefined();
    expect(downAchievement!.headline).toBe("Your tier shifted to Solid");
    expect(downAchievement!.body).toContain("moved you to Solid");
  });

  it("returns max 5 insights", () => {
    // Provide all data sources to potentially generate many insights
    const tierDiff: SnapshotDiff = {
      ...mockDiff,
      tier: { from: "Emerging", to: "Solid" },
      dimensions: { delivery: 10, quality: 8, consistency: 7, breadth: 6 },
    };
    const insights = generateInsights(mockImpact, mockTrendSummary, tierDiff);
    expect(insights.length).toBeLessThanOrEqual(5);
  });

  it("orders insights by priority (lower priority number first)", () => {
    const tierDiff: SnapshotDiff = {
      ...mockDiff,
      tier: { from: "Emerging", to: "Solid" },
    };
    const insights = generateInsights(mockImpact, mockTrendSummary, tierDiff);
    for (let i = 1; i < insights.length; i++) {
      expect(insights[i]!.priority).toBeGreaterThanOrEqual(insights[i - 1]!.priority);
    }
  });

  it("does not duplicate a dimension in both improvement and tip", () => {
    // breadth is the weakest (50) so it would get a tip, but also has delta > 5
    const diffWithBreadthImprovement: SnapshotDiff = {
      ...mockDiff,
      dimensions: { delivery: 2, quality: 1, consistency: 0, breadth: 8 },
    };
    const insights = generateInsights(mockImpact, null, diffWithBreadthImprovement);
    const breadthInsights = insights.filter((i) => i.dimension === "breadth");
    // Should only have the improvement, not the tip
    expect(breadthInsights.length).toBe(1);
    expect(breadthInsights[0]!.id).toBe("trend-breadth");
  });

  it("has Artificer archetype profile text", () => {
    const artificerImpact: ImpactV4Result = {
      ...mockImpact,
      archetype: "Artificer",
    };
    const insights = generateInsights(artificerImpact, null, null);
    const archetype = insights.find((i) => i.id === "tip-archetype");
    expect(archetype).toBeDefined();
    expect(archetype!.headline).toBe("You're a Artificer");
    expect(archetype!.body).toMatch(/craft/i);
  });

  it("has craft dimension tip text", () => {
    // When craft is the weakest dimension, generate-insights should provide a tip
    const craftImpact: ImpactV4Result = {
      ...mockImpact,
      archetype: "Builder",
      dimensions: { delivery: 85, quality: 60, consistency: 70, breadth: 50, craft: 20 },
    };
    const insights = generateInsights(craftImpact, null, null);
    const craftTip = insights.find((i) => i.id === "tip-craft");
    expect(craftTip).toBeDefined();
    expect(craftTip!.dimension).toBe("craft");
    expect(craftTip!.body).toBeTruthy();
  });
});
