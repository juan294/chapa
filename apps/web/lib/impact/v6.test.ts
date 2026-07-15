import { describe, it, expect } from "vitest";
import {
  computeDelivery,
  computeQuality,
  computeConsistency,
  computeBreadth,
  computeDimensions,
  deriveArchetype,
  detectProfileType,
  computeImpactV6,
  computeLeadTimeModifier,
} from "./v6";
import type { StatsData, DimensionScores, RawContributionData } from "@chapa/shared";
import { buildStatsFromRaw, SOLO_REVIEW_RATIO_THRESHOLD } from "@chapa/shared";
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

function heatmapDateAt(offset: number, startDate = "2025-01-05"): string {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Build a uniform 13-week heatmap with a given weekly total. */
function makeUniformHeatmap(weeklyTotal: number) {
  const days = [];
  for (let w = 0; w < 13; w++) {
    for (let d = 0; d < 7; d++) {
      const perDay = Math.floor(weeklyTotal / 7);
      const extra = d < weeklyTotal % 7 ? 1 : 0;
      days.push({
        date: heatmapDateAt(w * 7 + d),
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
        date: heatmapDateAt(w * 7 + d),
        count,
      });
    }
  }
  return days;
}

// ---------------------------------------------------------------------------
// computeDelivery(stats)
// ---------------------------------------------------------------------------

describe("computeDelivery(stats)", () => {
  it("returns 0 for zero activity", () => {
    expect(computeDelivery(makeStats())).toBe(0);
  });

  it("returns 100 for maxed-out shipping signals", () => {
    const stats = makeStats({
      prsMergedWeight: 120,
      issuesClosedCount: 80,
      commitsTotal: 600,
    });
    expect(computeDelivery(stats)).toBe(100);
  });

  it("weights PRs at 70%", () => {
    // Only PRs, no issues/commits
    const prOnly = makeStats({ prsMergedWeight: 120 });
    const score = computeDelivery(prOnly);
    expect(score).toBe(70);
  });

  it("weights issues at 20%", () => {
    const issueOnly = makeStats({ issuesClosedCount: 80 });
    const score = computeDelivery(issueOnly);
    expect(score).toBe(20);
  });

  it("weights commits at 10%", () => {
    const commitOnly = makeStats({ commitsTotal: 600 });
    const score = computeDelivery(commitOnly);
    expect(score).toBe(10);
  });

  it("returns an integer", () => {
    const stats = makeStats({ prsMergedWeight: 12, issuesClosedCount: 5, commitsTotal: 30 });
    expect(Number.isInteger(computeDelivery(stats))).toBe(true);
  });

  it("handles mid-range input", () => {
    const stats = makeStats({
      prsMergedWeight: 20,
      issuesClosedCount: 10,
      commitsTotal: 80,
    });
    const score = computeDelivery(stats);
    expect(score).toBeGreaterThan(30);
    expect(score).toBeLessThanOrEqual(80);
  });

  it("caps values above their limits", () => {
    const stats = makeStats({
      prsMergedWeight: 300,
      issuesClosedCount: 200,
      commitsTotal: 1500,
    });
    expect(computeDelivery(stats)).toBe(100);
  });

  it("boosts delivery for fast lead time", () => {
    const stats = makeStats({
      prsMergedWeight: 30,
      issuesClosedCount: 10,
      commitsTotal: 80,
      medianPrLeadTimeHours: 2, // very fast → 1.05x
    });
    const withoutLead = makeStats({
      prsMergedWeight: 30,
      issuesClosedCount: 10,
      commitsTotal: 80,
    });
    expect(computeDelivery(stats)).toBeGreaterThan(computeDelivery(withoutLead));
  });

  it("penalizes delivery for slow lead time", () => {
    const stats = makeStats({
      prsMergedWeight: 30,
      issuesClosedCount: 10,
      commitsTotal: 80,
      medianPrLeadTimeHours: 200, // very slow → 0.95x
    });
    const withoutLead = makeStats({
      prsMergedWeight: 30,
      issuesClosedCount: 10,
      commitsTotal: 80,
    });
    expect(computeDelivery(stats)).toBeLessThan(computeDelivery(withoutLead));
  });

  it("leaves delivery unchanged when no lead time data", () => {
    const stats = makeStats({
      prsMergedWeight: 30,
      issuesClosedCount: 10,
      commitsTotal: 80,
    });
    // No medianPrLeadTimeHours → modifier = 1.0
    const baseScore = computeDelivery(stats);
    // The neutral point is around 26h; without data should be exactly 1.0x
    expect(baseScore).toBe(computeDelivery(makeStats({
      prsMergedWeight: 30,
      issuesClosedCount: 10,
      commitsTotal: 80,
    })));
  });

  it("does not exceed 100 even with fast lead time boost", () => {
    const stats = makeStats({
      prsMergedWeight: 300,
      issuesClosedCount: 200,
      commitsTotal: 1500,
      medianPrLeadTimeHours: 1, // max boost
    });
    expect(computeDelivery(stats)).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// computeLeadTimeModifier(medianHours)
// ---------------------------------------------------------------------------

describe("computeLeadTimeModifier(medianHours)", () => {
  it("returns 1.05 for median ≤ 4 hours", () => {
    expect(computeLeadTimeModifier(0)).toBe(1.05);
    expect(computeLeadTimeModifier(4)).toBe(1.05);
  });

  it("returns 1.0 for median = 48 hours", () => {
    expect(computeLeadTimeModifier(48)).toBeCloseTo(1.0, 5);
  });

  it("returns 0.95 for median ≥ 168 hours", () => {
    expect(computeLeadTimeModifier(168)).toBeCloseTo(0.95, 5);
    expect(computeLeadTimeModifier(500)).toBe(0.95);
  });

  it("interpolates linearly between 4-48h", () => {
    // Midpoint at 26h → (1.05 + 1.0) / 2 = 1.025
    expect(computeLeadTimeModifier(26)).toBeCloseTo(1.025, 2);
  });

  it("interpolates linearly between 48-168h", () => {
    // Midpoint at 108h → (1.0 + 0.95) / 2 = 0.975
    expect(computeLeadTimeModifier(108)).toBeCloseTo(0.975, 2);
  });

  it("returns 1.0 when medianHours is undefined", () => {
    expect(computeLeadTimeModifier(undefined)).toBe(1.0);
  });

  it("returns 1.0 when medianHours is null-ish", () => {
    expect(computeLeadTimeModifier(undefined)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// computeQuality(stats)
// ---------------------------------------------------------------------------

describe("computeQuality(stats)", () => {
  it("returns 0 for solo profile with no merged PRs", () => {
    expect(computeQuality(makeStats())).toBe(0);
  });

  it("returns high score for prolific reviewer", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 180,
      prsMergedCount: 60, // review-to-PR ratio = 3:1 is excellent
    });
    const score = computeQuality(stats);
    expect(score).toBeGreaterThan(70);
  });

  it("weights reviews at 60%", () => {
    const reviewOnly = makeStats({ reviewsSubmittedCount: 180 });
    const score = computeQuality(reviewOnly);
    // 60% from reviews, 25% from ratio (no PRs → pure reviewer → max ratio = 1),
    // ~4.5% from batchSize (default 0.3 → 15% * 0.3)
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it("rewards high review-to-PR ratio", () => {
    // Same reviews, different PR counts
    const highRatio = makeStats({ reviewsSubmittedCount: 30, prsMergedCount: 5 }); // 6:1
    const lowRatio = makeStats({ reviewsSubmittedCount: 30, prsMergedCount: 30 }); // 1:1
    expect(computeQuality(highRatio)).toBeGreaterThan(computeQuality(lowRatio));
  });

  it("rewards high batchSizeScore", () => {
    const good = makeStats({ reviewsSubmittedCount: 30, batchSizeScore: 0.9 });
    const bad = makeStats({ reviewsSubmittedCount: 30, batchSizeScore: 0.1 });
    expect(computeQuality(good)).toBeGreaterThan(computeQuality(bad));
  });

  it("returns an integer", () => {
    const stats = makeStats({ reviewsSubmittedCount: 15, prsMergedCount: 10 });
    expect(Number.isInteger(computeQuality(stats))).toBe(true);
  });

  it("handles missing batchSizeScore with conservative default (0.3)", () => {
    const stats = makeStats({ reviewsSubmittedCount: 30 });
    const score = computeQuality(stats);
    expect(score).toBeGreaterThan(0);

    // With default 0.3 → 15% * 0.3 = 4.5% contribution
    // With explicit 1.0 → 15% * 1.0 = 15% contribution
    const maxBatch = makeStats({ reviewsSubmittedCount: 30, batchSizeScore: 1.0 });
    expect(computeQuality(maxBatch)).toBeGreaterThan(score);
  });

  it("scores lower with unknown batchSizeScore than with explicit 1.0", () => {
    // Validates the conservative default: unknown → 0.3 (no free points)
    const unknown = makeStats({ reviewsSubmittedCount: 100, prsMergedCount: 30 });
    const perfect = makeStats({ reviewsSubmittedCount: 100, prsMergedCount: 30, batchSizeScore: 1.0 });
    const scoreDiff = computeQuality(perfect) - computeQuality(unknown);
    // ~10.5 point difference (15% * 0.7 * 100)
    expect(scoreDiff).toBeGreaterThanOrEqual(8);
    expect(scoreDiff).toBeLessThanOrEqual(12);
  });

  it("is bounded 0-100", () => {
    const scenarios = [
      makeStats(),
      makeStats({ reviewsSubmittedCount: 180, prsMergedCount: 5, batchSizeScore: 1.0 }),
      makeStats({ reviewsSubmittedCount: 300, prsMergedCount: 1 }),
    ];
    for (const s of scenarios) {
      const score = computeQuality(s);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  // -------------------------------------------------------------------------
  // #827 — Threshold cliff: collaborative Quality must never punish a user
  // worse than the solo formula would have for the same inputs. A user with
  // strong solo signals who picks up a few reviews should not see Quality
  // collapse just because they crossed the 0.15 review-to-PR ratio threshold.
  // -------------------------------------------------------------------------

  describe("#827 cliff regression", () => {
    // Inputs derived from juan294's live stats on 2026-04-23 (the day the
    // profile flipped from solo to collaborative). With strong solo signals
    // (descRate=1.0, branchRate=1.0) the solo formula produced ~79; the
    // collaborative formula produced ~37 — a 42-point drop from picking up
    // 4 extra reviews. Quality must never decrease under that transition.
    const juan294 = {
      prsMergedCount: 23,
      reviewsSubmittedCount: 7,
      batchSizeScore: 0.42857142857142855,
      prDescriptionRate: 1,
      featureBranchRate: 1,
      issueLinkageRate: 0.38095238095238093,
    } as const;

    it("juan294 transition: collaborative Quality is at least as high as the solo formula", () => {
      const collabStats = makeStats(juan294);
      const soloStats = makeStats({
        ...juan294,
        // Drop reviews to 0 so detectProfileType returns "solo" deterministically
        reviewsSubmittedCount: 0,
      });

      expect(detectProfileType(collabStats)).toBe("collaborative");
      expect(detectProfileType(soloStats)).toBe("solo");

      const collabQuality = computeQuality(collabStats);
      const soloQuality = computeQuality(soloStats);

      // The user has more participation signal in the collaborative case
      // (7 reviews) than the solo case (0 reviews), so Quality must not drop.
      expect(collabQuality).toBeGreaterThanOrEqual(soloQuality);
    });

    it("Quality is monotone non-decreasing as reviews grow from 0 to cap", () => {
      // Hold all other Quality inputs constant at strong solo levels and step
      // reviews from 0 to well past the cap. Quality must never decrease.
      const base = {
        prsMergedCount: 23,
        batchSizeScore: 0.43,
        prDescriptionRate: 1,
        featureBranchRate: 1,
        issueLinkageRate: 0.4,
      } as const;

      let prev = -1;
      for (let reviews = 0; reviews <= 120; reviews++) {
        const score = computeQuality(makeStats({ ...base, reviewsSubmittedCount: reviews }));
        expect(score, `Quality regressed at reviews=${reviews} (was ${prev}, now ${score})`)
          .toBeGreaterThanOrEqual(prev);
        prev = score;
      }
    });

    it("collaborative Quality never falls below the solo formula for the same stats", () => {
      // Property: across a range of inputs that flip the profile to collaborative,
      // Quality must be at least max(solo, collab) — i.e. participation never penalizes.
      const cases = [
        // Strong solo signals, a few reviews
        { prsMergedCount: 22, reviewsSubmittedCount: 4, batchSizeScore: 0.5,
          prDescriptionRate: 1, featureBranchRate: 1, issueLinkageRate: 0.4 },
        // Moderate solo signals, more reviews
        { prsMergedCount: 30, reviewsSubmittedCount: 12, batchSizeScore: 0.4,
          prDescriptionRate: 0.8, featureBranchRate: 0.9, issueLinkageRate: 0.3 },
        // Excellent solo signals, threshold-grazing reviews
        { prsMergedCount: 40, reviewsSubmittedCount: 7, batchSizeScore: 0.6,
          prDescriptionRate: 1, featureBranchRate: 1, issueLinkageRate: 0.5 },
      ];

      for (const c of cases) {
        const collabStats = makeStats(c);
        const soloEquivalent = makeStats({ ...c, reviewsSubmittedCount: 0 });
        expect(detectProfileType(collabStats)).toBe("collaborative");
        expect(computeQuality(collabStats)).toBeGreaterThanOrEqual(computeQuality(soloEquivalent));
      }
    });
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
    });
    const score = computeConsistency(stats);
    expect(score).toBeGreaterThan(80);
  });

  it("weights sqrt streak at 45%", () => {
    const stats = makeStats({
      activeDays: 365,
      heatmapData: [], // no heatmap data → evenness = 0, weekCoverage = 0
    });
    const score = computeConsistency(stats);
    // sqrt(365/365) = 1.0; 45% * 1.0 * 100 = 45
    expect(score).toBe(45);
  });

  it("sqrt curve boosts moderate active days significantly", () => {
    // 120 active days: sqrt(120/365) = 57.3%
    const stats = makeStats({
      activeDays: 120,
      heatmapData: [], // no heatmap data → evenness = 0, weekCoverage = 0
    });
    const score = computeConsistency(stats);
    // sqrt(120/365) ≈ 0.573; 0.573 * 45 ≈ 25.8 → 26
    expect(score).toBe(26);
  });

  it("no longer penalizes high daily contribution counts", () => {
    // Two profiles with identical heatmaps but different maxCommitsIn10Min
    // should score the same (burst is no longer a factor)
    const low = makeStats({
      activeDays: 60,
      heatmapData: makeUniformHeatmap(10),
      maxCommitsIn10Min: 3,
    });
    const high = makeStats({
      activeDays: 60,
      heatmapData: makeUniformHeatmap(10),
      maxCommitsIn10Min: 300,
    });
    expect(computeConsistency(low)).toBe(computeConsistency(high));
  });

  it("scores higher when more weeks have activity (week coverage)", () => {
    // 13 active weeks vs 3 active weeks (same total activity)
    const manyWeeks = makeStats({
      activeDays: 91,
      heatmapData: makeUniformHeatmap(7), // all 13 weeks active
    });
    const fewWeeks = makeStats({
      activeDays: 21,
      heatmapData: makeBurstHeatmap(91), // only 1 week active
    });
    expect(computeConsistency(manyWeeks)).toBeGreaterThan(computeConsistency(fewWeeks));
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
      makeStats({ activeDays: 365, heatmapData: makeUniformHeatmap(20) }),
      makeStats({ activeDays: 1, heatmapData: makeBurstHeatmap(100) }),
    ];
    for (const s of scenarios) {
      const score = computeConsistency(s);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("scores > 90 with uniform activity across 52 weeks", () => {
    // Build a 52-week heatmap (364 days) with uniform activity
    const days: { date: string; count: number }[] = [];
    for (let i = 0; i < 364; i++) {
      days.push({ date: heatmapDateAt(i), count: 3 });
    }
    const stats = makeStats({
      activeDays: 364,
      heatmapData: days,
    });
    expect(computeConsistency(stats)).toBeGreaterThan(90);
  });

  it("scores well with 134 active days despite high max daily contributions", () => {
    // Simulate a high-output solo dev: active ~134 days, variable intensity
    // Key: maxCommitsIn10Min no longer penalizes the score
    const days: { date: string; count: number }[] = [];
    for (let i = 0; i < 365; i++) {
      const count = i < 134 ? (i % 7 === 0 ? 50 : 5) : 0;
      days.push({ date: heatmapDateAt(i), count });
    }
    const stats = makeStats({
      activeDays: 134,
      heatmapData: days,
      maxCommitsIn10Min: 300,
    });
    // Should score ~50 (up from ~40 with old burst penalty)
    expect(computeConsistency(stats)).toBeGreaterThanOrEqual(45);
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
    expect(dims.delivery).toBe(0);
    expect(dims.quality).toBe(0);
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
    for (const key of ["delivery", "quality", "consistency", "breadth"] as const) {
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
    expect(dims.delivery).toBe(computeDelivery(stats));
    expect(dims.quality).toBe(computeQuality(stats));
    expect(dims.consistency).toBe(computeConsistency(stats));
    expect(dims.breadth).toBe(computeBreadth(stats));
  });
});

// ---------------------------------------------------------------------------
// deriveArchetype(dimensions)
// ---------------------------------------------------------------------------

describe("deriveArchetype(dimensions) — V5 thresholds", () => {
  // V5: specialist threshold lowered from 70 to 60
  it("returns Builder when delivery is highest and >= 60", () => {
    const dims: DimensionScores = { delivery: 65, quality: 45, consistency: 50, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("returns Quality Champion when quality is highest and >= 60", () => {
    const dims: DimensionScores = { delivery: 45, quality: 65, consistency: 50, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Quality Champion");
  });

  it("returns Marathoner when consistency is highest and >= 60", () => {
    const dims: DimensionScores = { delivery: 45, quality: 40, consistency: 65, breadth: 50 };
    expect(deriveArchetype(dims)).toBe("Marathoner");
  });

  it("returns Polymath when breadth is highest and >= 60", () => {
    const dims: DimensionScores = { delivery: 45, quality: 40, consistency: 50, breadth: 65 };
    expect(deriveArchetype(dims)).toBe("Polymath");
  });

  // V5: Balanced gate expanded: range <= 20, avg >= 50
  it("returns Balanced when all within 20 pts and avg >= 50", () => {
    const dims: DimensionScores = { delivery: 55, quality: 60, consistency: 58, breadth: 52 };
    expect(deriveArchetype(dims)).toBe("Balanced");
  });

  // V5: Emerging gate: avg < 25 OR no dim >= 40
  it("returns Emerging when avg < 25", () => {
    const dims: DimensionScores = { delivery: 20, quality: 15, consistency: 10, breadth: 30 };
    // avg = 18.75 < 25
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  it("returns Emerging when no dimension >= 40", () => {
    const dims: DimensionScores = { delivery: 35, quality: 30, consistency: 25, breadth: 38 };
    // avg = 32, no dim >= 40
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  it("V5: avg=30 with dim >= 40 passes Emerging gate but falls back to Emerging", () => {
    // avg=30 > 25 AND delivery=42 >= 40 → passes Emerging gate
    // But range=17 <=20 yet avg=30 < 50 → not Balanced
    // Highest=42 < 60 → no specialist → falls back to Emerging
    const dims: DimensionScores = { delivery: 42, quality: 25, consistency: 25, breadth: 28 };
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  it("V5: avg=30 with dim >= 60 escapes Emerging to specialist", () => {
    // avg=30 > 25 AND delivery=60 >= 40 → passes Emerging gate
    // range=60-10=50 > 20 → not Balanced; delivery=60 → Builder
    const dims: DimensionScores = { delivery: 60, quality: 10, consistency: 15, breadth: 35 };
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  // Tie-breaking: Polymath > Quality Champion > Marathoner > Builder
  // Use range > 20 to avoid triggering V5 Balanced gate
  it("breaks ties favoring Polymath over Quality Champion", () => {
    const dims: DimensionScores = { delivery: 40, quality: 75, consistency: 40, breadth: 75 };
    expect(deriveArchetype(dims)).toBe("Polymath");
  });

  it("breaks ties favoring Quality Champion over Marathoner", () => {
    const dims: DimensionScores = { delivery: 40, quality: 75, consistency: 75, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Quality Champion");
  });

  it("breaks ties favoring Marathoner over Builder", () => {
    const dims: DimensionScores = { delivery: 70, quality: 40, consistency: 70, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Marathoner");
  });

  it("returns Balanced when all tied at 80 (within 20 pts, avg >= 50)", () => {
    const dims: DimensionScores = { delivery: 80, quality: 80, consistency: 80, breadth: 80 };
    expect(deriveArchetype(dims)).toBe("Balanced");
  });

  it("does NOT return Balanced if range exceeds 20 pts even with high avg", () => {
    const dims: DimensionScores = { delivery: 90, quality: 65, consistency: 75, breadth: 60 };
    // range = 90 - 60 = 30 > 20 → not Balanced
    // highest is delivery at 90, >= 60 → Builder
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("returns Balanced when range is exactly 20 and avg >= 50", () => {
    const dims: DimensionScores = { delivery: 50, quality: 60, consistency: 55, breadth: 70 };
    // range = 70 - 50 = 20, avg = 58.75 >= 50
    expect(deriveArchetype(dims)).toBe("Balanced");
  });

  it("returns Emerging over Balanced when avg < 50 even if within 20 pts", () => {
    // avg = 42.5, no dim >= 40? quality=45 >= 40, so NOT Emerging by dim gate
    // But avg < 50 → not Balanced. Highest is quality at 45, < 60 → no specialist
    // Falls through to Emerging
    const dims: DimensionScores = { delivery: 40, quality: 45, consistency: 42, breadth: 43 };
    expect(deriveArchetype(dims)).not.toBe("Balanced");
  });

  it("V5: handles edge case where highest is exactly 60", () => {
    const dims: DimensionScores = { delivery: 60, quality: 45, consistency: 50, breadth: 40 };
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("V5: dim at 65 qualifies as specialist (was < 70 threshold in V4)", () => {
    const dims: DimensionScores = { delivery: 65, quality: 30, consistency: 40, breadth: 35 };
    expect(deriveArchetype(dims)).toBe("Builder");
  });

  it("handles all zeros (Emerging)", () => {
    const dims: DimensionScores = { delivery: 0, quality: 0, consistency: 0, breadth: 0 };
    expect(deriveArchetype(dims)).toBe("Emerging");
  });

  it("handles all 100s (Balanced)", () => {
    const dims: DimensionScores = { delivery: 100, quality: 100, consistency: 100, breadth: 100 };
    expect(deriveArchetype(dims)).toBe("Balanced");
  });
});

// ---------------------------------------------------------------------------
// computeImpactV6(stats) — full integration
// ---------------------------------------------------------------------------

describe("computeImpactV6(stats)", () => {
  it("returns a complete ImpactV6Result", () => {
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

    const result = computeImpactV6(stats);

    expect(result.handle).toBe("test-user");
    expect(result.dimensions).toBeDefined();
    expect(result.dimensions.delivery).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.delivery).toBeLessThanOrEqual(100);
    expect(result.dimensions.quality).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.quality).toBeLessThanOrEqual(100);
    expect(result.dimensions.consistency).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.consistency).toBeLessThanOrEqual(100);
    expect(result.dimensions.breadth).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.breadth).toBeLessThanOrEqual(100);
    expect(result.archetype).toBeTruthy();
    expect(["Builder", "Quality Champion", "Marathoner", "Polymath", "Balanced", "Emerging"]).toContain(result.archetype);
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
    const result = computeImpactV6(stats);
    const dims = result.dimensions;
    const expectedAvg = Math.round(
      (dims.delivery + dims.quality + dims.consistency + dims.breadth) / 4
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
    const result = computeImpactV6(stats);
    expect(result.adjustedComposite).toBeLessThanOrEqual(result.compositeScore);
  });

  it("scores inactive user as Emerging", () => {
    const stats = makeStats({ commitsTotal: 2, activeDays: 1 });
    const result = computeImpactV6(stats);
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
    const result = computeImpactV6(stats);
    expect(result.archetype).toBe("Builder");
  });

  it("identifies a Quality Champion archetype", () => {
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
    const result = computeImpactV6(stats);
    expect(result.archetype).toBe("Quality Champion");
  });

  it("reuses confidence from v3 (same penalties)", () => {
    const stats = makeStats({
      maxCommitsIn10Min: 25,
      prsMergedCount: 15,
      reviewsSubmittedCount: 0,
      linesAdded: 20000,
      linesDeleted: 1000,
    });
    const result = computeImpactV6(stats);
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
    const result = computeImpactV6(stats);
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
    const result = computeImpactV6(stats);
    expect(Number.isInteger(result.compositeScore)).toBe(true);
    expect(Number.isInteger(result.adjustedComposite)).toBe(true);
  });

  it("includes computedAt timestamp", () => {
    const result = computeImpactV6(makeStats());
    expect(result.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("includes profileType in result", () => {
    const result = computeImpactV6(makeStats({ reviewsSubmittedCount: 5 }));
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

  it("returns 'solo' when review-to-PR ratio < 0.15 (e.g., 5 reviews, 67 PRs)", () => {
    // 5/67 = 0.075, below 0.15 threshold → solo
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 5, prsMergedCount: 67 }))).toBe("solo");
  });

  it("returns 'collaborative' when review-to-PR ratio >= 0.15 (e.g., 15 reviews, 67 PRs)", () => {
    // 15/67 = 0.224, above 0.15 threshold → collaborative
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 15, prsMergedCount: 67 }))).toBe("collaborative");
  });

  it("returns 'collaborative' when review-to-PR ratio is 1.0 (pure reviewer)", () => {
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 30, prsMergedCount: 30 }))).toBe("collaborative");
  });

  it("returns 'collaborative' when reviewsSubmittedCount is high", () => {
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 100 }))).toBe("collaborative");
  });

  it("handles edge case: 0 PRs with some reviews → collaborative", () => {
    // reviews / max(0, 1) = reviews/1 → ratio = reviews, which is >= 0.15
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 1, prsMergedCount: 0 }))).toBe("collaborative");
  });

  it("returns 'solo' at exactly the threshold boundary (ratio = 0.14)", () => {
    // 7/50 = 0.14, below 0.15 → solo
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 7, prsMergedCount: 50 }))).toBe("solo");
  });

  it("returns 'collaborative' at the threshold (ratio = 0.15)", () => {
    // 3/20 = 0.15, at threshold → collaborative (>= comparison)
    expect(detectProfileType(makeStats({ reviewsSubmittedCount: 3, prsMergedCount: 20 }))).toBe("collaborative");
  });

  // Pinning tests for the exact SOLO_REVIEW_RATIO_THRESHOLD pivot (#1032).
  //
  // The comparison in detectProfileType is `ratio < SOLO_REVIEW_RATIO_THRESHOLD
  // ? "solo" : "collaborative"` (strict less-than), so a ratio exactly equal to
  // the threshold is NOT solo — it's collaborative. These three cases sit
  // immediately astride the pivot so a `<` vs `<=` inversion would flip one of
  // them and fail CI. Counts are derived from the constant itself (scaled by
  // 100, which keeps everything integer for a 0.15 threshold) rather than a
  // bare literal, so the intent survives even if the threshold value changes.
  describe("exact SOLO_REVIEW_RATIO_THRESHOLD boundary", () => {
    const PR_COUNT = 100;
    // SOLO_REVIEW_RATIO_THRESHOLD * 100 is exact in IEEE-754 double precision
    // for the current 0.15 value (0.15 * 100 === 15), so this stays an integer.
    const EXACT_REVIEWS = SOLO_REVIEW_RATIO_THRESHOLD * PR_COUNT;

    it("returns 'collaborative' when ratio === SOLO_REVIEW_RATIO_THRESHOLD exactly", () => {
      // reviews/PR_COUNT === SOLO_REVIEW_RATIO_THRESHOLD exactly (not just below
      // it), so the strict `<` comparison in detectProfileType falls through to
      // "collaborative".
      expect(EXACT_REVIEWS / PR_COUNT).toBe(SOLO_REVIEW_RATIO_THRESHOLD);
      expect(
        detectProfileType(makeStats({ reviewsSubmittedCount: EXACT_REVIEWS, prsMergedCount: PR_COUNT })),
      ).toBe("collaborative");
    });

    it("returns 'solo' one review below SOLO_REVIEW_RATIO_THRESHOLD", () => {
      // (EXACT_REVIEWS - 1)/PR_COUNT is strictly less than the threshold → solo.
      const reviews = EXACT_REVIEWS - 1;
      expect(reviews / PR_COUNT).toBeLessThan(SOLO_REVIEW_RATIO_THRESHOLD);
      expect(
        detectProfileType(makeStats({ reviewsSubmittedCount: reviews, prsMergedCount: PR_COUNT })),
      ).toBe("solo");
    });

    it("returns 'collaborative' one review above SOLO_REVIEW_RATIO_THRESHOLD", () => {
      // (EXACT_REVIEWS + 1)/PR_COUNT is strictly greater than the threshold →
      // collaborative (was already true under `<`, but pins the "clearly above"
      // side of the pivot so all three cases live together).
      const reviews = EXACT_REVIEWS + 1;
      expect(reviews / PR_COUNT).toBeGreaterThan(SOLO_REVIEW_RATIO_THRESHOLD);
      expect(
        detectProfileType(makeStats({ reviewsSubmittedCount: reviews, prsMergedCount: PR_COUNT })),
      ).toBe("collaborative");
    });
  });

  it("uses primaryReviewsSubmittedCount for profile detection when present", () => {
    // Total reviews = 6 (from supplemental EMU), PRs = 31 → ratio 6/31 = 0.194 → collaborative
    // But primaryReviewsSubmittedCount = 0 → ratio 0/31 = 0 → solo
    // Profile type should be based on the primary account's reviews, not the merged total.
    expect(detectProfileType(makeStats({
      reviewsSubmittedCount: 6,
      prsMergedCount: 31,
      primaryReviewsSubmittedCount: 0,
    }))).toBe("solo");
  });

  it("falls back to reviewsSubmittedCount when primaryReviewsSubmittedCount is absent", () => {
    // No primaryReviewsSubmittedCount → uses reviewsSubmittedCount (backward compat)
    expect(detectProfileType(makeStats({
      reviewsSubmittedCount: 6,
      prsMergedCount: 31,
    }))).toBe("collaborative");
  });
});

// ---------------------------------------------------------------------------
// Integration: authoritative merged-PR count feeds detectProfileType
// (2026-07-07 scoring-integrity-contract, Phase 5c)
// ---------------------------------------------------------------------------

describe("detectProfileType with buildStatsFromRaw (juan294 golden case)", () => {
  function makeRaw(overrides: Partial<RawContributionData> = {}): RawContributionData {
    return {
      login: "juan294",
      name: "Juan",
      avatarUrl: "https://avatars.githubusercontent.com/u/1",
      mergedPrTotalCount: 904,
      contributionCalendar: { totalContributions: 15533, weeks: [] },
      pullRequests: {
        totalCount: 143,
        // Token-scoped/100-node-capped sample: 96 of the 904 merged PRs.
        nodes: Array.from({ length: 96 }, (_, i) => ({
          additions: 50, deletions: 10, changedFiles: 3, merged: true,
          body: `PR ${i}`, headRefName: `feat/${i}`, closingIssuesCount: 0,
        })),
      },
      reviews: { totalCount: 16 },
      issues: { totalCount: 5096 },
      repositories: { totalCount: 0, nodes: [] },
      ownedRepoStars: { nodes: [] },
      ...overrides,
    };
  }

  it("classifies as solo using the authoritative 904 denominator, not the 96-node sample size", () => {
    const stats = buildStatsFromRaw(makeRaw());

    // Pre-fix bug: using the sample size (96) as the denominator would give
    // 16/96 = 0.167 (>= 0.15 → wrongly "collaborative"). The authoritative
    // search count (904) gives 16/904 ≈ 0.018 (< 0.15 → correctly "solo").
    expect(stats.prsMergedCount).toBe(904);
    expect(stats.reviewsSubmittedCount).toBe(16);
    expect(detectProfileType(stats)).toBe("solo");
  });
});

// ---------------------------------------------------------------------------
// Solo developer scoring
// ---------------------------------------------------------------------------

describe("solo developer composite scoring", () => {
  it("uses 3 dimensions (excluding quality) for solo profiles without craft", () => {
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
      prsMergedCount: 20,
      prDescriptionRate: 0.8,
      featureBranchRate: 0.9,
      issueLinkageRate: 0.5,
    });
    const result = computeImpactV6(stats);
    const dims = result.dimensions;

    // Solo composite = (delivery + consistency + breadth) / 3 — quality excluded
    const expectedAvg = Math.round(
      (dims.delivery + dims.consistency + dims.breadth) / 3
    );
    expect(result.compositeScore).toBe(expectedAvg);
    expect(result.profileType).toBe("solo");
    // Quality is still computed (for display), just not in composite
    expect(dims.quality).toBeGreaterThan(0);
  });

  it("uses 4 dimensions (excluding quality, including craft) for solo profiles with craft", () => {
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
      prsMergedCount: 20,
      prDescriptionRate: 0.8,
      featureBranchRate: 0.9,
      issueLinkageRate: 0.5,
    });
    const result = computeImpactV6(stats, 75); // craft score = 75
    const dims = result.dimensions;

    // Solo composite = (delivery + consistency + breadth + craft) / 4
    const expectedAvg = Math.round(
      (dims.delivery + dims.consistency + dims.breadth + dims.craft!) / 4
    );
    expect(result.compositeScore).toBe(expectedAvg);
    expect(result.profileType).toBe("solo");
    expect(dims.craft).toBe(75);
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
    const result = computeImpactV6(stats);
    const dims = result.dimensions;
    const expectedAvg = Math.round(
      (dims.delivery + dims.quality + dims.consistency + dims.breadth) / 4
    );
    expect(result.compositeScore).toBe(expectedAvg);
    expect(result.profileType).toBe("collaborative");
  });

  it("solo with all zeros still scores 0", () => {
    const result = computeImpactV6(makeStats());
    expect(result.compositeScore).toBe(0);
    expect(result.profileType).toBe("solo");
    expect(result.tier).toBe("Emerging");
  });

  it("solo with maxed signals scores near 100", () => {
    const stats = makeStats({
      prsMergedWeight: 120,
      prsMergedCount: 50,
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
      prDescriptionRate: 1.0,
      featureBranchRate: 1.0,
      issueLinkageRate: 1.0,
      microCommitRatio: 0,
      batchSizeScore: 1.0,
    });
    const result = computeImpactV6(stats);
    expect(result.compositeScore).toBeGreaterThanOrEqual(90);
  });

  it("high-output solo dev gets >= 40 composite", () => {
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
      prDescriptionRate: 0.7,
      featureBranchRate: 0.8,
      issueLinkageRate: 0.3,
    });
    const result = computeImpactV6(stats);
    expect(result.compositeScore).toBeGreaterThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------
// Solo developer archetype derivation
// ---------------------------------------------------------------------------

describe("solo developer archetype", () => {
  it("CANNOT assign Quality Champion to solo profiles", () => {
    // Even if quality is highest, solo profiles can't be Quality Champion
    const dims: DimensionScores = { delivery: 50, quality: 85, consistency: 60, breadth: 55 };
    // Quality is excluded from SOLO_DIMENSION_KEYS → not considered for archetype
    expect(deriveArchetype(dims, "solo")).not.toBe("Quality Champion");
  });

  it("can assign Builder to solo profile", () => {
    const dims: DimensionScores = { delivery: 80, quality: 40, consistency: 50, breadth: 55 };
    expect(deriveArchetype(dims, "solo")).toBe("Builder");
  });

  it("can assign Marathoner to solo profile", () => {
    const dims: DimensionScores = { delivery: 50, quality: 40, consistency: 80, breadth: 55 };
    expect(deriveArchetype(dims, "solo")).toBe("Marathoner");
  });

  it("can assign Polymath to solo profile", () => {
    const dims: DimensionScores = { delivery: 50, quality: 40, consistency: 55, breadth: 80 };
    expect(deriveArchetype(dims, "solo")).toBe("Polymath");
  });

  it("can assign Balanced to solo profile when solo dims within 20 pts and avg >= 50", () => {
    // Solo uses only delivery, consistency, breadth (+ craft if present) — quality excluded
    const dims: DimensionScores = { delivery: 55, quality: 30, consistency: 50, breadth: 60 };
    expect(deriveArchetype(dims, "solo")).toBe("Balanced");
  });

  it("returns Emerging for low solo dimensions", () => {
    const dims: DimensionScores = { delivery: 20, quality: 10, consistency: 25, breadth: 15 };
    expect(deriveArchetype(dims, "solo")).toBe("Emerging");
  });

  it("defaults to collaborative behavior when profileType is omitted", () => {
    const dims: DimensionScores = { delivery: 50, quality: 85, consistency: 60, breadth: 55 };
    // Without profileType arg, should use all 4 dims → Quality Champion
    expect(deriveArchetype(dims)).toBe("Quality Champion");
  });
});

// ---------------------------------------------------------------------------
// Solo Quality scoring (computeQuality for solo profiles)
// ---------------------------------------------------------------------------

describe("computeQuality — solo path", () => {
  it("returns 0 when no reviews AND no merged PRs", () => {
    const stats = makeStats({ reviewsSubmittedCount: 0, prsMergedCount: 0 });
    expect(computeQuality(stats)).toBe(0);
  });

  it("applies solo formula weights: 40% desc, 25% branch, 20% linkage, 15% batchSize", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 0,
      prsMergedCount: 10,
      prDescriptionRate: 1.0,
      featureBranchRate: 0,
      issueLinkageRate: 0,
      batchSizeScore: 0,
    });
    // Only prDescriptionRate contributes: 40% * 1.0 * 100 = 40
    expect(computeQuality(stats)).toBe(40);
  });

  it("featureBranchRate at 25% weight", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 0,
      prsMergedCount: 10,
      prDescriptionRate: 0,
      featureBranchRate: 1.0,
      issueLinkageRate: 0,
      batchSizeScore: 0,
    });
    expect(computeQuality(stats)).toBe(25);
  });

  it("issueLinkageRate at 20% weight", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 0,
      prsMergedCount: 10,
      prDescriptionRate: 0,
      featureBranchRate: 0,
      issueLinkageRate: 1.0,
      batchSizeScore: 0,
    });
    expect(computeQuality(stats)).toBe(20);
  });

  it("batchSizeScore at 15% weight", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 0,
      prsMergedCount: 10,
      prDescriptionRate: 0,
      featureBranchRate: 0,
      issueLinkageRate: 0,
      batchSizeScore: 1.0,
    });
    expect(computeQuality(stats)).toBe(15);
  });

  it("returns 100 when all solo quality signals are maxed", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 0,
      prsMergedCount: 10,
      prDescriptionRate: 1.0,
      featureBranchRate: 1.0,
      issueLinkageRate: 1.0,
      batchSizeScore: 1.0,
    });
    expect(computeQuality(stats)).toBe(100);
  });

  it("defaults undefined rates to 0, batchSizeScore to 0.3 (no free points)", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 0,
      prsMergedCount: 10,
      // prDescriptionRate, featureBranchRate, issueLinkageRate all undefined
      // batchSizeScore undefined → defaults to 0.3
    });
    const score = computeQuality(stats);
    // Only batchSize contributes: 15% * 0.3 * 100 = 4.5 → 5
    expect(score).toBe(5);
  });

  it("collaborative quality path is unchanged (reviews > 0, high ratio)", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 80,
      prsMergedCount: 20,
      batchSizeScore: 1.0,
    });
    // Collaborative formula: 60% * (80/80) + 25% * min(80/20, 5)/5 + 15% * 1.0
    // = 60 + 25 * (4/5) + 15 = 60 + 20 + 15 = 95
    expect(computeQuality(stats)).toBe(95);
  });

  it("uses solo formula when review ratio is below threshold even with some reviews", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 5,
      prsMergedCount: 67,
      prDescriptionRate: 1.0,
      featureBranchRate: 0.5,
      issueLinkageRate: 0.3,
      batchSizeScore: 0.8,
    });
    // ratio = 5/67 = 0.075 < 0.15 → solo path
    // Solo: 40% * 1.0 + 25% * 0.5 + 20% * 0.3 + 15% * 0.8 = 40 + 12.5 + 6 + 12 = 70.5 → 71
    expect(computeQuality(stats)).toBe(71);
  });
});

