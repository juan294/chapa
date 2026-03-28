import type { StatsData, HeatmapDay } from "@chapa/shared";
import { PR_WEIGHT_AGG_CAP } from "@chapa/shared";

/**
 * Merge primary GitHub stats with supplemental stats (e.g. from an EMU account).
 *
 * Merge strategy per field:
 * - Numeric counts (commits, PRs, reviews, issues, lines, repos): summed.
 * - `prsMergedWeight`: summed, then capped at {@link PR_WEIGHT_AGG_CAP} (120).
 * - `heatmapData`: merged by date via {@link mergeHeatmap} (same date sums counts), sorted chronologically.
 * - `activeDays`: recomputed from the merged heatmap (count of days with count > 0).
 * - `topRepoShare`: approximated — `max(P * shareP, S * shareS) / (P + S)`.
 * - `maxCommitsIn10Min`: max of both.
 * - `microCommitRatio` / `docsOnlyPrRatio`: max of both (if defined) via {@link mergeOptionalMax}.
 * - `totalStars` / `totalForks` / `totalWatchers`: max of both (vanity metrics may overlap across accounts).
 * - Identity fields (`handle`, `displayName`, `avatarUrl`, `fetchedAt`): kept from primary.
 * - `hasSupplementalData`: set to `true` (controllable via `options.markAsSupplemental`).
 *
 * @param primary - The user's primary GitHub stats (identity fields are preserved from here)
 * @param supplemental - The supplemental stats to merge in (e.g. EMU / secondary account)
 * @param options - Optional merge configuration
 * @param options.markAsSupplemental - Whether to set `hasSupplementalData` on the result (default: `true`)
 * @returns A new `StatsData` object combining both sources — never mutates inputs
 */
export function mergeStats(
  primary: StatsData,
  supplemental: StatsData,
  options?: { markAsSupplemental?: boolean },
): StatsData {
  const mergedHeatmap = mergeHeatmap(primary.heatmapData, supplemental.heatmapData);
  const activeDays = mergedHeatmap.filter((d) => d.count > 0).length;

  const totalCommits = primary.commitsTotal + supplemental.commitsTotal;
  const topRepoShare =
    totalCommits > 0
      ? Math.max(
          primary.commitsTotal * primary.topRepoShare,
          supplemental.commitsTotal * supplemental.topRepoShare,
        ) / totalCommits
      : 0;

  return {
    handle: primary.handle,
    displayName: primary.displayName,
    avatarUrl: primary.avatarUrl,
    fetchedAt: primary.fetchedAt,
    commitsTotal: totalCommits,
    activeDays,
    prsMergedCount: primary.prsMergedCount + supplemental.prsMergedCount,
    prsMergedWeight: Math.min(primary.prsMergedWeight + supplemental.prsMergedWeight, PR_WEIGHT_AGG_CAP),
    reviewsSubmittedCount: primary.reviewsSubmittedCount + supplemental.reviewsSubmittedCount,
    issuesClosedCount: primary.issuesClosedCount + supplemental.issuesClosedCount,
    linesAdded: primary.linesAdded + supplemental.linesAdded,
    linesDeleted: primary.linesDeleted + supplemental.linesDeleted,
    reposContributed: primary.reposContributed + supplemental.reposContributed,
    topRepoShare,
    totalStars: Math.max(primary.totalStars, supplemental.totalStars),
    totalForks: Math.max(primary.totalForks, supplemental.totalForks),
    totalWatchers: Math.max(primary.totalWatchers, supplemental.totalWatchers),
    maxCommitsIn10Min: Math.max(primary.maxCommitsIn10Min, supplemental.maxCommitsIn10Min),
    microCommitRatio: mergeOptionalMax(primary.microCommitRatio, supplemental.microCommitRatio),
    batchSizeScore: mergeOptionalWeightedAvg(
      primary.batchSizeScore, primary.prsMergedCount,
      supplemental.batchSizeScore, supplemental.prsMergedCount,
    ),
    docsOnlyPrRatio: mergeOptionalMax(primary.docsOnlyPrRatio, supplemental.docsOnlyPrRatio),
    heatmapData: mergedHeatmap,
    hasSupplementalData: options?.markAsSupplemental ?? true,
  };
}

/**
 * Merge two heatmap arrays by date.
 *
 * When both arrays contain the same date, their counts are summed.
 * The result is sorted chronologically by date string (lexicographic, which
 * works correctly for ISO date format YYYY-MM-DD).
 *
 * @param a - First heatmap array (typically the primary account)
 * @param b - Second heatmap array (typically the supplemental account)
 * @returns A new deduplicated, chronologically sorted heatmap array
 */
function mergeHeatmap(a: HeatmapDay[], b: HeatmapDay[]): HeatmapDay[] {
  const map = new Map<string, number>();
  for (const day of a) {
    map.set(day.date, (map.get(day.date) ?? 0) + day.count);
  }
  for (const day of b) {
    map.set(day.date, (map.get(day.date) ?? 0) + day.count);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Merge two optional numeric values by taking the maximum.
 *
 * Returns `undefined` only when both inputs are `undefined`. When one side
 * is defined and the other is not, the defined value is returned as-is.
 * This is used for ratio fields (`microCommitRatio`, `docsOnlyPrRatio`)
 * where the worst-case (highest) value across accounts is the most
 * representative signal.
 *
 * @param a - First optional value
 * @param b - Second optional value
 * @returns The maximum of the defined values, or `undefined` if both are absent
 */
function mergeOptionalMax(
  a: number | undefined,
  b: number | undefined,
): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

/**
 * Merge two optional ratio values by weighted average (by count).
 *
 * Used for ratio fields like `batchSizeScore` where the value should be
 * averaged across platforms proportional to the number of items (PRs)
 * each platform contributed.
 */
function mergeOptionalWeightedAvg(
  aVal: number | undefined, aCount: number,
  bVal: number | undefined, bCount: number,
): number | undefined {
  if (aVal === undefined && bVal === undefined) return undefined;
  const totalCount = aCount + bCount;
  if (totalCount === 0) return undefined;
  const aContrib = (aVal ?? 0) * aCount;
  const bContrib = (bVal ?? 0) * bCount;
  return (aContrib + bContrib) / totalCount;
}
