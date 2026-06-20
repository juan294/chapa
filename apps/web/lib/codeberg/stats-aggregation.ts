import type { StatsData, HeatmapDay } from "@chapa/shared";
import {
  computePrWeight,
  normalizeStats,
  PR_WEIGHT_AGG_CAP,
  REPO_DEPTH_THRESHOLD,
} from "@chapa/shared";
import type { RawCodebergData } from "./types";
import { toDateString } from "@/lib/utils/date";

/**
 * Transform raw Codeberg data into a StatsData object.
 * Pure function — mirrors buildStatsFromBitbucket() for Bitbucket data.
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

  // 3. Active days
  const activeDays = heatmapData.filter((d) => d.count > 0).length;

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

  // 9. maxCommitsIn10Min approximation from daily spikes (same heuristic as GitHub/Bitbucket)
  const maxDailyCount = Math.max(...heatmapData.map((d) => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0;

  // 10. Social metrics — all available on Codeberg (unlike Bitbucket)
  const ownedRepos = raw.repos.filter((r) => r.isOwned);
  const totalStars = ownedRepos.reduce((sum, r) => sum + r.starsCount, 0);
  const totalForks = ownedRepos.reduce((sum, r) => sum + r.forksCount, 0);
  const totalWatchers = ownedRepos.reduce(
    (sum, r) => sum + r.watchersCount,
    0,
  );

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
