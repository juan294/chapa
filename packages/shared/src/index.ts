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
  PublicImpactV6Result,
  ClientImpactV6Result,
  SupplementalStats,
  SnapshotPenalty,
  MetricsSnapshot,
  BadgeBackground,
  BadgeCardStyle,
  BadgeBorder,
  BadgeScoreEffect,
  BadgeHeatmapAnimation,
  BadgeTierTreatment,
  BadgePalette,
  BadgeConfig,
  FeatureFlag,
  InsightsTool,
  InsightsUpload,
  CraftDimensions,
  CraftTier,
  CraftResult,
} from "./types";

export { BADGE_CONFIG_OPTIONS, DEFAULT_BADGE_CONFIG, RETIRED_BADGE_CONFIG_KEYS } from "./types";

export type { Platform, LinkedPlatform } from "./platforms";

export { CONTRIBUTION_QUERY, REPOSITORY_STATS_QUERY } from "./github-query";
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

// v7 is additive: legacy v6 exports above retain their stored meanings.
export * from "./scoring-window";
export * from "./scoring-evidence";
export { createCoreScoringInputs } from "./stats-schema";

export * from "./scoring-aggregation-v7";

export * from "./canonical-json";
export * from "./score-receipt";

// v7.2 foundation only: historical publication/replay dispatch is unchanged.
export * from "./scoring-observed";
export * from "./score-receipt-observed";
export * from "./score-receipt-registry";
