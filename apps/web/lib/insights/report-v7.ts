import { z } from "zod";
import { scoringInstant, type CraftUsageDiagnostics, type ScoringWindow } from "@chapa/shared";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const quantity = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const labels = z.record(z.string().min(1).max(120), count).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  try { scoringInstant(`${value}T00:00:00Z`); return true; } catch { return false; }
});
const reportSchema = z.strictObject({
  schemaVersion: z.literal("v7"), tool: z.literal("claude-code"),
  reportPeriod: z.strictObject({ start: date, end: date }), totalSessions: count,
  outcomes: labels, satisfaction: labels, toolUsage: labels, sessionTypes: labels, friction: labels, toolErrors: labels,
  totalToolCalls: count.nullable(),
  responseTime: z.strictObject({ medianSeconds: quantity.nullable(), averageSeconds: quantity.nullable() }),
  volume: z.record(z.string().min(1).max(120), quantity).nullable(),
  multiClauding: z.strictObject({ overlapEvents: count.nullable(), sessionsInvolved: count.nullable(), messagePercent: quantity.max(100).nullable() }).nullable(),
});
export type InsightsReportV7 = z.infer<typeof reportSchema>;

function sum(record: Record<string, number> | null): number {
  const value = Object.values(record ?? {}).reduce((total, next) => total + next, 0);
  if (!Number.isSafeInteger(value)) throw new RangeError("Report count sum exceeds safe bounds");
  return value;
}

/** Strict v7 boundary: report uploads cannot carry owner identities, episodes or rubric verdicts. */
export function parseInsightsReportV7(value: unknown, referenceTime: string): InsightsReportV7 {
  const report = reportSchema.parse(value);
  const referenceDate = scoringInstant(referenceTime).toISOString().slice(0, 10);
  if (report.reportPeriod.start > report.reportPeriod.end || report.reportPeriod.end > referenceDate) throw new RangeError("Invalid report period");
  for (const record of [report.outcomes, report.satisfaction, report.toolUsage, report.sessionTypes, report.friction, report.toolErrors]) sum(record);
  if (sum(report.outcomes) > report.totalSessions || sum(report.satisfaction) > report.totalSessions || sum(report.sessionTypes) > report.totalSessions ||
      (report.totalToolCalls !== null && report.toolUsage !== null && report.totalToolCalls < sum(report.toolUsage)) ||
      (report.multiClauding?.sessionsInvolved !== null && report.multiClauding?.sessionsInvolved !== undefined && report.multiClauding.sessionsInvolved > report.totalSessions)) {
    throw new RangeError("Inconsistent report count totals");
  }
  return report;
}

/** Each report remains a separate sample: overlapping aggregate reports cannot be pooled without session IDs. */
export function describeInsightsReportV7(report: InsightsReportV7, window: ScoringWindow) {
  const startInclusive = `${report.reportPeriod.start}T00:00:00.000Z`;
  const endExclusive = new Date(scoringInstant(`${report.reportPeriod.end}T00:00:00Z`).getTime() + 86400000).toISOString();
  const known = new Set(["fully_achieved", "mostly_achieved", "partially_achieved"]);
  const diagnostics: CraftUsageDiagnostics = {
    reportPeriod: { startInclusive, endExclusive },
    knownClassifications: Object.fromEntries(Object.entries(report.outcomes ?? {}).filter(([label]) => known.has(label))),
    unknownLabels: Object.fromEntries(Object.entries(report.outcomes ?? {}).filter(([label]) => !known.has(label))),
    unclassifiedSessions: report.totalSessions - sum(report.outcomes),
    likelySatisfiedEstimateCount: report.satisfaction?.likely_satisfied ?? 0,
    totalSessions: report.totalSessions,
  };
  return { diagnostics, coverage: "partial" as const,
    eligibility: endExclusive <= window.startInclusive ? "historical" as const : startInclusive < window.startInclusive ? "straddling_aggregate" as const : "current_aggregate" as const,
    classificationSource: "model_estimate" as const,
    outcomesObserved: report.outcomes !== null, satisfactionObserved: report.satisfaction !== null,
    responseTime: report.responseTime,
    satisfactionClassifications: report.satisfaction,
    usage: { toolUsage: report.toolUsage, sessionTypes: report.sessionTypes, friction: report.friction, toolErrors: report.toolErrors, volume: report.volume, multiClauding: report.multiClauding, totalToolCalls: report.totalToolCalls },
    limitation: "aggregate_sessions_not_dated_engineering_evidence" as const };
}

export type InsightsReportDescriptionV7 = ReturnType<typeof describeInsightsReportV7>;

/** Re-upload/read clocks cannot refresh the aggregate's original observation period. */
export function ageInsightsDescriptionV7(description: InsightsReportDescriptionV7, window: ScoringWindow): InsightsReportDescriptionV7 {
  const { startInclusive, endExclusive } = description.diagnostics.reportPeriod;
  scoringInstant(startInclusive);
  scoringInstant(endExclusive);
  return { ...description, eligibility: endExclusive <= window.startInclusive ? "historical" : startInclusive < window.startInclusive ? "straddling_aggregate" : "current_aggregate" };
}
