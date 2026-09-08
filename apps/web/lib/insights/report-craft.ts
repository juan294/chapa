import { createScoringWindow, observedPointResult, scoringInstant, SCORING_OBSERVED_POLICY,
  type ObservationPeriod, type ReportCraftCalculation, type ReportCraftInputs, type ReportOutcomeCategory, type ScoringWindow } from "@chapa/shared";

const policy = SCORING_OBSERVED_POLICY;
const categories = Object.keys(policy.reportCraft.outcomeCredits) as ReportOutcomeCategory[];
const invalid = (reason: Extract<ReportCraftCalculation, { status: "invalid" }>["reason"]): ReportCraftCalculation => ({ status: "invalid", reason });
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Shared clock/period validation for ingestion and later selection. Historical
 * arithmetic remains reproducible; only selection grants current eligibility.
 */
export function reportCraftPeriodStatus(window: ScoringWindow, period: ObservationPeriod): "current" | "historical" | "straddling" {
  const expected = createScoringWindow(window.referenceTime);
  if (!exactKeys(window as unknown as Record<string, unknown>, Object.keys(expected)) || (Object.keys(expected) as (keyof ScoringWindow)[]).some(key => window[key] !== expected[key])) throw new RangeError("Invalid scoring window");
  const start = scoringInstant(period.startInclusive).getTime();
  const end = scoringInstant(period.endExclusive).getTime();
  if (start >= end || end > scoringInstant(window.referenceTime).getTime()) throw new RangeError("Invalid report period");
  const lower = scoringInstant(window.startInclusive).getTime();
  return end <= lower ? "historical" : start < lower ? "straddling" : "current";
}

function context(value: Record<string, unknown>): { window: ScoringWindow; reportPeriod: ObservationPeriod } | null {
  if (!record(value.window) || !record(value.reportPeriod)
    || !exactKeys(value.reportPeriod, ["startInclusive", "endExclusive"])) return null;
  try {
    const window = value.window as unknown as ScoringWindow;
    const period = value.reportPeriod as unknown as ObservationPeriod;
    reportCraftPeriodStatus(window, period);
    return { window: createScoringWindow(window.referenceTime), reportPeriod: {
      startInclusive: scoringInstant(period.startInclusive).toISOString(), endExclusive: scoringInstant(period.endExclusive).toISOString(),
    } };
  } catch { return null; }
}

function normalize(label: string): string {
  return label.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, "")
    .replace(/[A-Z]/g, letter => letter.toLowerCase()).replace(/[ _-]+/g, "_");
}

/** Pure private ingestion. Raw labels remain in the caller's private input;
 * the returned canonical inputs/trace contain only allowlisted aggregates.
 * Non-scoring report diagnostics are deliberately ignored, never copied.
 */
export function calculateReportCraft(value: unknown): ReportCraftCalculation {
  if (!record(value) || value.policyVersion !== policy.policyVersion || value.classifierRevision !== policy.reportCraft.classifierRevision || !Array.isArray(value.outcomes)) return invalid("unsupported_schema");
  const validated = context(value);
  if (!validated) return invalid("invalid_period");
  if (!count(value.totalSessions)) return invalid("invalid_count");
  const outcomes: Record<ReportOutcomeCategory, number> = { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 0 };
  const seen = new Set<string>();
  let supplied = 0, unknownSessions = 0;
  for (const entry of value.outcomes) {
    if (!record(entry) || typeof entry.label !== "string" || !entry.label.length) return invalid("unsupported_schema");
    const label = normalize(entry.label);
    if (!label) return invalid("unsupported_schema");
    if (!count(entry.count)) return invalid("invalid_count");
    const category = Object.hasOwn(policy.reportCraft.aliases, label)
      ? policy.reportCraft.aliases[label as keyof typeof policy.reportCraft.aliases] as ReportOutcomeCategory : null;
    const identity = category ?? label;
    if (seen.has(identity)) return invalid("duplicate_category");
    seen.add(identity);
    supplied += entry.count;
    if (!Number.isSafeInteger(supplied) || supplied > value.totalSessions) return invalid("inconsistent_totals");
    if (category) outcomes[category] = entry.count;
    else unknownSessions += entry.count;
  }
  return calculateReportCraftInputs({ policyVersion: policy.policyVersion, classifierRevision: policy.reportCraft.classifierRevision,
    ...validated, totalSessions: value.totalSessions, outcomes, unknownSessions, unclassifiedSessions: value.totalSessions - supplied });
}

/** Arithmetic for the public canonical aggregate allowlist; never accepts raw
 * chart labels or extra fields as though they were validated replay inputs.
 */
export function calculateReportCraftInputs(value: unknown): ReportCraftCalculation {
  if (!record(value) || !exactKeys(value, ["policyVersion", "classifierRevision", "window", "reportPeriod", "totalSessions", "outcomes", "unknownSessions", "unclassifiedSessions"])
    || value.policyVersion !== policy.policyVersion || value.classifierRevision !== policy.reportCraft.classifierRevision
    || !record(value.outcomes) || !exactKeys(value.outcomes, categories)) return invalid("unsupported_schema");
  const validated = context(value);
  if (!validated) return invalid("invalid_period");
  if (![value.totalSessions, value.unknownSessions, value.unclassifiedSessions, ...Object.values(value.outcomes)].every(count)) return invalid("invalid_count");
  const input = value as unknown as ReportCraftInputs;
  let recognizedSessions = 0;
  for (const category of categories) {
    recognizedSessions += input.outcomes[category];
    if (!Number.isSafeInteger(recognizedSessions)) return invalid("inconsistent_totals");
  }
  const supplied = recognizedSessions + input.unknownSessions;
  const total = supplied + input.unclassifiedSessions;
  if (!Number.isSafeInteger(supplied) || !Number.isSafeInteger(total) || total !== input.totalSessions) return invalid("inconsistent_totals");
  const outcomes = { fully_achieved: input.outcomes.fully_achieved, mostly_achieved: input.outcomes.mostly_achieved,
    partially_achieved: input.outcomes.partially_achieved, not_achieved: input.outcomes.not_achieved };
  const inputs: ReportCraftInputs = { policyVersion: policy.policyVersion, classifierRevision: policy.reportCraft.classifierRevision,
    ...validated, totalSessions: input.totalSessions, outcomes, unknownSessions: input.unknownSessions, unclassifiedSessions: input.unclassifiedSessions };
  if (input.totalSessions === 0 || recognizedSessions === 0) return { status: "valid", inputs, result: { status: "insufficient_report_data", unlocked: false, point: null,
    reportPeriod: validated.reportPeriod, reason: input.totalSessions === 0 ? "no_sessions" : "no_recognized_outcomes" } };
  const credits = policy.reportCraft.outcomeCredits;
  const creditedSessions = outcomes.fully_achieved * credits.fully_achieved + outcomes.mostly_achieved * credits.mostly_achieved + outcomes.partially_achieved * credits.partially_achieved;
  const exact = creditedSessions === input.totalSessions ? 100 : 100 * creditedSessions / input.totalSessions;
  return { status: "valid", inputs, result: { status: "scored", unlocked: true, provenance: policy.reportCraft.provenance, assessment: policy.reportCraft.assessment,
    reportPeriod: validated.reportPeriod, point: observedPointResult(exact, "craft"), trace: { outcomeCredits: credits, creditedSessions, recognizedSessions,
      totalSessions: input.totalSessions, unknownSessions: input.unknownSessions, unclassifiedSessions: input.unclassifiedSessions, recognizedCoverage: recognizedSessions / input.totalSessions, exact } } };
}
