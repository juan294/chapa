import type { RawContributionData, StatsData, HeatmapDay } from "./types";
import { computePrWeight } from "./scoring";
import {
  MICRO_PR_LINE_THRESHOLD,
  PR_WEIGHT_AGG_CAP,
  REPO_DEPTH_THRESHOLD,
  BATCH_SIZE_MIN,
  BATCH_SIZE_MAX,
  DAILY_COMMIT_SPIKE_THRESHOLD,
} from "./constants";

/** Branch names that indicate a direct push (not a feature branch). */
const DEFAULT_BRANCH_NAMES = new Set(["main", "master", "develop", "development", "dev", "developer", "trunk"]);

export function median(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }

  return sorted[middle]!;
}

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

  // 4. PRs: only count merged, compute weight.
  // prsMergedCount is authoritative — sourced from `search(is:merged)`
  // (raw.mergedPrTotalCount), not the token-scoped/100-node-capped sample
  // below. The sample (mergedPRs) still drives weight + every quality
  // sub-metric on a best-effort basis (see stats-integrity.ts for the fetch
  // rejection that keeps a degraded sample from ever reaching here).
  const mergedPRs = raw.pullRequests.nodes.filter((pr) => pr.merged);
  const prsMergedCount = raw.mergedPrTotalCount;
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
  // Minimum development PRs needed for filtered quality metrics.
  // Below this threshold, the token likely has limited scope (e.g. GITHUB_TOKEN
  // seeing only public contributions) — fall back to all merged PRs.
  const MIN_QUALITY_SAMPLE = 5;

  const hasBaseRefName = mergedPRs.some((pr) => pr.baseRefName != null);
  const filteredDevPRs = hasBaseRefName
    ? mergedPRs.filter(
        (pr) =>
          !(DEFAULT_BRANCH_NAMES.has(pr.headRefName) && DEFAULT_BRANCH_NAMES.has(pr.baseRefName!)),
      )
    : mergedPRs;
  const developmentPRs = filteredDevPRs.length >= MIN_QUALITY_SAMPLE ? filteredDevPRs : mergedPRs;
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

  // 5c. Micro-commit ratio: fraction of merged PRs below the line-change threshold.
  // Denominator is the sample size (mergedPRs.length), not the authoritative
  // prsMergedCount — both numerator and denominator must come from the same
  // sample for the ratio to be meaningful.
  const microCommitRatio = mergedPRs.length > 0
    ? mergedPRs.filter((pr) => pr.additions + pr.deletions < MICRO_PR_LINE_THRESHOLD).length / mergedPRs.length
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
    });
  const medianPrLeadTimeHours = median(leadTimes);

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
  // Shared with computePlatformStats() via DAILY_COMMIT_SPIKE_THRESHOLD (#1024)
  // so this heuristic can never silently diverge between GitHub and the
  // other platform aggregators.
  const maxDailyCount = Math.max(...heatmapData.map((d) => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= DAILY_COMMIT_SPIKE_THRESHOLD ? maxDailyCount : 0;

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

  return normalizeStats({
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
    prDescriptionRate,
    featureBranchRate,
    issueLinkageRate,
    microCommitRatio,
    batchSizeScore,
    medianPrLeadTimeHours,
    totalStars,
    totalForks,
    totalWatchers,
    heatmapData,
  });
}

/**
 * Required StatsData fields and their default values. Single source of truth
 * for StatsData defaults — every platform aggregator routes its output through
 * `normalizeStats()` so a field added to StatsData gets a consistent default in
 * exactly one place (root cause fix for AR-M5 / the v2.7.x craft-field bugs).
 */
const STATS_REQUIRED_DEFAULTS: Omit<
  StatsData,
  | "displayName"
  | "avatarUrl"
  | "primaryReviewsSubmittedCount"
  | "microCommitRatio"
  | "batchSizeScore"
  | "medianPrLeadTimeHours"
  | "docsOnlyPrRatio"
  | "prDescriptionRate"
  | "featureBranchRate"
  | "issueLinkageRate"
  | "hasSupplementalData"
  | "linkedPlatforms"
  | "linkedPlatformLogins"
  | "fetchedAt"
> = {
  handle: "",
  commitsTotal: 0,
  activeDays: 0,
  prsMergedCount: 0,
  prsMergedWeight: 0,
  reviewsSubmittedCount: 0,
  issuesClosedCount: 0,
  linesAdded: 0,
  linesDeleted: 0,
  reposContributed: 0,
  topRepoShare: 0,
  maxCommitsIn10Min: 0,
  totalStars: 0,
  totalForks: 0,
  totalWatchers: 0,
  heatmapData: [],
};

/** Optional StatsData fields — included in output only when explicitly provided. */
const STATS_OPTIONAL_KEYS = [
  "displayName",
  "avatarUrl",
  "primaryReviewsSubmittedCount",
  "microCommitRatio",
  "batchSizeScore",
  "medianPrLeadTimeHours",
  "docsOnlyPrRatio",
  "prDescriptionRate",
  "featureBranchRate",
  "issueLinkageRate",
  "hasSupplementalData",
  "linkedPlatforms",
  "linkedPlatformLogins",
  "fetchScope",
] as const satisfies readonly (keyof StatsData)[];

/**
 * Fill a partial StatsData with canonical defaults for all required fields.
 *
 * - Required numeric/string/array fields default per `STATS_REQUIRED_DEFAULTS`.
 * - `fetchedAt` defaults to the current time when absent.
 * - Optional fields are copied through only when `!== undefined`, preserving the
 *   "omit when unknown" contract every aggregator relied on previously.
 *
 * Pure (except for the `fetchedAt` fallback, which reads the clock).
 */
export function normalizeStats(partial: Partial<StatsData>): StatsData {
  const out: StatsData = {
    ...STATS_REQUIRED_DEFAULTS,
    heatmapData: partial.heatmapData ?? [],
    fetchedAt: partial.fetchedAt ?? new Date().toISOString(),
  };
  const mutable = out as unknown as Record<string, unknown>;

  for (const key of Object.keys(STATS_REQUIRED_DEFAULTS)) {
    const value = (partial as Record<string, unknown>)[key];
    if (value !== undefined) {
      mutable[key] = value;
    }
  }

  for (const key of STATS_OPTIONAL_KEYS) {
    const value = (partial as Record<string, unknown>)[key];
    if (value !== undefined) {
      mutable[key] = value;
    }
  }

  return out;
}
