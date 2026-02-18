import { describe, it, expect } from "vitest";
import {
  computeBuilding,
  computeGuarding,
  computeConsistency,
  computeBreadth,
  computeDimensions,
  deriveArchetype,
  detectProfileType,
  computeImpactV4,
} from "./v4";
import type { StatsData, DimensionScores } from "@chapa/shared";
import { makeStats as _makeStats } from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Zero-based StatsData — dimension tests need a blank slate to test signals in isolation. */
function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return _makeStats({
    handle: "test-user",
    commitsTotal: 0,
    activeDays: 0,
    prsMergedCount: 0,
    prsMergedWeight: 0,
    reviewsSubmittedCount: 0,
    issuesClosedCount: 0,
    linesAdded: 0,
    linesDeleted: 0,
    reposContributed: 0,
    topRepoShare: 0,
    maxCommitsIn10Min: 0,
    totalStars: 0,
    totalForks: 0,
    totalWatchers: 0,
    heatmapData: [],
    ...overrides,
  });
}

/** Build a uniform 13-week heatmap with a given weekly total. */
function makeUniformHeatmap(weeklyTotal: number) {
  const days = [];
  for (let w = 0; w < 13; w++) {
    for (let d = 0; d < 7; d++) {
      const perDay = Math.floor(weeklyTotal / 7);
      const extra = d < weeklyTotal % 7 ? 1 : 0;
      days.push({
        date: `2025-01-${String(w * 7 + d + 1).padStart(2, "0")}`,
        count: perDay + extra,
      });
    }
  }
  return days;
}

/** Build a burst heatmap where all activity is in the first week. */
function makeBurstHeatmap(total: number) {
  const days = [];
  for (let w = 0; w < 13; w++) {
    for (let d = 0; d < 7; d++) {
      const count = w === 0 ? Math.floor(total / 7) + (d < total % 7 ? 1 : 0) : 0;
      days.push({
        date: `2025-01-${String(w * 7 + d + 1).padStart(2, "0")}`,
        count,
      });
    }
  }
  return days;
}

// ---------------------------------------------------------------------------
// computeBuilding(stats)
// ---------------------------------------------------------------------------