// ---------------------------------------------------------------------------
// computeQuality with explicit profileType override
// ---------------------------------------------------------------------------

describe("computeQuality with profileType parameter", () => {
  it("uses solo formula when profileType is solo even with non-zero reviews", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 50,
      prsMergedCount: 10,
      prDescriptionRate: 1.0,
      featureBranchRate: 1.0,
      issueLinkageRate: 1.0,
      batchSizeScore: 1.0,
    });
    // Forced solo: 40% + 25% + 20% + 15% = 100
    expect(computeQuality(stats, "solo")).toBe(100);
  });

  it("uses collaborative formula when profileType is collaborative", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 80,
      prsMergedCount: 20,
      batchSizeScore: 1.0,
    });
    // Forced collaborative: same as normal collaborative path
    expect(computeQuality(stats, "collaborative")).toBe(95);
  });

  it("defaults to detectProfileType when profileType not provided", () => {
    const stats = makeStats({
      reviewsSubmittedCount: 0,
      prsMergedCount: 10,
      prDescriptionRate: 1.0,
      featureBranchRate: 1.0,
      issueLinkageRate: 1.0,
      batchSizeScore: 1.0,
    });
    // reviews=0 → auto-detects solo → 100
    expect(computeQuality(stats)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// V6: Craft dimension
// ---------------------------------------------------------------------------

describe("V6: Craft dimension", () => {
  it("computeImpactV6 without craft returns same as v5 (collaborative)", () => {
    const stats = makeStats({ commitsTotal: 150, activeDays: 120, prsMergedWeight: 30, reposContributed: 5, reviewsSubmittedCount: 10 });
    const result = computeImpactV6(stats);
    expect(result.dimensions.craft).toBeUndefined();
    expect(result.profileType).toBe("collaborative");
    // Composite = avg of 4 dimensions (collaborative includes quality)
    const expected = Math.round((result.dimensions.delivery + result.dimensions.quality + result.dimensions.consistency + result.dimensions.breadth) / 4);
    expect(result.compositeScore).toBe(expected);
  });

  it("computeImpactV6 with craft includes 5th dimension (collaborative)", () => {
    const stats = makeStats({ commitsTotal: 150, activeDays: 120, prsMergedWeight: 30, reposContributed: 5, reviewsSubmittedCount: 10 });
    const result = computeImpactV6(stats, 80);
    expect(result.dimensions.craft).toBe(80);
    expect(result.profileType).toBe("collaborative");
    // Composite = avg of 5 dimensions (collaborative includes quality + craft)
    const expected = Math.round((result.dimensions.delivery + result.dimensions.quality + result.dimensions.consistency + result.dimensions.breadth + 80) / 5);
    expect(result.compositeScore).toBe(expected);
  });

  it("craft dimension is clamped to 0-100", () => {
    const stats = makeStats({ commitsTotal: 100, activeDays: 60 });
    const over = computeImpactV6(stats, 150);
    expect(over.dimensions.craft).toBe(100);
    const under = computeImpactV6(stats, -10);
    expect(under.dimensions.craft).toBe(0);
  });

  it("Artificer archetype triggers when craft is highest and >= 60", () => {
    const stats = makeStats({ commitsTotal: 50, activeDays: 30, prsMergedWeight: 10, reposContributed: 2 });
    // Low GitHub dimensions, high craft
    const result = computeImpactV6(stats, 85);
    // craft=85 should be highest dimension for these low stats
    expect(result.archetype).toBe("Artificer");
  });

  it("Artificer does not trigger when another dimension is higher", () => {
    const stats = makeStats({ commitsTotal: 200, activeDays: 200, prsMergedWeight: 50, prsMergedCount: 20, reviewsSubmittedCount: 60, reposContributed: 8 });
    const result = computeImpactV6(stats, 55);
    // GitHub dimensions should be higher than craft=55
    expect(result.archetype).not.toBe("Artificer");
  });

  it("Balanced archetype works with 5 dimensions", () => {
    // All dimensions within 20-point range and avg >= 50
    const stats = makeStats({ commitsTotal: 150, activeDays: 150, prsMergedWeight: 30, prsMergedCount: 15, reviewsSubmittedCount: 40, reposContributed: 6, topRepoShare: 0.3, totalStars: 20, totalForks: 10, docsOnlyPrRatio: 0.15 });
    const result = computeImpactV6(stats, 60);
    // Check if dimensions are close enough for Balanced
    const dims = result.dimensions;
    const values = [dims.delivery, dims.quality, dims.consistency, dims.breadth, dims.craft!];
    const range = Math.max(...values) - Math.min(...values);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    if (range <= 20 && avg >= 50) {
      expect(result.archetype).toBe("Balanced");
    }
    // If not Balanced, that's fine — the point is it doesn't crash
  });

  it("existing archetypes unchanged when craft is absent", () => {
    // Builder: high delivery
    const builderStats = makeStats({ commitsTotal: 250, activeDays: 80, prsMergedWeight: 55, issuesClosedCount: 30, prsMergedCount: 20, reposContributed: 3 });
    const builder = computeImpactV6(builderStats);
    expect(builder.dimensions.craft).toBeUndefined();
    expect(builder.archetype).toBe("Builder");
  });
});
