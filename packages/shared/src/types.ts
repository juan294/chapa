import type { Platform } from "./platforms";

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
  primaryReviewsSubmittedCount?: number; // primary account reviews only (for profile type detection after merge)
  issuesClosedCount: number; // cap 80
  linesAdded: number;
  linesDeleted: number;
  reposContributed: number; // cap 15
  topRepoShare: number; // 0..1
  maxCommitsIn10Min: number; // derived from commit timestamps
  microCommitRatio?: number; // optional, 0..1
  batchSizeScore?: number; // optional, 0..1 — fraction of merged PRs in the reviewable sweet spot (20-500 lines)
  medianPrLeadTimeHours?: number; // optional — median PR lead time in hours (creation → merge)
  docsOnlyPrRatio?: number; // optional, 0..1
  prDescriptionRate?: number; // optional, 0..1 — fraction of merged PRs with non-empty body
  featureBranchRate?: number; // optional, 0..1 — fraction of merged PRs from feature branches
  issueLinkageRate?: number; // optional, 0..1 — fraction of merged PRs linked to issues
  totalStars: number; // sum of stargazerCount across owned repos
  totalForks: number; // sum of forkCount across owned repos
  totalWatchers: number; // sum of watchers.totalCount across owned repos
  heatmapData: HeatmapDay[];
  fetchedAt: string; // ISO timestamp
  hasSupplementalData?: boolean; // true when merged with EMU/supplemental stats
  linkedPlatforms?: Platform[]; // platforms whose data was merged (informational)
  linkedPlatformLogins?: Record<string, string>; // platform → remote username (for profile URLs)
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
  | "review_volume_imbalance"
  | "platform_linked";

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

/** Four independent dimension scores (each 0..100), plus optional craft */
export interface DimensionScores {
  delivery: number;
  quality: number;
  consistency: number;
  breadth: number;
  craft?: number;
}

/** Developer archetype derived from dimension profile shape */
export type DeveloperArchetype =
  | "Builder"
  | "Quality Champion"
  | "Marathoner"
  | "Polymath"
  | "Balanced"
  | "Emerging"
  | "Artificer";

/** Full Impact v6 result */
export interface ImpactV6Result {
  handle: string;
  profileType: ProfileType;
  dimensions: DimensionScores;
  archetype: DeveloperArchetype;
  compositeScore: number; // 0..100 — avg of 4 dimensions
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
  /**
   * Authoritative merged-PR count from `search(query: "is:pr is:merged ...")`.
   * Independent of the token-scoped, 100-node-capped `pullRequestContributions`
   * sample below — used as the source of truth for `prsMergedCount` and as the
   * signal `assessRawFetchIntegrity` compares against the sample to detect a
   * degraded fetch (see `stats-integrity.ts`).
   */
  mergedPrTotalCount: number;
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
      body: string | null;
      headRefName: string;
      baseRefName?: string; // target branch — absent in old cached data
      createdAt?: string; // ISO timestamp — when the PR was created
      mergedAt?: string | null; // ISO timestamp — when the PR was merged (null if not merged)
      closingIssuesCount: number;
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
 * Stored permanently in Supabase `metrics_snapshots` table (UNIQUE on handle+date).
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
  prDescriptionRate?: number;
  featureBranchRate?: number;
  issueLinkageRate?: number;

  // Impact dimensions + classification
  delivery: number;
  quality: number;
  consistency: number;
  breadth: number;
  craft?: number;
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

// ---------------------------------------------------------------------------
// AI Tool Insights — Craft Score
// ---------------------------------------------------------------------------

/** Supported AI coding tools */
export type InsightsTool = "claude-code";

/** Structured data extracted from an AI tool usage report */
export interface InsightsUpload {
  tool: InsightsTool;
  reportPeriod: {
    start: string; // ISO date
    end: string; // ISO date
  };
  volume: {
    messages: number;
    linesAdded: number;
    linesDeleted: number;
    files: number;
    days: number;
    msgsPerDay: number;
  };
  toolUsage: Record<string, number>;
  sessionTypes: Record<string, number>;
  outcomes: {
    fullyAchieved: number;
    mostlyAchieved: number;
    partiallyAchieved: number;
  };
  friction: {
    buggyCode: number;
    wrongApproach: number;
    misunderstoodRequest: number;
  };
  satisfaction: {
    dissatisfied: number;
    likelySatisfied: number;
    satisfied: number;
  };
  multiClauding: {
    overlapEvents: number;
    sessionsInvolved: number;
    messagePercent: number; // 0-100
  };
  responseTime: {
    medianSeconds: number;
    averageSeconds: number;
  };
  toolErrors: Record<string, number>;
  totalSessions: number;
  totalToolCalls: number;
}

/** Three craft sub-dimensions (each 0-100) */
export interface CraftDimensions {
  proficiency: number;
  effectiveness: number;
  sophistication: number;
}

/** Craft score tier */
export type CraftTier = "Novice" | "Practitioner" | "Expert" | "Master";

/** Full craft score result */
export interface CraftResult {
  tool: InsightsTool;
  dimensions: CraftDimensions;
  craftScore: number; // 0-100, avg of 3 dimensions
  tier: CraftTier;
  reportPeriod: {
    start: string;
    end: string;
  };
  computedAt: string; // ISO timestamp
}
