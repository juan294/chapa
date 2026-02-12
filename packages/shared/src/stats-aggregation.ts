import type { RawContributionData, StatsData, HeatmapDay } from "./types";
import { computePrWeight } from "./scoring";
import { PR_WEIGHT_AGG_CAP } from "./constants";

/**
 * Transform raw GitHub GraphQL contribution data into a StatsData object.
 *
 * This is a pure function — deterministic output for a given input
 * (except for `fetchedAt` which uses the current time).
 *
 * Input shape: `RawContributionData` where PR nodes are already unwrapped
 * (i.e. null nodes filtered out by the caller — see `queries.ts` and `fetch-emu.ts`).
 */
export function buildStatsFromRaw(raw: RawContributionData): StatsData {
  // 1. Flatten heatmap from weeks -> HeatmapDay[]
  const heatmapData: HeatmapDay[] = [];
  for (const week of raw.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      heatmapData.push({ date: day.date, count: day.contributionCount });
    }
  }

  // 2. Count active days
  const activeDays = heatmapData.filter((d) => d.count > 0).length;

  // 3. Total commits from contribution calendar
  const commitsTotal = raw.contributionCalendar.totalContributions;

  // 4. PRs: only count merged, compute weight
  const mergedPRs = raw.pullRequests.nodes.filter((pr) => pr.merged);
  const prsMergedCount = mergedPRs.length;
  const prsMergedWeight = Math.min(
    mergedPRs.reduce((sum, pr) => sum + computePrWeight(pr), 0),
    PR_WEIGHT_AGG_CAP,
  );

  // 5. Lines added/deleted from merged PRs
  const linesAdded = mergedPRs.reduce((sum, pr) => sum + pr.additions, 0);
  const linesDeleted = mergedPRs.reduce((sum, pr) => sum + pr.deletions, 0);

  // 6. Reviews and issues
  const reviewsSubmittedCount = raw.reviews.totalCount;
  const issuesClosedCount = raw.issues.totalCount;

  // 7. Repos contributed to (with commits in the period)
  const repoCommits = raw.repositories.nodes
    .map((r) => ({
      name: r.nameWithOwner,
      commits: r.defaultBranchRef?.target?.history?.totalCount ?? 0,
    }))
    .filter((r) => r.commits > 0);
  const reposContributed = repoCommits.length;

  // 8. Top repo share
  const totalRepoCommits = repoCommits.reduce((s, r) => s + r.commits, 0);
  const topRepoShare =
    totalRepoCommits > 0
      ? Math.max(...repoCommits.map((r) => r.commits)) / totalRepoCommits
      : 0;

  // 9. maxCommitsIn10Min approximation from daily spikes
  const maxDailyCount = Math.max(...heatmapData.map((d) => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0;

  // 10. Total stars, forks, and watchers across owned repos
  const totalStars = raw.ownedRepoStars.nodes.reduce(
    (sum, r) => sum + r.stargazerCount,
    0,
  );
  const totalForks = raw.ownedRepoStars.nodes.reduce(
    (sum, r) => sum + r.forkCount,
    0,
  );
  const totalWatchers = raw.ownedRepoStars.nodes.reduce(
    (sum, r) => sum + r.watchers.totalCount,
    0,
  );

  return {
    handle: raw.login,
    displayName: raw.name ?? undefined,
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
    fetchedAt: new Date().toISOString(),
  };
}
