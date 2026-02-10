import type {
  Stats90d,
  ImpactV3Result,
  ImpactTier,
  ScoreBreakdown,
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
// Base score (0–100)
// ---------------------------------------------------------------------------

export const WEIGHTS = {
  commits: 0.12,
  prWeight: 0.33,
  reviews: 0.22,
  issues: 0.1,
  streak: 0.13,
  collaboration: 0.1,
} as const;

const CAPS = {
  commits: 200,
  prWeight: 40,
  reviews: 60,
  issues: 30,
  repos: 10,
} as const;

export function computeBaseScore(stats: Stats90d): {
  score: number;
  breakdown: ScoreBreakdown;
} {
  const breakdown: ScoreBreakdown = {
    commits: normalize(stats.commitsTotal, CAPS.commits),
    prWeight: normalize(stats.prsMergedWeight, CAPS.prWeight),
    reviews: normalize(stats.reviewsSubmittedCount, CAPS.reviews),
    issues: normalize(stats.issuesClosedCount, CAPS.issues),
    streak: Math.min(stats.activeDays, 90) / 90,
    collaboration: Math.min(stats.reposContributed, CAPS.repos) / CAPS.repos,
  };

  const raw =
    100 *
    (WEIGHTS.commits * breakdown.commits +
      WEIGHTS.prWeight * breakdown.prWeight +
      WEIGHTS.reviews * breakdown.reviews +
      WEIGHTS.issues * breakdown.issues +
      WEIGHTS.streak * breakdown.streak +
      WEIGHTS.collaboration * breakdown.collaboration);

  return { score: Math.round(raw), breakdown };
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

  // burst_activity: -15 if maxCommitsIn10Min >= 20
  if (stats.maxCommitsIn10Min >= 20) {
    penalties.push({
      flag: "burst_activity",
      penalty: 15,
      reason: CONFIDENCE_REASONS.burst_activity,
    });
    score -= 15;
  }

  // micro_commit_pattern: -10 if microCommitRatio >= 0.6 (only if computed)
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

  // generated_change_pattern: -15 if (linesAdded+linesDeleted >= 20000) AND low review
  const totalLines = stats.linesAdded + stats.linesDeleted;
  if (totalLines >= 20000 && stats.reviewsSubmittedCount <= 2) {
    penalties.push({
      flag: "generated_change_pattern",
      penalty: 15,
      reason: CONFIDENCE_REASONS.generated_change_pattern,
    });
    score -= 15;
  }

  // low_collaboration_signal: -10 if prsMergedCount >= 10 AND reviewsSubmittedCount <= 1
  if (stats.prsMergedCount >= 10 && stats.reviewsSubmittedCount <= 1) {
    penalties.push({
      flag: "low_collaboration_signal",
      penalty: 10,
      reason: CONFIDENCE_REASONS.low_collaboration_signal,
    });
    score -= 10;
  }

  // single_repo_concentration: -5 if topRepoShare >= 0.95 AND reposContributed <= 1
  if (stats.topRepoShare >= 0.95 && stats.reposContributed <= 1) {
    penalties.push({
      flag: "single_repo_concentration",
      penalty: 5,
      reason: CONFIDENCE_REASONS.single_repo_concentration,
    });
    score -= 5;
  }

  // supplemental_unverified: -5 if stats include merged supplemental data
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

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function computeImpactV3(stats: Stats90d): ImpactV3Result {
  const { score: baseScore, breakdown } = computeBaseScore(stats);
  const { confidence, penalties } = computeConfidence(stats);
  const adjustedScore = computeAdjustedScore(baseScore, confidence);
  const tier = getTier(adjustedScore);

  return {
    handle: stats.handle,
    baseScore,
    confidence,
    confidencePenalties: penalties,
    adjustedScore,
    tier,
    breakdown,
    computedAt: new Date().toISOString(),
  };
}
