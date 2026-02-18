import { describe, it, expect } from "vitest";
import { isSignificantChange } from "./significant-change";
import type { SnapshotDiff } from "./diff";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDiff(overrides: Partial<SnapshotDiff> = {}): SnapshotDiff {
  return {
    direction: "stable",
    daysBetween: 1,
    compositeScore: 0,
    adjustedComposite: 0,
    confidence: 0,
    dimensions: { building: 0, guarding: 0, consistency: 0, breadth: 0 },
    stats: {
      commitsTotal: 0,
      prsMergedCount: 0,
      prsMergedWeight: 0,
      reviewsSubmittedCount: 0,
      issuesClosedCount: 0,
      reposContributed: 0,
      activeDays: 0,
      linesAdded: 0,
      linesDeleted: 0,
      totalStars: 0,
      totalForks: 0,
      totalWatchers: 0,
      topRepoShare: 0,
    },
    archetype: null,
    tier: null,
    profileType: null,
    penaltyChanges: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("isSignificantChange", () => {
  describe("insignificant changes", () => {
    it("returns insignificant for no change", () => {
      const result = isSignificantChange(makeDiff());
      expect(result.significant).toBe(false);
    });

    it("returns insignificant for small score increase (<5)", () => {
      const result = isSignificantChange(makeDiff({ adjustedComposite: 4.9 }));
      expect(result.significant).toBe(false);
    });

    it("returns insignificant for score decrease", () => {
      const result = isSignificantChange(makeDiff({ adjustedComposite: -10 }));
      expect(result.significant).toBe(false);
    });

    it("returns insignificant for zero delta", () => {
      const result = isSignificantChange(makeDiff({ adjustedComposite: 0 }));
      expect(result.significant).toBe(false);
    });
  });

  describe("tier change", () => {
    it("detects tier change as significant", () => {
      const result = isSignificantChange(
        makeDiff({ tier: { from: "Solid", to: "High" } }),
      );
      expect(result.significant).toBe(true);
      if (result.significant) {
        expect(result.reason).toBe("tier_change");
        expect(result.allReasons).toContain("tier_change");
      }
    });

    it("detects tier downgrade as significant", () => {
      const result = isSignificantChange(
        makeDiff({ tier: { from: "High", to: "Solid" } }),
      );
      expect(result.significant).toBe(true);
      if (result.significant) {
        expect(result.reason).toBe("tier_change");
      }
    });
  });

  describe("archetype change", () => {
    it("detects archetype change as significant", () => {
      const result = isSignificantChange(
        makeDiff({ archetype: { from: "Balanced", to: "Builder" } }),
      );
      expect(result.significant).toBe(true);
      if (result.significant) {
        expect(result.reason).toBe("archetype_change");
        expect(result.allReasons).toContain("archetype_change");
      }
    });
  });

  describe("score bump", () => {
    it("detects score bump exactly at threshold", () => {
      const result = isSignificantChange(makeDiff({ adjustedComposite: 5 }));
      expect(result.significant).toBe(true);
      if (result.significant) {
        expect(result.reason).toBe("score_bump");
      }
    });

    it("detects large score bump", () => {
      const result = isSignificantChange(makeDiff({ adjustedComposite: 15 }));
      expect(result.significant).toBe(true);
      if (result.significant) {
        expect(result.reason).toBe("score_bump");
      }
    });
  });

  describe("priority ordering", () => {
    it("tier_change takes priority over archetype_change and score_bump", () => {
      const result = isSignificantChange(
        makeDiff({
          tier: { from: "Solid", to: "High" },
          archetype: { from: "Balanced", to: "Builder" },
          adjustedComposite: 10,
        }),
      );
      expect(result.significant).toBe(true);
      if (result.significant) {
        expect(result.reason).toBe("tier_change");
        expect(result.allReasons).toEqual([
          "tier_change",
          "archetype_change",
          "score_bump",
        ]);
      }
    });

    it("archetype_change takes priority over score_bump", () => {
      const result = isSignificantChange(
        makeDiff({
          archetype: { from: "Guardian", to: "Polymath" },
          adjustedComposite: 8,
        }),
      );
      expect(result.significant).toBe(true);
      if (result.significant) {
        expect(result.reason).toBe("archetype_change");
        expect(result.allReasons).toEqual(["archetype_change", "score_bump"]);
      }
    });

    it("includes all reasons that fired", () => {
      const result = isSignificantChange(
        makeDiff({
          tier: { from: "Emerging", to: "Solid" },
          adjustedComposite: 6,
        }),
      );
      expect(result.significant).toBe(true);
      if (result.significant) {
        expect(result.allReasons).toEqual(["tier_change", "score_bump"]);
      }
    });
  });
});
