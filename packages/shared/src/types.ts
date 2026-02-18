/** Daily activity count for heatmap (up to 53 weeks × 7 days = 371 entries) */
export interface HeatmapDay {
  date: string; // ISO date string (YYYY-MM-DD)
  count: number;
}

/** Aggregated GitHub stats over the last 365 days */
export interface StatsData {
  handle: string;
  displayName?: string; // GitHub profile name (e.g. "Juan García"), undefined if unset
  avatarUrl?: string; // GitHub avatar URL
  commitsTotal: number; // cap 600
  activeDays: number; // 0..365
  prsMergedCount: number;
  prsMergedWeight: number; // cap 120
  reviewsSubmittedCount: number; // cap 180
  issuesClosedCount: number; // cap 80
  linesAdded: number;
  linesDeleted: number;
  reposContributed: number; // cap 15
  topRepoShare: number; // 0..1
  maxCommitsIn10Min: number; // derived from commit timestamps
  microCommitRatio?: number; // optional, 0..1
  docsOnlyPrRatio?: number; // optional, 0..1
  totalStars: number; // sum of stargazerCount across owned repos
  totalForks: number; // sum of forkCount across owned repos
  totalWatchers: number; // sum of watchers.totalCount across owned repos
  heatmapData: HeatmapDay[];
  fetchedAt: string; // ISO timestamp
  hasSupplementalData?: boolean; // true when merged with EMU/supplemental stats
}

/** Confidence flag identifiers */
export type ConfidenceFlag =
  | "burst_activity"
  | "micro_commit_pattern"
  | "generated_change_pattern"
  | "low_collaboration_signal"
  | "single_repo_concentration"
  | "supplemental_unverified"
  | "low_activity_signal"
  | "review_volume_imbalance";

/** A single confidence penalty with reason */
export interface ConfidencePenalty {
  flag: ConfidenceFlag;
  penalty: number;
  reason: string;
}

/** Impact tier based on adjusted score */
export type ImpactTier = "Emerging" | "Solid" | "High" | "Elite";

/** Developer profile type — determines scoring behavior */
export type ProfileType = "solo" | "collaborative";

/** Four independent dimension scores (each 0..100) */
export interface DimensionScores {
  building: number;
  guarding: number;
  consistency: number;
  breadth: number;
}

/** Developer archetype derived from dimension profile shape */
export type DeveloperArchetype =
  | "Builder"
  | "Guardian"
  | "Marathoner"
  | "Polymath"
  | "Balanced"
  | "Emerging";

/** Full Impact v4 result */
export interface ImpactV4Result {
  handle: string;
  profileType: ProfileType;
  dimensions: DimensionScores;
  archetype: DeveloperArchetype;
  compositeScore: number; // 0..100 — avg of dimensions (3 for solo, 4 for collaborative)
  confidence: number; // 50..100
  confidencePenalties: ConfidencePenalty[];
  adjustedComposite: number; // 0..100
  tier: ImpactTier;
  computedAt: string; // ISO timestamp
}

/** Raw data shape returned by the GitHub GraphQL contribution query */
export interface RawContributionData {
  login: string;
  name: string | null;
  avatarUrl: string;
  contributionCalendar: {
    totalContributions: number;
    weeks: {
      contributionDays: {
        date: string;
        contributionCount: number;
      }[];
    }[];
  };
  pullRequests: {
    totalCount: number;
    nodes: {
      additions: number;
      deletions: number;
      changedFiles: number;
      merged: boolean;
    }[];
  };
  reviews: { totalCount: number };
  issues: { totalCount: number };
  repositories: {
    totalCount: number;
    nodes: {
      nameWithOwner: string;
      defaultBranchRef: {
        target: { history: { totalCount: number } };
      } | null;
    }[];
  };
  ownedRepoStars: {
    nodes: {
      stargazerCount: number;
      forkCount: number;
      watchers: { totalCount: number };
    }[];
  };
}

/** Supplemental stats uploaded from a linked account (e.g. GitHub EMU) */
export interface SupplementalStats {
  targetHandle: string; // personal GitHub handle
  sourceHandle: string; // EMU handle
  stats: StatsData;
  uploadedAt: string; // ISO timestamp
}

// ---------------------------------------------------------------------------
// Lifetime history — Metrics snapshots
// ---------------------------------------------------------------------------

/** Compact penalty record — omits reason string (rehydratable from CONFIDENCE_REASONS). */
export interface SnapshotPenalty {
  flag: ConfidenceFlag;
  penalty: number;
}

