import type { StatsData, HeatmapDay } from "@chapa/shared";
import { computePrWeight, normalizeStats, PR_WEIGHT_AGG_CAP, REPO_DEPTH_THRESHOLD } from "@chapa/shared";
import type { RawBitbucketData } from "./types";

/**
 * Transform raw Bitbucket data into a StatsData object.
 * Pure function — mirrors buildStatsFromRaw() for GitHub data.
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

  // 2. Active days
  const activeDays = heatmapData.filter((d) => d.count > 0).length;

  // 3. Total commits
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

  // 5. Reviews — count approvals and change requests by this user
  const reviewsSubmittedCount = raw.reviewActivities.filter(
    (a) => a.approval || a.changes_requested,
  ).length;

  // 6. Issues closed
  const issuesClosedCount = raw.closedIssues;

  // 7. Repos contributed to (anti-shallow-breadth: >= REPO_DEPTH_THRESHOLD commits)
  const activeRepos = raw.repos.filter((r) => r.commitCount > 0);
  const reposContributed = activeRepos.filter(
    (r) => r.commitCount >= REPO_DEPTH_THRESHOLD,
  ).length;

  // 8. Top repo share
  const totalRepoCommits = activeRepos.reduce(
    (s, r) => s + r.commitCount,
    0,
  );
  const topRepoShare =
    totalRepoCommits > 0
      ? Math.max(...activeRepos.map((r) => r.commitCount)) / totalRepoCommits
      : 0;

  // 9. maxCommitsIn10Min approximation from daily spikes (same heuristic as GitHub)
  const maxDailyCount = Math.max(...heatmapData.map((d) => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0;

  // 10. Social metrics — Bitbucket has no stars, limited watchers
  const ownedRepos = raw.repos.filter((r) => r.isOwned);
  const totalForks = ownedRepos.reduce((sum, r) => sum + r.forkCount, 0);

  return normalizeStats({
    handle: raw.username,
    displayName: raw.displayName,
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
    totalStars: 0, // Bitbucket has no stars
    totalForks,
    totalWatchers: 0, // Not publicly accessible
    heatmapData,
  });
}
