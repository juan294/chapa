/** Number of days of GitHub activity used for scoring. */
export const SCORING_WINDOW_DAYS = 365;

/** Cap for aggregated PR weight (used by buildStatsFromRaw and mergeStats). */
export const PR_WEIGHT_AGG_CAP = 120;

/**
 * Scoring dimension caps — used by computeImpactV4.
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
