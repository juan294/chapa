/** Number of days of GitHub activity used for scoring. */
export const SCORING_WINDOW_DAYS = 365;

/** Cap for aggregated PR weight (used by buildStatsFromRaw and mergeStats). */
export const PR_WEIGHT_AGG_CAP = 120;

/**
 * Scoring dimension caps — used by computeImpactV6.
 * V5 recalibration: caps target P50-P75 developers (was P99 in V4).
 * Calibrated for a 365-day window.
 */
export const SCORING_CAPS = {
  prWeight: 60,
  issues: 40,
  commits: 300,
  reviews: 80,
  repos: 12,
  stars: 150,
  forks: 80,
  watchers: 50,
} as const;

/**
 * Minimum commits in a repo for it to count toward `reposContributed`.
 * Prevents gaming Breadth by making trivial single-commit contributions
 * to many repos. `topRepoShare` still uses ALL active repos (1+ commits).
 */
export const REPO_DEPTH_THRESHOLD = 3;

/**
 * Maximum total lines changed (additions + deletions) for a PR to be
 * classified as a "micro PR" in microCommitRatio computation.
 * PRs below this threshold contribute negligible code change.
 */
export const MICRO_PR_LINE_THRESHOLD = 10;

/**
 * Review-to-PR ratio below which a profile is classified as "solo".
 * A developer needs roughly 1 review per 7 PRs (0.15) to be treated as
 * "collaborative" — below this threshold, reviews are incidental, not
 * systematic code review participation.
 */
export const SOLO_REVIEW_RATIO_THRESHOLD = 0.15;

/** Minimum lines changed for a PR to be in the "reviewable sweet spot". */
export const BATCH_SIZE_MIN = 20;

/** Maximum lines changed for a PR to be in the "reviewable sweet spot". */
export const BATCH_SIZE_MAX = 500;

/** Commits in a 10-minute window that trigger the burst-activity confidence penalty. */
export const BURST_ACTIVITY_THRESHOLD = 100;

/**
 * Daily commit count (from the contribution heatmap) treated as a "burst
 * spike" when approximating `maxCommitsIn10Min`. Shared by GitHub's
 * `buildStatsFromRaw` (packages/shared/src/stats-aggregation.ts) and the
 * cross-platform `computePlatformStats` skeleton (platform-stats.ts) so the
 * two aggregation paths can never silently diverge on this literal (#1024).
 *
 * Deliberately distinct from `BURST_ACTIVITY_THRESHOLD` (100), which is a
 * separate, higher threshold applied downstream to the resulting
 * `maxCommitsIn10Min` value to trigger a confidence penalty.
 */
export const DAILY_COMMIT_SPIKE_THRESHOLD = 30;

/** Micro-commit ratio threshold that triggers the confidence penalty. */
export const MICRO_COMMIT_THRESHOLD = 0.6;

/** Top-repo concentration threshold that triggers the single-repo confidence penalty. */
export const SINGLE_REPO_CONCENTRATION = 0.95;

/** Delivery lead-time breakpoints (hours) for the +/-5% modifier. */
export const LEAD_TIME_CAPS = {
  fast: 4,
  mid: 48,
  slow: 168,
} as const;

/** Neutral fallback when batch-size score is unavailable. */
export const BATCH_SIZE_DEFAULT = 0.3;

/** Adjusted-score thresholds for tier mapping. */
export const TIER_THRESHOLDS = {
  S: 85,
  A: 70,
  C: 30,
} as const;

/**
 * All four scoring dimension keys in canonical order.
 * Used by v4 scoring, heatmap coloring, and archetype derivation.
 */
export const DIMENSION_KEYS: (keyof import("./types").DimensionScores)[] = [
  "delivery",
  "quality",
  "consistency",
  "breadth",
  "craft",
];

/**
 * Dimension keys used for solo profile composite scoring and archetype derivation.
 * Quality is excluded — solo quality (computed from PR descriptions, branch strategy,
 * issue linkage) is displayed on radar/cards but does not count toward the composite.
 * Craft is included when present (v6).
 */
export const SOLO_DIMENSION_KEYS: (keyof import("./types").DimensionScores)[] = [
  "delivery",
  "consistency",
  "breadth",
  "craft",
];
