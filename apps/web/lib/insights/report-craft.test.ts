import { describe, expect, it } from "vitest";
import { createScoringWindow, type ReportCraftRawInputs } from "@chapa/shared";
import { calculateReportCraft, calculateReportCraftInputs } from "./report-craft";

const window = createScoringWindow("2026-09-08T12:00:00Z");
const fixture = (): ReportCraftRawInputs => ({ policyVersion: "v7.2", classifierRevision: "cc-outcomes-v7.2", window,
  reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-08T00:00:00.000Z" }, totalSessions: 10,
  outcomes: [{ label: "fully_achieved", count: 4 }, { label: "mostly_achieved", count: 2 }, { label: "partially_achieved", count: 1 }, { label: "failed", count: 1 }, { label: "private-unknown-label", count: 1 }] });

describe("v7.2 report-derived Craft", () => {
  it("C06 publishes57 with8/10 recognized coverage and only allowlisted arithmetic", () => {
    const calculation = calculateReportCraft(fixture());
    expect(calculation.status).toBe("valid");
    if (calculation.status !== "valid") throw new Error("Expected valid report");
    expect(calculation.result).toMatchObject({ status: "scored", unlocked: true, provenance: "report_derived", assessment: "model_estimate", point: { exact: 57, displayValue: 57, displayLabel: "57" }, trace: { recognizedSessions: 8, totalSessions: 10, unknownSessions: 1, unclassifiedSessions: 1, recognizedCoverage: 0.8 } });
    expect(calculation.inputs.outcomes).toEqual({ fully_achieved: 4, mostly_achieved: 2, partially_achieved: 1, not_achieved: 1 });
    expect(JSON.stringify(calculation)).not.toContain("private-unknown-label");
    expect(calculateReportCraftInputs(calculation.inputs)).toEqual(calculation);
  });
  it("C06 proportional reports and unrelated diagnostics change no earned score", () => {
    const input = fixture();
    const original = calculateReportCraft(input);
    const doubled = calculateReportCraft({ ...input, totalSessions: 20, outcomes: input.outcomes.map(row => ({ ...row, count: row.count * 2 })) });
    expect(doubled).toMatchObject({ result: { point: { exact: 57 }, trace: { recognizedCoverage: 0.8 } } });
    expect(calculateReportCraft({ ...input, tool: "other", tokens: 999999, volume: { files: 900 }, satisfaction: { likely_satisfied: 10 }, responseTime: 0.001, rawBody: "private report" })).toEqual(original);
    expect(calculateReportCraft({ ...input, outcomes: [...input.outcomes].reverse() })).toEqual(original);
  });
  it("C07/C08 failure-only is scored0; unknown, unclassified and zero keys are insufficient", () => {
    expect(calculateReportCraft({ ...fixture(), outcomes: [{ label: "failed", count: 10 }] })).toMatchObject({ result: { status: "scored", unlocked: true, point: { exact: 0 } } });
    for (const outcomes of [[], [{ label: "fully_achieved", count: 0 }], [{ label: "unknown", count: 10 }]]) {
      expect(calculateReportCraft({ ...fixture(), outcomes })).toMatchObject({ result: { status: "insufficient_report_data", point: null, unlocked: false, reason: "no_recognized_outcomes" } });
    }
    expect(calculateReportCraft({ ...fixture(), totalSessions: 0, outcomes: [] })).toMatchObject({ result: { reason: "no_sessions", point: null } });
  });
  it.each([" Fully--Achieved \t", "FULLY ACHIEVED", "fully___achieved"])("uses only the closed ASCII normalization for %s", label => {
    expect(calculateReportCraft({ ...fixture(), outcomes: [{ label, count: 10 }] })).toMatchObject({ result: { point: { exact: 100 } } });
  });
  it.each(["fullyAchieved", "échec", "failure", "unsuccessful", "\u00a0fully_achieved\u00a0", "__proto__", "constructor"])("preserves unsupported label %s as unknown", label => {
    expect(calculateReportCraft({ ...fixture(), outcomes: [{ label, count: 10 }] })).toMatchObject({ inputs: { unknownSessions: 10 }, result: { status: "insufficient_report_data" } });
  });
  it.each([["failed", "not-achieved"], ["mostly_achieved", "Mostly Achieved"], ["private label", "PRIVATE-LABEL"]])("rejects duplicate normalized or aliased categories %s/%s before overwriting", (first, second) => {
    expect(calculateReportCraft({ ...fixture(), outcomes: [{ label: first, count: 0 }, { label: second, count: 1 }] })).toEqual({ status: "invalid", reason: "duplicate_category" });
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "2"])("rejects unsafe count %s", count => {
    expect(calculateReportCraft({ ...fixture(), outcomes: [{ label: "failed", count }] })).toEqual({ status: "invalid", reason: "invalid_count" });
    expect(calculateReportCraft({ ...fixture(), totalSessions: count })).toEqual({ status: "invalid", reason: "invalid_count" });
  });
  it("rejects overfull and overflowing checked totals", () => {
    expect(calculateReportCraft({ ...fixture(), totalSessions: 1 })).toEqual({ status: "invalid", reason: "inconsistent_totals" });
    expect(calculateReportCraft({ ...fixture(), totalSessions: Number.MAX_SAFE_INTEGER, outcomes: [{ label: "failed", count: Number.MAX_SAFE_INTEGER }, { label: "unknown", count: 1 }] })).toEqual({ status: "invalid", reason: "inconsistent_totals" });
  });
  it.each([null, {}, { ...fixture(), policyVersion: "v7" }, { ...fixture(), classifierRevision: "future" }, { ...fixture(), outcomes: {} }, { ...fixture(), outcomes: [{ label: "", count: 1 }] }])("rejects unsupported malformed input", input => {
    expect(calculateReportCraft(input)).toEqual({ status: "invalid", reason: "unsupported_schema" });
  });
  it.each([
    { startInclusive: "2026-09-08T00:00:00Z", endExclusive: "2026-09-01T00:00:00Z" },
    { startInclusive: "2026-09-08T00:00:00Z", endExclusive: "2026-09-08T12:00:00.001Z" },
    { startInclusive: "2026-02-30T00:00:00Z", endExclusive: "2026-09-01T00:00:00Z" },
    { startInclusive: "2026-09-01", endExclusive: "2026-09-08" },
  ])("rejects impossible, future and implicit-time periods", reportPeriod => {
    expect(calculateReportCraft({ ...fixture(), reportPeriod })).toEqual({ status: "invalid", reason: "invalid_period" });
  });
  it("keeps valid historical aggregate arithmetic for explicit selection-time aging", () => {
    expect(calculateReportCraft({ ...fixture(), reportPeriod: { startInclusive: "2024-01-01T00:00:00Z", endExclusive: "2024-02-01T00:00:00Z" } })).toMatchObject({ result: { point: { exact: 57 } } });
    expect(calculateReportCraft({ ...fixture(), window: { ...window, calendarDays: 364 } })).toEqual({ status: "invalid", reason: "invalid_period" });
  });
  it("validates canonical replay totals and strips no illicit extra fields silently", () => {
    const calculated = calculateReportCraft(fixture());
    if (calculated.status !== "valid") throw new Error("Expected valid report");
    expect(calculateReportCraftInputs({ ...calculated.inputs, unknownSessions: 2 })).toEqual({ status: "invalid", reason: "inconsistent_totals" });
    expect(calculateReportCraftInputs({ ...calculated.inputs, rawBody: "private" })).toEqual({ status: "invalid", reason: "unsupported_schema" });
  });
});
