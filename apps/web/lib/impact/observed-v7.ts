import {
  observedPointResult, SCORING_OBSERVED_POLICY,
  type CountBounds, type EngineeringEvidenceInput, type ObservedCoreCalculation,
  type ObservedCoreInputs, type ObservedCoreResult, type ObservedScalarTrace,
} from "@chapa/shared";
import { calculateCoreV7, coreTierV7 } from "./v7";
import { deriveCoreEvidenceV7, type CoreEvidenceV7 } from "./v7-evidence";

function normalization<Cap extends number, Multiplier extends number>(originalBounds: CountBounds, cap: Cap, multiplier: Multiplier): ObservedScalarTrace<Cap, Multiplier> {
  const observedCount = originalBounds.lower;
  const clamped = Math.min(observedCount, cap);
  const normalized = Math.log1p(clamped) / Math.log1p(cap);
  return { originalBounds, observedCount, cap, clamped, normalized, multiplier, weighted: normalized * multiplier };
}

export interface CalculatedObservedCoreV7 extends ObservedCoreCalculation {
  readonly inputs: ObservedCoreInputs;
}

/** Pure recorded-evidence arithmetic. Original completion bounds determine archetype
 * eligibility only; they never supply estimated score credit. No report input exists.
 */
export function calculateObservedCoreV7(input: ObservedCoreInputs): CalculatedObservedCoreV7 {
  if (input.policyVersion !== "v7.2") throw new RangeError("Expected v7.2 observed scoring inputs");
  // Reuse the pinned validator and exact original-bounds archetype eligibility.
  // The new point arithmetic below is independent of the historical endpoints.
  const original = calculateCoreV7({ policyVersion: "v7", window: input.window, counts: input.counts });
  const inputs: ObservedCoreInputs = { policyVersion: "v7.2", window: original.inputs.window, counts: original.inputs.counts };
  const counts = inputs.counts;
  const { caps, coreWeights } = SCORING_OBSERVED_POLICY;
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
  const dimensions = {
    delivery: delivery.weighted,
    quality: Object.values(quality).reduce((sum, criterion) => sum + criterion.weighted, 0),
    consistency: consistency.weighted,
    breadth: breadth.projects.weighted + breadth.categories.weighted,
  };
  const weightedDimensions = {
    delivery: dimensions.delivery * coreWeights.delivery,
    quality: dimensions.quality * coreWeights.quality,
    consistency: dimensions.consistency * coreWeights.consistency,
    breadth: dimensions.breadth * coreWeights.breadth,
  };
  const composite = Object.values(weightedDimensions).reduce((sum, value) => sum + value, 0);
  const core: ObservedCoreResult = {
    dimensions: {
      delivery: observedPointResult(dimensions.delivery, "dimension"),
      quality: observedPointResult(dimensions.quality, "dimension"),
      consistency: observedPointResult(dimensions.consistency, "dimension"),
      breadth: observedPointResult(dimensions.breadth, "dimension"),
    },
    composite: observedPointResult(composite, "core"),
    tier: coreTierV7(composite),
    archetype: original.core.archetype,
  };
  return { inputs, core, trace: { delivery, quality, consistency, breadth, dimensions, weightedDimensions, composite, displayed: core } };
}

/** Receives normalized evidence, never a provider read-result fallback. Errors propagate
 * to the materializer; coverage, limitations and uncapped observed totals stay intact.
 */
export function computeObservedImpactV7(input: EngineeringEvidenceInput): Omit<CoreEvidenceV7, "inputs"> & CalculatedObservedCoreV7 {
  const evidence = deriveCoreEvidenceV7(input);
  return { ...evidence, ...calculateObservedCoreV7({ policyVersion: "v7.2", window: evidence.inputs.window, counts: evidence.inputs.counts }) };
}
