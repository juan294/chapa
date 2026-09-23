/**
 * Shared test fixtures — canonical factory functions for test data.
 *
 * Import from "../test-helpers/fixtures" (relative) in any test file.
 * Each factory returns a valid object with sensible defaults;
 * pass an `overrides` partial to customize only what the test cares about.
 */

import type { StatsData, ImpactV6Result } from "@chapa/shared";
import type { MetricsSnapshot } from "../history/types";
import type { ScoreViewModel } from "../profile/score-view-model";

// ---------------------------------------------------------------------------
// makeStats — builds a valid StatsData with sensible defaults
// ---------------------------------------------------------------------------

export function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return {
    handle: "testuser",
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
// makeFullStats — builds a StatsData with ALL fields populated (including optional)
// ---------------------------------------------------------------------------

/**
 * Factory that returns a StatsData with every field (required + optional)
 * populated with realistic nonzero values. Use in tests that need to detect
 * field loss through pipeline stages (merge, scoring, snapshot).
 */
export function makeFullStats(overrides: Partial<StatsData> = {}): StatsData {
  return {
    ...makeStats(),
    displayName: "Test User",
    avatarUrl: "https://example.com/avatar.png",
    microCommitRatio: 0.15,
    docsOnlyPrRatio: 0.1,
    prDescriptionRate: 0.8,
    featureBranchRate: 0.9,
    issueLinkageRate: 0.6,
    batchSizeScore: 0.65,
    medianPrLeadTimeHours: 12,
    hasSupplementalData: false,
    fetchScope: "authenticated",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeImpact — builds a valid ImpactV6Result with sensible defaults
// ---------------------------------------------------------------------------

export function makeImpact(
  overrides: Partial<ImpactV6Result> = {},
): ImpactV6Result {
  return {
    handle: "testuser",
    profileType: "collaborative",
    dimensions: {
      delivery: 72,
      quality: 55,
      consistency: 68,
      breadth: 48,
    },
    archetype: "Builder",
    compositeScore: 61,
    confidence: 85,
    confidencePenalties: [],
    adjustedComposite: 58,
    tier: "Solid",
    computedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeScoring — builds a valid v7.2 ScoreViewModel with sensible defaults
// ---------------------------------------------------------------------------

/**
 * #1335 — the v7.2-only counterpart to `makeImpact`. Every scored consumer
 * (Studio, dashboard, share page) now renders exactly this shape; a partial
 * override still needs its own `dimensions`/`composite` as whole `ScoreValue`
 * objects (`{ kind: "point", value, display }`), since those don't merge
 * field-by-field the way `overrides` does for the rest of the model.
 */
export function makeScoring(
  overrides: Partial<ScoreViewModel> = {},
): ScoreViewModel {
  const point = (value: number) => ({ kind: "point" as const, value, display: value });
  return {
    // Always a synthetic fixture, never a real issued receipt — matches the
    // one condition (identity or illustrative) simulateObservedScore
    // requires of its baseline.
    illustrative: true,
    policyVersion: "v7.2",
    handle: "testuser",
    identity: null,
    window: null,
    dimensions: {
      delivery: point(60),
      quality: point(70),
      consistency: point(80),
      breadth: point(50),
    },
    composite: point(65),
    tier: "Solid",
    archetype: "Builder",
    craft: null,
    reportCraft: { status: "no_report", unlocked: false, report: null },
    coverage: [],
    exclusions: [],
    limitations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeSnapshot — builds a valid MetricsSnapshot with sensible defaults
// ---------------------------------------------------------------------------

export function makeSnapshot(
  overrides: Partial<MetricsSnapshot> = {},
): MetricsSnapshot {
  return {
    date: "2025-06-15",
    capturedAt: "2025-06-15T14:30:00.000Z",
    commitsTotal: 150,
    prsMergedCount: 30,
    prsMergedWeight: 45,
    reviewsSubmittedCount: 20,
    issuesClosedCount: 10,
    reposContributed: 8,
    activeDays: 200,
    linesAdded: 5000,
    linesDeleted: 2000,
    totalStars: 100,
    totalForks: 25,
    totalWatchers: 50,
    topRepoShare: 0.4,
    maxCommitsIn10Min: 3,
    delivery: 75,
    quality: 60,
    consistency: 80,
    breadth: 55,
    archetype: "Builder",
    profileType: "collaborative",
    compositeScore: 67.5,
    adjustedComposite: 60.75,
    confidence: 90,
    tier: "High",
    ...overrides,
  };
}
