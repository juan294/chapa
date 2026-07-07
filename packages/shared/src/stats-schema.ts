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
