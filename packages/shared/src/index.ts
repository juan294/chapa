export type {
  HeatmapDay,
  StatsData,
  RawContributionData,
  ConfidenceFlag,
  ConfidencePenalty,
  ImpactTier,
  ProfileType,
  DimensionScores,
  DeveloperArchetype,
  ImpactV6Result,
  SupplementalStats,
  SnapshotPenalty,
  MetricsSnapshot,
  BadgeBackground,
  BadgeCardStyle,
  BadgeBorder,
  BadgeScoreEffect,
  BadgeHeatmapAnimation,
  BadgeInteraction,
  BadgeStatsDisplay,
  BadgeTierTreatment,
  BadgeCelebration,
  BadgeConfig,
  FeatureFlag,
  InsightsTool,
  InsightsUpload,
  CraftDimensions,
  CraftTier,
  CraftResult,
} from "./types";

export { BADGE_CONFIG_OPTIONS, DEFAULT_BADGE_CONFIG } from "./types";

export type { Platform, LinkedPlatform } from "./platforms";

export { CONTRIBUTION_QUERY } from "./github-query";
export { buildStatsFromRaw, normalizeStats } from "./stats-aggregation";
export { computePlatformStats } from "./platform-stats";
export type { PlatformStatsInput, NormalizedRepo, NormalizedMergedPr } from "./platform-stats";
export { computePrWeight } from "./scoring";
export { formatCompact } from "./format";
export {
  SCORING_WINDOW_DAYS,
  PR_WEIGHT_AGG_CAP,
  SCORING_CAPS,
  REPO_DEPTH_THRESHOLD,
  DIMENSION_KEYS,
  SOLO_DIMENSION_KEYS,
  SOLO_REVIEW_RATIO_THRESHOLD,
  BATCH_SIZE_MIN,
  BATCH_SIZE_MAX,
  BURST_ACTIVITY_THRESHOLD,
  DAILY_COMMIT_SPIKE_THRESHOLD,
  MICRO_COMMIT_THRESHOLD,
  SINGLE_REPO_CONCENTRATION,
  LEAD_TIME_CAPS,
  BATCH_SIZE_DEFAULT,
  TIER_THRESHOLDS,
} from "./constants";
export {
  STATS_DATA_KEYS,
  CLIENT_INJECTED_KEYS,
  MERGE_EXPECTED_KEYS,
} from "./stats-schema";
