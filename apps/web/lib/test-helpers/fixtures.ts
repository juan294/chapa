/**
 * Shared test fixtures — canonical factory functions for test data.
 *
 * Import from "../test-helpers/fixtures" (relative) in any test file.
 * Each factory returns a valid object with sensible defaults;
 * pass an `overrides` partial to customize only what the test cares about.
 */

import type { StatsData, ImpactV6Result } from "@chapa/shared";
import { SCORING_OBSERVED_POLICY } from "@chapa/shared";
import type { MetricsSnapshot } from "../history/types";
import type { CoreDimensionKey, ScoreValue, ScoreViewModel } from "../profile/score-view-model";

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

const REPORT_CRAFT_REF = "00000000-0000-4000-8000-000000000103";
const REPORT_CRAFT_PERIOD = { startInclusive: "2026-08-01T00:00:00.000Z", endExclusive: "2026-09-01T00:00:00.000Z" };

/** A "scored" `reportCraft` at the given displayed value — the shape
 * `renderBadgeSvg`'s pentagon-radar branch reads (`model.reportCraft.status
 * === "scored"`), not a `dimensions.craft` field (the core dimensions are
 * always exactly `CORE_DIMENSION_KEYS`, #1335 phase 5). */
function makeReportCraft(displayValue: number): ScoreViewModel["reportCraft"] {
  return {
    status: "scored",
    unlocked: true,
    report: {
      reportRef: REPORT_CRAFT_REF,
      supersedesReportRef: null,
      inputs: {
        policyVersion: "v7.2",
        classifierRevision: "cc-outcomes-v7.2",
        window: { referenceTime: "2026-09-01T00:00:00.000Z", referenceDate: "2026-09-01", startInclusive: "2025-09-02T00:00:00.000Z", endExclusive: "2026-09-02T00:00:00.000Z", calendarDays: 365 },
        reportPeriod: REPORT_CRAFT_PERIOD,
        totalSessions: 20,
        outcomes: { fully_achieved: 14, mostly_achieved: 4, partially_achieved: 1, not_achieved: 1 },
        unknownSessions: 0,
        unclassifiedSessions: 0,
      },
      result: {
        status: "scored",
        unlocked: true,
        provenance: "report_derived",
        assessment: "model_estimate",
        reportPeriod: REPORT_CRAFT_PERIOD,
        point: { kind: "point", exact: displayValue, displayValue, displayLabel: String(displayValue) },
        trace: {
          outcomeCredits: SCORING_OBSERVED_POLICY.reportCraft.outcomeCredits,
          creditedSessions: 18, recognizedSessions: 19, totalSessions: 20,
          unknownSessions: 0, unclassifiedSessions: 0, recognizedCoverage: 0.95, exact: displayValue,
        },
      },
    },
  };
}

/** A plain number is treated as a point's displayed value; a pre-built
 * `ScoreValue` (e.g. a range, or one copied from another model's output) is
 * kept as-is. Callers use whichever is more convenient for their case. */
function toScoreValue(value: number | ScoreValue): ScoreValue {
  return typeof value === "number" ? { kind: "point", value, display: value } : value;
}

/**
 * Factory for a v7.2 `ScoreViewModel` (#1335 phase 5 — "delete v6").
 * `renderBadgeSvg` and every other scored consumer take this model, never a
 * legacy `ImpactV6Result` — this fixture matches `makeImpact`'s historical
 * default magnitudes (dimensions 72/55/68/48, archetype Builder, tier Solid)
 * so tests written against the old aggregate keep the same drawn geometry.
 * `composite` defaults to 58 — the historical `adjustedComposite` value the
 * badge actually drew (v6's raw `compositeScore` was never rendered).
 *
 * `composite` and each `dimensions` entry accept either a plain number
 * (wrapped as a point's displayed value — the common case, one magnitude at
 * a time) or a whole `ScoreValue` (a range, or a value copied from another
 * fixture's output), so both calling styles used across the suite work
 * without a caller-side conversion:
 * - `composite`: a point composite's displayed value, or a `ScoreValue`.
 * - `dimensions`: a partial map of numbers and/or `ScoreValue`s, merged over
 *   the defaults.
 * - `craftDisplay`: builds a "scored" `reportCraft` at this displayed value
 *   (undefined leaves the default "no_report" — no Craft axis). A caller
 *   that needs a specific custom `reportCraft` (not just one displayed
 *   value) passes `reportCraft` directly through the rest of `overrides`.
 */
export function makeScoring(
  overrides: Partial<Omit<ScoreViewModel, "dimensions" | "composite" | "reportCraft">> & {
    composite?: number | ScoreValue;
    dimensions?: Partial<Record<CoreDimensionKey, number | ScoreValue>>;
    craftDisplay?: number;
  } = {},
): ScoreViewModel {
  const { composite, dimensions, craftDisplay, ...rest } = overrides;
  const defaultDimensions: Record<CoreDimensionKey, number> = {
    delivery: 72,
    quality: 55,
    consistency: 68,
    breadth: 48,
  };
  const mergedDimensions = { ...defaultDimensions, ...dimensions };
  return {
    // Always a synthetic fixture, never a real issued receipt — matches the
    // one condition (identity or illustrative) simulateObservedScore
    // requires of its baseline.
    illustrative: true,
    policyVersion: "v7.2",
    handle: "testuser",
    identity: null,
    window: null,
    dimensions: Object.fromEntries(
      Object.entries(mergedDimensions).map(([key, value]) => [key, toScoreValue(value)]),
    ) as Record<CoreDimensionKey, ScoreValue>,
    composite: toScoreValue(composite ?? 58),
    tier: "Solid",
    archetype: "Builder",
    craft: null,
    reportCraft: craftDisplay === undefined ? { status: "no_report", unlocked: false, report: null } : makeReportCraft(craftDisplay),
    freshness: "current",
    coverage: [],
    exclusions: [],
    limitations: [],
    ...rest,
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
