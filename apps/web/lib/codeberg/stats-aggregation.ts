import type { HeatmapDay, StatsData } from "@chapa/shared";
import { computePlatformStats, computePrWeight, PR_WEIGHT_AGG_CAP } from "@chapa/shared";
import type { RawCodebergData } from "./types";
import { toDateString } from "@/lib/utils/date";

/**
 * Transform raw Codeberg data into a StatsData object.
 * Pure function — mirrors buildStatsFromBitbucket() for Bitbucket data.
 *
 * Platform-specific steps handled here:
 *   1. Heatmap construction from Unix timestamp entries
 *      ({timestamp, contributions}) → {date: "YYYY-MM-DD", count}
 *      Aggregates multiple timestamps mapping to the same date.
 *   2. commitsTotal: sum of heatmap contribution counts
 *   4. PR diffstat: additions/deletions/changed_files inline on Codeberg PRs
 *   5. Review counting: raw.reviews.length (already filtered in queries layer)
 *   6. issuesClosedCount passthrough
 *  10. Social metrics: all available (stars, forks, watchers)
 *
 * Invariant steps (active days, repo depth, top-repo share, maxCommitsIn10Min)
 * are delegated to computePlatformStats().
 */
export function buildStatsFromCodeberg(raw: RawCodebergData): StatsData {
  // 1. Build heatmap from native data
  //    Convert {timestamp, contributions} → {date: "YYYY-MM-DD", count}
  //    Aggregate by date (multiple timestamps can map to same date)
  const heatmapMap = new Map<string, number>();
  for (const entry of raw.heatmap) {
    const date = toDateString(new Date(entry.timestamp * 1000));
    heatmapMap.set(date, (heatmapMap.get(date) ?? 0) + entry.contributions);
  }
  const heatmapData: HeatmapDay[] = Array.from(heatmapMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // 2. Commit count from heatmap totals
  const commitsTotal = heatmapData.reduce((sum, d) => sum + d.count, 0);

  // 4. PR metrics — additions/deletions/changedFiles are inline on Codeberg PRs
  const prsMergedCount = raw.mergedPRs.length;
  let prsMergedWeight = 0;
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const pr of raw.mergedPRs) {
    linesAdded += pr.additions;
    linesDeleted += pr.deletions;
    prsMergedWeight += computePrWeight({
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
    });
  }
  prsMergedWeight = Math.min(prsMergedWeight, PR_WEIGHT_AGG_CAP);

  // 5. Reviews — already filtered in queries layer
  const reviewsSubmittedCount = raw.reviews.length;

  // 6. Issues closed
  const issuesClosedCount = raw.closedIssues;

  // 10. Social metrics — all available on Codeberg (unlike Bitbucket)
  const ownedRepos = raw.repos.filter((r) => r.isOwned);
  const totalStars = ownedRepos.reduce((sum, r) => sum + r.starsCount, 0);
  const totalForks = ownedRepos.reduce((sum, r) => sum + r.forksCount, 0);
  const totalWatchers = ownedRepos.reduce(
    (sum, r) => sum + r.watchersCount,
    0,
  );

  // Delegate invariant steps (active days, repo depth, top-repo share,
  // maxCommitsIn10Min) and final normalizeStats() to the shared helper.
  return computePlatformStats({
    handle: raw.username,
    displayName: raw.displayName || raw.username,
    avatarUrl: raw.avatarUrl,
    heatmapData,
    commitsTotal,
    prsMergedCount,
    prsMergedWeight,
    linesAdded,
    linesDeleted,
    reviewsSubmittedCount,
    issuesClosedCount,
    repos: raw.repos, // { fullName, commitCount, isOwned } — subset of CodebergRepo
    totalStars,
    totalForks,
    totalWatchers,
  });
}
