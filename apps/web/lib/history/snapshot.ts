import { SCORING_V7_RECEIPT_RULES, type StatsData, type ImpactV6Result } from "@chapa/shared";
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
  impact: ImpactV6Result,
  today?: string,
  /** The fresh, unsmoothed composite this capture displayed. Recorded beside
   * the smoothed one so a snapshot reader can publish the badge's number
   * without recomputing the profile. */
  headlineScore?: number,
): MetricsSnapshot {
  const now = new Date();
  const snapshot: MetricsSnapshot = {
    date: today ?? toDateString(now),
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
    ...(headlineScore !== undefined && { headlineScore }),
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

/** Receipt/raw headline and trend are separate versioned artifacts. Superseded
 * historical receipts may have no retained trend anchor; never reconstruct one. */
export interface ReceiptSnapshotV7 {
  readonly version: "v7";
  readonly replayStatus: "replayable";
  readonly receipt: import("@chapa/shared").HashedScoreReceipt;
  readonly trend: import("@chapa/shared").TrendObservation;
}
export function buildReceiptSnapshotV7(
  receipt: import("@chapa/shared").HashedScoreReceipt,
  anchor: import("@chapa/shared").TrendAnchor | null,
): ReceiptSnapshotV7 {
  const payload = receipt.receipt;
  // PostgreSQL float JSON output can differ from receipt arithmetic by a few ULPs.
  // Only internal raw math is tolerant; identity, classification and domains remain exact.
  if (anchor && (payload.action === "retract" || anchor.receiptRevisionId !== payload.revisionId || anchor.referenceDate !== payload.window.referenceDate || anchor.policyVersion !== payload.policyVersion || payload.core.composite.kind !== "point" || !Number.isFinite(anchor.rawPoint) || anchor.rawPoint < 0 || anchor.rawPoint > 100 || Math.abs(anchor.rawPoint - payload.core.composite.value) > SCORING_V7_RECEIPT_RULES.numericTolerance || !Number.isFinite(anchor.unroundedValue) || anchor.unroundedValue < 0 || anchor.unroundedValue > 100)) throw new RangeError("Receipt/trend identity mismatch");
  return { version: "v7", replayStatus: "replayable", receipt,
    trend: anchor ? { status: "point", anchor, assumption: "new_value_backward_fill" } : { status: "gap", referenceDate: payload.window.referenceDate, reason: payload.action !== "retract" && payload.core.composite.kind === "range" ? "range" : "missing" } };
}
