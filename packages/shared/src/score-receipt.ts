import { canonicalJson, canonicalSha256 } from "./canonical-json";
import { createScoringWindow, scoringInstant, type ScoringWindow } from "./scoring-window";
import { SCORING_V7_RECEIPT_RULES, type ScoreBounds, type ExactNumericBounds, type NormalizationTrace, type PublicScoringReceipt, type ScoringScope, type PrivateCriterionAssessment, type PublicCoverageSummary, type PublicCriterionResult } from "./scoring-evidence";

/** The policy file bytes and ordered concatenation of core/Craft engine source bytes.
 * See docs/scoring-reproduction.md. A changed artifact requires a new identity. */
export const RECEIPT_ALGORITHM_V7 = Object.freeze({
  algorithmId: "chapa-impact-v7" as const, revision: "v7.1",
  algorithmDigest: Object.freeze({ algorithm: "SHA-256" as const, value: "e25b31e8c16e9153429dec5dc460296755c04753d249f4e306a6e80ef1c79864" }),
  policyDigest: Object.freeze({ algorithm: "SHA-256" as const, value: "48d367e72e6dead9e220c4b7164690c53ac967d195d54132bd38f1aa639f7ad1" }),
});
export interface HashedScoreReceipt {
  readonly receipt: PublicScoringReceipt;
  readonly contentHash: { readonly algorithm: "SHA-256"; readonly value: string };
}
type Validator = (value: unknown) => boolean;
function check(test: boolean): void { if (!test) throw new TypeError("Invalid public receipt"); }
const number: Validator = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const count: Validator = value => number(value) && Number.isSafeInteger(value);
const boolean: Validator = value => typeof value === "boolean";
const literal = (expected: unknown): Validator => value => canonicalJson(value) === canonicalJson(expected);
const oneOf = (...values: readonly unknown[]): Validator => value => values.includes(value);
const nullable = (validate: Validator): Validator => value => value === null || validate(value);
const array = (validate: Validator): Validator => value => Array.isArray(value) && value.every(validate);
const pattern = (expression: RegExp): Validator => value => typeof value === "string" && expression.test(value);
const object = (fields: Record<string, Validator>): Validator => value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === Object.keys(fields).length && Object.keys(row).every(key => Object.hasOwn(fields, key)) && Object.entries(fields).every(([key, validate]) => validate(row[key]));
};
const instant: Validator = value => typeof value === "string" && scoringInstant(value).toISOString() === value;
const period = object({ startInclusive: instant, endExclusive: instant });
const windowSchema = object({ referenceTime: instant, referenceDate: pattern(/^\d{4}-\d{2}-\d{2}$/), startInclusive: instant, endExclusive: instant, calendarDays: literal(365) });
const bounds: Validator = value => object({ lower: count, upper: count })(value) && (value as { lower: number; upper: number }).lower <= (value as { lower: number; upper: number }).upper;
const exact: Validator = value => object({ lower: number, upper: number })(value) && (value as { lower: number; upper: number }).lower <= (value as { lower: number; upper: number }).upper;
const scoreNumber: Validator = value => number(value) && (value as number) <= 100;
const score: Validator = value => object({ kind: literal("point"), value: scoreNumber, displayValue: count })(value) || object({ kind: literal("range"), lower: scoreNumber, upper: scoreNumber, displayLower: count, displayUpper: count })(value);
const qualityKeys = ["rationale", "verification", "review_or_correction", "outcome_followup"] as const;
const craftKeys = ["framing", "verification_debugging", "tool_judgment", "accepted_outcome"] as const;
const record = (keys: readonly string[], validate: Validator) => object(Object.fromEntries(keys.map(key => [key, validate])));
const dimensions = (validate: Validator) => record(["delivery", "quality", "consistency", "breadth"], validate);
const coreInput = object({ policyVersion: literal("v7"), window: windowSchema, counts: object({ deliveryUnits: bounds, quality: record(qualityKeys, bounds), activeIsoWeeks: bounds, eligibleProjects: bounds, eligibleCategories: bounds }) });
const craftInput = object({ policyVersion: literal("v7"), window: windowSchema, eligibleEpisodes: count, counts: record(craftKeys, bounds), independentlyCorroboratedCompleteEpisodes: count });
const coreResult = object({ dimensions: dimensions(score), composite: score, tier: oneOf(null, "Emerging", "Solid", "High", "Elite"), archetype: oneOf(null, "Emerging", "Balanced", "Builder", "Quality Champion", "Marathoner", "Polymath") });
const craftResult: Validator = value => object({ status: literal("not_observed") })(value) || object({ status: literal("observed"), criteria: record(craftKeys, score), composite: score, descriptor: oneOf(null, "Artificer") })(value);
const normalization = (cap: number, multiplier: number) => object({ input: bounds, cap: literal(cap), clamped: bounds, normalized: exact, multiplier: literal(multiplier), weighted: exact });
const coreTrace = object({ delivery: normalization(120, 100), quality: record(qualityKeys, normalization(12, 25)), consistency: normalization(40, 100), breadth: object({ projects: normalization(4, 50), categories: normalization(4, 50) }), dimensions: dimensions(exact), weightedDimensions: dimensions(exact), composite: exact, displayed: coreResult });
const craftTrace = object({ criteria: record(craftKeys, normalization(8, 25)), composite: exact, displayed: craftResult });
const reason = oneOf("criterion_demonstrated", "criterion_not_demonstrated", "not_assessed", "not_accessible", "not_supported", "pagination_incomplete", "discovery_incomplete", "source_error", "stale_data", "legacy_aggregate", "acceptance_time_unknown", "attribution_unknown", "alias_unresolved", "partial_files", "outside_window", "retracted", "insufficient_evidence");
const provider = oneOf("github", "gitlab", "bitbucket", "codeberg", "supplemental", "portfolio");
const uuid = pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const coverage = object({ sourceRef: pattern(/^source-[1-9]\d*$/), provider, status: oneOf("complete", "partial", "unavailable", "stale", "legacy"), dataThrough: nullable(instant), discovery: oneOf("owned_and_contributed", "contribution_search", "registered_ledger", "explicit_repositories", "legacy_upload"), accessibleRepositoryCount: count, repositoryDiscoveryComplete: boolean, reasonCodes: array(reason), unknownPeriods: array(period) });
const criterion = object({ workItemRef: pattern(/^work-[1-9]\d*$/), criterion: oneOf(...qualityKeys, ...craftKeys), status: oneOf("accepted", "rejected", "unassessed", "retracted"), rubricVersion: literal("v7"), reasonCode: reason, qualifyingCount: oneOf(0, 1), provenance: oneOf("source_observed", "self_reported", "automated_assessment", "human_assessed", "independently_corroborated") });
const receiptSchema = object({ schemaVersion: literal("v7"), policyVersion: literal("v7"), receiptId: uuid, subjectRef: literal("subject-1"), revisionId: uuid, revision: count, recordedAt: instant, supersedesRevisionId: nullable(uuid), action: oneOf("create", "correct", "retract"), window: windowSchema, inputs: coreInput, core: coreResult, craft: nullable(object({ inputs: craftInput, result: craftResult })), criteria: array(criterion), coverage: array(coverage), exclusions: array(object({ provider, reason: oneOf("not_connected", "not_consented") })), limitations: array(reason), serializationVersion: literal("canonical-json-v1"), algorithm: literal(RECEIPT_ALGORITHM_V7), calculation: object({ rules: literal(SCORING_V7_RECEIPT_RULES), core: coreTrace, craft: nullable(craftTrace) }) });
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}
/** Fail closed on unexpected fields at every depth; never publish an arbitrary object spread. */
export function parsePublicScoreReceipt(value: unknown): PublicScoringReceipt {
  const copy: unknown = JSON.parse(canonicalJson(value));
  check(receiptSchema(copy));
  const receipt = copy as PublicScoringReceipt;
  check(canonicalJson(receipt.window) === canonicalJson(createScoringWindow(receipt.window.referenceTime)));
  check(canonicalJson(receipt.inputs.window) === canonicalJson(receipt.window));
  if (receipt.craft) check(canonicalJson(receipt.craft.inputs.window) === canonicalJson(receipt.window));
  check((receipt.craft === null) === (receipt.calculation.craft === null));
  check(receipt.revision >= 1 && (receipt.revision === 1 ? receipt.action === "create" && receipt.supersedesRevisionId === null : receipt.action !== "create" && receipt.supersedesRevisionId !== null && receipt.supersedesRevisionId !== receipt.revisionId));
  check(scoringInstant(receipt.recordedAt) >= scoringInstant(receipt.window.referenceTime));
  validateCriteria(receipt.criteria);
  validateCoverage(receipt.coverage, receipt.window);
  validateArithmetic(receipt);
  return freeze(receipt);
}
/** Both projection and direct public boundaries require already resolved verdicts. */
function validateCriteria(rows: readonly PublicCriterionResult[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = canonicalJson([row.workItemRef, row.criterion]);
    check(!seen.has(key)); seen.add(key);
    check(row.status !== "retracted");
    check(row.qualifyingCount === (row.status === "accepted" ? 1 : 0));
    check(row.status !== "accepted" || (row.reasonCode === "criterion_demonstrated" && row.provenance !== "self_reported"));
  }
}
function validateCoverage(rows: readonly PublicCoverageSummary[], window: ScoringWindow): void {
  check(new Set(rows.map(row => row.sourceRef)).size === rows.length);
  for (const row of rows) {
    check(row.dataThrough === null || scoringInstant(row.dataThrough) <= scoringInstant(window.referenceTime));
    if (row.status === "complete") check(row.repositoryDiscoveryComplete);
    for (const period of row.unknownPeriods) {
      check(period.startInclusive < period.endExclusive);
      const intersects = period.startInclusive < window.endExclusive && period.endExclusive > window.startInclusive;
      check(row.status !== "complete" || !intersects);
    }
  }
}
/** Only computed math is tolerant. Shapes, labels and displayed integers stay exact.
 * Compare point/range endpoint equality separately so tolerance never hides uncertainty. */
