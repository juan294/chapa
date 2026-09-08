import { canonicalJson, canonicalSha256 } from "./canonical-json";
import { createScoringWindow, scoringInstant } from "./scoring-window";
import type { ContentDigest, PublicScoringReceipt } from "./scoring-evidence";
import { SCORING_OBSERVED_POLICY, type ObservedCoreInputs, type ObservedCoreResult, type ObservedCoreTrace, type ReportCraftInputs, type ReportCraftResult, type ScoredReportCraft } from "./scoring-observed";
import { RECEIPT_ALGORITHM_OBSERVED } from "./score-receipt-observed-artifacts";

export { RECEIPT_ALGORITHM_OBSERVED } from "./score-receipt-observed-artifacts";
/** Opaque, durable public identity. Raw report digests and labels remain private. */
export interface PublicScoredReportCalculation {
  readonly reportRef: string;
  readonly supersedesReportRef: string | null;
  readonly inputs: ReportCraftInputs;
  readonly result: ScoredReportCraft;
}
export interface PublicInsufficientReportCalculation {
  readonly inputs: ReportCraftInputs;
  readonly result: Extract<ReportCraftResult, { status: "insufficient_report_data" }>;
}
export type PublicObservedCraft =
  | { readonly status: "no_report"; readonly unlocked: false; readonly report: null }
  | { readonly status: "scored"; readonly unlocked: true; readonly report: PublicScoredReportCalculation }
  | { readonly status: "insufficient_report_data"; readonly unlocked: false; readonly report: PublicInsufficientReportCalculation }
  | { readonly status: "expired"; readonly unlocked: true; readonly report: null; readonly lastReport: PublicScoredReportCalculation }
  | { readonly status: "unavailable"; readonly unlocked: boolean; readonly report: null; readonly lastReport: PublicScoredReportCalculation | null; readonly reason: "source_error" | "publication_pending" | "outside_window" };

export interface PublicObservedScoringReceipt extends Omit<PublicScoringReceipt, "policyVersion" | "inputs" | "core" | "craft" | "algorithm" | "calculation"> {
  readonly policyVersion: "v7.2";
  readonly inputs: ObservedCoreInputs;
  readonly core: ObservedCoreResult;
  readonly craft: PublicObservedCraft;
  readonly algorithm: typeof RECEIPT_ALGORITHM_OBSERVED;
  readonly calculation: { readonly rules: typeof SCORING_OBSERVED_POLICY; readonly core: ObservedCoreTrace };
}
export interface HashedObservedScoreReceipt { readonly receipt: PublicObservedScoringReceipt; readonly contentHash: ContentDigest }

type Validator = (value: unknown) => boolean;
function check(value: boolean): asserts value { if (!value) throw new TypeError("Invalid observed public receipt"); }
const finite: Validator = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const count: Validator = value => finite(value) && Number.isSafeInteger(value);
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
const scoreNumber: Validator = value => finite(value) && (value as number) <= 100;
const point = object({ kind: literal("point"), exact: scoreNumber, displayValue: scoreNumber, displayLabel: pattern(/^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/) });
const qualityKeys = ["rationale", "verification", "review_or_correction", "outcome_followup"] as const;
const dimensionKeys = ["delivery", "quality", "consistency", "breadth"] as const;
const outcomeKeys = ["fully_achieved", "mostly_achieved", "partially_achieved", "not_achieved"] as const;
const record = (keys: readonly string[], validate: Validator) => object(Object.fromEntries(keys.map(key => [key, validate])));
const coreInput = object({ policyVersion: literal("v7.2"), window: windowSchema, counts: object({ deliveryUnits: bounds, quality: record(qualityKeys, bounds), activeIsoWeeks: bounds, eligibleProjects: bounds, eligibleCategories: bounds }) });
const coreResult = object({ dimensions: record(dimensionKeys, point), composite: point, tier: oneOf("Emerging", "Solid", "High", "Elite"), archetype: oneOf(null, "Emerging", "Balanced", "Builder", "Quality Champion", "Marathoner", "Polymath") });
const normalization = (cap: number, multiplier: number) => object({ originalBounds: bounds, observedCount: count, cap: literal(cap), clamped: count, normalized: finite, multiplier: literal(multiplier), weighted: finite });
const coreTrace = object({ delivery: normalization(120, 100), quality: record(qualityKeys, normalization(12, 25)), consistency: normalization(40, 100), breadth: object({ projects: normalization(4, 50), categories: normalization(4, 50) }), dimensions: record(dimensionKeys, finite), weightedDimensions: record(dimensionKeys, finite), composite: finite, displayed: coreResult });
const reportInput = object({ policyVersion: literal("v7.2"), classifierRevision: literal("cc-outcomes-v7.2"), window: windowSchema, reportPeriod: period, totalSessions: count, outcomes: record(outcomeKeys, count), unknownSessions: count, unclassifiedSessions: count });
const reportTrace = object({ outcomeCredits: literal(SCORING_OBSERVED_POLICY.reportCraft.outcomeCredits), creditedSessions: finite, recognizedSessions: count, totalSessions: count, unknownSessions: count, unclassifiedSessions: count, recognizedCoverage: finite, exact: scoreNumber });
const scoredResult = object({ status: literal("scored"), unlocked: literal(true), provenance: literal("report_derived"), assessment: literal("model_estimate"), reportPeriod: period, point, trace: reportTrace });
const insufficientResult = object({ status: literal("insufficient_report_data"), unlocked: literal(false), point: literal(null), reportPeriod: period, reason: oneOf("no_sessions", "no_recognized_outcomes") });
const uuid = pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const scoredReport = object({ reportRef: uuid, supersedesReportRef: nullable(uuid), inputs: reportInput, result: scoredResult });
const craft: Validator = value =>
  object({ status: literal("no_report"), unlocked: literal(false), report: literal(null) })(value)
  || object({ status: literal("scored"), unlocked: literal(true), report: scoredReport })(value)
  || object({ status: literal("insufficient_report_data"), unlocked: literal(false), report: object({ inputs: reportInput, result: insufficientResult }) })(value)
  || object({ status: literal("expired"), unlocked: literal(true), report: literal(null), lastReport: scoredReport })(value)
  || object({ status: literal("unavailable"), unlocked: oneOf(true, false), report: literal(null), lastReport: nullable(scoredReport), reason: oneOf("source_error", "publication_pending", "outside_window") })(value);