describe("computeBuilding(stats)", () => {
  it("returns 0 for zero activity", () => {
    expect(computeBuilding(makeStats())).toBe(0);
  });

  it("returns 100 for maxed-out shipping signals", () => {
    const stats = makeStats({
      prsMergedWeight: 120,
      issuesClosedCount: 80,
      commitsTotal: 600,
    });
    expect(computeBuilding(stats)).toBe(100);
  });

  it("weights PRs at 70%", () => {
    // Only PRs, no issues/commits
    const prOnly = makeStats({ prsMergedWeight: 120 });
    const score = computeBuilding(prOnly);
    expect(score).toBe(70);
  });

  it("weights issues at 20%", () => {
    const issueOnly = makeStats({ issuesClosedCount: 80 });
    const score = computeBuilding(issueOnly);
    expect(score).toBe(20);
  });

  it("weights commits at 10%", () => {
    const commitOnly = makeStats({ commitsTotal: 600 });
    const score = computeBuilding(commitOnly);
    expect(score).toBe(10);
  });

  it("returns an integer", () => {
    const stats = makeStats({ prsMergedWeight: 12, issuesClosedCount: 5, commitsTotal: 30 });
    expect(Number.isInteger(computeBuilding(stats))).toBe(true);
  });

  it("handles mid-range input", () => {
    const stats = makeStats({
      prsMergedWeight: 20,
      issuesClosedCount: 10,
      commitsTotal: 80,
    });
    const score = computeBuilding(stats);
    expect(score).toBeGreaterThan(30);
    expect(score).toBeLessThanOrEqual(80);
  });

  it("caps values above their limits", () => {
    const stats = makeStats({
      prsMergedWeight: 300,
      issuesClosedCount: 200,
      commitsTotal: 1500,
    });
    expect(computeBuilding(stats)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeGuarding(stats)
// ---------------------------------------------------------------------------

describe("computeGuarding(stats)", () => {
  it("returns 0 for zero reviews", () => {
    expect(computeGuarding(makeStats())).toBe(0);
  });

  it("returns high score for prolific reviewer", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 180,
      prsMergedCount: 60, // review-to-PR ratio = 3:1 is excellent
    });
    const score = computeGuarding(stats);
    expect(score).toBeGreaterThan(70);
  });

  it("weights reviews at 60%", () => {
    const reviewOnly = makeStats({ reviewsSubmittedCount: 180 });
    const score = computeGuarding(reviewOnly);
    // 60% from reviews, 25% from ratio (no PRs → pure reviewer → max ratio = 1),
    // ~10.5% from inverse micro (default 0.3 → inverseMicro = 0.7 → 15% * 0.7)
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it("rewards high review-to-PR ratio", () => {
    // Same reviews, different PR counts
    const highRatio = makeStats({ reviewsSubmittedCount: 30, prsMergedCount: 5 }); // 6:1
    const lowRatio = makeStats({ reviewsSubmittedCount: 30, prsMergedCount: 30 }); // 1:1
    expect(computeGuarding(highRatio)).toBeGreaterThan(computeGuarding(lowRatio));
  });

  it("penalizes high microCommitRatio", () => {
    const clean = makeStats({ reviewsSubmittedCount: 30, microCommitRatio: 0.1 });
    const micro = makeStats({ reviewsSubmittedCount: 30, microCommitRatio: 0.9 });
    expect(computeGuarding(clean)).toBeGreaterThan(computeGuarding(micro));
  });

  it("returns an integer", () => {
    const stats = makeStats({ reviewsSubmittedCount: 15, prsMergedCount: 10 });
    expect(Number.isInteger(computeGuarding(stats))).toBe(true);
  });

  it("handles missing microCommitRatio with conservative default (0.3)", () => {
    const stats = makeStats({ reviewsSubmittedCount: 30 });
    const score = computeGuarding(stats);
    expect(score).toBeGreaterThan(0);

    // With microCommitRatio=0.3, inverseMicro=0.7 → 15% * 0.7 = 10.5% contribution
    // With microCommitRatio=0 (explicit), inverseMicro=1.0 → 15% * 1.0 = 15% contribution
    const explicitZero = makeStats({ reviewsSubmittedCount: 30, microCommitRatio: 0 });
    expect(computeGuarding(explicitZero)).toBeGreaterThan(score);
  });

  it("scores lower with unknown microCommitRatio than with explicit 0", () => {
    // This validates the anti-gaming default: unknown → 0.3 (no free points)
    const unknown = makeStats({ reviewsSubmittedCount: 100, prsMergedCount: 30 });
    const clean = makeStats({ reviewsSubmittedCount: 100, prsMergedCount: 30, microCommitRatio: 0 });
    const scoreDiff = computeGuarding(clean) - computeGuarding(unknown);
    // ~4.5 point difference (15% * 0.3 * 100)
    expect(scoreDiff).toBeGreaterThanOrEqual(3);
    expect(scoreDiff).toBeLessThanOrEqual(6);
  });

  it("is bounded 0-100", () => {
    const scenarios = [
      makeStats(),
      makeStats({ reviewsSubmittedCount: 180, prsMergedCount: 5, microCommitRatio: 0 }),
      makeStats({ reviewsSubmittedCount: 300, prsMergedCount: 1 }),
    ];
    for (const s of scenarios) {
      const score = computeGuarding(s);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// computeConsistency(stats)
// ---------------------------------------------------------------------------

describe("computeConsistency(stats)", () => {
  it("returns 0 for no activity", () => {
    expect(computeConsistency(makeStats())).toBe(0);
  });

  it("returns high score for daily, uniform activity", () => {
    const stats = makeStats({
      activeDays: 340,
      heatmapData: makeUniformHeatmap(14), // 2/day for 13 weeks
      maxCommitsIn10Min: 3,
    });
    const score = computeConsistency(stats);
    expect(score).toBeGreaterThan(80);
  });

  it("V5: weights sqrt streak at 45%", () => {
    const stats = makeStats({
      activeDays: 365,
      heatmapData: [], // no heatmap data → evenness = 0
      maxCommitsIn10Min: 30, // max burst → inverseBurst = 0
    });
    const score = computeConsistency(stats);
    // sqrt(365/365) = 1.0; 45% * 1.0 * 100 = 45
    expect(score).toBe(45);
  });

  it("V5: sqrt curve boosts moderate active days significantly", () => {
    // 120 active days: V4 streak = 32.9%, V5 streak = sqrt(120/365) = 57.3%
    const stats = makeStats({
      activeDays: 120,
      heatmapData: [], // no heatmap data → evenness = 0
      maxCommitsIn10Min: 30, // max burst → inverseBurst = 0
    });
    const score = computeConsistency(stats);
    // sqrt(120/365) ≈ 0.573; 0.573 * 45 ≈ 25.8 → 26
    expect(score).toBe(26);
  });

  it("penalizes burst activity", () => {
    const steady = makeStats({
      activeDays: 60,
      heatmapData: makeUniformHeatmap(10),
      maxCommitsIn10Min: 3,
    });
    const bursty = makeStats({
      activeDays: 60,
      heatmapData: makeBurstHeatmap(130),
      maxCommitsIn10Min: 25,
    });
    expect(computeConsistency(steady)).toBeGreaterThan(computeConsistency(bursty));
  });

  it("rewards even distribution over bursty heatmap", () => {
    const even = makeStats({
      activeDays: 45,
      heatmapData: makeUniformHeatmap(7),
    });
    const bursty = makeStats({
      activeDays: 45,
      heatmapData: makeBurstHeatmap(91),
    });
    expect(computeConsistency(even)).toBeGreaterThan(computeConsistency(bursty));
  });

  it("returns an integer", () => {
    const stats = makeStats({ activeDays: 30, heatmapData: makeUniformHeatmap(5) });
    expect(Number.isInteger(computeConsistency(stats))).toBe(true);
  });

  it("is bounded 0-100", () => {
    const scenarios = [
      makeStats(),
      makeStats({ activeDays: 365, heatmapData: makeUniformHeatmap(20), maxCommitsIn10Min: 0 }),
      makeStats({ activeDays: 1, heatmapData: makeBurstHeatmap(100), maxCommitsIn10Min: 50 }),
    ];
    for (const s of scenarios) {
      const score = computeConsistency(s);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// computeBreadth(stats)
// ---------------------------------------------------------------------------

describe("computeBreadth(stats)", () => {
  it("returns 0 for zero repos", () => {
    expect(computeBreadth(makeStats())).toBe(0);
  });

  it("returns high score for many repos with low concentration, stars, forks, watchers", () => {
    const stats = makeStats({
      reposContributed: 15,
      topRepoShare: 0.2,
      docsOnlyPrRatio: 0.3,
      totalStars: 200,
      totalForks: 100,
      totalWatchers: 50,
    });
    const score = computeBreadth(stats);
    expect(score).toBeGreaterThan(70);
  });

  it("V5: weights repos at 40%", () => {
    const repoOnly = makeStats({ reposContributed: 12, topRepoShare: 1.0 });
    // 40% from repos (maxed at new cap 12), 0% from inverse topRepoShare (1.0), 0% from others
    const score = computeBreadth(repoOnly);
    expect(score).toBe(40);
  });

  it("rewards low topRepoShare (diverse)", () => {
    const diverse = makeStats({ reposContributed: 5, topRepoShare: 0.3 });
    const concentrated = makeStats({ reposContributed: 5, topRepoShare: 0.9 });
    expect(computeBreadth(diverse)).toBeGreaterThan(computeBreadth(concentrated));
  });

  it("gives bonus for docs-only PR ratio", () => {
    const withDocs = makeStats({ reposContributed: 5, topRepoShare: 0.5, docsOnlyPrRatio: 0.5 });
    const noDocs = makeStats({ reposContributed: 5, topRepoShare: 0.5, docsOnlyPrRatio: 0 });
    expect(computeBreadth(withDocs)).toBeGreaterThan(computeBreadth(noDocs));
  });

  it("V5: rewards totalStars (10% weight)", () => {
    const noStars = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalStars: 0 });
    const withStars = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalStars: 100 });
    expect(computeBreadth(withStars)).toBeGreaterThan(computeBreadth(noStars));
  });

  it("V5: caps stars contribution at 150", () => {
    const atCap = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalStars: 150 });
    const overCap = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalStars: 500 });
    expect(computeBreadth(overCap)).toBe(computeBreadth(atCap));
  });

  it("V5: rewards totalForks (5% weight)", () => {
    const noForks = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalForks: 0 });
    const withForks = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalForks: 50 });
    expect(computeBreadth(withForks)).toBeGreaterThan(computeBreadth(noForks));
  });

  it("V5: caps forks contribution at 80", () => {
    const atCap = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalForks: 80 });
    const overCap = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalForks: 300 });
    expect(computeBreadth(overCap)).toBe(computeBreadth(atCap));
  });

  it("V5: watchers have zero weight (dropped)", () => {
    const noWatch = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalWatchers: 0 });
    const withWatch = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalWatchers: 50 });
    expect(computeBreadth(withWatch)).toBe(computeBreadth(noWatch));
  });

  it("handles missing docsOnlyPrRatio gracefully", () => {
    const stats = makeStats({ reposContributed: 5, topRepoShare: 0.5 });
    const score = computeBreadth(stats);
    expect(score).toBeGreaterThan(0);
  });

  it("returns an integer", () => {
    const stats = makeStats({ reposContributed: 3, topRepoShare: 0.6 });
    expect(Number.isInteger(computeBreadth(stats))).toBe(true);
  });

  it("is bounded 0-100", () => {
    const scenarios = [
      makeStats(),
      makeStats({ reposContributed: 15, topRepoShare: 0.1, docsOnlyPrRatio: 1.0 }),
      makeStats({ reposContributed: 1, topRepoShare: 1.0, docsOnlyPrRatio: 0 }),
    ];
    for (const s of scenarios) {
      const score = computeBreadth(s);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// computeDimensions(stats)
// ---------------------------------------------------------------------------

describe("computeDimensions(stats)", () => {
  it("returns all zeros for inactive user", () => {
    const dims = computeDimensions(makeStats());
    expect(dims.building).toBe(0);
    expect(dims.guarding).toBe(0);
    expect(dims.consistency).toBe(0);
    expect(dims.breadth).toBe(0);
  });

  it("returns all values between 0 and 100", () => {
    const stats = makeStats({
      prsMergedWeight: 20,
      reviewsSubmittedCount: 30,
      activeDays: 60,
      reposContributed: 5,
      topRepoShare: 0.4,
      heatmapData: makeUniformHeatmap(10),
    });
    const dims = computeDimensions(stats);
    for (const key of ["building", "guarding", "consistency", "breadth"] as const) {
      expect(dims[key]).toBeGreaterThanOrEqual(0);
      expect(dims[key]).toBeLessThanOrEqual(100);
    }
  });

  it("correctly delegates to individual dimension functions", () => {
    const stats = makeStats({
      prsMergedWeight: 30,
      issuesClosedCount: 10,
      commitsTotal: 100,
      reviewsSubmittedCount: 40,
      prsMergedCount: 15,
      activeDays: 70,
      heatmapData: makeUniformHeatmap(10),
      reposContributed: 7,
      topRepoShare: 0.3,
    });
    const dims = computeDimensions(stats);
    expect(dims.building).toBe(computeBuilding(stats));
    expect(dims.guarding).toBe(computeGuarding(stats));
    expect(dims.consistency).toBe(computeConsistency(stats));
    expect(dims.breadth).toBe(computeBreadth(stats));
  });
});

// ---------------------------------------------------------------------------
// deriveArchetype(dimensions)
// ---------------------------------------------------------------------------

describe("deriveArchetype(dimensions) — V5 thresholds", () => {
  // V5: specialist threshold lowered from 70 to 60
  it("returns Builder when building is highest and >= 60", () => {
    const dims: DimensionScores = { building: 65, guarding: 45, consistency: 50, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("returns Guardian when guarding is highest and >= 60", () => {
    const dims: DimensionScores = { building: 45, guarding: 65, consistency: 50, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Guardian");
  });

  it("returns Marathoner when consistency is highest and >= 60", () => {
    const dims: DimensionScores = { building: 45, guarding: 40, consistency: 65, breadth: 50 };
    expect(deriveArchetype(dims)).toBe("Marathoner");
  });

  it("returns Polymath when breadth is highest and >= 60", () => {
    const dims: DimensionScores = { building: 45, guarding: 40, consistency: 50, breadth: 65 };
    expect(deriveArchetype(dims)).toBe("Polymath");
  });

  // V5: Balanced gate expanded: range <= 20, avg >= 50
  it("returns Balanced when all within 20 pts and avg >= 50", () => {
    const dims: DimensionScores = { building: 55, guarding: 60, consistency: 58, breadth: 52 };
    expect(deriveArchetype(dims)).toBe("Balanced");
  });

  // V5: Emerging gate: avg < 25 OR no dim >= 40
  it("returns Emerging when avg < 25", () => {
    const dims: DimensionScores = { building: 20, guarding: 15, consistency: 10, breadth: 30 };
    // avg = 18.75 < 25
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  it("returns Emerging when no dimension >= 40", () => {
    const dims: DimensionScores = { building: 35, guarding: 30, consistency: 25, breadth: 38 };
    // avg = 32, no dim >= 40
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  it("V5: avg=30 with dim >= 40 passes Emerging gate but falls back to Emerging", () => {
    // avg=30 > 25 AND building=42 >= 40 → passes Emerging gate
    // But range=17 <=20 yet avg=30 < 50 → not Balanced
    // Highest=42 < 60 → no specialist → falls back to Emerging
    const dims: DimensionScores = { building: 42, guarding: 25, consistency: 25, breadth: 28 };
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  it("V5: avg=30 with dim >= 60 escapes Emerging to specialist", () => {
    // avg=30 > 25 AND building=60 >= 40 → passes Emerging gate
    // range=60-10=50 > 20 → not Balanced; building=60 → Builder
    const dims: DimensionScores = { building: 60, guarding: 10, consistency: 15, breadth: 35 };
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  // Tie-breaking: Polymath > Guardian > Marathoner > Builder
  // Use range > 20 to avoid triggering V5 Balanced gate
  it("breaks ties favoring Polymath over Guardian", () => {
    const dims: DimensionScores = { building: 40, guarding: 75, consistency: 40, breadth: 75 };
    expect(deriveArchetype(dims)).toBe("Polymath");
  });

  it("breaks ties favoring Guardian over Marathoner", () => {
    const dims: DimensionScores = { building: 40, guarding: 75, consistency: 75, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Guardian");
  });

  it("breaks ties favoring Marathoner over Builder", () => {
    const dims: DimensionScores = { building: 70, guarding: 40, consistency: 70, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Marathoner");
  });

  it("returns Balanced when all tied at 80 (within 20 pts, avg >= 50)", () => {
    const dims: DimensionScores = { building: 80, guarding: 80, consistency: 80, breadth: 80 };
    expect(deriveArchetype(dims)).toBe("Balanced");
  });

  it("does NOT return Balanced if range exceeds 20 pts even with high avg", () => {
    const dims: DimensionScores = { building: 90, guarding: 65, consistency: 75, breadth: 60 };
    // range = 90 - 60 = 30 > 20 → not Balanced
    // highest is building at 90, >= 60 → Builder
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("returns Balanced when range is exactly 20 and avg >= 50", () => {
    const dims: DimensionScores = { building: 50, guarding: 60, consistency: 55, breadth: 70 };
    // range = 70 - 50 = 20, avg = 58.75 >= 50
    expect(deriveArchetype(dims)).toBe("Balanced");
  });

  it("returns Emerging over Balanced when avg < 50 even if within 20 pts", () => {
    // avg = 42.5, no dim >= 40? guarding=45 >= 40, so NOT Emerging by dim gate
    // But avg < 50 → not Balanced. Highest is guarding at 45, < 60 → no specialist
    // Falls through to Emerging
    const dims: DimensionScores = { building: 40, guarding: 45, consistency: 42, breadth: 43 };
    expect(deriveArchetype(dims)).not.toBe("Balanced");
  });

  it("V5: handles edge case where highest is exactly 60", () => {
    const dims: DimensionScores = { building: 60, guarding: 45, consistency: 50, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("V5: dim at 65 qualifies as specialist (was < 70 threshold in V4)", () => {
    const dims: DimensionScores = { building: 65, guarding: 30, consistency: 40, breadth: 35 };
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("handles all zeros (Emerging)", () => {
    const dims: DimensionScores = { building: 0, guarding: 0, consistency: 0, breadth: 0 };
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  it("handles all 100s (Balanced)", () => {
    const dims: DimensionScores = { building: 100, guarding: 100, consistency: 100, breadth: 100 };
    expect(deriveArchetype(dims)).toBe("Balanced");
  });
});

// ---------------------------------------------------------------------------
// computeImpactV4(stats) — full integration
// ---------------------------------------------------------------------------

describe("computeImpactV4(stats)", () => {
  it("returns a complete ImpactV4Result", () => {
    const stats = makeStats({
      commitsTotal: 80,
      activeDays: 45,
      prsMergedCount: 8,
      prsMergedWeight: 15,
      reviewsSubmittedCount: 20,
      issuesClosedCount: 5,
      linesAdded: 3000,
      linesDeleted: 1000,
      reposContributed: 4,
      topRepoShare: 0.6,
      maxCommitsIn10Min: 5,
      heatmapData: makeUniformHeatmap(10),
    });

    const result = computeImpactV4(stats);

    expect(result.handle).toBe("test-user");
    expect(result.dimensions).toBeDefined();
    expect(result.dimensions.building).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.building).toBeLessThanOrEqual(100);
    expect(result.dimensions.guarding).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.guarding).toBeLessThanOrEqual(100);
    expect(result.dimensions.consistency).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.consistency).toBeLessThanOrEqual(100);
    expect(result.dimensions.breadth).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.breadth).toBeLessThanOrEqual(100);
    expect(result.archetype).toBeTruthy();
    expect(["Builder", "Guardian", "Marathoner", "Polymath", "Balanced", "Emerging"]).toContain(result.archetype);
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(50);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(result.adjustedComposite).toBeGreaterThanOrEqual(0);
    expect(result.adjustedComposite).toBeLessThanOrEqual(100);
    expect(["Emerging", "Solid", "High", "Elite"]).toContain(result.tier);
    expect(result.confidencePenalties).toBeInstanceOf(Array);
    expect(result.computedAt).toBeTruthy();
  });

  it("compositeScore is the average of 4 dimensions", () => {
    const stats = makeStats({
      prsMergedWeight: 20,
      reviewsSubmittedCount: 30,
      activeDays: 60,
      reposContributed: 5,
      topRepoShare: 0.4,
      heatmapData: makeUniformHeatmap(10),
    });
    const result = computeImpactV4(stats);
    const dims = result.dimensions;
    const expectedAvg = Math.round(
      (dims.building + dims.guarding + dims.consistency + dims.breadth) / 4
    );
    expect(result.compositeScore).toBe(expectedAvg);
  });

  it("adjustedComposite <= compositeScore always", () => {
    const stats = makeStats({
      commitsTotal: 100,
      activeDays: 60,
      prsMergedWeight: 25,
      prsMergedCount: 15,
      reviewsSubmittedCount: 20,
      issuesClosedCount: 10,
      reposContributed: 5,
      topRepoShare: 0.5,
      maxCommitsIn10Min: 25,
      heatmapData: makeUniformHeatmap(10),
    });
    const result = computeImpactV4(stats);
    expect(result.adjustedComposite).toBeLessThanOrEqual(result.compositeScore);
  });

  it("scores inactive user as Emerging", () => {
    const stats = makeStats({ commitsTotal: 2, activeDays: 1 });
    const result = computeImpactV4(stats);
    expect(result.archetype).toBe("Emerging");
    expect(result.tier).toBe("Emerging");
  });

  it("identifies a Builder archetype", () => {
    const stats = makeStats({
      prsMergedWeight: 100,
      issuesClosedCount: 50,
      commitsTotal: 400,
      reviewsSubmittedCount: 5,
      prsMergedCount: 50,
      activeDays: 60,
      heatmapData: makeUniformHeatmap(5),
      reposContributed: 2,
      topRepoShare: 0.7,
    });
    const result = computeImpactV4(stats);
    expect(result.archetype).toBe("Builder");
  });

  it("identifies a Guardian archetype", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 170,
      prsMergedCount: 20,
      prsMergedWeight: 15,
      commitsTotal: 50,
      activeDays: 60,
      heatmapData: makeUniformHeatmap(4),
      reposContributed: 2,
      topRepoShare: 0.6,
    });
    const result = computeImpactV4(stats);
    expect(result.archetype).toBe("Guardian");
  });

  it("reuses confidence from v3 (same penalties)", () => {
    const stats = makeStats({
      maxCommitsIn10Min: 25,
      prsMergedCount: 15,
      reviewsSubmittedCount: 0,
      linesAdded: 20000,
      linesDeleted: 1000,
    });
    const result = computeImpactV4(stats);
    expect(result.confidence).toBeLessThan(100);
    expect(result.confidencePenalties.length).toBeGreaterThan(0);
  });

  it("tier is derived from adjustedComposite", () => {
    // Force a high composite by maxing all dimensions
    const stats = makeStats({
      prsMergedWeight: 120,
      issuesClosedCount: 80,
      commitsTotal: 600,
      reviewsSubmittedCount: 180,
      prsMergedCount: 40,
      activeDays: 365,
      heatmapData: makeUniformHeatmap(20),
      reposContributed: 15,
      topRepoShare: 0.15,
      docsOnlyPrRatio: 0.3,
      maxCommitsIn10Min: 3,
    });
    const result = computeImpactV4(stats);
    expect(result.adjustedComposite).toBeGreaterThanOrEqual(70);
    expect(["High", "Elite"]).toContain(result.tier);
  });

  it("compositeScore is rounded to integer", () => {
    const stats = makeStats({
      prsMergedWeight: 12,
      reviewsSubmittedCount: 15,
      activeDays: 40,
      reposContributed: 3,
      topRepoShare: 0.5,
      heatmapData: makeUniformHeatmap(7),
    });
    const result = computeImpactV4(stats);
    expect(Number.isInteger(result.compositeScore)).toBe(true);
    expect(Number.isInteger(result.adjustedComposite)).toBe(true);
  });

  it("includes computedAt timestamp", () => {
    const result = computeImpactV4(makeStats());
    expect(result.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("includes profileType in result", () => {
    const result = computeImpactV4(makeStats({ reviewsSubmittedCount: 5 }));
    expect(result.profileType).toBe("collaborative");
  });
});

// ---------------------------------------------------------------------------
// detectProfileType(stats)
// ---------------------------------------------------------------------------

describe("detectProfileType(stats)", () => {
  it("returns 'solo' when reviewsSubmittedCount is 0", () => {
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 0 }))).toBe("solo");
  });

  it("returns 'collaborative' when reviewsSubmittedCount is 1", () => {
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 1 }))).toBe("collaborative");
  });

  it("returns 'collaborative' when reviewsSubmittedCount is high", () => {
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 100 }))).toBe("collaborative");
  });
});

// ---------------------------------------------------------------------------
// Solo developer scoring
// ---------------------------------------------------------------------------

describe("solo developer composite scoring", () => {
  it("uses 3 dimensions (excludes guarding) for solo profiles", () => {
    const stats = makeStats({
      prsMergedWeight: 80,
      issuesClosedCount: 40,
      commitsTotal: 300,
      activeDays: 200,
      heatmapData: makeUniformHeatmap(14),
      reposContributed: 8,
      topRepoShare: 0.3,
      totalStars: 50,
      reviewsSubmittedCount: 0, // solo
    });
    const result = computeImpactV4(stats);
    const dims = result.dimensions;

    // Solo composite = (building + consistency + breadth) / 3
    const expectedAvg = Math.round(
      (dims.building + dims.consistency + dims.breadth) / 3
    );
    expect(result.compositeScore).toBe(expectedAvg);
    expect(result.profileType).toBe("solo");
  });

  it("scores higher than 4-dim average for active solo devs", () => {
    const soloStats = makeStats({
      prsMergedWeight: 80,
      issuesClosedCount: 40,
      commitsTotal: 300,
      activeDays: 200,
      heatmapData: makeUniformHeatmap(14),
      reposContributed: 8,
      topRepoShare: 0.3,
      totalStars: 50,
      reviewsSubmittedCount: 0, // solo
    });
    const result = computeImpactV4(soloStats);
    const dims = result.dimensions;

    // The old 4-dim average would be lower because guarding = 0
    const old4DimAvg = Math.round(
      (dims.building + dims.guarding + dims.consistency + dims.breadth) / 4
    );
    expect(result.compositeScore).toBeGreaterThan(old4DimAvg);
  });

  it("collaborative profiles still use 4 dimensions", () => {
    const stats = makeStats({
      prsMergedWeight: 20,
      reviewsSubmittedCount: 30,
      activeDays: 60,
      reposContributed: 5,
      topRepoShare: 0.4,
      heatmapData: makeUniformHeatmap(10),
    });
    const result = computeImpactV4(stats);
    const dims = result.dimensions;
    const expectedAvg = Math.round(
      (dims.building + dims.guarding + dims.consistency + dims.breadth) / 4
    );
    expect(result.compositeScore).toBe(expectedAvg);
    expect(result.profileType).toBe("collaborative");
  });

  it("solo with all zeros still scores 0", () => {
    const result = computeImpactV4(makeStats());
    expect(result.compositeScore).toBe(0);
    expect(result.profileType).toBe("solo");
    expect(result.tier).toBe("Emerging");
  });

  it("solo with maxed building/consistency/breadth scores near 100", () => {
    const stats = makeStats({
      prsMergedWeight: 120,
      issuesClosedCount: 80,
      commitsTotal: 600,
      activeDays: 365,
      heatmapData: makeUniformHeatmap(20),
      maxCommitsIn10Min: 0,
      reposContributed: 15,
      topRepoShare: 0.1,
      docsOnlyPrRatio: 0.5,
      totalStars: 500,
      totalForks: 200,
      totalWatchers: 100,
      reviewsSubmittedCount: 0,
    });
    const result = computeImpactV4(stats);
    // Each dimension maxes at 100 individually but heatmap evenness
    // depends on coverage — 13 weeks of data against 53-week window
    expect(result.compositeScore).toBeGreaterThanOrEqual(95);
  });

  it("high-output solo dev gets >= 50 composite and at least Solid tier", () => {
    // Simulates a solo dev with ~2100 contributions
    const stats = makeStats({
      commitsTotal: 500,
      activeDays: 250,
      prsMergedCount: 80,
      prsMergedWeight: 90,
      issuesClosedCount: 30,
      linesAdded: 15000,
      linesDeleted: 5000,
      reposContributed: 5,
      topRepoShare: 0.4,
      maxCommitsIn10Min: 5,
      heatmapData: makeUniformHeatmap(14),
      reviewsSubmittedCount: 0,
    });
    const result = computeImpactV4(stats);
    expect(result.compositeScore).toBeGreaterThanOrEqual(50);
    expect(["Solid", "High", "Elite"]).toContain(result.tier);
  });
});

// ---------------------------------------------------------------------------
// Solo developer archetype derivation
// ---------------------------------------------------------------------------

describe("solo developer archetype", () => {
  it("never assigns Guardian to solo profiles", () => {
    // Even if guarding dimension were somehow high, solo should not get Guardian
    const dims: DimensionScores = { building: 50, guarding: 85, consistency: 60, breadth: 55 };
    expect(deriveArchetype(dims, "solo")).not.toBe("Guardian");
  });

  it("can assign Builder to solo profile", () => {
    const dims: DimensionScores = { building: 80, guarding: 0, consistency: 50, breadth: 55 };
    expect(deriveArchetype(dims, "solo")).toBe("Builder");
  });

  it("can assign Marathoner to solo profile", () => {
    const dims: DimensionScores = { building: 50, guarding: 0, consistency: 80, breadth: 55 };
    expect(deriveArchetype(dims, "solo")).toBe("Marathoner");
  });

  it("can assign Polymath to solo profile", () => {
    const dims: DimensionScores = { building: 50, guarding: 0, consistency: 55, breadth: 80 };
    expect(deriveArchetype(dims, "solo")).toBe("Polymath");
  });

  it("V5: can assign Balanced to solo profile when 3 dims within 20 pts and avg >= 50", () => {
    const dims: DimensionScores = { building: 55, guarding: 0, consistency: 50, breadth: 60 };
    expect(deriveArchetype(dims, "solo")).toBe("Balanced");
  });

  it("returns Emerging for low solo dimensions", () => {
    const dims: DimensionScores = { building: 20, guarding: 0, consistency: 25, breadth: 15 };
    expect(deriveArchetype(dims, "solo")).toBe("Emerging");
  });

  it("defaults to collaborative behavior when profileType is omitted", () => {
    const dims: DimensionScores = { building: 50, guarding: 85, consistency: 60, breadth: 55 };
    // Without profileType arg, should use all 4 dims → Guardian
    expect(deriveArchetype(dims)).toBe("Guardian");
  });
});