function mathEqual(actual: unknown, expected: unknown, key = ""): void {
  if (typeof actual === "number" && typeof expected === "number") {
    check(Number.isFinite(actual) && Math.abs(actual - expected) <= (key.startsWith("display") ? 0 : SCORING_V7_RECEIPT_RULES.numericTolerance));
  } else if (actual && expected && typeof actual === "object" && typeof expected === "object") {
    const a = actual as Record<string, unknown>, b = expected as Record<string, unknown>;
    check(canonicalJson(Object.keys(a).sort()) === canonicalJson(Object.keys(b).sort()));
    if (typeof b.lower === "number" && typeof b.upper === "number") check((a.lower === a.upper) === (b.lower === b.upper));
    for (const field of Object.keys(b)) mathEqual(a[field], b[field], field);
  } else check(actual === expected);
}
/** Structural trace checks bind issued arithmetic to inputs before sealing or serving. */
function validateArithmetic(receipt: PublicScoringReceipt): void {
  const equal = (a: unknown, b: unknown) => check(canonicalJson(a) === canonicalJson(b));
  const endpoints = (values: readonly ExactNumericBounds[]): ExactNumericBounds => values.reduce((a, b) => ({ lower: a.lower + b.lower, upper: a.upper + b.upper }), { lower: 0, upper: 0 });
  const rendered = (value: ExactNumericBounds): ScoreBounds => value.lower === value.upper ? { kind: "point", value: value.lower, displayValue: Math.round(value.lower) } : { kind: "range", ...value, displayLower: Math.floor(value.lower), displayUpper: Math.ceil(value.upper) };
  const step = (trace: NormalizationTrace<number, number>, input: ExactNumericBounds) => {
    equal(trace.input, input);
    const clamped = { lower: Math.min(input.lower, trace.cap), upper: Math.min(input.upper, trace.cap) };
    const normalized = { lower: Math.log1p(clamped.lower) / Math.log1p(trace.cap), upper: Math.log1p(clamped.upper) / Math.log1p(trace.cap) };
    equal(trace.clamped, clamped); mathEqual(trace.normalized, normalized);
    const weighted = { lower: normalized.lower * trace.multiplier, upper: normalized.upper * trace.multiplier };
    mathEqual(trace.weighted, weighted);
    return weighted;
  };
  const c = receipt.inputs.counts, t = receipt.calculation.core;
  check(c.eligibleCategories.upper <= 4 && c.activeIsoWeeks.upper <= 54);
  const expected = { delivery: step(t.delivery, c.deliveryUnits), quality: endpoints(qualityKeys.map(key => step(t.quality[key], c.quality[key]))), consistency: step(t.consistency, c.activeIsoWeeks), breadth: endpoints([step(t.breadth.projects, c.eligibleProjects), step(t.breadth.categories, c.eligibleCategories)]) };
  mathEqual(t.dimensions, expected);
  const keys = ["delivery", "quality", "consistency", "breadth"] as const;
  const weighted = Object.fromEntries(keys.map(key => [key, { lower: expected[key].lower / 4, upper: expected[key].upper / 4 }]));
  const composite = endpoints(Object.values(weighted));
  mathEqual(t.weightedDimensions, weighted); mathEqual(t.composite, composite);
  mathEqual(receipt.core.dimensions, Object.fromEntries(keys.map(key => [key, rendered(expected[key])])));
  mathEqual(receipt.core.composite, rendered(composite)); mathEqual(t.displayed, receipt.core);
  const tier = (value: number) => value >= 85 ? "Elite" : value >= 70 ? "High" : value >= 30 ? "Solid" : "Emerging";
  equal(receipt.core.tier, tier(composite.lower) === tier(composite.upper) ? tier(composite.lower) : null);
  const values = keys.map(key => expected[key].lower), max = Math.max(...values), mean = values.reduce((a, b) => a + b, 0) / 4;
  let archetype: PublicScoringReceipt["core"]["archetype"] = null;
  if (keys.every(key => expected[key].lower === expected[key].upper)) {
    archetype = "Emerging";
    if (mean >= 25 && max >= 40) {
      if (max - Math.min(...values) <= 20 && mean >= 50) archetype = "Balanced";
      else if (max >= 60) archetype = expected.breadth.lower === max ? "Polymath" : expected.quality.lower === max ? "Quality Champion" : expected.consistency.lower === max ? "Marathoner" : "Builder";
    }
  }
  equal(receipt.core.archetype, archetype);
  if (receipt.craft && receipt.calculation.craft) {
    const { inputs, result } = receipt.craft, trace = receipt.calculation.craft;
    check(inputs.independentlyCorroboratedCompleteEpisodes <= inputs.eligibleEpisodes);
    for (const key of craftKeys) check(inputs.counts[key].lower <= inputs.eligibleEpisodes && inputs.counts[key].lower >= inputs.independentlyCorroboratedCompleteEpisodes && (inputs.eligibleEpisodes > 0 || inputs.counts[key].upper === 0));
    const criteria = Object.fromEntries(craftKeys.map(key => [key, step(trace.criteria[key], inputs.counts[key])]));
    const craftComposite = endpoints(Object.values(criteria));
    mathEqual(trace.composite, craftComposite); mathEqual(trace.displayed, result);
    if (!inputs.eligibleEpisodes) equal(result, { status: "not_observed" });
    else {
      check(result.status === "observed");
      if (result.status === "observed") {
        mathEqual(result.criteria, Object.fromEntries(craftKeys.map(key => [key, rendered(criteria[key]!)])));
        mathEqual(result.composite, rendered(craftComposite));
        equal(result.descriptor, craftComposite.lower === craftComposite.upper && craftComposite.lower >= 60 && inputs.independentlyCorroboratedCompleteEpisodes > 0 ? "Artificer" : null);
      }
    }
  }
}
/** Hash only the canonical receipt payload, never its containing hash/signature envelope.
 * This proves content identity; persistence, consent and issuance authentication are separate gates. */
