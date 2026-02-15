import { describe, it, expect } from "vitest";
import type { StatsData } from "@chapa/shared";
import {
  normalize,
  clampScore,
  computeConfidence,
  computeAdjustedScore,
  getTier,
} from "./utils";

// ---------------------------------------------------------------------------
// Helper: build a minimal StatsData with sane defaults (no penalties triggered)
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return {
    handle: "test-user",
    commitsTotal: 50,
    activeDays: 30,
    prsMergedCount: 5,
    prsMergedWeight: 10,
    reviewsSubmittedCount: 10,
    issuesClosedCount: 3,
    linesAdded: 2000,
    linesDeleted: 500,
    reposContributed: 4,
    topRepoShare: 0.4,
    maxCommitsIn10Min: 3,
    totalStars: 0,
    totalForks: 0,
    totalWatchers: 0,
    heatmapData: [],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalize(x, cap)
// ---------------------------------------------------------------------------

describe("normalize", () => {
  it("returns 0 when x is 0", () => {
    expect(normalize(0, 10)).toBe(0);
  });

  it("returns 0 for negative input", () => {
    expect(normalize(-1, 10)).toBe(0);
    expect(normalize(-100, 5)).toBe(0);
  });

  it("returns ln(2)/ln(11) for normalize(1, 10)", () => {
    const expected = Math.log(2) / Math.log(11);
    expect(normalize(1, 10)).toBeCloseTo(expected, 10);
  });

  it("returns 1.0 when x equals cap", () => {
    expect(normalize(10, 10)).toBeCloseTo(1.0, 10);
  });

  it("returns 1.0 when x exceeds cap (clamped)", () => {
    expect(normalize(100, 10)).toBeCloseTo(1.0, 10);
    expect(normalize(999, 5)).toBeCloseTo(1.0, 10);
  });

  it("handles fractional inputs correctly", () => {
    const expected = Math.log(1.5) / Math.log(2);
    expect(normalize(0.5, 1)).toBeCloseTo(expected, 10);
  });

  it("handles cap of 1 with x = 1", () => {
    expect(normalize(1, 1)).toBeCloseTo(1.0, 10);
  });

  it("handles large cap with small x", () => {
    const expected = Math.log(2) / Math.log(10001);
    expect(normalize(1, 10000)).toBeCloseTo(expected, 10);
  });

  it("returns a value between 0 and 1 for typical inputs", () => {
    const result = normalize(25, 200);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// clampScore(raw)
// ---------------------------------------------------------------------------

describe("clampScore", () => {
  it("returns the value unchanged when within 0–100", () => {
    expect(clampScore(50)).toBe(50);
  });

  it("clamps negative values to 0", () => {
    expect(clampScore(-10)).toBe(0);
  });

  it("clamps values above 100 to 100", () => {
    expect(clampScore(150)).toBe(100);
  });

  it("rounds fractional values", () => {
    expect(clampScore(75.6)).toBe(76);
  });

  it("returns 0 for input 0", () => {
    expect(clampScore(0)).toBe(0);
  });

  it("returns 100 for input 100", () => {
    expect(clampScore(100)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeConfidence(stats)
// ---------------------------------------------------------------------------

describe("computeConfidence", () => {
  it("returns 100 with no penalties when all flags are clear", () => {
    const { confidence, penalties } = computeConfidence(makeStats());
    expect(confidence).toBe(100);
    expect(penalties).toHaveLength(0);
  });

  // --- burst_activity ---
  describe("burst_activity flag", () => {
    it("applies -15 when maxCommitsIn10Min >= 20", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ maxCommitsIn10Min: 20 }),
      );
      expect(confidence).toBe(85);
      expect(penalties).toHaveLength(1);
      expect(penalties[0]!.flag).toBe("burst_activity");
      expect(penalties[0]!.penalty).toBe(15);
    });

    it("does NOT apply when maxCommitsIn10Min is 19", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ maxCommitsIn10Min: 19 }),
      );
      expect(confidence).toBe(100);
      expect(penalties.find((p) => p.flag === "burst_activity")).toBeUndefined();
    });
  });

  // --- micro_commit_pattern ---
  describe("micro_commit_pattern flag", () => {
    it("applies -10 when microCommitRatio >= 0.6", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ microCommitRatio: 0.6 }),
      );
      expect(confidence).toBe(90);
      expect(penalties).toHaveLength(1);
      expect(penalties[0]!.flag).toBe("micro_commit_pattern");
      expect(penalties[0]!.penalty).toBe(10);
    });

    it("does NOT apply when microCommitRatio is 0.59", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ microCommitRatio: 0.59 }),
      );
      expect(confidence).toBe(100);
      expect(
        penalties.find((p) => p.flag === "micro_commit_pattern"),
      ).toBeUndefined();
    });

    it("does NOT apply when microCommitRatio is undefined", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ microCommitRatio: undefined }),
      );
      expect(confidence).toBe(100);
      expect(
        penalties.find((p) => p.flag === "micro_commit_pattern"),
      ).toBeUndefined();
    });
  });

  // --- generated_change_pattern ---
  describe("generated_change_pattern flag", () => {
    it("applies -15 when total lines >= 20000 AND reviews <= 2", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({
          linesAdded: 15000,
          linesDeleted: 5000,
          reviewsSubmittedCount: 2,
        }),
      );
      expect(confidence).toBe(85);
      expect(penalties).toHaveLength(1);
      expect(penalties[0]!.flag).toBe("generated_change_pattern");
      expect(penalties[0]!.penalty).toBe(15);
    });

    it("does NOT apply when total lines < 20000", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({
          linesAdded: 10000,
          linesDeleted: 9999,
          reviewsSubmittedCount: 0,
        }),
      );
      expect(
        penalties.find((p) => p.flag === "generated_change_pattern"),
      ).toBeUndefined();
      expect(confidence).toBe(100);
    });

    it("does NOT apply when reviews > 2 even with high lines", () => {
      const { confidence } = computeConfidence(
        makeStats({
          linesAdded: 20000,
          linesDeleted: 5000,
          reviewsSubmittedCount: 3,
        }),
      );
      expect(confidence).toBe(100);
    });
  });

  // --- low_collaboration_signal ---
  describe("low_collaboration_signal flag", () => {
    it("applies -10 when PRs >= 10 AND reviews <= 1", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ prsMergedCount: 10, reviewsSubmittedCount: 1 }),
      );
      expect(confidence).toBe(90);
      expect(penalties).toHaveLength(1);
      expect(penalties[0]!.flag).toBe("low_collaboration_signal");
      expect(penalties[0]!.penalty).toBe(10);
    });

    it("does NOT apply when PRs < 10", () => {
      const { penalties } = computeConfidence(
        makeStats({ prsMergedCount: 9, reviewsSubmittedCount: 0 }),
      );
      expect(
        penalties.find((p) => p.flag === "low_collaboration_signal"),
      ).toBeUndefined();
    });

    it("does NOT apply when reviews > 1", () => {
      const { penalties } = computeConfidence(
        makeStats({ prsMergedCount: 20, reviewsSubmittedCount: 2 }),
      );
      expect(
        penalties.find((p) => p.flag === "low_collaboration_signal"),
      ).toBeUndefined();
    });
  });

  // --- single_repo_concentration ---
  describe("single_repo_concentration flag", () => {
    it("applies -5 when topRepoShare >= 0.95 AND repos <= 1", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ topRepoShare: 0.95, reposContributed: 1 }),
      );
      expect(confidence).toBe(95);
      expect(penalties).toHaveLength(1);
      expect(penalties[0]!.flag).toBe("single_repo_concentration");
      expect(penalties[0]!.penalty).toBe(5);
    });

    it("does NOT apply when topRepoShare < 0.95", () => {
      const { penalties } = computeConfidence(
        makeStats({ topRepoShare: 0.94, reposContributed: 1 }),
      );
      expect(
        penalties.find((p) => p.flag === "single_repo_concentration"),
      ).toBeUndefined();
    });

    it("does NOT apply when repos > 1 even with high topRepoShare", () => {
      const { penalties } = computeConfidence(
        makeStats({ topRepoShare: 1.0, reposContributed: 2 }),
      );
      expect(
        penalties.find((p) => p.flag === "single_repo_concentration"),
      ).toBeUndefined();
    });
  });

  // --- supplemental_unverified ---
  describe("supplemental_unverified flag", () => {
    it("applies -5 when hasSupplementalData is true", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ hasSupplementalData: true }),
      );
      expect(confidence).toBe(95);
      expect(penalties).toHaveLength(1);
      expect(penalties[0]!.flag).toBe("supplemental_unverified");
      expect(penalties[0]!.penalty).toBe(5);
    });

    it("does NOT apply when hasSupplementalData is false", () => {
      const { penalties } = computeConfidence(
        makeStats({ hasSupplementalData: false }),
      );
      expect(
        penalties.find((p) => p.flag === "supplemental_unverified"),
      ).toBeUndefined();
    });

    it("does NOT apply when hasSupplementalData is undefined", () => {
      const { penalties } = computeConfidence(
        makeStats({ hasSupplementalData: undefined }),
      );
      expect(
        penalties.find((p) => p.flag === "supplemental_unverified"),
      ).toBeUndefined();
    });
  });

  // --- low_activity_signal ---
  describe("low_activity_signal flag", () => {
    it("applies -10 when activeDays < 30 AND commitsTotal < 50", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ activeDays: 20, commitsTotal: 30 }),
      );
      expect(confidence).toBe(90);
      expect(penalties).toHaveLength(1);
      expect(penalties[0]!.flag).toBe("low_activity_signal");
      expect(penalties[0]!.penalty).toBe(10);
    });

    it("does NOT apply when activeDays >= 30", () => {
      const { penalties } = computeConfidence(
        makeStats({ activeDays: 30, commitsTotal: 10 }),
      );
      expect(
        penalties.find((p) => p.flag === "low_activity_signal"),
      ).toBeUndefined();
    });

    it("does NOT apply when commitsTotal >= 50", () => {
      const { penalties } = computeConfidence(
        makeStats({ activeDays: 10, commitsTotal: 50 }),
      );
      expect(
        penalties.find((p) => p.flag === "low_activity_signal"),
      ).toBeUndefined();
    });

    it("applies at boundary: activeDays=29, commitsTotal=49", () => {
      const { penalties } = computeConfidence(
        makeStats({ activeDays: 29, commitsTotal: 49 }),
      );
      expect(
        penalties.find((p) => p.flag === "low_activity_signal"),
      ).toBeDefined();
    });
  });

  // --- review_volume_imbalance ---
  describe("review_volume_imbalance flag", () => {
    it("applies -10 when reviews >= 50 AND prsMergedCount < 3", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ reviewsSubmittedCount: 50, prsMergedCount: 2 }),
      );
      expect(confidence).toBe(90);
      expect(penalties).toHaveLength(1);
      expect(penalties[0]!.flag).toBe("review_volume_imbalance");
      expect(penalties[0]!.penalty).toBe(10);
    });

    it("does NOT apply when reviews < 50", () => {
      const { penalties } = computeConfidence(
        makeStats({ reviewsSubmittedCount: 49, prsMergedCount: 0 }),
      );
      expect(
        penalties.find((p) => p.flag === "review_volume_imbalance"),
      ).toBeUndefined();
    });

    it("does NOT apply when prsMergedCount >= 3", () => {
      const { penalties } = computeConfidence(
        makeStats({ reviewsSubmittedCount: 100, prsMergedCount: 3 }),
      );
      expect(
        penalties.find((p) => p.flag === "review_volume_imbalance"),
      ).toBeUndefined();
    });

    it("is mutually exclusive with low_collaboration_signal", () => {
      // review_volume_imbalance requires reviews >= 50
      // low_collaboration_signal requires reviews <= 1
      // These cannot both be true simultaneously
      const { penalties } = computeConfidence(
        makeStats({ reviewsSubmittedCount: 50, prsMergedCount: 0 }),
      );
      const hasReviewImbalance = penalties.some(
        (p) => p.flag === "review_volume_imbalance",
      );
      const hasLowCollab = penalties.some(
        (p) => p.flag === "low_collaboration_signal",
      );
      expect(hasReviewImbalance && hasLowCollab).toBe(false);
    });
  });

  // --- all penalties stacked -> clamp to 50 ---
  it("clamps confidence to 50 when maximum penalties fire (7 simultaneous)", () => {
    const { confidence, penalties } = computeConfidence(
      makeStats({
        maxCommitsIn10Min: 30, // burst_activity: -15
        microCommitRatio: 0.9, // micro_commit_pattern: -10
        linesAdded: 25000, // generated_change_pattern: -15
        linesDeleted: 0, //   (25000 >= 20000)
        reviewsSubmittedCount: 0, //   (reviews <= 2 AND <= 1)
        prsMergedCount: 15, // low_collaboration_signal: -10
        topRepoShare: 1.0, // single_repo_concentration: -5
        reposContributed: 1, //   (repos <= 1)
        hasSupplementalData: true, // supplemental_unverified: -5
        activeDays: 10, // low_activity_signal: -10
        commitsTotal: 20, //   (activeDays < 30 AND commits < 50)
      }),
    );
    // Total penalties: 15 + 10 + 15 + 10 + 5 + 5 + 10 = 70
    // 100 - 70 = 30, clamped to 50
    // Note: review_volume_imbalance cannot fire here (reviews=0 < 50)
    expect(confidence).toBe(50);
    expect(penalties).toHaveLength(7);
  });

  it("includes reason strings on all penalties", () => {
    const { penalties } = computeConfidence(
      makeStats({
        maxCommitsIn10Min: 25,
        microCommitRatio: 0.8,
      }),
    );
    expect(penalties).toHaveLength(2);
    for (const p of penalties) {
      expect(p.reason).toBeTruthy();
      expect(typeof p.reason).toBe("string");
      expect(p.reason.length).toBeGreaterThan(10);
    }
  });

  // --- solo profile type ---
  describe("solo profile type", () => {
    it("skips low_collaboration_signal for solo profiles", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({ prsMergedCount: 15, reviewsSubmittedCount: 0 }),
        "solo",
      );
      expect(
        penalties.find((p) => p.flag === "low_collaboration_signal"),
      ).toBeUndefined();
      expect(confidence).toBe(100);
    });

    it("skips generated_change_pattern for solo profiles", () => {
      const { confidence, penalties } = computeConfidence(
        makeStats({
          linesAdded: 25000,
          linesDeleted: 5000,
          reviewsSubmittedCount: 0,
        }),
        "solo",
      );
      expect(
        penalties.find((p) => p.flag === "generated_change_pattern"),
      ).toBeUndefined();
      expect(confidence).toBe(100);
    });

    it("still applies burst_activity for solo profiles", () => {
      const { penalties } = computeConfidence(
        makeStats({ maxCommitsIn10Min: 25 }),
        "solo",
      );
      expect(penalties.find((p) => p.flag === "burst_activity")).toBeDefined();
    });

    it("still applies micro_commit_pattern for solo profiles", () => {
      const { penalties } = computeConfidence(
        makeStats({ microCommitRatio: 0.8 }),
        "solo",
      );
      expect(
        penalties.find((p) => p.flag === "micro_commit_pattern"),
      ).toBeDefined();
    });

    it("still applies single_repo_concentration for solo profiles", () => {
      const { penalties } = computeConfidence(
        makeStats({ topRepoShare: 1.0, reposContributed: 1 }),
        "solo",
      );
      expect(
        penalties.find((p) => p.flag === "single_repo_concentration"),
      ).toBeDefined();
    });

    it("still applies supplemental_unverified for solo profiles", () => {
      const { penalties } = computeConfidence(
        makeStats({ hasSupplementalData: true }),
        "solo",
      );
      expect(
        penalties.find((p) => p.flag === "supplemental_unverified"),
      ).toBeDefined();
    });

    it("defaults to collaborative when profileType is omitted", () => {
      // This should still apply low_collaboration_signal
      const { penalties } = computeConfidence(
        makeStats({ prsMergedCount: 15, reviewsSubmittedCount: 0 }),
      );
      expect(
        penalties.find((p) => p.flag === "low_collaboration_signal"),
      ).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// computeAdjustedScore(base, confidence)
// ---------------------------------------------------------------------------

describe("computeAdjustedScore", () => {
  it("returns 100 for perfect base and confidence", () => {
    expect(computeAdjustedScore(100, 100)).toBe(100);
  });

  it("returns 0 when base is 0 regardless of confidence", () => {
    expect(computeAdjustedScore(0, 100)).toBe(0);
    expect(computeAdjustedScore(0, 50)).toBe(0);
  });

  it("returns 93 for base=100, confidence=50", () => {
    // 100 * (0.85 + 0.15 * 0.5) = 100 * 0.925 = 92.5 -> round -> 93
    expect(computeAdjustedScore(100, 50)).toBe(93);
  });

  it("returns 50 for base=50, confidence=100", () => {
    // 50 * (0.85 + 0.15 * 1.0) = 50 * 1.0 = 50
    expect(computeAdjustedScore(50, 100)).toBe(50);
  });

  it("returns 46 for base=50, confidence=50", () => {
    // 50 * (0.85 + 0.15 * 0.5) = 50 * 0.925 = 46.25 -> round -> 46
    expect(computeAdjustedScore(50, 50)).toBe(46);
  });

  it("never exceeds 100", () => {
    expect(computeAdjustedScore(120, 100)).toBe(100);
  });

  it("never goes below 0", () => {
    expect(computeAdjustedScore(-10, 100)).toBe(0);
  });

  it("rounds correctly at .5 boundary (92.5 -> 93)", () => {
    expect(computeAdjustedScore(100, 50)).toBe(93);
  });

  it("handles confidence at minimum (50)", () => {
    // 80 * (0.85 + 0.15 * 0.5) = 80 * 0.925 = 74
    expect(computeAdjustedScore(80, 50)).toBe(74);
  });
});

// ---------------------------------------------------------------------------
// getTier(adjustedScore)
// ---------------------------------------------------------------------------

describe("getTier", () => {
  it("returns Emerging for score 0", () => {
    expect(getTier(0)).toBe("Emerging");
  });

  it("returns Emerging for score 39", () => {
    expect(getTier(39)).toBe("Emerging");
  });

  it("returns Solid for score 40 (boundary)", () => {
    expect(getTier(40)).toBe("Solid");
  });

  it("returns Solid for score 69", () => {
    expect(getTier(69)).toBe("Solid");
  });

  it("returns High for score 70 (boundary)", () => {
    expect(getTier(70)).toBe("High");
  });

  it("returns High for score 84", () => {
    expect(getTier(84)).toBe("High");
  });

  it("returns Elite for score 85 (boundary)", () => {
    expect(getTier(85)).toBe("Elite");
  });

  it("returns Elite for score 100", () => {
    expect(getTier(100)).toBe("Elite");
  });

  it("returns Emerging for negative score", () => {
    expect(getTier(-5)).toBe("Emerging");
  });

  it("returns Elite for score above 100", () => {
    expect(getTier(150)).toBe("Elite");
  });
});
