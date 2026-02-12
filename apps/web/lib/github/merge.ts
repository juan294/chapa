import type { StatsData, HeatmapDay } from "@chapa/shared";
import { PR_WEIGHT_AGG_CAP } from "@chapa/shared";

/**
 * Merge primary GitHub stats with supplemental stats (e.g. from an EMU account).
 *
 * Rules:
 * - Numeric counts: summed
 * - prsMergedWeight: summed, capped at PR_WEIGHT_AGG_CAP (120)
 * - heatmapData: merged by date (same date → sum counts), sorted chronologically
 * - activeDays: recomputed from merged heatmap
 * - topRepoShare: approximated — max(P*shareP, S*shareS) / (P+S)
 * - maxCommitsIn10Min: max of both
 * - microCommitRatio / docsOnlyPrRatio: max of both (if defined)
 * - Identity fields (handle, displayName, avatarUrl, fetchedAt): kept from primary
 * - Sets hasSupplementalData: true
 */
export function mergeStats(
  primary: StatsData,
  supplemental: StatsData,
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
    docsOnlyPrRatio: mergeOptionalMax(primary.docsOnlyPrRatio, supplemental.docsOnlyPrRatio),
    heatmapData: mergedHeatmap,
    hasSupplementalData: true,
  };
}

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

function mergeOptionalMax(
  a: number | undefined,
  b: number | undefined,
): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}
