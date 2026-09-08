import { CORE_DIMENSION_KEYS, type CoreDimensionKey, type ScoreViewModel } from "@/lib/profile/score-view-model";
import type { ObservedTrendAnchor } from "@/lib/db/score-receipts-observed";

type Magnitude = { readonly exact: number; readonly display: number };
export interface ScoringObservation {
  readonly policyVersion: ScoreViewModel["policyVersion"];
  readonly identity: ScoreViewModel["identity"];
  readonly window: ScoreViewModel["window"];
  readonly composite: Magnitude;
  readonly dimensions: Readonly<Record<CoreDimensionKey, Magnitude>>;
  readonly tier: ScoreViewModel["tier"];
  readonly archetype: ScoreViewModel["archetype"];
  readonly craft: (Magnitude & { readonly reportPeriod: { readonly startInclusive: string; readonly endExclusive: string } }) | null;
}
export type ScoringComparison = {
  readonly previous: ScoringObservation;
  readonly current: ScoringObservation;
} & ({ readonly status: "not_comparable"; readonly reason: "policy_mismatch" | "window_mismatch" } | {
  readonly status: "comparable";
  readonly composite: Magnitude;
  readonly dimensions: Readonly<Record<CoreDimensionKey, Magnitude>>;
  readonly craft: Magnitude | null;
  readonly craftLimitation: "report_period_mismatch" | "not_scored" | null;
});

/** Public point observations only. Archived ranges retain their own schema. */
export function scoringObservation(model: ScoreViewModel): ScoringObservation | null {
  if (model.illustrative || model.freshness === "unavailable" || model.composite.kind !== "point" || CORE_DIMENSION_KEYS.some(key => model.dimensions[key].kind !== "point")) return null;
  const dimensions = {} as Record<CoreDimensionKey, Magnitude>;
  for (const key of CORE_DIMENSION_KEYS) {
    const point = model.dimensions[key];
    if (point.kind !== "point") return null;
    dimensions[key] = { exact: point.value, display: point.display };
  }
  const craft = model.reportCraft?.status === "scored" ? model.reportCraft.report : null;
  return { policyVersion: model.policyVersion, identity: model.identity, window: model.window,
    composite: { exact: model.composite.value, display: model.composite.display }, dimensions, tier: model.tier, archetype: model.archetype,
    craft: craft ? { exact: craft.result.point.exact, display: craft.result.point.displayValue, reportPeriod: craft.inputs.reportPeriod } : null };
}
const delta = (a: Magnitude, b: Magnitude): Magnitude => ({ exact: b.exact - a.exact, display: b.display - a.display });

/** A shifted annual window is a changed context, not a performance delta. */
export function compareScoringObservations(previous: ScoringObservation, current: ScoringObservation): ScoringComparison {
  const pair = { previous, current };
  if (previous.policyVersion !== current.policyVersion) return { ...pair, status: "not_comparable", reason: "policy_mismatch" };
  if (previous.window?.referenceDate !== current.window?.referenceDate || previous.window?.startInclusive !== current.window?.startInclusive || previous.window?.endExclusive !== current.window?.endExclusive) return { ...pair, status: "not_comparable", reason: "window_mismatch" };
  const dimensions = {} as Record<CoreDimensionKey, Magnitude>;
  for (const key of CORE_DIMENSION_KEYS) dimensions[key] = delta(previous.dimensions[key], current.dimensions[key]);
  const sameReport = previous.craft && current.craft && previous.craft.reportPeriod.startInclusive === current.craft.reportPeriod.startInclusive && previous.craft.reportPeriod.endExclusive === current.craft.reportPeriod.endExclusive;
  return { ...pair, status: "comparable", composite: delta(previous.composite, current.composite), dimensions,
    craft: sameReport ? delta(previous.craft!, current.craft!) : null,
    craftLimitation: !previous.craft || !current.craft ? "not_scored" : sameReport ? null : "report_period_mismatch" };
}

/** Retain the durable policy-segmented EMA, including its predecessor outside
 * a requested date slice. Recomputing here would silently reset that seed. */
export function buildScoringHistory(entries: readonly { model: ScoreViewModel; trend: ObservedTrendAnchor | null }[]) {
  const observations = entries.map(entry => scoringObservation(entry.model)).filter((value): value is ScoringObservation => value !== null);
  const trend = entries.flatMap(({ model, trend }) => scoringObservation(model) && trend && model.policyVersion === trend.policyVersion && model.identity?.revisionId === trend.receiptRevisionId && model.window?.referenceDate === trend.referenceDate ? [trend] : []);
  return { observations, trend, comparisons: observations.slice(1).map((current, index) => compareScoringObservations(observations[index]!, current)) };
}
