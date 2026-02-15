import type { StatsData, ImpactV4Result } from "@chapa/shared";
import type { MetricsSnapshot } from "./types";

/**
 * Build a compact MetricsSnapshot from stats + impact data.
 *
 * Pure function — deterministic output for a given input + current time.
 * Excludes bulky/mutable fields (heatmapData, displayName, avatarUrl).
 * Includes explanatory stats and confidence penalties for score change analysis.
 */
export function buildSnapshot(
  stats: StatsData,
  impact: ImpactV4Result,
): MetricsSnapshot {
  const now = new Date();
  const snapshot: MetricsSnapshot = {
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

    maxCommitsIn10Min: stats.maxCommitsIn10Min,
    ...(stats.microCommitRatio !== undefined && { microCommitRatio: stats.microCommitRatio }),
    ...(stats.docsOnlyPrRatio !== undefined && { docsOnlyPrRatio: stats.docsOnlyPrRatio }),

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

  // Only include penalties when non-empty (saves bytes in Redis)
  if (impact.confidencePenalties.length > 0) {
    snapshot.confidencePenalties = impact.confidencePenalties.map((p) => ({
      flag: p.flag,
      penalty: p.penalty,
    }));
  }

  return snapshot;
}
