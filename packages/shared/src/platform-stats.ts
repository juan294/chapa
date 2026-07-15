import type { HeatmapDay, StatsData } from "./types";
import { normalizeStats } from "./stats-aggregation";
import { computePrWeight } from "./scoring";
import { PR_WEIGHT_AGG_CAP, REPO_DEPTH_THRESHOLD, DAILY_COMMIT_SPIKE_THRESHOLD } from "./constants";

/**
 * Normalized repo entry — common shape across all platform aggregators.
 * Each platform extracts its repo data into this shape before calling
 * computePlatformStats().
 */
export interface NormalizedRepo {
  fullName: string;
  commitCount: number; // commits (or merged MR count) by this user
  isOwned: boolean; // user is the repo owner
}

/**
 * Normalized merged-PR entry — the change-size shape shared by the PR weight
 * heuristic. Each platform maps its own PR representation (Bitbucket diffstat
 * arrays, GitLab/Codeberg inline counts) into this shape before calling
 * computePlatformStats(), which then owns the single copy of the weight
 * accumulation + aggregate cap + line sums.
 */
export interface NormalizedMergedPr {
  additions: number;
  deletions: number;
  changedFiles: number;
}

/**
 * Platform-independent inputs for the shared aggregation skeleton.
 * Steps 6-9 (repo depth, top-repo share, max-commits heuristic) and the
 * final normalizeStats() call are identical across every platform. Only the
 * source-shape extraction (heatmap construction, PR diffstat parsing, review
 * counting, social metrics) differs per platform.
 */
export interface PlatformStatsInput {
  // Identity
  handle: string;
  displayName?: string;
  avatarUrl?: string;

  // Heatmap — already built by the platform aggregator
  heatmapData: HeatmapDay[];

  // Commit count — bitbucket derives from raw.commits.length; others from heatmap sum
  commitsTotal: number;

  // Merged PRs — normalized change sizes (source-shape extraction is the only
  // per-platform step). computePlatformStats owns prsMergedCount, prsMergedWeight
  // (with the aggregate cap), linesAdded and linesDeleted derived from these.
  mergedPrs: NormalizedMergedPr[];

  // Review + issue counts
  reviewsSubmittedCount: number;
  issuesClosedCount: number;

  // Repos — normalized shape (platform-specific fields already resolved)
  repos: NormalizedRepo[];

  // Social metrics (platform-specific — pass 0 when not available)
  totalStars: number;
  totalForks: number;
  totalWatchers: number;
}

/**
 * Shared aggregation skeleton for per-platform stats builders.
 *
 * Handles the three invariant computation steps shared across all platforms
 * (Bitbucket, GitLab, Codeberg), then delegates final normalization to
 * normalizeStats(). Platform aggregators call this after extracting
 * their platform-specific inputs.
 *
 * Invariant steps computed here:
 *   Step 1 (active days): derived from heatmapData.filter(d => d.count > 0)
 *   Step 2 (repos depth filter): activeRepos (commitCount >= REPO_DEPTH_THRESHOLD)
 *   Step 3 (top repo share): max(commitCount) / sum(commitCount) across active repos
 *   Step 4 (maxCommitsIn10Min heuristic): maxDailyCount >= DAILY_COMMIT_SPIKE_THRESHOLD ? maxDailyCount : 0
 *           (GitHub's buildStatsFromRaw uses the same shared constant — #1024)
 *   Step 5 (PR metrics): prsMergedCount, prsMergedWeight (aggregate-capped),
 *           linesAdded and linesDeleted derived from the normalized mergedPrs.
 *
 * @param input - normalized platform inputs
 * @returns fully populated StatsData
 */
export function computePlatformStats(input: PlatformStatsInput): StatsData {
  const {
    handle,
    displayName,
    avatarUrl,
    heatmapData,
    commitsTotal,
    mergedPrs,
    reviewsSubmittedCount,
    issuesClosedCount,
    repos,
    totalStars,
    totalForks,
    totalWatchers,
  } = input;

  // Invariant step 5: PR metrics from the normalized merged-PR list.
  // Single copy of the weight accumulation + aggregate cap + line sums that
  // each platform aggregator previously duplicated.
  const prsMergedCount = mergedPrs.length;
  let prsMergedWeight = 0;
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const pr of mergedPrs) {
    linesAdded += pr.additions;
    linesDeleted += pr.deletions;
    prsMergedWeight += computePrWeight(pr);
  }
  prsMergedWeight = Math.min(prsMergedWeight, PR_WEIGHT_AGG_CAP);

  // Invariant step 1: active days from heatmap
  const activeDays = heatmapData.filter((d) => d.count > 0).length;

  // Invariant step 2: repos contributed to
  // (anti-shallow-breadth: >= REPO_DEPTH_THRESHOLD commits)
  const activeRepos = repos.filter((r) => r.commitCount > 0);
  const reposContributed = activeRepos.filter(
    (r) => r.commitCount >= REPO_DEPTH_THRESHOLD,
  ).length;

  // Invariant step 3: top repo share
  const totalRepoCommits = activeRepos.reduce((s, r) => s + r.commitCount, 0);
  const topRepoShare =
    totalRepoCommits > 0
      ? Math.max(...activeRepos.map((r) => r.commitCount)) / totalRepoCommits
      : 0;

  // Invariant step 4: maxCommitsIn10Min approximation from daily spikes
  // (same heuristic as GitHub — daily counts >= DAILY_COMMIT_SPIKE_THRESHOLD
  // signal burst activity; shared constant per #1024 so this can never
  // silently drift from GitHub's own copy of the same heuristic)
  const maxDailyCount = Math.max(...heatmapData.map((d) => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= DAILY_COMMIT_SPIKE_THRESHOLD ? maxDailyCount : 0;

  return normalizeStats({
    handle,
    displayName,
    avatarUrl,
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
