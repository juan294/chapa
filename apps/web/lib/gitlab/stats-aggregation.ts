import type { StatsData, HeatmapDay } from "@chapa/shared";
import {
  computePrWeight,
  normalizeStats,
  PR_WEIGHT_AGG_CAP,
  REPO_DEPTH_THRESHOLD,
} from "@chapa/shared";
import type { RawGitlabData } from "./types";

/**
 * Transform raw GitLab data into a StatsData object.
 * Pure function — mirrors buildStatsFromCodeberg() for Codeberg data.
 *
 * GitLab differs from Codeberg in two source-shape ways, both already resolved
 * in the queries layer: the heatmap arrives pre-bucketed by date (reconstructed
 * from the Events API), and merged-MR diffstats arrive already parsed.
 */
export function buildStatsFromGitlab(raw: RawGitlabData): StatsData {
  // 1. Heatmap is already date-bucketed; sort ascending for determinism.
  const heatmapData: HeatmapDay[] = [...raw.heatmap]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, count }) => ({ date, count }));

  // 2. Commit count from heatmap totals
  const commitsTotal = heatmapData.reduce((sum, d) => sum + d.count, 0);

  // 3. Active days
  const activeDays = heatmapData.filter((d) => d.count > 0).length;

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

  // 7. Repos contributed to (anti-shallow-breadth: >= REPO_DEPTH_THRESHOLD merged MRs)
  const activeRepos = raw.repos.filter((r) => r.commitCount > 0);
  const reposContributed = activeRepos.filter(
    (r) => r.commitCount >= REPO_DEPTH_THRESHOLD,
  ).length;

  // 8. Top repo share
  const totalRepoCommits = activeRepos.reduce((s, r) => s + r.commitCount, 0);
  const topRepoShare =
    totalRepoCommits > 0
      ? Math.max(...activeRepos.map((r) => r.commitCount)) / totalRepoCommits
      : 0;

  // 9. maxCommitsIn10Min approximation from daily spikes (same heuristic as GitHub/Codeberg)
  const maxDailyCount = Math.max(...heatmapData.map((d) => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0;

  // 10. Social metrics — GitLab has stars + forks, no watchers
  const ownedRepos = raw.repos.filter((r) => r.isOwned);
  const totalStars = ownedRepos.reduce((sum, r) => sum + r.starsCount, 0);
  const totalForks = ownedRepos.reduce((sum, r) => sum + r.forksCount, 0);
  const totalWatchers = 0;

  return normalizeStats({
    handle: raw.username,
    displayName: raw.displayName || raw.username,
    avatarUrl: raw.avatarUrl,
    commitsTotal,
    activeDays,
    prsMergedCount,
    prsMergedWeight,
    reviewsSubmittedCount,
    issuesClosedCount,
    linesAdded,
    linesDeleted,
    reposContributed,
    topRepoShare,
    maxCommitsIn10Min,
    totalStars,
    totalForks,
    totalWatchers,
    heatmapData,
  });
}
