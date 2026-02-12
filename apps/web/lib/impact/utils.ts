import type {
  Stats90d,
  ImpactTier,
  ConfidencePenalty,
  ConfidenceFlag,
} from "@chapa/shared";

// ---------------------------------------------------------------------------
// Normalization: f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)
// ---------------------------------------------------------------------------

export function normalize(x: number, cap: number): number {
  if (x <= 0) return 0;
  const clamped = Math.min(x, cap);
  return Math.log(1 + clamped) / Math.log(1 + cap);
}

// ---------------------------------------------------------------------------
// Confidence (50–100)
// ---------------------------------------------------------------------------

const CONFIDENCE_REASONS: Record<ConfidenceFlag, string> = {
  burst_activity:
    "Some activity appears in short bursts, which reduces timing confidence.",
  micro_commit_pattern:
    "Many very small changes in this period reduce signal clarity.",
  generated_change_pattern:
    "Large change volume with limited review signals reduces confidence.",
  low_collaboration_signal:
    "Limited review and collaboration signals detected in this period.",
  single_repo_concentration:
    "Most activity is concentrated in one repo (not bad\u2014just less cross-repo signal).",
  supplemental_unverified:
    "Includes activity from a linked account that cannot be independently verified.",
};

export function computeConfidence(stats: Stats90d): {
  confidence: number;
  penalties: ConfidencePenalty[];
} {
  const penalties: ConfidencePenalty[] = [];
  let score = 100;

  if (stats.maxCommitsIn10Min >= 20) {
    penalties.push({
      flag: "burst_activity",
      penalty: 15,
      reason: CONFIDENCE_REASONS.burst_activity,
    });
    score -= 15;
  }

  if (
    stats.microCommitRatio !== undefined &&
    stats.microCommitRatio >= 0.6
  ) {
    penalties.push({
      flag: "micro_commit_pattern",
      penalty: 10,
      reason: CONFIDENCE_REASONS.micro_commit_pattern,
    });
    score -= 10;
  }

  const totalLines = stats.linesAdded + stats.linesDeleted;
  if (totalLines >= 20000 && stats.reviewsSubmittedCount <= 2) {
    penalties.push({
      flag: "generated_change_pattern",
      penalty: 15,
      reason: CONFIDENCE_REASONS.generated_change_pattern,
    });
    score -= 15;
  }

  if (stats.prsMergedCount >= 10 && stats.reviewsSubmittedCount <= 1) {
    penalties.push({
      flag: "low_collaboration_signal",
      penalty: 10,
      reason: CONFIDENCE_REASONS.low_collaboration_signal,
    });
    score -= 10;
  }

  if (stats.topRepoShare >= 0.95 && stats.reposContributed <= 1) {
    penalties.push({
      flag: "single_repo_concentration",
      penalty: 5,
      reason: CONFIDENCE_REASONS.single_repo_concentration,
    });
    score -= 5;
  }

  if (stats.hasSupplementalData) {
    penalties.push({
      flag: "supplemental_unverified",
      penalty: 5,
      reason: CONFIDENCE_REASONS.supplemental_unverified,
    });
    score -= 5;
  }

  return { confidence: Math.max(50, score), penalties };
}

// ---------------------------------------------------------------------------
// Adjusted score (0–100)
// ---------------------------------------------------------------------------

export function computeAdjustedScore(
  base: number,
  confidence: number,
): number {
  const adjusted = base * (0.85 + 0.15 * (confidence / 100));
  return Math.round(Math.max(0, Math.min(100, adjusted)));
}

// ---------------------------------------------------------------------------
// Tier mapping
// ---------------------------------------------------------------------------

export function getTier(adjustedScore: number): ImpactTier {
  if (adjustedScore >= 85) return "Elite";
  if (adjustedScore >= 70) return "High";
  if (adjustedScore >= 40) return "Solid";
  return "Emerging";
}
