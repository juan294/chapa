import type { RawContributionData, StatsData, HeatmapDay } from "./types";
import { computePrWeight } from "./scoring";
import { MICRO_PR_LINE_THRESHOLD, PR_WEIGHT_AGG_CAP, REPO_DEPTH_THRESHOLD, BATCH_SIZE_MIN, BATCH_SIZE_MAX } from "./constants";

/** Branch names that indicate a direct push (not a feature branch). */
const DEFAULT_BRANCH_NAMES = new Set(["main", "master", "develop", "development", "dev", "developer", "trunk"]);

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

  // 5b. Solo quality signals from merged PRs
  // Exclude cross-default PRs (e.g. develop → main releases, main → develop backports)
  // from solo quality denominators — they represent integration activity, not development work.
  // When baseRefName is unavailable (old cached data), fall back to all merged PRs.
  const hasBaseRefName = mergedPRs.some((pr) => pr.baseRefName != null);
  const developmentPRs = hasBaseRefName
    ? mergedPRs.filter(
        (pr) =>
          !(DEFAULT_BRANCH_NAMES.has(pr.headRefName) && DEFAULT_BRANCH_NAMES.has(pr.baseRefName!)),
      )
    : mergedPRs;
  const devPrCount = developmentPRs.length;

  const prDescriptionRate = devPrCount > 0
    ? developmentPRs.filter((pr) => (pr.body ?? "").trim().length > 0).length / devPrCount
    : undefined;
  const featureBranchRate = devPrCount > 0
    ? developmentPRs.filter((pr) => !DEFAULT_BRANCH_NAMES.has(pr.headRefName)).length / devPrCount
    : undefined;
  const issueLinkageRate = devPrCount > 0
    ? developmentPRs.filter((pr) => pr.closingIssuesCount > 0).length / devPrCount
    : undefined;

  // 5c. Micro-commit ratio: fraction of merged PRs below the line-change threshold
  const microCommitRatio = prsMergedCount > 0
    ? mergedPRs.filter((pr) => pr.additions + pr.deletions < MICRO_PR_LINE_THRESHOLD).length / prsMergedCount
    : undefined;

  // 5d. Batch size score: fraction of merged PRs in the reviewable sweet spot
  const batchSizeScore = devPrCount > 0
    ? developmentPRs.filter((pr) => {
        const total = pr.additions + pr.deletions;
        return total >= BATCH_SIZE_MIN && total <= BATCH_SIZE_MAX;
      }).length / devPrCount
    : undefined;

  // 5e. Median PR lead time (creation → merge) in hours
  const leadTimes = mergedPRs
    .filter((pr) => pr.createdAt && pr.mergedAt)
    .map((pr) => {
      const created = new Date(pr.createdAt!).getTime();
      const merged = new Date(pr.mergedAt!).getTime();
      return Math.max(0, (merged - created) / (1000 * 60 * 60));
    })
    .sort((a, b) => a - b);
  const medianPrLeadTimeHours = leadTimes.length > 0
    ? leadTimes[Math.floor(leadTimes.length / 2)]
    : undefined;

  // 6. Reviews and issues
  const reviewsSubmittedCount = raw.reviews.totalCount;
  const issuesClosedCount = raw.issues.totalCount;

  // 7. Repos contributed to
  // All repos with 1+ commits (used for topRepoShare — honest concentration)
  const activeRepos = raw.repositories.nodes
    .map((r) => ({
      name: r.nameWithOwner,
      commits: r.defaultBranchRef?.target?.history?.totalCount ?? 0,
    }))
    .filter((r) => r.commits > 0);

  // Only repos with >= REPO_DEPTH_THRESHOLD commits count toward reposContributed
  // (anti-shallow-breadth: prevents gaming by single-commit drive-bys)
  const reposContributed = activeRepos.filter(
    (r) => r.commits >= REPO_DEPTH_THRESHOLD,
  ).length;

  // 8. Top repo share (uses ALL active repos for honest concentration measurement)
  const totalRepoCommits = activeRepos.reduce((s, r) => s + r.commits, 0);
  const topRepoShare =
    totalRepoCommits > 0
      ? Math.max(...activeRepos.map((r) => r.commits)) / totalRepoCommits
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
    ...(prDescriptionRate !== undefined && { prDescriptionRate }),
    ...(featureBranchRate !== undefined && { featureBranchRate }),
    ...(issueLinkageRate !== undefined && { issueLinkageRate }),
    ...(microCommitRatio !== undefined && { microCommitRatio }),
    ...(batchSizeScore !== undefined && { batchSizeScore }),
    ...(medianPrLeadTimeHours !== undefined && { medianPrLeadTimeHours }),
    totalStars,
    totalForks,
    totalWatchers,
    heatmapData,
    fetchedAt: new Date().toISOString(),
  };
}
