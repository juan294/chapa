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
  ImpactV4Result,
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
export { buildStatsFromRaw } from "./stats-aggregation";
export { computePrWeight } from "./scoring";
export { formatCompact } from "./format";
export {
  SCORING_WINDOW_DAYS,
  PR_WEIGHT_AGG_CAP,
  SCORING_CAPS,
  REPO_DEPTH_THRESHOLD,
  DIMENSION_KEYS,
  SOLO_DIMENSION_KEYS,
} from "./constants";
