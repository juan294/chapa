/** Independent arithmetic implementation. Imports contracts/serialization only, never production calculators. */
import { verifyScoreReceipt, type CoreScoringInputs, type CraftScoringInputs, type CoreScoringResult, type CraftV7Result, type ScoreBounds, type CountBounds, type CoreDimension, type CoreCalculationTrace, type CraftCalculationTrace, type NormalizationTrace, type ExactNumericBounds } from "@chapa/shared";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const qualityKeys = ["rationale", "verification", "review_or_correction", "outcome_followup"] as const;
const craftKeys = ["framing", "verification_debugging", "tool_judgment", "accepted_outcome"] as const;
const dimensionKeys = ["delivery", "quality", "consistency", "breadth"] as const;
function normalize<C extends number, M extends number>(input: CountBounds, cap: C, multiplier: M): NormalizationTrace<C, M> {
  if (!Number.isSafeInteger(input.lower) || !Number.isSafeInteger(input.upper) || input.lower < 0 || input.upper < input.lower) throw new RangeError("Invalid counts");
  const clamped = { lower: Math.min(cap, input.lower), upper: Math.min(cap, input.upper) };
  const normalized = { lower: Math.log1p(clamped.lower) / Math.log1p(cap), upper: Math.log1p(clamped.upper) / Math.log1p(cap) };
  return { input, cap, clamped, normalized, multiplier, weighted: { lower: normalized.lower * multiplier, upper: normalized.upper * multiplier } };
}
function sum(values: readonly ExactNumericBounds[]): ExactNumericBounds {
  let lower = 0, upper = 0;
  for (const value of values) { lower += value.lower; upper += value.upper; }
  return { lower, upper };
}
function display(value: ExactNumericBounds): ScoreBounds {
  return value.lower === value.upper ? { kind: "point", value: value.lower, displayValue: Math.floor(value.lower + 0.5) }
    : { kind: "range", ...value, displayLower: Math.floor(value.lower), displayUpper: Math.ceil(value.upper) };
}
function tier(value: number): CoreScoringResult["tier"] { return value < 30 ? "Emerging" : value < 70 ? "Solid" : value < 85 ? "High" : "Elite"; }
export function referenceCalculate(coreInput: CoreScoringInputs, craftInput: CraftScoringInputs | null = null): { core: CoreScoringResult; craft: CraftV7Result | null; coreTrace: CoreCalculationTrace; craftTrace: CraftCalculationTrace | null } {
  if (coreInput.policyVersion !== "v7" || (craftInput && craftInput.policyVersion !== "v7")) throw new RangeError("Unsupported policy");
  const counts = coreInput.counts;
  const delivery = normalize(counts.deliveryUnits, 120, 100);
  const quality = Object.fromEntries(qualityKeys.map(key => [key, normalize(counts.quality[key], 12, 25)])) as CoreCalculationTrace["quality"];
  const consistency = normalize(counts.activeIsoWeeks, 40, 100);
  const breadth = { projects: normalize(counts.eligibleProjects, 4, 50), categories: normalize(counts.eligibleCategories, 4, 50) };
  const dimensions = { delivery: delivery.weighted, quality: sum(qualityKeys.map(key => quality[key].weighted)), consistency: consistency.weighted, breadth: sum([breadth.projects.weighted, breadth.categories.weighted]) };
  const weightedDimensions = Object.fromEntries(dimensionKeys.map(key => [key, { lower: dimensions[key].lower / 4, upper: dimensions[key].upper / 4 }])) as Record<CoreDimension, ExactNumericBounds>;
  const composite = sum(dimensionKeys.map(key => weightedDimensions[key]));
  const points = dimensionKeys.map(key => dimensions[key].lower);
  const mean = points.reduce((a, b) => a + b, 0) / 4, max = Math.max(...points);
  let archetype: CoreScoringResult["archetype"] = null;
  if (dimensionKeys.every(key => dimensions[key].lower === dimensions[key].upper)) {
    archetype = "Emerging";
    if (mean >= 25 && max >= 40) {
      if (max - Math.min(...points) <= 20 && mean >= 50) archetype = "Balanced";
      else if (max >= 60) {
        if (dimensions.breadth.lower === max) archetype = "Polymath";
        else if (dimensions.quality.lower === max) archetype = "Quality Champion";
        else if (dimensions.consistency.lower === max) archetype = "Marathoner";
        else archetype = "Builder";
      }
    }
  }
  const core: CoreScoringResult = { dimensions: Object.fromEntries(dimensionKeys.map(key => [key, display(dimensions[key])])) as CoreScoringResult["dimensions"], composite: display(composite), tier: tier(composite.lower) === tier(composite.upper) ? tier(composite.lower) : null, archetype };
  const coreTrace = { delivery, quality, consistency, breadth, dimensions, weightedDimensions, composite, displayed: core };
  if (!craftInput) return { core, craft: null, coreTrace, craftTrace: null };
  const eligible = craftInput.eligibleEpisodes, corroborated = craftInput.independentlyCorroboratedCompleteEpisodes;
  if (!Number.isSafeInteger(eligible) || !Number.isSafeInteger(corroborated) || eligible < 0 || corroborated < 0 || corroborated > eligible) throw new RangeError("Invalid episodes");
  const criteria = Object.fromEntries(craftKeys.map(key => {
    const value = craftInput.counts[key];
    if (value.lower > eligible || value.lower < corroborated || (!eligible && value.upper !== 0)) throw new RangeError("Inconsistent episodes");
    return [key, normalize(value, 8, 25)];
  })) as CraftCalculationTrace["criteria"];
  const craftComposite = sum(craftKeys.map(key => criteria[key].weighted));
  const craft: CraftV7Result = eligible === 0 ? { status: "not_observed" } : { status: "observed", criteria: Object.fromEntries(craftKeys.map(key => [key, display(criteria[key].weighted)])) as Extract<CraftV7Result, { status: "observed" }>["criteria"], composite: display(craftComposite), descriptor: craftComposite.lower === craftComposite.upper && craftComposite.lower >= 60 && corroborated > 0 ? "Artificer" : null };
  return { core, craft, coreTrace, craftTrace: { criteria, composite: craftComposite, displayed: craft } };
}
/** Exact integers/labels and shape; only internal floating-point arithmetic has tolerance. */
export function assertReferenceParity(actual: unknown, expected: unknown, key = ""): void {
  if (typeof actual === "number" && typeof expected === "number") {
    const fields = key.split(".");
    const tolerance = fields.some(field => field === "input" || field === "clamped" || field === "cap" || field === "multiplier" || field.startsWith("display") && field !== "displayed") ? 0 : 1e-10;
    if (Math.abs(actual - expected) <= tolerance) return;
  } else if (actual === expected) return;
  else if (actual && expected && typeof actual === "object" && typeof expected === "object") {
    const a = actual as Record<string, unknown>, b = expected as Record<string, unknown>;
    if (JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(b).sort())) {
      for (const field of Object.keys(b)) assertReferenceParity(a[field], b[field], key ? `${key}.${field}` : field);
      return;
    }
  }
  throw new RangeError("Receipt arithmetic mismatch");
}
export async function replayReceipt(value: unknown) {
  const receipt = await verifyScoreReceipt(value);
  const calculated = referenceCalculate(receipt.inputs, receipt.craft?.inputs ?? null);
  assertReferenceParity(receipt.core, calculated.core);
  assertReferenceParity(receipt.calculation.core, calculated.coreTrace);
  assertReferenceParity(receipt.craft?.result ?? null, calculated.craft);
  assertReferenceParity(receipt.calculation.craft, calculated.craftTrace);
  return { replayStatus: "arithmetic_reproduced" as const, receiptId: receipt.receiptId, core: calculated.core, craft: calculated.craft };
}
async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) { console.error("Usage: pnpm exec tsx scripts/scoring/reference-calculator.ts receipt.json"); process.exitCode = 1; }
  else {
    try { console.log(JSON.stringify(await replayReceipt(JSON.parse(await readFile(file, "utf8"))), null, 2)); }
    catch { console.error("Receipt rejected: invalid schema, digest, policy or arithmetic. Legacy evidence cannot be reconstructed."); process.exitCode = 1; }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
