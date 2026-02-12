import type {
  Stats90d,
  DimensionScores,
  DeveloperArchetype,
  ImpactV4Result,
} from "@chapa/shared";
import { normalize, computeConfidence, computeAdjustedScore, getTier } from "./utils";
import { computeHeatmapEvenness } from "./heatmap-evenness";

// ---------------------------------------------------------------------------
// Caps (reuse v3 where applicable)
// ---------------------------------------------------------------------------

const CAPS = {
  prWeight: 40,
  issues: 30,
  commits: 200,
  reviews: 60,
  repos: 10,
  stars: 500,
} as const;

// ---------------------------------------------------------------------------
// Building: shipping meaningful changes
// prsMergedWeight (70%), issuesClosedCount (20%), commitsTotal (10%)
// ---------------------------------------------------------------------------

export function computeBuilding(stats: Stats90d): number {
  const pr = normalize(stats.prsMergedWeight, CAPS.prWeight);
  const issues = normalize(stats.issuesClosedCount, CAPS.issues);
  const commits = normalize(stats.commitsTotal, CAPS.commits);

  const raw = 100 * (0.7 * pr + 0.2 * issues + 0.1 * commits);
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ---------------------------------------------------------------------------
// Guarding: reviewing & quality gatekeeping
// reviewsSubmittedCount (60%), review-to-PR ratio (25%), inverse microCommitRatio (15%)
// ---------------------------------------------------------------------------

export function computeGuarding(stats: Stats90d): number {
  if (stats.reviewsSubmittedCount === 0) return 0;

  const reviews = normalize(stats.reviewsSubmittedCount, CAPS.reviews);

  // Review-to-PR ratio: how much reviewing vs own shipping
  // Cap the ratio at 5:1 for normalization
  let reviewRatio = 0;
  if (stats.prsMergedCount > 0) {
    const ratio = stats.reviewsSubmittedCount / stats.prsMergedCount;
    reviewRatio = Math.min(ratio, 5) / 5;
  } else if (stats.reviewsSubmittedCount > 0) {
    // Reviews without own PRs → pure reviewer → max ratio
    reviewRatio = 1;
  }

  // Inverse micro-commit ratio: low micro-commit ratio → high quality
  const microRatio = stats.microCommitRatio ?? 0;
  const inverseMicro = 1 - microRatio;

  const raw = 100 * (0.6 * reviews + 0.25 * reviewRatio + 0.15 * inverseMicro);
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ---------------------------------------------------------------------------
// Consistency: reliable, sustained contributions
// activeDays/90 (50%), heatmap evenness (35%), inverse burst activity (15%)
// ---------------------------------------------------------------------------

export function computeConsistency(stats: Stats90d): number {
  if (stats.activeDays === 0) return 0;

  const streak = Math.min(stats.activeDays, 90) / 90;
  const evenness = computeHeatmapEvenness(stats.heatmapData);

  // Inverse burst: low maxCommitsIn10Min → steady work
  // Cap at 30 for normalization; 0 bursts → 1.0, 30+ → 0.0
  const burstCap = 30;
  const inverseBurst = 1 - Math.min(stats.maxCommitsIn10Min, burstCap) / burstCap;

  const raw = 100 * (0.5 * streak + 0.35 * evenness + 0.15 * inverseBurst);
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ---------------------------------------------------------------------------
// Breadth: cross-project influence
// reposContributed (40%), inverse topRepoShare (30%), stars (20%), docsOnlyPrRatio (10%)
// ---------------------------------------------------------------------------

export function computeBreadth(stats: Stats90d): number {
  if (stats.reposContributed === 0) return 0;

  const repos = Math.min(stats.reposContributed, CAPS.repos) / CAPS.repos;
  const inverseConcentration = 1 - stats.topRepoShare;
  const stars = normalize(stats.totalStars, CAPS.stars);
  const docsRatio = stats.docsOnlyPrRatio ?? 0;

  const raw = 100 * (0.4 * repos + 0.3 * inverseConcentration + 0.2 * stars + 0.1 * docsRatio);
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ---------------------------------------------------------------------------
// Compute all dimensions
// ---------------------------------------------------------------------------

export function computeDimensions(stats: Stats90d): DimensionScores {
  return {
    building: computeBuilding(stats),
    guarding: computeGuarding(stats),
    consistency: computeConsistency(stats),
    breadth: computeBreadth(stats),
  };
}

// ---------------------------------------------------------------------------
// Archetype derivation
// ---------------------------------------------------------------------------

const DIMENSION_KEYS: (keyof DimensionScores)[] = [
  "building",
  "guarding",
  "consistency",
  "breadth",
];

// Tie-breaking priority: Polymath > Guardian > Marathoner > Builder
const ARCHETYPE_MAP: { key: keyof DimensionScores; archetype: DeveloperArchetype }[] = [
  { key: "breadth", archetype: "Polymath" },
  { key: "guarding", archetype: "Guardian" },
  { key: "consistency", archetype: "Marathoner" },
  { key: "building", archetype: "Builder" },
];

export function deriveArchetype(dimensions: DimensionScores): DeveloperArchetype {
  const values = DIMENSION_KEYS.map((k) => dimensions[k]);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  // Emerging: avg < 40 OR no dimension >= 50
  if (avg < 40 || !values.some((v) => v >= 50)) {
    return "Emerging";
  }

  // Balanced: all within 15 pts AND avg >= 60
  if (range <= 15 && avg >= 60) {
    return "Balanced";
  }

  // Specific archetypes: highest dimension >= 70, with tie-breaking priority
  for (const { key, archetype } of ARCHETYPE_MAP) {
    if (dimensions[key] >= 70 && dimensions[key] === max) {
      return archetype;
    }
  }

  // Fallback: if highest >= 70 but tied with another at the same value,
  // the loop above already handles tie-breaking via order.
  // If no dimension reaches 70, fall back to Emerging.
  return "Emerging";
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function computeImpactV4(stats: Stats90d): ImpactV4Result {
  const dimensions = computeDimensions(stats);
  const archetype = deriveArchetype(dimensions);

  const compositeScore = Math.round(
    (dimensions.building +
      dimensions.guarding +
      dimensions.consistency +
      dimensions.breadth) /
      4
  );

  // Reuse v3 confidence system
  const { confidence, penalties } = computeConfidence(stats);
  const adjustedComposite = computeAdjustedScore(compositeScore, confidence);
  const tier = getTier(adjustedComposite);

  return {
    handle: stats.handle,
    dimensions,
    archetype,
    compositeScore,
    confidence,
    confidencePenalties: penalties,
    adjustedComposite,
    tier,
    computedAt: new Date().toISOString(),
  };
}
