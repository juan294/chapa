/** Independent v7.2 arithmetic. Contracts and serialization only; no production calculator imports. */
import type { ObservedCoreInputs, ObservedCoreResult, ObservedCoreTrace, PointResult, ReportCraftInputs, ScoredReportCraft, PublicObservedScoringReceipt, PublicObservedCraft } from "@chapa/shared";

const axes = ["delivery", "quality", "consistency", "breadth"] as const;
const criteria = ["rationale", "verification", "review_or_correction", "outcome_followup"] as const;

export function referenceObservedDisplay(exact: number, core = false): PointResult {
  if (!Number.isFinite(exact) || exact < 0 || exact > 100) throw new RangeError("Invalid point");
  let displayValue = Math.round(exact);
  if (core) {
    for (const threshold of [30, 70, 85]) {
      if (exact < threshold && displayValue >= threshold) {
        displayValue = Math.min(Math.floor(exact * 100) / 100, threshold - 0.01);
        break;
      }
    }
  }
  return { kind: "point", exact, displayValue, displayLabel: String(displayValue) };
}
export function referenceCalculateObservedCore(inputs: ObservedCoreInputs): { core: ObservedCoreResult; trace: ObservedCoreTrace } {
  if (inputs.policyVersion !== "v7.2") throw new RangeError("Unsupported policy");
  function scalar<C extends number, M extends number>(originalBounds: { lower: number; upper: number }, cap: C, multiplier: M) {
    if (!Number.isSafeInteger(originalBounds.lower) || !Number.isSafeInteger(originalBounds.upper) || originalBounds.lower < 0 || originalBounds.upper < originalBounds.lower) throw new RangeError("Invalid counts");
    const observedCount = originalBounds.lower;
    const clamped = Math.min(cap, observedCount);
    const normalized = Math.log1p(clamped) / Math.log1p(cap);
    return { originalBounds, observedCount, cap, clamped, normalized, multiplier, weighted: normalized * multiplier };
  }
  const c = inputs.counts;
  const delivery = scalar(c.deliveryUnits, 120, 100);
  const quality = { rationale: scalar(c.quality.rationale, 12, 25), verification: scalar(c.quality.verification, 12, 25), review_or_correction: scalar(c.quality.review_or_correction, 12, 25), outcome_followup: scalar(c.quality.outcome_followup, 12, 25) };
  const consistency = scalar(c.activeIsoWeeks, 40, 100);
  const breadth = { projects: scalar(c.eligibleProjects, 4, 50), categories: scalar(c.eligibleCategories, 4, 50) };
  let qualityValue = 0;
  for (const criterion of criteria) qualityValue += quality[criterion].weighted;
  const dimensions = { delivery: delivery.weighted, quality: qualityValue, consistency: consistency.weighted, breadth: breadth.projects.weighted + breadth.categories.weighted };
  const weightedDimensions = { delivery: dimensions.delivery / 4, quality: dimensions.quality / 4, consistency: dimensions.consistency / 4, breadth: dimensions.breadth / 4 };
  let composite = 0;
  for (const axis of axes) composite += weightedDimensions[axis];
  const endpoint = (bounds: { upper: number }, cap: number, multiplier: number) => Math.log1p(Math.min(bounds.upper, cap)) / Math.log1p(cap) * multiplier;
  let upperQuality = 0;
  for (const criterion of criteria) upperQuality += endpoint(c.quality[criterion], 12, 25);
  const uppers = { delivery: endpoint(c.deliveryUnits, 120, 100), quality: upperQuality, consistency: endpoint(c.activeIsoWeeks, 40, 100), breadth: endpoint(c.eligibleProjects, 4, 50) + endpoint(c.eligibleCategories, 4, 50) };
  let archetype: ObservedCoreResult["archetype"] = null;
  if (axes.every(axis => dimensions[axis] === uppers[axis])) {
    const maximum = Math.max(...Object.values(dimensions));
    const minimum = Math.min(...Object.values(dimensions));
    const average = Object.values(dimensions).reduce((sum, value) => sum + value, 0) / 4;
    archetype = "Emerging";
    if (average >= 25 && maximum >= 40) {
      if (maximum - minimum <= 20 && average >= 50) archetype = "Balanced";
      else if (maximum >= 60) {
        if (dimensions.breadth === maximum) archetype = "Polymath";
        else if (dimensions.quality === maximum) archetype = "Quality Champion";
        else if (dimensions.consistency === maximum) archetype = "Marathoner";
        else archetype = "Builder";
      }
    }
  }
  const core: ObservedCoreResult = { dimensions: { delivery: referenceObservedDisplay(dimensions.delivery), quality: referenceObservedDisplay(dimensions.quality), consistency: referenceObservedDisplay(dimensions.consistency), breadth: referenceObservedDisplay(dimensions.breadth) }, composite: referenceObservedDisplay(composite, true), tier: composite < 30 ? "Emerging" : composite < 70 ? "Solid" : composite < 85 ? "High" : "Elite", archetype };
  return { core, trace: { delivery, quality, consistency, breadth, dimensions, weightedDimensions, composite, displayed: core } };
}
export function referenceCalculateObservedCraft(input: ReportCraftInputs): ScoredReportCraft | Extract<import("@chapa/shared").ReportCraftResult, { status: "insufficient_report_data" }> {
  if (input.policyVersion !== "v7.2" || input.classifierRevision !== "cc-outcomes-v7.2") throw new RangeError("Unsupported report classifier");
  const counts = [input.outcomes.fully_achieved, input.outcomes.mostly_achieved, input.outcomes.partially_achieved, input.outcomes.not_achieved];
  if (![...counts, input.totalSessions, input.unknownSessions, input.unclassifiedSessions].every(n => Number.isSafeInteger(n) && n >= 0)) throw new RangeError("Invalid report counts");
  let recognized = 0;
  for (const count of counts) { recognized += count; if (!Number.isSafeInteger(recognized)) throw new RangeError("Unsafe total"); }
  const supplied = recognized + input.unknownSessions, total = supplied + input.unclassifiedSessions;
  if (!Number.isSafeInteger(supplied) || !Number.isSafeInteger(total) || total !== input.totalSessions) throw new RangeError("Inconsistent report totals");
  if (total === 0 || recognized === 0) return { status: "insufficient_report_data", unlocked: false, point: null, reportPeriod: input.reportPeriod, reason: total === 0 ? "no_sessions" : "no_recognized_outcomes" };
  const creditedSessions = input.outcomes.fully_achieved + input.outcomes.mostly_achieved * 0.7 + input.outcomes.partially_achieved * 0.3;
  const exact = creditedSessions === total ? 100 : creditedSessions * 100 / total;
  return { status: "scored", unlocked: true, provenance: "report_derived", assessment: "model_estimate", reportPeriod: input.reportPeriod, point: referenceObservedDisplay(exact), trace: { outcomeCredits: { fully_achieved: 1, mostly_achieved: 0.7, partially_achieved: 0.3, not_achieved: 0 }, creditedSessions, recognizedSessions: recognized, totalSessions: total, unknownSessions: input.unknownSessions, unclassifiedSessions: input.unclassifiedSessions, recognizedCoverage: recognized / total, exact } };
}
export function assertObservedReferenceParity(actual: unknown, expected: unknown, path: readonly string[] = []): void {
  if (typeof actual === "number" && typeof expected === "number") {
    const isExact = path.some(field => ["originalBounds", "observedCount", "clamped", "cap", "multiplier", "outcomeCredits", "recognizedSessions", "totalSessions", "unknownSessions", "unclassifiedSessions", "displayValue"].includes(field));
    if (Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= (isExact ? 0 : 1e-10)) return;
  } else if (actual === expected) return;
  else if (actual && expected && typeof actual === "object" && typeof expected === "object") {
    if (JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(Object.keys(expected).sort())) {
      for (const field of Object.keys(expected)) assertObservedReferenceParity((actual as Record<string, unknown>)[field], (expected as Record<string, unknown>)[field], [...path, field]);
      return;
    }
  }
  throw new RangeError(`Observed receipt arithmetic mismatch at ${path.join(".")}`);
}
export function replayObservedCalculation(receipt: PublicObservedScoringReceipt) {
  const calculated = referenceCalculateObservedCore(receipt.inputs);
  assertObservedReferenceParity(receipt.core, calculated.core);
  assertObservedReferenceParity(receipt.calculation.core, calculated.trace);
  const checkReport = (report: { inputs: ReportCraftInputs; result: unknown }) => assertObservedReferenceParity(report.result, referenceCalculateObservedCraft(report.inputs));
  const craft: PublicObservedCraft = receipt.craft;
  if (craft.status === "scored" || craft.status === "insufficient_report_data") checkReport(craft.report);
  else if ((craft.status === "expired" || craft.status === "unavailable") && craft.lastReport) checkReport(craft.lastReport);
  return { replayStatus: "arithmetic_reproduced" as const, policyVersion: "v7.2" as const, receiptId: receipt.receiptId, core: calculated.core, craft };
}
