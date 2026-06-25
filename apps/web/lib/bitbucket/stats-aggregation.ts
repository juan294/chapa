import type { HeatmapDay, StatsData } from "@chapa/shared";
import { computePlatformStats, computePrWeight, PR_WEIGHT_AGG_CAP } from "@chapa/shared";
import type { RawBitbucketData } from "./types";

/**
 * Transform raw Bitbucket data into a StatsData object.
 * Pure function — mirrors buildStatsFromRaw() for GitHub data.
 *
 * Platform-specific steps handled here:
 *   1. Heatmap construction from commit timestamp strings (YYYY-MM-DDT...)
 *   2. commitsTotal from raw commit array length
 *   4. PR diffstat parsing (lines_added/lines_removed arrays per PR)
 *   5. Review counting (approvals + change_requests, not plain comments)
 *   6. issuesClosedCount passthrough
 *  10. Social metrics (Bitbucket has forks only; no stars, no watchers)
 *
 * Invariant steps 1 (active days), 7 (repo depth), 8 (top-repo share), and
 * 9 (maxCommitsIn10Min heuristic) are delegated to computePlatformStats().
 */
export function buildStatsFromBitbucket(raw: RawBitbucketData): StatsData {
  // 1. Build heatmap from commit timestamps (aggregate by date)
  const heatmapMap = new Map<string, number>();
  for (const commit of raw.commits) {
    const date = commit.date.slice(0, 10); // YYYY-MM-DD
    heatmapMap.set(date, (heatmapMap.get(date) ?? 0) + 1);
  }
  const heatmapData: HeatmapDay[] = Array.from(heatmapMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // 2. Total commits (Bitbucket: raw commit array length, not heatmap sum)
  const commitsTotal = raw.commits.length;

  // 4. PR metrics — compute weight using shared computePrWeight()
  const prsMergedCount = raw.mergedPRs.length;
  let prsMergedWeight = 0;
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const { diffstat } of raw.mergedPRs) {
    const additions = diffstat.reduce((sum, d) => sum + d.lines_added, 0);
    const deletions = diffstat.reduce((sum, d) => sum + d.lines_removed, 0);
    const changedFiles = diffstat.length;
    linesAdded += additions;
    linesDeleted += deletions;
    prsMergedWeight += computePrWeight({ additions, deletions, changedFiles });
  }
  prsMergedWeight = Math.min(prsMergedWeight, PR_WEIGHT_AGG_CAP);

  // 5. Reviews — count approvals and change requests by this user (not comments)
  const reviewsSubmittedCount = raw.reviewActivities.filter(
    (a) => a.approval || a.changes_requested,
  ).length;

  // 6. Issues closed
  const issuesClosedCount = raw.closedIssues;

  // 10. Social metrics — Bitbucket has no stars, limited watchers
  const ownedRepos = raw.repos.filter((r) => r.isOwned);
  const totalForks = ownedRepos.reduce((sum, r) => sum + r.forkCount, 0);

  // Delegate invariant steps (active days, repo depth, top-repo share,
  // maxCommitsIn10Min) and final normalizeStats() to the shared helper.
  return computePlatformStats({
    handle: raw.username,
    displayName: raw.displayName,
    avatarUrl: raw.avatarUrl,
    heatmapData,
    commitsTotal,
    prsMergedCount,
    prsMergedWeight,
    linesAdded,
    linesDeleted,
    reviewsSubmittedCount,
    issuesClosedCount,
    repos: raw.repos, // { fullName, commitCount, isOwned } — subset of BitbucketRepo
    totalStars: 0, // Bitbucket has no stars
    totalForks,
    totalWatchers: 0, // Not publicly accessible
  });
}
