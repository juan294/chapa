import type { StatsData, ImpactV4Result } from "@chapa/shared";
import type { MetricsSnapshot } from "./types";
import { toDateString } from "@/lib/utils/date";

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
    date: toDateString(now),
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
    ...(stats.prDescriptionRate !== undefined && { prDescriptionRate: stats.prDescriptionRate }),
    ...(stats.featureBranchRate !== undefined && { featureBranchRate: stats.featureBranchRate }),
    ...(stats.issueLinkageRate !== undefined && { issueLinkageRate: stats.issueLinkageRate }),

    delivery: impact.dimensions.delivery,
    quality: impact.dimensions.quality,
    consistency: impact.dimensions.consistency,
    breadth: impact.dimensions.breadth,
    ...(impact.dimensions.craft != null && { craft: impact.dimensions.craft }),
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
