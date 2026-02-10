import { describe, it, expect } from "vitest";
import {
  normalize,
  computeBaseScore,
  computeConfidence,
  computeAdjustedScore,
  getTier,
  computeImpactV3,
} from "./v3";
import type { Stats90d } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Stats90d with sensible defaults — override only what you need. */
function makeStats(overrides: Partial<Stats90d> = {}): Stats90d {
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
    heatmapData: [],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalize(x, cap)
// ---------------------------------------------------------------------------

describe("normalize(x, cap)", () => {
  it("returns 0 when x is 0", () => {
    expect(normalize(0, 200)).toBe(0);
  });

  it("returns 1 when x equals cap", () => {
    expect(normalize(200, 200)).toBeCloseTo(1, 5);
  });

  it("returns 1 when x exceeds cap (clamped)", () => {
    expect(normalize(400, 200)).toBeCloseTo(1, 5);
  });

  it("returns a mid-range value for typical input", () => {
    // f(100, 200) = ln(101) / ln(201)
    const expected = Math.log(101) / Math.log(201);
    expect(normalize(100, 200)).toBeCloseTo(expected, 5);
  });

  it("returns 0 for negative input", () => {
    expect(normalize(-5, 200)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeBaseScore(stats)
// ---------------------------------------------------------------------------

describe("computeBaseScore(stats)", () => {
  it("returns 0 when all signals are zero", () => {
    const stats = makeStats();
    const { score, breakdown } = computeBaseScore(stats);
    expect(score).toBe(0);
    expect(breakdown.commits).toBe(0);
    expect(breakdown.prWeight).toBe(0);
    expect(breakdown.reviews).toBe(0);
    expect(breakdown.issues).toBe(0);
    expect(breakdown.streak).toBe(0);
    expect(breakdown.collaboration).toBe(0);
  });

  it("returns 100 when all signals are at or above cap", () => {
    const stats = makeStats({
      commitsTotal: 200,
      prsMergedWeight: 40,
      reviewsSubmittedCount: 60,
      issuesClosedCount: 30,
      activeDays: 90,
      reposContributed: 10,
    });
    const { score } = computeBaseScore(stats);
    expect(score).toBe(100);
  });

  it("caps values that exceed the defined caps", () => {
    const stats = makeStats({
      commitsTotal: 500, // cap 200
      prsMergedWeight: 100, // cap 40
      reviewsSubmittedCount: 200, // cap 60
      issuesClosedCount: 100, // cap 30
      activeDays: 90,
      reposContributed: 50, // cap 10
    });
    const { score } = computeBaseScore(stats);
    expect(score).toBe(100);
  });

  it("returns correct score for a known mid-range input", () => {
    const stats = makeStats({
      commitsTotal: 50,
      prsMergedWeight: 10,
      reviewsSubmittedCount: 15,
      issuesClosedCount: 5,
      activeDays: 30,
      reposContributed: 3,
    });
    const { score, breakdown } = computeBaseScore(stats);

    // Verify each normalized component
    expect(breakdown.commits).toBeCloseTo(Math.log(51) / Math.log(201), 4);
    expect(breakdown.prWeight).toBeCloseTo(Math.log(11) / Math.log(41), 4);
    expect(breakdown.reviews).toBeCloseTo(Math.log(16) / Math.log(61), 4);
    expect(breakdown.issues).toBeCloseTo(Math.log(6) / Math.log(31), 4);
    expect(breakdown.streak).toBeCloseTo(30 / 90, 4);
    expect(breakdown.collaboration).toBeCloseTo(3 / 10, 4);

    // Weighted sum
    const expected = Math.round(
      100 *
        (0.12 * breakdown.commits +
          0.33 * breakdown.prWeight +
          0.22 * breakdown.reviews +
          0.1 * breakdown.issues +
          0.13 * breakdown.streak +
          0.1 * breakdown.collaboration)
    );
    expect(score).toBe(expected);
  });

  it("rounds the base score to an integer", () => {
    const stats = makeStats({ commitsTotal: 7, activeDays: 3 });
    const { score } = computeBaseScore(stats);
    expect(Number.isInteger(score)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeConfidence(stats)
// ---------------------------------------------------------------------------

describe("computeConfidence(stats)", () => {
  it("returns 100 with no penalties for clean activity", () => {
    const stats = makeStats({
      maxCommitsIn10Min: 5,
      prsMergedCount: 5,
      reviewsSubmittedCount: 10,
      reposContributed: 3,
      topRepoShare: 0.5,
      linesAdded: 1000,
      linesDeleted: 500,
    });
    const { confidence, penalties } = computeConfidence(stats);
    expect(confidence).toBe(100);
    expect(penalties).toHaveLength(0);
  });

  it("applies burst_activity penalty (-15) when maxCommitsIn10Min >= 20", () => {
    const stats = makeStats({ maxCommitsIn10Min: 20 });
    const { confidence, penalties } = computeConfidence(stats);
    expect(confidence).toBe(85);
    expect(penalties).toHaveLength(1);
    expect(penalties[0].flag).toBe("burst_activity");
    expect(penalties[0].penalty).toBe(15);
  });

  it("applies micro_commit_pattern penalty (-10) when microCommitRatio >= 0.6", () => {
    const stats = makeStats({ microCommitRatio: 0.6 });
    const { confidence, penalties } = computeConfidence(stats);
    expect(confidence).toBe(90);
    expect(penalties).toHaveLength(1);
    expect(penalties[0].flag).toBe("micro_commit_pattern");
    expect(penalties[0].penalty).toBe(10);
  });

  it("skips micro_commit_pattern when microCommitRatio is undefined", () => {
    const stats = makeStats(); // microCommitRatio defaults to undefined
    const { penalties } = computeConfidence(stats);
    const microPenalty = penalties.find(
      (p) => p.flag === "micro_commit_pattern"
    );
    expect(microPenalty).toBeUndefined();
  });

  it("applies generated_change_pattern penalty (-15) for high volume + low review", () => {
    const stats = makeStats({
      linesAdded: 15000,
      linesDeleted: 6000, // total 21000 >= 20000
      reviewsSubmittedCount: 1, // low review
    });
    const { confidence, penalties } = computeConfidence(stats);
    expect(
      penalties.find((p) => p.flag === "generated_change_pattern")
    ).toBeTruthy();
    expect(confidence).toBe(85);
  });

  it("does NOT apply generated_change_pattern when reviews are sufficient", () => {
    const stats = makeStats({
      linesAdded: 15000,
      linesDeleted: 6000, // total 21000 >= 20000
      reviewsSubmittedCount: 10, // sufficient review
    });
    const { penalties } = computeConfidence(stats);
    expect(
      penalties.find((p) => p.flag === "generated_change_pattern")
    ).toBeUndefined();
  });

  it("applies low_collaboration_signal penalty (-10) for many PRs but few reviews", () => {
    const stats = makeStats({
      prsMergedCount: 10,
      reviewsSubmittedCount: 1,
    });
    const { confidence, penalties } = computeConfidence(stats);
    expect(
      penalties.find((p) => p.flag === "low_collaboration_signal")
    ).toBeTruthy();
    expect(confidence).toBe(90);
  });

  it("applies single_repo_concentration penalty (-5)", () => {
    const stats = makeStats({
      topRepoShare: 0.95,
      reposContributed: 1,
    });
    const { confidence, penalties } = computeConfidence(stats);
    expect(
      penalties.find((p) => p.flag === "single_repo_concentration")
    ).toBeTruthy();
    expect(confidence).toBe(95);
  });

  it("clamps confidence to 50 when all penalties stack", () => {
    const stats = makeStats({
      maxCommitsIn10Min: 25, // burst: -15
      microCommitRatio: 0.8, // micro: -10
      linesAdded: 20000, // generated: -15 (needs low review)
      linesDeleted: 1000,
      reviewsSubmittedCount: 0, // triggers generated + low_collaboration
      prsMergedCount: 15, // low_collaboration: -10
      topRepoShare: 1.0, // single_repo: -5
      reposContributed: 1,
    });
    const { confidence } = computeConfidence(stats);
    // 100 - 15 - 10 - 15 - 10 - 5 = 45 → clamped to 50
    expect(confidence).toBe(50);
  });

  it("never returns confidence below 50", () => {
    const stats = makeStats({
      maxCommitsIn10Min: 100,
      microCommitRatio: 1.0,
      linesAdded: 100000,
      linesDeleted: 100000,
      reviewsSubmittedCount: 0,
      prsMergedCount: 50,
      topRepoShare: 1.0,
      reposContributed: 1,
    });
    const { confidence } = computeConfidence(stats);
    expect(confidence).toBeGreaterThanOrEqual(50);
  });

  it("includes reason strings for each penalty", () => {
    const stats = makeStats({ maxCommitsIn10Min: 25 });
    const { penalties } = computeConfidence(stats);
    expect(penalties[0].reason).toBeTruthy();
    expect(typeof penalties[0].reason).toBe("string");
    expect(penalties[0].reason.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// computeAdjustedScore(base, confidence)
// ---------------------------------------------------------------------------

describe("computeAdjustedScore(base, confidence)", () => {
  it("returns base score when confidence is 100", () => {
    expect(computeAdjustedScore(100, 100)).toBe(100);
    expect(computeAdjustedScore(50, 100)).toBe(50);
  });

  it("reduces score when confidence is low", () => {
    // adjusted = 100 * (0.85 + 0.15 * 50/100) = 100 * 0.925 = 92.5 → 93
    expect(computeAdjustedScore(100, 50)).toBe(93);
  });

  it("returns 0 when base is 0 regardless of confidence", () => {
    expect(computeAdjustedScore(0, 100)).toBe(0);
    expect(computeAdjustedScore(0, 50)).toBe(0);
  });

  it("clamps to 0-100 range", () => {
    expect(computeAdjustedScore(100, 100)).toBeLessThanOrEqual(100);
    expect(computeAdjustedScore(0, 50)).toBeGreaterThanOrEqual(0);
  });

  it("rounds to integer", () => {
    const result = computeAdjustedScore(73, 82);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTier(adjustedScore)
// ---------------------------------------------------------------------------

describe("getTier(adjustedScore)", () => {
  it("returns 'Emerging' for 0-39", () => {
    expect(getTier(0)).toBe("Emerging");
    expect(getTier(20)).toBe("Emerging");
    expect(getTier(39)).toBe("Emerging");
  });

  it("returns 'Solid' for 40-69", () => {
    expect(getTier(40)).toBe("Solid");
    expect(getTier(55)).toBe("Solid");
    expect(getTier(69)).toBe("Solid");
  });

  it("returns 'High' for 70-84", () => {
    expect(getTier(70)).toBe("High");
    expect(getTier(77)).toBe("High");
    expect(getTier(84)).toBe("High");
  });

  it("returns 'Elite' for 85-100", () => {
    expect(getTier(85)).toBe("Elite");
    expect(getTier(92)).toBe("Elite");
    expect(getTier(100)).toBe("Elite");
  });
});

// ---------------------------------------------------------------------------
// computeImpactV3(stats) — full integration
// ---------------------------------------------------------------------------

describe("computeImpactV3(stats)", () => {
  it("returns a complete ImpactV3Result", () => {
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
    });

    const result = computeImpactV3(stats);

    expect(result.handle).toBe("test-user");
    expect(result.baseScore).toBeGreaterThanOrEqual(0);
    expect(result.baseScore).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(50);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(result.adjustedScore).toBeGreaterThanOrEqual(0);
    expect(result.adjustedScore).toBeLessThanOrEqual(100);
    expect(["Emerging", "Solid", "High", "Elite"]).toContain(result.tier);
    expect(result.breakdown).toBeDefined();
    expect(result.confidencePenalties).toBeInstanceOf(Array);
    expect(result.computedAt).toBeTruthy();
  });

  it("scores an inactive user as Emerging tier", () => {
    const stats = makeStats({ commitsTotal: 2, activeDays: 1 });
    const result = computeImpactV3(stats);
    expect(result.tier).toBe("Emerging");
    expect(result.adjustedScore).toBeLessThan(40);
  });

  it("scores a highly active user as High or Elite tier", () => {
    const stats = makeStats({
      commitsTotal: 180,
      activeDays: 75,
      prsMergedCount: 30,
      prsMergedWeight: 35,
      reviewsSubmittedCount: 50,
      issuesClosedCount: 20,
      linesAdded: 8000,
      linesDeleted: 3000,
      reposContributed: 8,
      topRepoShare: 0.3,
      maxCommitsIn10Min: 3,
    });
    const result = computeImpactV3(stats);
    expect(["High", "Elite"]).toContain(result.tier);
    expect(result.adjustedScore).toBeGreaterThanOrEqual(70);
  });

  it("penalizes confidence for suspicious patterns", () => {
    const clean = makeStats({
      commitsTotal: 100,
      activeDays: 50,
      prsMergedWeight: 20,
      reviewsSubmittedCount: 30,
      issuesClosedCount: 10,
      reposContributed: 5,
      topRepoShare: 0.4,
      maxCommitsIn10Min: 3,
    });

    const suspicious = makeStats({
      ...clean,
      maxCommitsIn10Min: 25, // burst
      prsMergedCount: 15,
      reviewsSubmittedCount: 0, // low collab
    });

    const cleanResult = computeImpactV3(clean);
    const suspResult = computeImpactV3(suspicious);

    expect(suspResult.confidence).toBeLessThan(cleanResult.confidence);
    expect(suspResult.confidencePenalties.length).toBeGreaterThan(0);
  });

  it("adjustedScore <= baseScore always (confidence only reduces)", () => {
    const stats = makeStats({
      commitsTotal: 100,
      activeDays: 60,
      prsMergedWeight: 25,
      reviewsSubmittedCount: 20,
      issuesClosedCount: 10,
      reposContributed: 5,
      topRepoShare: 0.5,
      maxCommitsIn10Min: 25, // penalty
    });
    const result = computeImpactV3(stats);
    expect(result.adjustedScore).toBeLessThanOrEqual(result.baseScore);
  });
});