const reason = oneOf("criterion_demonstrated", "criterion_not_demonstrated", "not_assessed", "not_accessible", "not_supported", "pagination_incomplete", "discovery_incomplete", "source_error", "stale_data", "legacy_aggregate", "acceptance_time_unknown", "attribution_unknown", "alias_unresolved", "partial_files", "outside_window", "retracted", "insufficient_evidence");
const provider = oneOf("github", "gitlab", "bitbucket", "codeberg", "supplemental", "portfolio");
const coverage = object({ sourceRef: pattern(/^source-[1-9]\d*$/), provider, status: oneOf("complete", "partial", "unavailable", "stale", "legacy"), dataThrough: nullable(instant), discovery: oneOf("owned_and_contributed", "contribution_search", "registered_ledger", "explicit_repositories", "legacy_upload"), accessibleRepositoryCount: count, repositoryDiscoveryComplete: oneOf(true, false), reasonCodes: array(reason), unknownPeriods: array(period) });
const criterion = object({ workItemRef: pattern(/^work-[1-9]\d*$/), criterion: oneOf(...qualityKeys), status: oneOf("accepted", "rejected", "unassessed", "retracted"), rubricVersion: literal("v7"), reasonCode: reason, qualifyingCount: oneOf(0, 1), provenance: oneOf("source_observed", "self_reported", "automated_assessment", "human_assessed", "independently_corroborated") });
const schema = object({ schemaVersion: literal("v7"), policyVersion: literal("v7.2"), receiptId: uuid, subjectRef: literal("subject-1"), revisionId: uuid, revision: count, recordedAt: instant, supersedesRevisionId: nullable(uuid), action: oneOf("create", "correct", "retract"), window: windowSchema, inputs: coreInput, core: coreResult, craft, criteria: array(criterion), coverage: array(coverage), exclusions: array(object({ provider, reason: oneOf("not_connected", "not_consented") })), limitations: array(reason), serializationVersion: literal("canonical-json-v1"), algorithm: literal(RECEIPT_ALGORITHM_OBSERVED), calculation: object({ rules: literal(SCORING_OBSERVED_POLICY), core: coreTrace }) });
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function equal(actual: unknown, expected: unknown): void { check(canonicalJson(actual) === canonicalJson(expected)); }
/** Input counts, constants and presentation remain exact; only calculated math is tolerant. */
function mathEqual(actual: unknown, expected: unknown, path: readonly string[] = []): void {
  if (typeof actual === "number" && typeof expected === "number") {
    const exact = path.some(key => ["originalBounds", "observedCount", "clamped", "cap", "multiplier", "outcomeCredits", "recognizedSessions", "totalSessions", "unknownSessions", "unclassifiedSessions", "displayValue"].includes(key));
    check(Number.isFinite(actual) && Math.abs(actual - expected) <= (exact ? 0 : 1e-10));
  } else if (actual && expected && typeof actual === "object" && typeof expected === "object") {
    equal(Object.keys(actual).sort(), Object.keys(expected).sort());
    for (const key of Object.keys(expected)) mathEqual((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], [...path, key]);
  } else check(actual === expected);
}
function display(exact: number, core = false) {
  const rounded = Math.round(exact);
  const boundary = [30, 70, 85].find(value => exact < value && rounded >= value);
  const displayValue = core && boundary !== undefined ? Math.min(Math.floor(exact * 100) / 100, boundary - 0.01) : rounded;
  return { kind: "point" as const, exact, displayValue, displayLabel: String(displayValue) };
}
function validateCore(receipt: PublicObservedScoringReceipt): void {
  const step = <C extends number, M extends number>(originalBounds: { lower: number; upper: number }, cap: C, multiplier: M) => {
    const observedCount = originalBounds.lower, clamped = Math.min(observedCount, cap), normalized = Math.log1p(clamped) / Math.log1p(cap);
    return { originalBounds, observedCount, cap, clamped, normalized, multiplier, weighted: normalized * multiplier };
  };
  const c = receipt.inputs.counts;
  const delivery = step(c.deliveryUnits, 120, 100), consistency = step(c.activeIsoWeeks, 40, 100);
  const quality = Object.fromEntries(qualityKeys.map(key => [key, step(c.quality[key], 12, 25)])) as ObservedCoreTrace["quality"];
  const breadth = { projects: step(c.eligibleProjects, 4, 50), categories: step(c.eligibleCategories, 4, 50) };
  const dimensions = { delivery: delivery.weighted, quality: qualityKeys.reduce((sum, key) => sum + quality[key].weighted, 0), consistency: consistency.weighted, breadth: breadth.projects.weighted + breadth.categories.weighted };
  const weightedDimensions = Object.fromEntries(dimensionKeys.map(key => [key, dimensions[key] / 4])) as ObservedCoreTrace["weightedDimensions"];
  const composite = dimensionKeys.reduce((sum, key) => sum + weightedDimensions[key], 0);
  // Preserve historical arithmetic operation order when deciding endpoint equality.
  const upperStep = (bound: { upper: number }, cap: number, multiplier: number) => (Math.log1p(Math.min(bound.upper, cap)) / Math.log1p(cap)) * multiplier;
  const upperDimensions = { delivery: upperStep(c.deliveryUnits, 120, 100), quality: qualityKeys.reduce((sum, key) => sum + upperStep(c.quality[key], 12, 25), 0), consistency: upperStep(c.activeIsoWeeks, 40, 100), breadth: upperStep(c.eligibleProjects, 4, 50) + upperStep(c.eligibleCategories, 4, 50) };
  let archetype: ObservedCoreResult["archetype"] = null;
  if (dimensionKeys.every(key => dimensions[key] === upperDimensions[key])) {
    const values = Object.values(dimensions), max = Math.max(...values), mean = values.reduce((a, b) => a + b, 0) / 4;
    archetype = "Emerging";
    if (mean >= 25 && max >= 40) {
      if (max - Math.min(...values) <= 20 && mean >= 50) archetype = "Balanced";
      else if (max >= 60) archetype = dimensions.breadth === max ? "Polymath" : dimensions.quality === max ? "Quality Champion" : dimensions.consistency === max ? "Marathoner" : "Builder";
    }
  }
  const core: ObservedCoreResult = { dimensions: Object.fromEntries(dimensionKeys.map(key => [key, display(dimensions[key])])) as ObservedCoreResult["dimensions"], composite: display(composite, true), tier: composite >= 85 ? "Elite" : composite >= 70 ? "High" : composite >= 30 ? "Solid" : "Emerging", archetype };
  mathEqual(receipt.core, core);
  mathEqual(receipt.calculation.core, { delivery, quality, consistency, breadth, dimensions, weightedDimensions, composite, displayed: core });
}
function validateReport(report: PublicScoredReportCalculation | PublicInsufficientReportCalculation): void {
  const { inputs, result } = report;
  equal(inputs.window, createScoringWindow(inputs.window.referenceTime));
  check(inputs.reportPeriod.startInclusive < inputs.reportPeriod.endExclusive && inputs.reportPeriod.endExclusive <= inputs.window.referenceTime);
  equal(result.reportPeriod, inputs.reportPeriod);
  let recognizedSessions = 0;
  for (const key of outcomeKeys) { recognizedSessions += inputs.outcomes[key]; check(Number.isSafeInteger(recognizedSessions)); }
  const supplied = recognizedSessions + inputs.unknownSessions, total = supplied + inputs.unclassifiedSessions;
  check(Number.isSafeInteger(supplied) && Number.isSafeInteger(total) && total === inputs.totalSessions);
  if (!inputs.totalSessions || !recognizedSessions) {
    equal(result, { status: "insufficient_report_data", unlocked: false, point: null, reportPeriod: inputs.reportPeriod, reason: inputs.totalSessions === 0 ? "no_sessions" : "no_recognized_outcomes" });
    return;
  }
  check(result.status === "scored");
  const outcomes = inputs.outcomes;
  const creditedSessions = outcomes.fully_achieved + 0.7 * outcomes.mostly_achieved + 0.3 * outcomes.partially_achieved;
  const exact = creditedSessions === total ? 100 : 100 * creditedSessions / total;
  mathEqual(result, { status: "scored", unlocked: true, provenance: "report_derived", assessment: "model_estimate", reportPeriod: inputs.reportPeriod, point: display(exact), trace: { outcomeCredits: SCORING_OBSERVED_POLICY.reportCraft.outcomeCredits, creditedSessions, recognizedSessions, totalSessions: total, unknownSessions: inputs.unknownSessions, unclassifiedSessions: inputs.unclassifiedSessions, recognizedCoverage: recognizedSessions / total, exact } });
  const scored = report as PublicScoredReportCalculation;
  check(scored.reportRef !== scored.supersedesReportRef);
}
/** Strict current contract; historical portfolio/range payloads never coerce into points. */
export function parseObservedScoreReceipt(value: unknown): PublicObservedScoringReceipt {
  const copy: unknown = JSON.parse(canonicalJson(value));
  check(schema(copy));
  const receipt = copy as PublicObservedScoringReceipt;
  equal(receipt.window, createScoringWindow(receipt.window.referenceTime));
  equal(receipt.inputs.window, receipt.window);
  check(receipt.revision >= 1 && (receipt.revision === 1 ? receipt.action === "create" && receipt.supersedesRevisionId === null : receipt.action !== "create" && receipt.supersedesRevisionId !== null && receipt.supersedesRevisionId !== receipt.revisionId));
  check(receipt.recordedAt >= receipt.window.referenceTime);
  const seen = new Set<string>();
  for (const row of receipt.criteria) {
    const key = canonicalJson([row.workItemRef, row.criterion]); check(!seen.has(key)); seen.add(key);
    check(row.status !== "retracted" && row.qualifyingCount === (row.status === "accepted" ? 1 : 0));
    check(row.status !== "accepted" || row.reasonCode === "criterion_demonstrated" && row.provenance !== "self_reported");
  }
  check(new Set(receipt.coverage.map(row => row.sourceRef)).size === receipt.coverage.length);
  for (const row of receipt.coverage) {
    check(row.dataThrough === null || row.dataThrough <= receipt.window.referenceTime);
    check(row.status !== "complete" || row.repositoryDiscoveryComplete);
    for (const period of row.unknownPeriods) {
      check(period.startInclusive < period.endExclusive);
      check(row.status !== "complete" || period.endExclusive <= receipt.window.startInclusive || period.startInclusive >= receipt.window.endExclusive);
    }
  }
  validateCore(receipt);
  const selected = receipt.craft;
  if (selected.status === "scored" || selected.status === "insufficient_report_data") {
    validateReport(selected.report);
    equal(selected.report.inputs.window, receipt.window);
    check(selected.report.inputs.reportPeriod.startInclusive >= receipt.window.startInclusive);
  } else if (selected.status === "expired" || selected.status === "unavailable") {
    if (selected.lastReport) {
      validateReport(selected.lastReport);
      check(selected.lastReport.inputs.window.referenceTime <= receipt.window.referenceTime);
      check(selected.lastReport.inputs.reportPeriod.startInclusive >= selected.lastReport.inputs.window.startInclusive);
    }
    if (selected.status === "expired") check(selected.lastReport.inputs.reportPeriod.startInclusive < receipt.window.startInclusive);
    else check(selected.unlocked === (selected.lastReport !== null));
  }
  return freeze(receipt);
}
export async function sealObservedScoreReceipt(value: unknown): Promise<HashedObservedScoreReceipt> {
  const receipt = parseObservedScoreReceipt(value);
  return freeze({ receipt, contentHash: { algorithm: "SHA-256", value: await canonicalSha256(receipt) } });
}
export async function verifyObservedScoreReceipt(value: unknown): Promise<PublicObservedScoringReceipt> {
  canonicalJson(value);
  check(object({ receipt: schema, contentHash: object({ algorithm: literal("SHA-256"), value: pattern(/^[0-9a-f]{64}$/) }) })(value));
  const envelope = value as HashedObservedScoreReceipt;
  const receipt = parseObservedScoreReceipt(envelope.receipt);
  check(envelope.contentHash.value === await canonicalSha256(receipt));
  return receipt;
}
