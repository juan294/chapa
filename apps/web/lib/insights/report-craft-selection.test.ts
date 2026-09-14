import { describe, expect, it } from "vitest";
import { createScoringWindow, type ReportCraftCandidate, type ScoredReportCraft } from "@chapa/shared";
import { calculateReportCraftInputs } from "./report-craft";
import { selectReportCraft } from "./report-craft-selection";

const window = createScoringWindow("2026-09-08T12:00:00Z");
function candidate(id: string, start = "2026-09-01", end = "2026-09-08", successful = 10): ReportCraftCandidate {
  return { reportId: id, contentDigest: { algorithm: "SHA-256", value: id.repeat(64).slice(0, 64) }, supersedesReportId: null, inputs: {
    policyVersion: "v7.2", classifierRevision: "cc-outcomes-v7.2", window,
    reportPeriod: { startInclusive: `${start}T00:00:00.000Z`, endExclusive: `${end}T00:00:00.000Z` }, totalSessions: 10,
    outcomes: { fully_achieved: successful, mostly_achieved: 0, partially_achieved: 0, not_achieved: 10 - successful }, unknownSessions: 0, unclassifiedSessions: 0,
  } };
}
const select = (candidates: ReportCraftCandidate[], lastPublished: ScoredReportCraft | null = null) => selectReportCraft({ window, candidates, previouslyUnlocked: lastPublished !== null, lastPublished });
const scored = (row: ReportCraftCandidate): ScoredReportCraft => {
  const result = calculateReportCraftInputs(row.inputs);
  if (result.status !== "valid" || result.result.status !== "scored") throw new Error("Expected scored fixture");
  return result.result;
};

describe("period-driven report Craft selection", () => {
  it("C09 picks latest end then start, never highest score or overlapping sum", () => {
    const older = candidate("a", "2026-08-01", "2026-09-01");
    const newest = candidate("b", "2026-09-01", "2026-09-08", 0);
    const longer = candidate("c", "2026-08-01", "2026-09-08");
    for (const rows of [[older, newest, longer], [longer, newest, older]]) expect(select(rows)).toEqual({ status: "selected", candidate: newest });
  });
  it("C09 exact duplicates are idempotent and explicit correction wins regardless of order", () => {
    const old = candidate("a");
    expect(select([old, structuredClone(old)])).toEqual({ status: "selected", candidate: old });
    const corrected = { ...candidate("b", undefined, undefined, 0), supersedesReportId: old.reportId };
    expect(select([corrected, old])).toEqual({ status: "selected", candidate: corrected });
    expect(select([old, corrected])).toEqual({ status: "selected", candidate: corrected });
    const duplicate = { ...old, reportId: "duplicate" };
    expect(select([duplicate, old])).toEqual(select([old, duplicate]));
    const tampered = { ...candidate("b", undefined, undefined, 0), contentDigest: old.contentDigest };
    expect(select([old, tampered])).toMatchObject({ status: "conflict" });
  });
  it("rejects unlinked same-period replacements, forks, cycles, missing parents and conflicting identities", () => {
    const a = candidate("a"), b = candidate("b"), c = candidate("c");
    for (const rows of [[a, b], [a, { ...b, supersedesReportId: "a" }, { ...c, supersedesReportId: "a" }], [{ ...a, supersedesReportId: "b" }, { ...b, supersedesReportId: "a" }], [{ ...b, supersedesReportId: "missing" }], [{ ...a, supersedesReportId: "a" }], [a, { ...b, reportId: "a" }]]) {
      expect(select(rows)).toEqual({ status: "conflict", reason: "same_period_requires_explicit_correction" });
    }
  });
  it("does not let newer insufficient uploads erase a valid current score", () => {
    const valid = candidate("a", "2026-08-01", "2026-09-01");
    const base = candidate("b");
    const insufficient = { ...base, inputs: { ...base.inputs, outcomes: { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 0 }, unclassifiedSessions: 10 } };
    expect(select([insufficient, valid])).toEqual({ status: "selected", candidate: valid });
    expect(select([insufficient])).toMatchObject({ status: "none", result: { status: "insufficient_report_data", point: null } });
  });
  it("resolves corrections through insufficient reports without losing the last scored node", () => {
    const a = candidate("a");
    const empty = { ...a, inputs: { ...a.inputs, outcomes: { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 0 }, unclassifiedSessions: 10 } };
    const b = { ...candidate("b"), supersedesReportId: "a" };
    expect(select([b, empty])).toEqual({ status: "selected", candidate: b });
    const emptyMiddle = { ...empty, reportId: "b", contentDigest: b.contentDigest, supersedesReportId: "a" };
    const c = { ...candidate("c", undefined, undefined, 0), supersedesReportId: "b" };
    expect(select([c, emptyMiddle, a])).toEqual({ status: "selected", candidate: c });
    expect(select([emptyMiddle, a])).toEqual({ status: "selected", candidate: a });
  });
  it("refuses an older-only candidate set behind a known current publication and retains its receipt result", () => {
    const current = scored(candidate("a"));
    const older = candidate("b", "2026-08-01", "2026-09-01");
    expect(select([older], current)).toEqual({ status: "none", result: { status: "unavailable", unlocked: true, point: null, lastReport: current, reason: "source_error" } });
    const insufficient = { ...older, inputs: { ...older.inputs, outcomes: { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 0 }, unclassifiedSessions: 10 } };
    expect(select([insufficient], current)).toEqual({ status: "none", result: { status: "unavailable", unlocked: true, point: null, lastReport: current, reason: "source_error" } });
  });
  it("C10 does not rejuvenate historical/straddling samples and preserves an expired unlocked slot", () => {
    const historical = candidate("a", "2024-01-01", "2024-02-01");
    const last = scored(historical);
    expect(select([historical], last)).toEqual({ status: "none", result: { status: "expired", unlocked: true, point: null, lastReport: last } });
    expect(select([historical])).toMatchObject({ status: "none", result: { status: "unavailable", reason: "outside_window", point: null, unlocked: false } });
    expect(select([candidate("b", "2025-01-01", "2026-09-01")])).toMatchObject({ status: "none", result: { reason: "outside_window" } });
  });
  it("keeps no-report and prior-publication-unavailable distinct", () => {
    expect(select([])).toEqual({ status: "none", result: { status: "no_report", unlocked: false, point: null } });
    expect(select([], scored(candidate("a")))).toMatchObject({ status: "none", result: { status: "unavailable", unlocked: true, reason: "source_error", point: null } });
  });
});
