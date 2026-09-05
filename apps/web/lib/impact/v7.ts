import {
  createCoreScoringInputs, scoreBounds, SCORING_V7_POLICY,
  type CoreCalculationTrace, type CoreDimension, type CoreScoringInputs, type CoreScoringResult,
  type CountBounds, type DeveloperArchetype, type EngineeringEvidenceInput, type ExactNumericBounds, type ImpactTier,
  type NormalizationTrace,
} from "@chapa/shared";
import { deriveCoreEvidenceV7, type CoreEvidenceV7 } from "./v7-evidence";

const dimensions = ["delivery", "quality", "consistency", "breadth"] as const;
const archetypes = [
  ["breadth", "Polymath"], ["quality", "Quality Champion"],
  ["consistency", "Marathoner"], ["delivery", "Builder"],
] as const;
function assertPoint(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError("Expected a finite 0–100 point");
}
/** Thresholds are published product choices. Classification always uses the unrounded value. */
export function coreTierV7(value: number): ImpactTier {
  assertPoint(value);
  const thresholds = SCORING_V7_POLICY.tierThresholds;
  if (value >= thresholds.elite) return "Elite";
  if (value >= thresholds.high) return "High";
  if (value >= thresholds.solid) return "Solid";
  return "Emerging";
}
/** Describe evidence shape with all four dimensions and no solo/profile exclusions. */
export function coreArchetypeV7(values: Readonly<Record<CoreDimension, number>>): Exclude<DeveloperArchetype, "Artificer"> {
  const points = dimensions.map(dimension => values[dimension]);
  points.forEach(assertPoint);
  const mean = points.reduce((sum, point) => sum + point, 0) / 4;
  const max = Math.max(...points);
  if (mean < 25 || max < 40) return "Emerging";
  if (max - Math.min(...points) <= 20 && mean >= 50) return "Balanced";
  for (const [dimension, archetype] of archetypes) if (values[dimension] === max && max >= 60) return archetype;
  return "Emerging";
}
/** Reveal enough precision that a rounded point cannot visually cross its tier boundary. */
export function formatCorePointV7(value: number): string {
  const tier = coreTierV7(value);
  const rounded = Math.round(value);
  if (coreTierV7(rounded) === tier) return String(rounded);
  for (let digits = 1; digits <= 6; digits++) {
    const label = value.toFixed(digits);
    if (coreTierV7(Number(label)) === tier) return label;
  }
  return `<${rounded}`;
}
function normalization<Cap extends number, Multiplier extends number>(input: CountBounds, cap: Cap, multiplier: Multiplier): NormalizationTrace<Cap, Multiplier> {
  const clamped = { lower: Math.min(input.lower, cap), upper: Math.min(input.upper, cap) };
  const normalized = { lower: Math.log1p(clamped.lower) / Math.log1p(cap), upper: Math.log1p(clamped.upper) / Math.log1p(cap) };
  return { input, cap, clamped, normalized, multiplier, weighted: { lower: normalized.lower * multiplier, upper: normalized.upper * multiplier } };
}
function sumBounds(values: readonly ExactNumericBounds[]): ExactNumericBounds {
  return values.reduce((sum, value) => ({ lower: sum.lower + value.lower, upper: sum.upper + value.upper }), { lower: 0, upper: 0 });
}

export interface CalculatedCoreV7 {
  readonly inputs: CoreScoringInputs;
  readonly core: CoreScoringResult;
  readonly calculation: CoreCalculationTrace;
}
/** Private engineering-evidence entrypoint; optional insights never enter this boundary. */
export function computeImpactV7(input: EngineeringEvidenceInput): CoreEvidenceV7 & CalculatedCoreV7 {
  const evidence = deriveCoreEvidenceV7(input);
  return { ...evidence, ...calculateCoreV7(evidence.inputs) };
}
/** Entire core arithmetic boundary. Metadata, usage diagnostics and optional Craft are absent. */
export function calculateCoreV7(input: CoreScoringInputs): CalculatedCoreV7 {
  if (input.policyVersion !== "v7") throw new RangeError("Expected v7 scoring inputs");
  const inputs = createCoreScoringInputs(input.window, input.counts);
  const counts = inputs.counts;
  const caps = SCORING_V7_POLICY.caps;
  const delivery = normalization(counts.deliveryUnits, caps.delivery, 100);
  const quality = {
    rationale: normalization(counts.quality.rationale, caps.qualityCriterion, 25),
    verification: normalization(counts.quality.verification, caps.qualityCriterion, 25),
    review_or_correction: normalization(counts.quality.review_or_correction, caps.qualityCriterion, 25),
    outcome_followup: normalization(counts.quality.outcome_followup, caps.qualityCriterion, 25),
  };
  const consistency = normalization(counts.activeIsoWeeks, caps.consistency, 100);
  const breadth = {
    projects: normalization(counts.eligibleProjects, caps.breadthProjects, 50),
    categories: normalization(counts.eligibleCategories, caps.breadthCategories, 50),
  };
  const exactDimensions = { delivery: delivery.weighted, quality: sumBounds(Object.values(quality).map(criterion => criterion.weighted)),
    consistency: consistency.weighted, breadth: sumBounds([breadth.projects.weighted, breadth.categories.weighted]) };
  const weightedDimensions = Object.fromEntries(dimensions.map(dimension => [dimension, {
    lower: exactDimensions[dimension].lower * SCORING_V7_POLICY.coreWeights[dimension],
    upper: exactDimensions[dimension].upper * SCORING_V7_POLICY.coreWeights[dimension],
  }])) as Record<CoreDimension, ExactNumericBounds>;
  const composite = sumBounds(dimensions.map(dimension => weightedDimensions[dimension]));
  const displayedDimensions = Object.fromEntries(dimensions.map(dimension => [dimension,
    scoreBounds(exactDimensions[dimension].lower, exactDimensions[dimension].upper),
  ])) as CoreScoringResult["dimensions"];
  const lowerTier = coreTierV7(composite.lower);
  const core: CoreScoringResult = {
    dimensions: displayedDimensions, composite: scoreBounds(composite.lower, composite.upper),
    tier: lowerTier === coreTierV7(composite.upper) ? lowerTier : null,
    archetype: dimensions.every(dimension => displayedDimensions[dimension].kind === "point")
      ? coreArchetypeV7(Object.fromEntries(dimensions.map(dimension => [dimension, exactDimensions[dimension].lower])) as Record<CoreDimension, number>) : null,
  };
  return { inputs, core, calculation: { delivery, quality, consistency, breadth,
    dimensions: exactDimensions, weightedDimensions, composite, displayed: core } };
}
