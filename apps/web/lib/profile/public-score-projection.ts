import { createScoringWindow, type ObservationPeriod, type DimensionScores } from "@chapa/shared";
import { CORE_DIMENSION_KEYS, type ScoreViewModel, type ScoreIdentityView, type ScoreValue } from "./score-view-model";

/** Public values are copied from the selected model; no scoring or second rounding. */
export function publicScoreProjection(model: ScoreViewModel) {
  const dimensions: Partial<DimensionScores> = {};
  const exactDimensions: Partial<DimensionScores> = {};
  for (const key of CORE_DIMENSION_KEYS) {
    const value = model.dimensions[key];
    if (value.kind === "point") { dimensions[key] = value.display; exactDimensions[key] = value.value; }
  }
  const craft = model.policyVersion === "v7.2" ? model.reportCraft ?? null : null;
  if (craft?.status === "scored") {
    dimensions.craft = craft.report.result.point.displayValue;
    exactDimensions.craft = craft.report.result.point.exact;
  }
  return { policyVersion: model.policyVersion, identity: model.identity, window: model.window,
    displayScore: model.composite.kind === "point" ? model.composite.display : null,
    exactScore: model.composite.kind === "point" ? model.composite.value : null,
    dimensions, exactDimensions, tier: model.tier, archetype: model.archetype,
    craft, craftPeriod: craft?.status === "scored" ? craft.report.inputs.reportPeriod : null, scoring: model, freshness: model.freshness ?? "current" };
}
export type PublicScoreProjection = ReturnType<typeof publicScoreProjection>;

