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
  const microRatio = stats.microCommitRatio ?? 0;
  const inverseMicro = 1 - microRatio;

  const raw = 100 * (0.6 * reviews + 0.25 * reviewRatio + 0.15 * inverseMicro);
  return clampScore(raw);
}

// ---------------------------------------------------------------------------
// Consistency: reliable, sustained contributions
// activeDays/SCORING_WINDOW_DAYS (50%), heatmap evenness (35%), inverse burst activity (15%)
// ---------------------------------------------------------------------------

export function computeConsistency(stats: StatsData): number {
  if (stats.activeDays === 0) return 0;

  const streak = Math.min(stats.activeDays, SCORING_WINDOW_DAYS) / SCORING_WINDOW_DAYS;
  const evenness = computeHeatmapEvenness(stats.heatmapData);

  // Inverse burst: low maxCommitsIn10Min → steady work
  // Cap at 30 for normalization; 0 bursts → 1.0, 30+ → 0.0
  const burstCap = 30;
  const inverseBurst = 1 - Math.min(stats.maxCommitsIn10Min, burstCap) / burstCap;

  const raw = 100 * (0.5 * streak + 0.35 * evenness + 0.15 * inverseBurst);
  return clampScore(raw);
}

// ---------------------------------------------------------------------------
// Breadth: cross-project influence
// reposContributed (35%), inverse topRepoShare (25%), stars (15%), forks (10%), watchers (5%), docsOnlyPrRatio (10%)
// ---------------------------------------------------------------------------

export function computeBreadth(stats: StatsData): number {
  if (stats.reposContributed === 0) return 0;

  const repos = Math.min(stats.reposContributed, CAPS.repos) / CAPS.repos;
  const inverseConcentration = 1 - stats.topRepoShare;
  const stars = normalize(stats.totalStars, CAPS.stars);
  const forks = normalize(stats.totalForks, CAPS.forks);
  const watchers = normalize(stats.totalWatchers, CAPS.watchers);
  const docsRatio = stats.docsOnlyPrRatio ?? 0;

  const raw = 100 * (0.35 * repos + 0.25 * inverseConcentration + 0.15 * stars + 0.1 * forks + 0.05 * watchers + 0.1 * docsRatio);
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

  // Emerging: avg < 40 OR no dimension >= 50
  if (avg < 40 || !values.some((v) => v >= 50)) {
    return "Emerging";
  }

  // Balanced: all within 15 pts AND avg >= 60
  if (range <= 15 && avg >= 60) {
    return "Balanced";
  }

  // Specific archetypes: highest dimension >= 70, with tie-breaking priority
  // Solo profiles skip Guardian
  const candidates = isSolo
    ? ARCHETYPE_MAP.filter((a) => a.archetype !== "Guardian")
    : ARCHETYPE_MAP;

  for (const { key, archetype } of candidates) {
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

  const { confidence, penalties } = computeConfidence(stats, profileType);
  const adjustedComposite = computeAdjustedScore(compositeScore, confidence);
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
