import type { HeatmapDay, StatsData } from "./types";
import { normalizeStats } from "./stats-aggregation";
import { PR_WEIGHT_AGG_CAP, REPO_DEPTH_THRESHOLD } from "./constants";

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

  // PR metrics — already computed by the platform aggregator
  prsMergedCount: number;
  prsMergedWeight: number; // must already be capped at PR_WEIGHT_AGG_CAP
  linesAdded: number;
  linesDeleted: number;

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
 *   Step 4 (maxCommitsIn10Min heuristic): maxDailyCount >= 30 ? maxDailyCount : 0
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
    prsMergedCount,
    prsMergedWeight,
    linesAdded,
    linesDeleted,
    reviewsSubmittedCount,
    issuesClosedCount,
    repos,
    totalStars,
    totalForks,
    totalWatchers,
  } = input;

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
  // (same heuristic as GitHub — daily counts ≥ 30 signal burst activity)
  const maxDailyCount = Math.max(...heatmapData.map((d) => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0;

  // Sanity-check: callers must cap before passing to avoid silent over-counting
  const cappedWeight = Math.min(prsMergedWeight, PR_WEIGHT_AGG_CAP);

  return normalizeStats({
    handle,
    displayName,
    avatarUrl,
    commitsTotal,
    activeDays,
    prsMergedCount,
    prsMergedWeight: cappedWeight,
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
