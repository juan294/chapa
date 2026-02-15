import type { DeveloperArchetype, ImpactTier, ProfileType } from "@chapa/shared";

/**
 * Compact daily snapshot of a user's metrics + impact scores.
 *
 * Stored permanently in Redis sorted sets (key: `history:<handle>`).
 * ~300 bytes JSON — excludes heatmapData (7KB), confidencePenalties
 * (recomputable), and mutable display fields (avatarUrl, displayName).
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
}
