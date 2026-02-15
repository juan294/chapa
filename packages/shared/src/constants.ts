/** Number of days of GitHub activity used for scoring. */
export const SCORING_WINDOW_DAYS = 365;

/** Number of weeks shown in the badge heatmap visual. */
export const BADGE_HEATMAP_WEEKS = 13;

/** Cap for aggregated PR weight (used by buildStatsFromRaw and mergeStats). */
export const PR_WEIGHT_AGG_CAP = 120;

/**
 * Scoring dimension caps — used by computeImpactV4.
 * Calibrated for a 365-day window.
 */
export const SCORING_CAPS = {
  prWeight: 120,
  issues: 80,
  commits: 600,
  reviews: 180,
  repos: 15,
  stars: 500,
  forks: 200,
  watchers: 100,
} as const;

/**
 * Minimum commits in a repo for it to count toward `reposContributed`.
 * Prevents gaming Breadth by making trivial single-commit contributions
 * to many repos. `topRepoShare` still uses ALL active repos (1+ commits).
 */
export const REPO_DEPTH_THRESHOLD = 3;
