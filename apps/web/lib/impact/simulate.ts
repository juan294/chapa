import type { DimensionScores } from "@chapa/shared";
import { observedPointResult, SCORING_OBSERVED_POLICY, type CoreCountInputs } from "@chapa/shared";
import { CORE_DIMENSION_KEYS, type ScoreViewModel } from "@/lib/profile/score-view-model";
import { publicScoreProjection } from "@/lib/profile/public-score-projection";
import { calculateObservedCoreV7 } from "./observed-v7";
import { coreTierV7 } from "./v7";

type CountOverrides = Partial<Omit<CoreCountInputs, "quality">> & { quality?: Partial<CoreCountInputs["quality"]> };
export type ObservedScenario = { dimensions: Partial<DimensionScores>; counts?: never } | { counts: CountOverrides; dimensions?: never };
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Hypothetical only: a dimension scenario cannot claim that evidence was attained. */
export function simulateObservedScore(model: ScoreViewModel, scenario: ObservedScenario) {
  if (model.policyVersion !== "v7.2" || model.composite.kind !== "point" || model.freshness === "unavailable") throw new RangeError("Current point baseline required");
  if (!record(scenario) || Object.keys(scenario).length !== 1) throw new RangeError("Choose dimensions or counts");
  const baseline = publicScoreProjection(model);
  const context = { hypothetical: true as const, policyVersion: "v7.2" as const, baselineRevision: model.identity?.revisionId ?? null,
    baselineIdentity: model.identity, window: model.window ?? model.observedInputs?.window ?? null, illustrative: model.illustrative === true };
  if (!model.identity && !model.illustrative) throw new RangeError("Receipt baseline required");
  if ("counts" in scenario) {
    const inputs = model.observedInputs;
    if (!inputs) throw new RangeError("Receipt input baseline required");
    if (!model.illustrative && (!model.window || (["referenceTime", "referenceDate", "startInclusive", "endExclusive", "calendarDays"] as const).some(key => inputs.window[key] !== model.window![key]))) throw new RangeError("Baseline context mismatch");
    const original = calculateObservedCoreV7(inputs);
    if (Math.abs(original.core.composite.exact - model.composite.value) > SCORING_OBSERVED_POLICY.numericTolerance
      || CORE_DIMENSION_KEYS.some(key => { const value = model.dimensions[key]; return value.kind !== "point" || Math.abs(original.core.dimensions[key].exact - value.value) > SCORING_OBSERVED_POLICY.numericTolerance; })) throw new RangeError("Baseline context mismatch");
    const overrides = scenario.counts;
    if (!record(overrides) || Object.keys(overrides).some(key => !["deliveryUnits", "quality", "activeIsoWeeks", "eligibleProjects", "eligibleCategories"].includes(key))) throw new RangeError("Unknown evidence count");
    if (overrides.quality !== undefined && (!record(overrides.quality) || Object.keys(overrides.quality).some(key => !["rationale", "verification", "review_or_correction", "outcome_followup"].includes(key)))) throw new RangeError("Unknown quality criterion");
    for (const value of [...Object.entries(overrides).filter(([key]) => key !== "quality").map(([, value]) => value), ...Object.values(overrides.quality ?? {})]) {
      if (!record(value) || Object.keys(value).sort().join(",") !== "lower,upper") throw new RangeError("Count bounds required");
    }
    const calculated = calculateObservedCoreV7({ ...inputs, counts: { ...inputs.counts, ...overrides, quality: { ...inputs.counts.quality, ...overrides.quality } } });
    const dimensions = { ...baseline.dimensions };
    for (const key of CORE_DIMENSION_KEYS) dimensions[key] = calculated.core.dimensions[key].displayValue;
    return { ...context, scope: "evidence_counts" as const, inputs: calculated.inputs, dimensions, exactDimensions: Object.fromEntries(CORE_DIMENSION_KEYS.map(key => [key, calculated.core.dimensions[key].exact])),
      exactScore: calculated.core.composite.exact, displayScore: calculated.core.composite.displayValue, tier: calculated.core.tier,
      deltaVsCurrent: calculated.core.composite.exact - model.composite.value, craft: baseline.craft, trace: calculated.trace };
  }
  const overrides = scenario.dimensions;
  if (!record(overrides) || Object.entries(overrides).some(([key, value]) => !( [...CORE_DIMENSION_KEYS, "craft"] as readonly string[]).includes(key) || typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)) throw new RangeError("Dimensions must be numbers from 0 to 100");
  const exactDimensions = { ...baseline.exactDimensions, ...overrides };
  if (CORE_DIMENSION_KEYS.some(key => exactDimensions[key] === undefined)) throw new RangeError("Point dimensions required");
  const exactScore = CORE_DIMENSION_KEYS.reduce((sum, key) => sum + exactDimensions[key]! * SCORING_OBSERVED_POLICY.coreWeights[key], 0);
  const point = observedPointResult(exactScore, "core");
  return { ...context, scope: "dimension_scenario" as const, note: "Hypothetical dimension values; no evidence attainment or publication is claimed. Craft never changes the four-weight core.",
    inputs: { dimensions: exactDimensions }, dimensions: Object.fromEntries(Object.entries(exactDimensions).map(([key, value]) => [key, observedPointResult(value!, key === "craft" ? "craft" : "dimension").displayValue])),
    exactDimensions, exactScore, displayScore: point.displayValue, tier: coreTierV7(exactScore), deltaVsCurrent: exactScore - model.composite.value };
}