export async function sealScoreReceipt(value: unknown): Promise<HashedScoreReceipt> {
  const receipt = parsePublicScoreReceipt(value);
  return freeze({ receipt, contentHash: { algorithm: "SHA-256" as const, value: await canonicalSha256(receipt) } });
}
export async function verifyScoreReceipt(value: unknown): Promise<PublicScoringReceipt> {
  canonicalJson(value);
  check(object({ receipt: receiptSchema, contentHash: object({ algorithm: literal("SHA-256"), value: pattern(/^[0-9a-f]{64}$/) }) })(value));
  const envelope = value as HashedScoreReceipt;
  const receipt = parsePublicScoreReceipt(envelope.receipt);
  check(envelope.contentHash.value === await canonicalSha256(receipt));
  return receipt;
}
/** Allocate receipt-local ordinals. No private identity or low-entropy hash crosses the boundary.
 * Caller supplies only resolved, eligible verdicts from the authorized ledger projection. */
export function projectReceiptEvidence(scope: ScoringScope, assessments: readonly PrivateCriterionAssessment[]): { coverage: PublicCoverageSummary[]; criteria: PublicCriterionResult[]; exclusions: ScoringScope["excludedSources"] } {
  const refs = new Map<string, string>();
  const criteria = assessments.map(row => {
    check(row.action !== "retract");
    if (!refs.has(row.workItemId)) refs.set(row.workItemId, `work-${refs.size + 1}`);
    return { workItemRef: refs.get(row.workItemId)!, criterion: row.criterion, status: row.status, rubricVersion: row.rubricVersion, reasonCode: row.reasonCode, qualifyingCount: row.status === "accepted" ? 1 as const : 0 as const, provenance: row.provenance };
  });
  const coverage = scope.sources.map((row, index) => ({ sourceRef: `source-${index + 1}`, provider: row.source.provider, status: row.status, dataThrough: row.dataThrough, discovery: row.discovery, accessibleRepositoryCount: new Set(row.repositoryIds).size, repositoryDiscoveryComplete: row.repositoryDiscoveryComplete, reasonCodes: [...row.reasonCodes], unknownPeriods: row.unknownPeriods.map(period => ({ startInclusive: period.startInclusive, endExclusive: period.endExclusive })) }));
  const exclusions = scope.excludedSources.map(row => ({ provider: row.provider, reason: row.reason }));
  check(array(criterion)(criteria) && array(coverageSchema)(coverage));
  validateCriteria(criteria);
  coverage.forEach((row, index) => validateCoverage([row], scope.sources[index]!.window));
  return { coverage, criteria, exclusions };
}
const coverageSchema = coverage;
