import type {
  StatsData,
  DimensionScores,
  DeveloperArchetype,
  ImpactV4Result,
  ProfileType,
} from "@chapa/shared";
import { SCORING_CAPS, SCORING_WINDOW_DAYS } from "@chapa/shared";
import { normalize, clampScore, computeConfidence, computeAdjustedScore, getTier } from "./utils";
import { computeHeatmapEvenness } from "./heatmap-evenness";
import { computeRecencyRatio, applyRecencyWeight } from "./recency";

// ---------------------------------------------------------------------------
// Caps — calibrated for 365-day window (imported from shared constants)
// ---------------------------------------------------------------------------

const CAPS = SCORING_CAPS;

// ---------------------------------------------------------------------------
// Building: shipping meaningful changes
// prsMergedWeight (70%), issuesClosedCount (20%), commitsTotal (10%)
// ---------------------------------------------------------------------------

export function computeBuilding(stats: StatsData): number {
  const pr = normalize(stats.prsMergedWeight, CAPS.prWeight);
  const issues = normalize(stats.issuesClosedCount, CAPS.issues);
  const commits = normalize(stats.commitsTotal, CAPS.commits);

  const raw = 100 * (0.7 * pr + 0.2 * issues + 0.1 * commits);
  return clampScore(raw);
}

// ---------------------------------------------------------------------------
// Guarding: reviewing & quality gatekeeping
// reviewsSubmittedCount (60%), review-to-PR ratio (25%), inverse microCommitRatio (15%)
// ---------------------------------------------------------------------------

export function computeGuarding(stats: StatsData): number {
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
  // Default 0.3 when unknown (no free points — assumes moderate micro-commit activity)
  const microRatio = stats.microCommitRatio ?? 0.3;
  const inverseMicro = 1 - microRatio;

  const raw = 100 * (0.6 * reviews + 0.25 * reviewRatio + 0.15 * inverseMicro);
  return clampScore(raw);
}

// ---------------------------------------------------------------------------
// Consistency: reliable, sustained contributions
// V5: sqrt(activeDays/365) (45%), heatmap evenness (40%), inverse burst (15%)
// sqrt curve: easier to start, harder to climb — 120 days ≈ 57% (was 33% linear)
// ---------------------------------------------------------------------------

export function computeConsistency(stats: StatsData): number {
  if (stats.activeDays === 0) return 0;

  const streak = Math.sqrt(Math.min(stats.activeDays, SCORING_WINDOW_DAYS) / SCORING_WINDOW_DAYS);
  const evenness = computeHeatmapEvenness(stats.heatmapData);

  // Inverse burst: low maxCommitsIn10Min → steady work
  // Cap at 30 for normalization; 0 bursts → 1.0, 30+ → 0.0
  const burstCap = 30;
  const inverseBurst = 1 - Math.min(stats.maxCommitsIn10Min, burstCap) / burstCap;

  const raw = 100 * (0.45 * streak + 0.40 * evenness + 0.15 * inverseBurst);
  return clampScore(raw);
}

// ---------------------------------------------------------------------------
// Breadth: cross-project influence
// V5: repos (40%), inverseConcentration (25%), stars (10%), forks (5%),
//     docsOnlyPrRatio (15%), reserved 5% (zeros for now). Watchers dropped.
// ---------------------------------------------------------------------------

export function computeBreadth(stats: StatsData): number {
  if (stats.reposContributed === 0) return 0;

  const repos = Math.min(stats.reposContributed, CAPS.repos) / CAPS.repos;
  const inverseConcentration = 1 - stats.topRepoShare;
  const stars = normalize(stats.totalStars, CAPS.stars);
  const forks = normalize(stats.totalForks, CAPS.forks);
  const docsRatio = stats.docsOnlyPrRatio ?? 0;

  const raw = 100 * (0.40 * repos + 0.25 * inverseConcentration + 0.10 * stars + 0.05 * forks + 0.15 * docsRatio);
  return clampScore(raw);
}

// ---------------------------------------------------------------------------
// Compute all dimensions
// ---------------------------------------------------------------------------

export function computeDimensions(stats: StatsData): DimensionScores {
  return {
    building: computeBuilding(stats),
    guarding: computeGuarding(stats),
    consistency: computeConsistency(stats),
    breadth: computeBreadth(stats),
  };
}

// ---------------------------------------------------------------------------
// Profile type detection
// ---------------------------------------------------------------------------

export function detectProfileType(stats: StatsData): ProfileType {
  return stats.reviewsSubmittedCount === 0 ? "solo" : "collaborative";
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

const SOLO_DIMENSION_KEYS: (keyof DimensionScores)[] = [
  "building",
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

export function deriveArchetype(
  dimensions: DimensionScores,
  profileType: ProfileType = "collaborative",
): DeveloperArchetype {
  const isSolo = profileType === "solo";
  const keys = isSolo ? SOLO_DIMENSION_KEYS : DIMENSION_KEYS;
  const values = keys.map((k) => dimensions[k]);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  // V5 Emerging: avg < 25 OR no dimension >= 40
  if (avg < 25 || !values.some((v) => v >= 40)) {
    return "Emerging";
  }

  // V5 Balanced: all within 20 pts AND avg >= 50
  if (range <= 20 && avg >= 50) {
    return "Balanced";
  }

  // V5 Specific archetypes: highest dimension >= 60 (was 70), with tie-breaking priority
  // Solo profiles skip Guardian
  const candidates = isSolo
    ? ARCHETYPE_MAP.filter((a) => a.archetype !== "Guardian")
    : ARCHETYPE_MAP;

  for (const { key, archetype } of candidates) {
    if (dimensions[key] >= 60 && dimensions[key] === max) {
      return archetype;
    }
  }

  // Fallback: if no dimension reaches 60, fall back to Emerging.
  return "Emerging";
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function computeImpactV4(stats: StatsData): ImpactV4Result {
  const profileType = detectProfileType(stats);
  const dimensions = computeDimensions(stats);
  const archetype = deriveArchetype(dimensions, profileType);

  const compositeScore =
    profileType === "solo"
      ? Math.round(
          (dimensions.building + dimensions.consistency + dimensions.breadth) / 3
        )
      : Math.round(
          (dimensions.building +
            dimensions.guarding +
            dimensions.consistency +
            dimensions.breadth) /
            4
        );

  // V5: Apply recency weighting before confidence adjustment
  const recencyRatio = computeRecencyRatio(stats.heatmapData);
  const recencyWeighted = applyRecencyWeight(compositeScore, recencyRatio);

  const { confidence, penalties } = computeConfidence(stats, profileType);
  const adjustedComposite = computeAdjustedScore(recencyWeighted, confidence);
  const tier = getTier(adjustedComposite);

  return {
    handle: stats.handle,
    profileType,
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