/**
 * Compact daily snapshot of a user's metrics + impact scores.
 *
 * Stored permanently in Redis sorted sets (key: `history:<handle>`).
 * ~300 bytes JSON — excludes heatmapData (7KB) and mutable display
 * fields (avatarUrl, displayName). Includes explanatory fields for
 * score change analysis.
 */
export interface MetricsSnapshot {
  /** YYYY-MM-DD — deduplication key (one snapshot per user per day) */
  date: string;
  /** ISO timestamp of when the snapshot was captured */
  capturedAt: string;

  // Key stats from StatsData
  commitsTotal: number;
  prsMergedCount: number;
  prsMergedWeight: number;
  reviewsSubmittedCount: number;
  issuesClosedCount: number;
  reposContributed: number;
  activeDays: number;
  linesAdded: number;
  linesDeleted: number;
  totalStars: number;
  totalForks: number;
  totalWatchers: number;
  topRepoShare: number;

  // Explanatory stats (for score change analysis)
  maxCommitsIn10Min: number;
  microCommitRatio?: number;
  docsOnlyPrRatio?: number;

  // Impact dimensions + classification
  building: number;
  guarding: number;
  consistency: number;
  breadth: number;
  archetype: DeveloperArchetype;
  profileType: ProfileType;
  compositeScore: number;
  adjustedComposite: number;
  confidence: number;
  tier: ImpactTier;

  /** Active confidence penalties — omitted when empty to save bytes. */
  confidencePenalties?: SnapshotPenalty[];
}

// ---------------------------------------------------------------------------
// Creator Studio — Badge customization config
// ---------------------------------------------------------------------------

export type BadgeBackground = "solid" | "aurora" | "particles";
export type BadgeCardStyle = "flat" | "frost" | "smoke" | "crystal" | "aurora-glass";
export type BadgeBorder = "solid-amber" | "gradient-rotating" | "none";
export type BadgeScoreEffect = "standard" | "gold-shimmer" | "gold-leaf" | "chrome" | "embossed" | "neon-amber" | "holographic";
export type BadgeHeatmapAnimation = "fade-in" | "diagonal" | "ripple" | "scatter" | "cascade" | "waterfall";
export type BadgeInteraction = "static" | "tilt-3d" | "holographic";
export type BadgeStatsDisplay = "static" | "animated-ease" | "animated-spring";
export type BadgeTierTreatment = "standard" | "enhanced";
export type BadgeCelebration = "none" | "confetti";

/** User-authored badge visual configuration (stored in Redis, no TTL) */
export interface BadgeConfig {
  background: BadgeBackground;
  cardStyle: BadgeCardStyle;
  border: BadgeBorder;
  scoreEffect: BadgeScoreEffect;
  heatmapAnimation: BadgeHeatmapAnimation;
  interaction: BadgeInteraction;
  statsDisplay: BadgeStatsDisplay;
  tierTreatment: BadgeTierTreatment;
  celebration: BadgeCelebration;
}

/** All valid values for each BadgeConfig field (used by validation + UI) */
export const BADGE_CONFIG_OPTIONS = {
  background: ["solid", "aurora", "particles"] as const,
  cardStyle: ["flat", "frost", "smoke", "crystal", "aurora-glass"] as const,
  border: ["solid-amber", "gradient-rotating", "none"] as const,
  scoreEffect: ["standard", "gold-shimmer", "gold-leaf", "chrome", "embossed", "neon-amber", "holographic"] as const,
  heatmapAnimation: ["fade-in", "diagonal", "ripple", "scatter", "cascade", "waterfall"] as const,
  interaction: ["static", "tilt-3d", "holographic"] as const,
  statsDisplay: ["static", "animated-ease", "animated-spring"] as const,
  tierTreatment: ["standard", "enhanced"] as const,
  celebration: ["none", "confetti"] as const,
} as const;

/** Default config — all fields set to their first (most basic) option */
export const DEFAULT_BADGE_CONFIG: BadgeConfig = {
  background: "solid",
  cardStyle: "flat",
  border: "solid-amber",
  scoreEffect: "standard",
  heatmapAnimation: "fade-in",
  interaction: "static",
  statsDisplay: "static",
  tierTreatment: "standard",
  celebration: "none",
};

// ---------------------------------------------------------------------------
// Feature Flags — DB-backed feature toggle system
// ---------------------------------------------------------------------------

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
