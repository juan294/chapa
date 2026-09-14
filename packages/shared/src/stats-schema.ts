import { countBounds, type CountBounds, type CoreCountInputs, type CoreScoringInputs } from "./scoring-evidence";
import { createScoringWindow, type ScoringWindow } from "./scoring-window";
import type { StatsData } from "./types";

/**
 * Canonical list of all StatsData field names.
 * TypeScript enforces this stays in sync with the interface via `satisfies`.
 * If you add a field to StatsData, add it here — or the build breaks.
 */
const _STATS_DATA_KEYS = [
  "handle",
  "displayName",
  "avatarUrl",
  "commitsTotal",
  "activeDays",
  "prsMergedCount",
  "prsMergedWeight",
  "reviewsSubmittedCount",
  "primaryReviewsSubmittedCount",
  "issuesClosedCount",
  "linesAdded",
  "linesDeleted",
  "reposContributed",
  "topRepoShare",
  "maxCommitsIn10Min",
  "microCommitRatio",
  "batchSizeScore",
  "medianPrLeadTimeHours",
  "docsOnlyPrRatio",
  "prDescriptionRate",
  "featureBranchRate",
  "issueLinkageRate",
  "totalStars",
  "totalForks",
  "totalWatchers",
  "heatmapData",
  "fetchedAt",
  "hasSupplementalData",
  "linkedPlatforms",
  "linkedPlatformLogins",
  "fetchScope",
] as const satisfies readonly (keyof StatsData)[];

export const STATS_DATA_KEYS: readonly string[] = _STATS_DATA_KEYS;

/** Fields that are set by client.ts after merge (not by mergeStats itself) */
export const CLIENT_INJECTED_KEYS: readonly string[] = [
  "hasSupplementalData",
  "linkedPlatforms",
  "linkedPlatformLogins",
] as const;

/** Fields expected in mergeStats output */
export const MERGE_EXPECTED_KEYS: readonly string[] = STATS_DATA_KEYS.filter(
  (k) => !CLIENT_INJECTED_KEYS.includes(k),
);

/** Explicit v7 projection: extra metadata cannot enter arithmetic inputs or public replay JSON. */
export function createCoreScoringInputs(window: ScoringWindow, counts: CoreCountInputs): CoreScoringInputs {
  const canonicalWindow = createScoringWindow(window.referenceTime);
  if (window.referenceDate !== canonicalWindow.referenceDate || window.startInclusive !== canonicalWindow.startInclusive ||
    window.endExclusive !== canonicalWindow.endExclusive || window.calendarDays !== 365) {
    throw new RangeError("Inconsistent scoring reference context");
  }
  const copyBounds = (bounds: CountBounds): CountBounds => countBounds(bounds.lower, bounds.upper);
  return {
    policyVersion: "v7", window: canonicalWindow,
    counts: {
      deliveryUnits: copyBounds(counts.deliveryUnits),
      quality: {
        rationale: copyBounds(counts.quality.rationale), verification: copyBounds(counts.quality.verification),
        review_or_correction: copyBounds(counts.quality.review_or_correction), outcome_followup: copyBounds(counts.quality.outcome_followup),
      },
      activeIsoWeeks: copyBounds(counts.activeIsoWeeks), eligibleProjects: copyBounds(counts.eligibleProjects),
      eligibleCategories: copyBounds(counts.eligibleCategories),
    },
  };
}
