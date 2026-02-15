import type { StatsData, ImpactV4Result } from "@chapa/shared";
import type { MetricsSnapshot } from "./types";

/**
 * Build a compact MetricsSnapshot from stats + impact data.
 *
 * Pure function — deterministic output for a given input + current time.
 * Excludes bulky/mutable fields (heatmapData, confidencePenalties,
 * displayName, avatarUrl, derived ratios).
 */
export function buildSnapshot(
  stats: StatsData,
  impact: ImpactV4Result,
): MetricsSnapshot {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    capturedAt: now.toISOString(),

    commitsTotal: stats.commitsTotal,
    prsMergedCount: stats.prsMergedCount,
    prsMergedWeight: stats.prsMergedWeight,
    reviewsSubmittedCount: stats.reviewsSubmittedCount,
    issuesClosedCount: stats.issuesClosedCount,
    reposContributed: stats.reposContributed,
    activeDays: stats.activeDays,
    linesAdded: stats.linesAdded,
    linesDeleted: stats.linesDeleted,
    totalStars: stats.totalStars,
    totalForks: stats.totalForks,
    totalWatchers: stats.totalWatchers,
    topRepoShare: stats.topRepoShare,

    building: impact.dimensions.building,
    guarding: impact.dimensions.guarding,
    consistency: impact.dimensions.consistency,
    breadth: impact.dimensions.breadth,
    archetype: impact.archetype,
    profileType: impact.profileType,
    compositeScore: impact.compositeScore,
    adjustedComposite: impact.adjustedComposite,
    confidence: impact.confidence,
    tier: impact.tier,
  };
}
