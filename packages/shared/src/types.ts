/** Daily activity count for heatmap (13 weeks × 7 days = 91 entries) */
export interface HeatmapDay {
  date: string; // ISO date string (YYYY-MM-DD)
  count: number;
}

/** Aggregated GitHub stats over the last 90 days */
export interface Stats90d {
  handle: string;
  displayName?: string; // GitHub profile name (e.g. "Juan García"), undefined if unset
  avatarUrl?: string; // GitHub avatar URL
  commitsTotal: number; // cap 200
  activeDays: number; // 0..90
  prsMergedCount: number;
  prsMergedWeight: number; // cap 40
  reviewsSubmittedCount: number; // cap 60
  issuesClosedCount: number; // cap 30
  linesAdded: number;
  linesDeleted: number;
  reposContributed: number; // cap 10
  topRepoShare: number; // 0..1
  maxCommitsIn10Min: number; // derived from commit timestamps
  microCommitRatio?: number; // optional, 0..1
  docsOnlyPrRatio?: number; // optional, 0..1
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
  | "supplemental_unverified";

/** A single confidence penalty with reason */
export interface ConfidencePenalty {
  flag: ConfidenceFlag;
  penalty: number;
  reason: string;
}

/** Normalized score breakdown (each 0..1 before weighting) */
export interface ScoreBreakdown {
  commits: number;
  prWeight: number;
  reviews: number;
  issues: number;
  streak: number;
  collaboration: number;
}

/** Impact tier based on adjusted score */
export type ImpactTier = "Emerging" | "Solid" | "High" | "Elite";

/** Full Impact v3 result */
export interface ImpactV3Result {
  handle: string;
  baseScore: number; // 0..100
  confidence: number; // 50..100
  confidencePenalties: ConfidencePenalty[];
  adjustedScore: number; // 0..100
  tier: ImpactTier;
  breakdown: ScoreBreakdown;
  computedAt: string; // ISO timestamp
}

// ---------------------------------------------------------------------------
// Impact v4: Developer Impact Profile
// ---------------------------------------------------------------------------

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
}

/** Supplemental stats uploaded from a linked account (e.g. GitHub EMU) */
export interface SupplementalStats {
  targetHandle: string; // personal GitHub handle
  sourceHandle: string; // EMU handle
  stats: Stats90d;
  uploadedAt: string; // ISO timestamp
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
