import type { Stats90d, HeatmapDay } from "@chapa/shared";
import { fetchContributionData } from "./queries";

// ---------------------------------------------------------------------------
// PR weight formula: w = 0.5 + 0.25*ln(1+filesChanged) + 0.25*ln(1+additions+deletions)
// Capped at 3.0 per PR. Total capped at 40.
// ---------------------------------------------------------------------------

function computePrWeight(pr: {
  additions: number;
  deletions: number;
  changedFiles: number;
}): number {
  const w =
    0.5 +
    0.25 * Math.log(1 + pr.changedFiles) +
    0.25 * Math.log(1 + pr.additions + pr.deletions);
  return Math.min(w, 3.0);
}

// ---------------------------------------------------------------------------
// fetchStats90d — main aggregation function
// ---------------------------------------------------------------------------

export async function fetchStats90d(
  handle: string,
  token?: string,
): Promise<Stats90d | null> {
  const raw = await fetchContributionData(handle, token);
  if (!raw) return null;

  // Heatmap: flatten weeks into 91 days (13 weeks × 7 days)
  const heatmapData: HeatmapDay[] = [];
  for (const week of raw.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      heatmapData.push({ date: day.date, count: day.contributionCount });
    }
  }

  // Active days: days with at least 1 contribution
  const activeDays = heatmapData.filter((d) => d.count > 0).length;

  // Total commits from contribution calendar
  const commitsTotal = raw.contributionCalendar.totalContributions;

  // PRs: only count merged, compute weight
  const mergedPRs = raw.pullRequests.nodes.filter((pr) => pr.merged);
  const prsMergedCount = mergedPRs.length;
  const prsMergedWeight = Math.min(
    mergedPRs.reduce((sum, pr) => sum + computePrWeight(pr), 0),
    40,
  );

  // Lines added/deleted from merged PRs
  const linesAdded = mergedPRs.reduce((sum, pr) => sum + pr.additions, 0);
  const linesDeleted = mergedPRs.reduce((sum, pr) => sum + pr.deletions, 0);

  // Reviews and issues
  const reviewsSubmittedCount = raw.reviews.totalCount;
  const issuesClosedCount = raw.issues.totalCount;

  // Repos contributed to (with commits in the period)
  const repoCommits = raw.repositories.nodes
    .map((r) => ({
      name: r.nameWithOwner,
      commits: r.defaultBranchRef?.target?.history?.totalCount ?? 0,
    }))
    .filter((r) => r.commits > 0);
  const reposContributed = repoCommits.length;

  // Top repo share
  const totalRepoCommits = repoCommits.reduce((s, r) => s + r.commits, 0);
  const topRepoShare =
    totalRepoCommits > 0
      ? Math.max(...repoCommits.map((r) => r.commits)) / totalRepoCommits
      : 0;

  // maxCommitsIn10Min: we don't have fine-grained timestamp data from GraphQL,
  // so we approximate using daily spikes. If a single day has >20 commits,
  // flag it proportionally. This is a reasonable approximation.
  const maxDailyCount = Math.max(...heatmapData.map((d) => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0;

  return {
    handle: raw.login,
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
    heatmapData,
    fetchedAt: new Date().toISOString(),
  };
}
