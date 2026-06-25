import type { HeatmapDay, StatsData } from "@chapa/shared";
import { computePlatformStats, computePrWeight, PR_WEIGHT_AGG_CAP } from "@chapa/shared";
import type { RawGitlabData } from "./types";

/**
 * Transform raw GitLab data into a StatsData object.
 * Pure function — mirrors buildStatsFromCodeberg() for Codeberg data.
 *
 * GitLab differs from Codeberg in two source-shape ways, both already resolved
 * in the queries layer: the heatmap arrives pre-bucketed by date (reconstructed
 * from the Events API), and merged-MR diffstats arrive already parsed.
 *
 * Platform-specific steps handled here:
 *   1. Heatmap: pre-bucketed — sort ascending, pass through as HeatmapDay[]
 *   2. commitsTotal: sum of heatmap counts
 *   4. PR diffstat: additions/deletions/changed_files already parsed per MR
 *   5. Review counting: raw.reviewsCount passthrough
 *   6. issuesClosedCount passthrough
 *  10. Social metrics: GitLab has stars + forks (no accessible watchers)
 *
 * Invariant steps (active days, repo depth, top-repo share, maxCommitsIn10Min)
 * are delegated to computePlatformStats().
 */
export function buildStatsFromGitlab(raw: RawGitlabData): StatsData {
  // 1. Heatmap is already date-bucketed; sort ascending for determinism.
  const heatmapData: HeatmapDay[] = [...raw.heatmap]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, count }) => ({ date, count }));

  // 2. Commit count from heatmap totals
  const commitsTotal = heatmapData.reduce((sum, d) => sum + d.count, 0);

  // 4. PR metrics — additions/deletions/changedFiles already parsed per MR
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

  // 5. Reviews — count of others' MRs the user approved (queries layer filters)
  const reviewsSubmittedCount = raw.reviewsCount;

  // 6. Issues closed
  const issuesClosedCount = raw.closedIssues;

  // 10. Social metrics — GitLab has stars + forks, no watchers
  const ownedRepos = raw.repos.filter((r) => r.isOwned);
  const totalStars = ownedRepos.reduce((sum, r) => sum + r.starsCount, 0);
  const totalForks = ownedRepos.reduce((sum, r) => sum + r.forksCount, 0);

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
    repos: raw.repos, // { fullName, commitCount, isOwned } — subset of GitlabRepo
    totalStars,
    totalForks,
    totalWatchers: 0, // GitLab watchers not publicly accessible
  });
}
