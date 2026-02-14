import { describe, it, expect } from "vitest";
import type { StatsData, ConfidenceFlag } from "@chapa/shared";
import { computeConfidence } from "./utils";

// ---------------------------------------------------------------------------
// Accusatory language blocklist — words that must NEVER appear in penalty
// reason strings. Confidence messaging must be neutral and non-judgmental.
// ---------------------------------------------------------------------------

const ACCUSATORY_WORDS = [
  "cheating",
  "cheat",
  "cheated",
  "fake",
  "faked",
  "faking",
  "suspicious",
  "suspect",
  "fraud",
  "fraudulent",
  "gaming",
  "gamed",
  "manipulation",
  "manipulated",
  "manipulating",
  "abuse",
  "abused",
  "abusing",
  "dishonest",
  "deceptive",
  "deception",
  "misleading",
  "inflated",
  "inflate",
  "illegitimate",
  "wrongdoing",
  "exploit",
  "exploiting",
  "exploited",
  "spam",
  "spamming",
  "spammed",
  "bot",
  "botted",
  "botting",
  "artificial",
  "fabricated",
  "fabricating",
  "padding",
  "padded",
];

// ---------------------------------------------------------------------------
// Neutral language allowlist — at least one of these should appear in each
// penalty reason to confirm the tone is descriptive rather than judgmental.
// ---------------------------------------------------------------------------

const NEUTRAL_WORDS = [
  "reduces",
  "reduced",
  "limited",
  "concentrated",
  "appears",
  "detected",
  "signals",
  "signal",
  "confidence",
  "clarity",
  "period",
  "activity",
  "linked",
  "independently",
  "verified",
  "volume",
  "bursts",
  "small",
  "changes",
  "review",
  "repo",
  "cross-repo",
  "account",
];

// ---------------------------------------------------------------------------
// Helper: trigger each penalty flag individually
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

const PENALTY_TRIGGERS: Record<ConfidenceFlag, Partial<StatsData>> = {
  burst_activity: { maxCommitsIn10Min: 25 },
  micro_commit_pattern: { microCommitRatio: 0.8 },
  generated_change_pattern: {
    linesAdded: 25000,
    linesDeleted: 0,
    reviewsSubmittedCount: 0,
  },
  low_collaboration_signal: {
    prsMergedCount: 15,
    reviewsSubmittedCount: 0,
  },
  single_repo_concentration: {
    topRepoShare: 1.0,
    reposContributed: 1,
  },
  supplemental_unverified: {
    hasSupplementalData: true,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Non-accusatory confidence messaging", () => {
  const allFlags = Object.keys(PENALTY_TRIGGERS) as ConfidenceFlag[];

  describe("no accusatory language in any penalty reason", () => {
    for (const flag of allFlags) {
      it(`"${flag}" reason contains no accusatory words`, () => {
        const { penalties } = computeConfidence(
          makeStats(PENALTY_TRIGGERS[flag]),
        );
        const penalty = penalties.find((p) => p.flag === flag);
        expect(penalty).toBeDefined();

        const reason = penalty!.reason.toLowerCase();
        for (const word of ACCUSATORY_WORDS) {
          expect(reason).not.toContain(word);
        }
      });
    }
  });

  describe("all penalty reasons use neutral, descriptive language", () => {
    for (const flag of allFlags) {
      it(`"${flag}" reason contains at least one neutral word`, () => {
        const { penalties } = computeConfidence(
          makeStats(PENALTY_TRIGGERS[flag]),
        );
        const penalty = penalties.find((p) => p.flag === flag);
        expect(penalty).toBeDefined();

        const reason = penalty!.reason.toLowerCase();
        const hasNeutralWord = NEUTRAL_WORDS.some((word) =>
          reason.includes(word),
        );
        expect(hasNeutralWord).toBe(true);
      });
    }
  });

  it("all 6 confidence flags are covered by this test", () => {
    expect(allFlags).toHaveLength(6);
    expect(allFlags).toEqual(
      expect.arrayContaining([
        "burst_activity",
        "micro_commit_pattern",
        "generated_change_pattern",
        "low_collaboration_signal",
        "single_repo_concentration",
        "supplemental_unverified",
      ]),
    );
  });

  it("every penalty reason is a non-empty string", () => {
    for (const flag of allFlags) {
      const { penalties } = computeConfidence(
        makeStats(PENALTY_TRIGGERS[flag]),
      );
      const penalty = penalties.find((p) => p.flag === flag);
      expect(penalty).toBeDefined();
      expect(typeof penalty!.reason).toBe("string");
      expect(penalty!.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("penalty reasons end with a period", () => {
    for (const flag of allFlags) {
      const { penalties } = computeConfidence(
        makeStats(PENALTY_TRIGGERS[flag]),
      );
      const penalty = penalties.find((p) => p.flag === flag);
      expect(penalty).toBeDefined();
      expect(penalty!.reason.trimEnd()).toMatch(/\.$/);
    }
  });

  it("penalty reasons use parenthetical softening where appropriate", () => {
    // The single_repo_concentration reason uses parenthetical softening:
    // "(not bad — just less cross-repo signal)"
    const { penalties } = computeConfidence(
      makeStats(PENALTY_TRIGGERS.single_repo_concentration),
    );
    const penalty = penalties.find(
      (p) => p.flag === "single_repo_concentration",
    );
    expect(penalty).toBeDefined();
    expect(penalty!.reason).toContain("not bad");
  });
});
