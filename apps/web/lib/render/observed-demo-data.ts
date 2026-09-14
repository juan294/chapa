import { createScoringWindow, type CoreCountInputs } from "@chapa/shared";
import { calculateObservedCoreV7 } from "@/lib/impact/observed-v7";
import { calculateReportCraftInputs } from "@/lib/insights/report-craft";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";

/** Public synthetic examples. These calculations are not an issued profile or evidence of anyone's work. */
function sample({ delivery, quality, weeks, projects, categories, total, fully, mostly, failed }: {
  delivery: number; quality: number; weeks: number; projects: number; categories: number;
  total: number; fully: number; mostly: number; failed: number;
}): ScoreViewModel {
  const point = (value: number) => ({ lower: value, upper: value });
  const window = createScoringWindow("2026-09-08T10:00:00.000Z");
  const counts: CoreCountInputs = { deliveryUnits: point(delivery), quality: { rationale: point(quality), verification: point(quality), review_or_correction: point(quality), outcome_followup: point(quality) }, activeIsoWeeks: point(weeks), eligibleProjects: point(projects), eligibleCategories: point(categories) };
  const calculation = calculateObservedCoreV7({ policyVersion: "v7.2", window, counts });
  const craft = calculateReportCraftInputs({ policyVersion: "v7.2", classifierRevision: "cc-outcomes-v7.2", window, reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-08T00:00:00.000Z" }, totalSessions: total, outcomes: { fully_achieved: fully, mostly_achieved: mostly, partially_achieved: 0, not_achieved: failed }, unknownSessions: 0, unclassifiedSessions: 0 });
  if (craft.status !== "valid" || craft.result.status !== "scored") throw new Error("Invalid illustrative report");
  const value = (source: { exact: number; displayValue: number }) => ({ kind: "point" as const, value: source.exact, display: source.displayValue });
  return { illustrative: true, observedInputs: calculation.inputs, policyVersion: "v7.2", handle: "developer", identity: null, window: null,
    dimensions: { delivery: value(calculation.core.dimensions.delivery), quality: value(calculation.core.dimensions.quality), consistency: value(calculation.core.dimensions.consistency), breadth: value(calculation.core.dimensions.breadth) },
    composite: value(calculation.core.composite), tier: calculation.core.tier, archetype: calculation.core.archetype, craft: null,
    reportCraft: { status: "scored", unlocked: true, report: { reportRef: "00000000-0000-4000-8000-000000000001", supersedesReportRef: null, inputs: craft.inputs, result: craft.result } },
    coverage: [], exclusions: [], limitations: [] };
}
export const LANDING_OBSERVED_DEMO = sample({ delivery: 100, quality: 7, weeks: 30, projects: 4, categories: 4, total: 100, fully: 85, mostly: 10, failed: 5 });
export const STUDIO_OBSERVED_DEMO = sample({ delivery: 80, quality: 6, weeks: 20, projects: 3, categories: 2, total: 10, fully: 3, mostly: 6, failed: 1 });
