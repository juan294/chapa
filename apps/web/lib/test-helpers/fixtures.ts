/**
 * Shared test fixtures — canonical factory functions for test data.
 *
 * Import from "../test-helpers/fixtures" (relative) in any test file.
 * Each factory returns a valid object with sensible defaults;
 * pass an `overrides` partial to customize only what the test cares about.
 */

import type { StatsData, ImpactV4Result } from "@chapa/shared";
import type { MetricsSnapshot } from "../history/types";

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
// makeImpact — builds a valid ImpactV4Result with sensible defaults
// ---------------------------------------------------------------------------

export function makeImpact(
  overrides: Partial<ImpactV4Result> = {},
): ImpactV4Result {
  return {
    handle: "testuser",
    profileType: "collaborative",
    dimensions: {
      building: 72,
      guarding: 55,
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
    building: 75,
    guarding: 60,
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