/** Same-policy comparisons require the same observation period, not identical incidental clocks. */
type ComparisonProjection = Pick<PublicScoreProjection, "policyVersion" | "window" | "displayScore" | "exactScore" | "dimensions" | "exactDimensions" | "freshness" | "craftPeriod">;
export function comparePublicScores<A extends ComparisonProjection, B extends ComparisonProjection>(current: A, other: B) {
  const reason = current.policyVersion !== other.policyVersion ? "policy_mismatch"
    : current.freshness !== "current" || other.freshness !== "current" ? "unavailable"
    : !current.window || !other.window
      || current.window.referenceDate !== other.window.referenceDate
      || current.window.startInclusive !== other.window.startInclusive
      || current.window.endExclusive !== other.window.endExclusive ? "period_mismatch"
    : current.exactScore === null || other.exactScore === null ? "non_point" : null;
  const currentCraft = current.craftPeriod;
  const otherCraft = other.craftPeriod;
  const craftReason = !currentCraft || !otherCraft ? "unavailable"
    : currentCraft.startInclusive !== otherCraft.startInclusive || currentCraft.endExclusive !== otherCraft.endExclusive ? "period_mismatch" : null;
  const craftComparison = reason || craftReason ? { status: "not_comparable" as const, reason: reason ?? craftReason }
    : { status: "comparable" as const, reason: null };
  const sides = { current, other, craftComparison };
  if (reason) return { ...sides, status: "not_comparable" as const, reason, differences: null };
  const dimensions: Partial<DimensionScores> = {};
  const exactDimensions: Partial<DimensionScores> = {};
  for (const key of [...CORE_DIMENSION_KEYS, "craft"] as const) {
    if (key === "craft" && craftReason) continue;
    const a = current.dimensions[key], b = other.dimensions[key];
    const exactA = current.exactDimensions[key], exactB = other.exactDimensions[key];
    if (a !== undefined && b !== undefined) dimensions[key] = b - a;
    if (exactA !== undefined && exactB !== undefined) exactDimensions[key] = exactB - exactA;
  }
  return { ...sides, status: "comparable" as const, reason: null, differences: {
    score: other.displayScore! - current.displayScore!, exactScore: other.exactScore! - current.exactScore!, dimensions, exactDimensions } };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const magnitude = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
const isoTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Reconstruct only comparison fields at the unknown HTTP boundary. Never echo the incoming model. */
export function readPublicComparison(value: unknown): (ComparisonProjection & {
  identity: ScoreIdentityView | null; tier: ScoreViewModel["tier"];
  scoring: { policyVersion: ScoreViewModel["policyVersion"]; identity: ScoreIdentityView | null; window: ScoreViewModel["window"]; composite: ScoreValue };
}) | null {
  if (!record(value) || !record(value.scoring)) return null;
  const model = value.scoring;
  if (model.illustrative === true) return null;
  const policyVersion = model.policyVersion;
  if (policyVersion !== "v7" && policyVersion !== "v7.2") return null;
  const point = (value: unknown) => {
    if (!record(value)) return null;
    if (value.kind === "point" && magnitude(value.value) && magnitude(value.display)) return { kind: "point" as const, value: value.value, display: value.display };
    if (policyVersion === "v7" && value.kind === "range" && magnitude(value.lower) && magnitude(value.upper) && magnitude(value.displayLower) && magnitude(value.displayUpper) && value.lower <= value.upper) return { kind: "range" as const, lower: value.lower, upper: value.upper, displayLower: value.displayLower, displayUpper: value.displayUpper };
    return null;
  };
  const composite = point(model.composite);
  if (!composite || !record(model.dimensions)) return null;
  const dimensions: Partial<DimensionScores> = {}, exactDimensions: Partial<DimensionScores> = {};
  for (const key of CORE_DIMENSION_KEYS) {
    const number = point(model.dimensions[key]);
    if (!number) return null;
    if (number.kind === "point") { dimensions[key] = number.display; exactDimensions[key] = number.value; }
  }
  let window: ReturnType<typeof createScoringWindow> | null = null;
  if (model.window !== null) {
    if (!record(model.window) || !isoTime(model.window.referenceTime)) return null;
    try { window = createScoringWindow(model.window.referenceTime); } catch { return null; }
    if (Object.entries(window).some(([key, entry]) => (model.window as Record<string, unknown>)[key] !== entry)) return null;
  }
  let identity: ScoreIdentityView | null = null;
  if (model.identity !== null) {
    const id = model.identity;
    if (!record(id) || !uuid(id.receiptId) || !uuid(id.revisionId) || typeof id.revision !== "number" || !Number.isSafeInteger(id.revision) || id.revision < 1 || !isoTime(id.recordedAt)
      || (id.action !== "create" && id.action !== "correct") || !(id.supersedesRevisionId === null || uuid(id.supersedesRevisionId))
      || typeof id.contentHash !== "string" || !/^[0-9a-f]{64}$/.test(id.contentHash)) return null;
    identity = { receiptId: id.receiptId, revisionId: id.revisionId, revision: id.revision, recordedAt: id.recordedAt,
      action: id.action, supersedesRevisionId: id.supersedesRevisionId, contentHash: id.contentHash };
  }
  if (policyVersion === "v7.2" && (!window || !identity)) return null;
  const tier = model.tier;
  if (tier !== null && tier !== "Emerging" && tier !== "Solid" && tier !== "High" && tier !== "Elite") return null;
  let craftPeriod: ObservationPeriod | null = null;
  if (policyVersion === "v7.2" && record(model.reportCraft) && model.reportCraft.status === "scored") {
    const report = model.reportCraft.report;
    if (!record(report) || !record(report.inputs) || !record(report.inputs.reportPeriod) || !record(report.result) || !record(report.result.point)) return null;
    const period = report.inputs.reportPeriod, result = report.result.point;
    if (!isoTime(period.startInclusive) || !isoTime(period.endExclusive) || period.startInclusive >= period.endExclusive || !magnitude(result.exact) || !magnitude(result.displayValue)) return null;
    craftPeriod = { startInclusive: period.startInclusive, endExclusive: period.endExclusive };
    dimensions.craft = result.displayValue; exactDimensions.craft = result.exact;
  }
  const freshness = model.freshness ?? "current";
  if (freshness !== "current" && freshness !== "stale" && freshness !== "unavailable") return null;
  return { policyVersion, identity, window, tier, freshness, craftPeriod, dimensions, exactDimensions,
    displayScore: composite.kind === "point" ? composite.display : null, exactScore: composite.kind === "point" ? composite.value : null,
    scoring: { policyVersion, identity, window, composite } };
}
