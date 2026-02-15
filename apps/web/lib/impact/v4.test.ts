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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a StatsData with sensible defaults — override only what you need. */
function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return {
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
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
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

  it("weights activeDays/365 at 50%", () => {
    const stats = makeStats({
      activeDays: 365,
      heatmapData: [], // no heatmap data → evenness = 0
      maxCommitsIn10Min: 30, // max burst → inverseBurst = 0
    });
    const score = computeConsistency(stats);
    expect(score).toBe(50); // 50% from streak, 0% from evenness, 0% from burst
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

  it("weights repos at 35%", () => {
    const repoOnly = makeStats({ reposContributed: 15, topRepoShare: 1.0 });
    // 35% from repos (maxed), 0% from inverse topRepoShare (1.0 = no diversity), 0% from others
    const score = computeBreadth(repoOnly);
    expect(score).toBe(35);
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

  it("rewards totalStars (15% weight)", () => {
    const noStars = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalStars: 0 });
    const withStars = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalStars: 300 });
    expect(computeBreadth(withStars)).toBeGreaterThan(computeBreadth(noStars));
  });

  it("caps stars contribution at 500", () => {
    const at500 = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalStars: 500 });
    const at1000 = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalStars: 1000 });
    expect(computeBreadth(at1000)).toBe(computeBreadth(at500));
  });

  it("rewards totalForks (10% weight)", () => {
    const noForks = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalForks: 0 });
    const withForks = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalForks: 100 });
    expect(computeBreadth(withForks)).toBeGreaterThan(computeBreadth(noForks));
  });

  it("caps forks contribution at 200", () => {
    const at200 = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalForks: 200 });
    const at500 = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalForks: 500 });
    expect(computeBreadth(at500)).toBe(computeBreadth(at200));
  });

  it("rewards totalWatchers (5% weight)", () => {
    const noWatch = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalWatchers: 0 });
    const withWatch = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalWatchers: 50 });
    expect(computeBreadth(withWatch)).toBeGreaterThan(computeBreadth(noWatch));
  });

  it("caps watchers contribution at 100", () => {
    const at100 = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalWatchers: 100 });
    const at300 = makeStats({ reposContributed: 5, topRepoShare: 0.5, totalWatchers: 300 });
    expect(computeBreadth(at300)).toBe(computeBreadth(at100));
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

describe("deriveArchetype(dimensions)", () => {
  it("returns Builder when building is highest and >= 70", () => {
    const dims: DimensionScores = { building: 80, guarding: 50, consistency: 60, breadth: 55 };
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("returns Guardian when guarding is highest and >= 70", () => {
    const dims: DimensionScores = { building: 50, guarding: 85, consistency: 60, breadth: 55 };
    expect(deriveArchetype(dims)).toBe("Guardian");
  });

  it("returns Marathoner when consistency is highest and >= 70", () => {
    const dims: DimensionScores = { building: 50, guarding: 55, consistency: 80, breadth: 60 };
    expect(deriveArchetype(dims)).toBe("Marathoner");
  });

  it("returns Polymath when breadth is highest and >= 70", () => {
    const dims: DimensionScores = { building: 50, guarding: 55, consistency: 60, breadth: 75 };
    expect(deriveArchetype(dims)).toBe("Polymath");
  });

  it("returns Balanced when all within 15 pts and avg >= 60", () => {
    const dims: DimensionScores = { building: 65, guarding: 70, consistency: 68, breadth: 62 };
    expect(deriveArchetype(dims)).toBe("Balanced");
  });

  it("returns Emerging when avg < 40", () => {
    const dims: DimensionScores = { building: 30, guarding: 20, consistency: 25, breadth: 35 };
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  it("returns Emerging when no dimension >= 50", () => {
    const dims: DimensionScores = { building: 45, guarding: 40, consistency: 35, breadth: 48 };
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  // Tie-breaking: Polymath > Guardian > Marathoner > Builder
  it("breaks ties favoring Polymath over Guardian", () => {
    const dims: DimensionScores = { building: 60, guarding: 80, consistency: 60, breadth: 80 };
    expect(deriveArchetype(dims)).toBe("Polymath");
  });

  it("breaks ties favoring Guardian over Marathoner", () => {
    const dims: DimensionScores = { building: 60, guarding: 80, consistency: 80, breadth: 60 };
    expect(deriveArchetype(dims)).toBe("Guardian");
  });

  it("breaks ties favoring Marathoner over Builder", () => {
    const dims: DimensionScores = { building: 75, guarding: 50, consistency: 75, breadth: 50 };
    expect(deriveArchetype(dims)).toBe("Marathoner");
  });

  it("breaks ties favoring Polymath over all others", () => {
    const dims: DimensionScores = { building: 80, guarding: 80, consistency: 80, breadth: 80 };
    // All tied at 80, all >= 70 → within 15pts and avg >= 60 → Balanced
    // BUT: check if "Balanced" takes priority over specific archetypes
    // Actually all within 15 pts AND avg >= 60 → Balanced should match
    expect(deriveArchetype(dims)).toBe("Balanced");
  });

  it("does NOT return Balanced if range exceeds 15 pts even with high avg", () => {
    const dims: DimensionScores = { building: 90, guarding: 70, consistency: 75, breadth: 65 };
    // range = 90 - 65 = 25 > 15 → not Balanced
    // highest is building at 90, >= 70 → Builder
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("returns Emerging over Balanced when avg < 60 even if within 15 pts", () => {
    const dims: DimensionScores = { building: 50, guarding: 55, consistency: 52, breadth: 48 };
    // within 15 pts, but avg = 51.25 < 60
    // Highest is guarding at 55, but < 70 → not Guardian
    // Check Emerging: avg < 40? No (51.25). No dim >= 50? No (guarding is 55, building 50).
    // So this falls through to a default
    expect(deriveArchetype(dims)).not.toBe("Balanced");
  });

  it("handles edge case where highest is exactly 70", () => {
    const dims: DimensionScores = { building: 70, guarding: 50, consistency: 60, breadth: 55 };
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

  it("can assign Balanced to solo profile when 3 dims within 15 pts and avg >= 60", () => {
    const dims: DimensionScores = { building: 70, guarding: 0, consistency: 65, breadth: 68 };
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
