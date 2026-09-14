import { describe, expect, it } from "vitest";
import { aggregateEngineeringEvidence, createScoringWindow } from "@chapa/shared";
import { deriveCoreEvidenceV7 } from "@/lib/impact/v7-evidence";
import { ageSupplementalEvidence, parseSupplementalEvidenceV2, type SupplementalEvidenceV2 } from "./evidence-aging";

const reference = "2026-09-05T12:00:00.000Z";
const window = createScoringWindow(reference);
function upload(): SupplementalEvidenceV2 {
  return {
    schemaVersion: "supplemental-v2", targetHandle: "alice",
    source: { provider: "github", host: "github.com", subjectId: "work-42", handle: "alice-work" },
    observationPeriod: { startInclusive: "2025-09-06T00:00:00.000Z", endExclusive: reference },
    observedThrough: reference,
    events: [{ eventId: "merge-1", repositoryId: "repo-1", actorId: "work-42", workItemId: "pr-1",
      kind: "accepted_change", occurredAt: "2025-09-06T10:00:00.000Z", artifactRevision: "sha-1",
      files: ["src/a.ts"], additions: 10, deletions: 2, leadTimeHours: 4,
      hasDescription: true, hasIssueLink: true, usesFeatureBranch: true,
      acceptance: { method: "merged_change", acceptedAt: "2025-09-06T10:00:00.000Z", acceptedResultId: "merge-1" } }],
  };
}
function record(value = upload(), uploadedAt = reference) {
  return { uploadId: "upload-1", uploadedAt, value };
}

describe("supplemental v2 validation and exact aging", () => {
  it("accepts an authenticated owner's bounded dated import", () => {
    expect(parseSupplementalEvidenceV2(upload(), "alice", reference)).toEqual(upload());
  });
  it.each([
    { targetHandle: "bob" },
    { source: { ...upload().source, handle: "ALICE" } },
    { source: "primary" },
    { provenance: "source_observed" },
    { assessments: [] },
    { repositoryAliases: [] },
    { observedThrough: "2026-09-06T00:00:00.000Z" },
    { observationPeriod: { startInclusive: reference, endExclusive: reference } },
  ])("rejects ownership, primary-source, authority and date forgery %j", change => {
    expect(() => parseSupplementalEvidenceV2({ ...upload(), ...change }, "alice", reference)).toThrow();
  });
  it.each([
    { actorId: "someone-else" }, { additions: Infinity }, { additions: 1e308 }, { deletions: -1 },
    { additions: 0.5 }, { leadTimeHours: NaN }, { occurredAt: "2026-09-06T00:00:00.000Z" },
    { provenance: "human_assessed" }, { canonicalProjectId: "primary-project" },
  ])("rejects invalid event fields %j", change => {
    const value = upload();
    expect(() => parseSupplementalEvidenceV2({ ...value, events: [{ ...value.events[0], ...change }] }, "alice", reference)).toThrow();
  });
  it("ages the precise event and all its diagnostic observations out at the UTC boundary", () => {
    const before = aggregateEngineeringEvidence(ageSupplementalEvidence([record()], "alice", window));
    const after = aggregateEngineeringEvidence(ageSupplementalEvidence([record()], "alice", createScoringWindow("2026-09-06T12:00:00.000Z")));
    expect(before.events).toHaveLength(1);
    expect(after.events).toHaveLength(0);
    expect(before.diagnostics.descriptionRate.denominator).toBe(1);
    expect(after.diagnostics.descriptionRate.denominator).toBe(0);
    expect(before.diagnostics.leadTimeHours.median).toBe(4);
    expect(after.diagnostics.leadTimeHours).toEqual({ observations: [], unknownCount: 0, median: null });
    expect(after.scope.sources[0]?.repositoryIds).toEqual([]);
    expect(after.observedEventCalendar.every(day => day.count === 0)).toBe(true);
  });
  it("reupload time never rejuvenates an old event", () => {
    const later = createScoringWindow("2026-09-06T12:00:00.000Z");
    expect(ageSupplementalEvidence([record(upload(), later.referenceTime)], "alice", later).events).toHaveLength(0);
  });
  it("deduplicates overlapping uploads and is order invariant", () => {
    const a = record(); const b = { ...record(), uploadId: "upload-2" };
    const one = ageSupplementalEvidence([a], "alice", window);
    expect(ageSupplementalEvidence([a, b], "alice", window).events).toEqual(one.events);
    expect(ageSupplementalEvidence([a, b], "alice", window)).toEqual(ageSupplementalEvidence([b, a], "alice", window));
  });
  it("preserves unknown measurements instead of inventing zeros or denominators", () => {
    const value = upload();
    const { files: _files, additions: _additions, leadTimeHours: _lead, ...event } = value.events[0]!;
    const evidence = ageSupplementalEvidence([record({ ...value, events: [event] })], "alice", window);
    expect(evidence.events[0]?.measurements.additions.status).toBe("unknown");
    expect(evidence.events[0]?.measurements.changedFiles.status).toBe("unknown");
    expect(evidence.events[0]?.measurements.leadTimeHours.status).toBe("unknown");
  });
  it("authentication does not promote claimed source facts to measured engineering credit", () => {
    const evidence = ageSupplementalEvidence([record()], "alice", window);
    expect(evidence.events[0]?.provenance).toBe("self_reported");
    expect(evidence.scope.sources[0]?.status).toBe("partial");
    expect(evidence.repositoryAliases).toEqual([]);
    expect(evidence.assessments).toEqual([]);
    expect(deriveCoreEvidenceV7(evidence).inputs.counts.deliveryUnits.lower).toBe(0);
  });
  it("excludes records not yet received at a historical reference instant", () => {
    expect(ageSupplementalEvidence([record(upload(), "2026-09-06T00:00:00.000Z")], "alice", window).events).toHaveLength(0);
  });
  it("rejects conflicting immutable facts across overlapping uploads", () => {
    const changed = upload();
    expect(() => ageSupplementalEvidence([record(), record({ ...changed, events: [{ ...changed.events[0]!, artifactRevision: "different-sha" }] })], "alice", window)).toThrow();
  });
  it("accepts non-GitHub source handles without imposing GitHub EMU syntax", () => {
    const value = { ...upload(), source: { ...upload().source, provider: "gitlab" as const, host: "gitlab.com", handle: "alice.work" } };
    expect(parseSupplementalEvidenceV2(value, "alice", reference)).toEqual(value);
  });
  it("accepts an equivalent scoring window independent of object key order", () => {
    const reordered = { calendarDays: window.calendarDays, referenceDate: window.referenceDate, endExclusive: window.endExclusive, startInclusive: window.startInclusive, referenceTime: window.referenceTime };
    expect(ageSupplementalEvidence([record()], "alice", reordered)).toEqual(ageSupplementalEvidence([record()], "alice", window));
  });

});

it("keeps the full window unknown before and after observedThrough ages", () => {
  const value = { ...upload(), events: [] };
  const records = [record(value)];
  for (const asOf of [reference, "2026-09-06T12:00:00.000Z"]) {
    const current = createScoringWindow(asOf);
    const aged = ageSupplementalEvidence(records, "alice", current);
    expect(aged.scope.sources[0]?.unknownPeriods).toEqual([{ startInclusive: current.startInclusive, endExclusive: current.endExclusive }]);
    const core = deriveCoreEvidenceV7(aged);
    const explicit = deriveCoreEvidenceV7({ ...aged, scope: { ...aged.scope, sources: aged.scope.sources.map(source => ({ ...source, unknownPeriods: [{ startInclusive: current.startInclusive, endExclusive: current.endExclusive }] })) } });
    expect(core.inputs).toEqual(explicit.inputs);
    expect(core.inputs.counts.activeIsoWeeks).toEqual({ lower: 0, upper: 40 });
    expect(core.inputs.counts.eligibleProjects).toEqual({ lower: 0, upper: 4 });
    expect(core.inputs.counts.eligibleCategories).toEqual({ lower: 0, upper: 4 });
    expect(core.observedCounts.activeIsoWeeks).toBe(0);
  }
});

it.each(["workItemId", "artifactRevision", "occurredAt"] as const)("rejects conflicting %s in one immutable event identity", field => {
  const value = upload();
  const changed = { ...value.events[0]!, [field]: field === "occurredAt" ? "2025-09-07T10:00:00.000Z" : "different", acceptance: undefined };
  expect(() => parseSupplementalEvidenceV2({ ...value, events: [{ ...value.events[0]!, acceptance: undefined }, changed] }, "alice", reference)).toThrow();
});

it("permits enrichment and conflicting diagnostic measurements for the same immutable event", () => {
  const value = upload();
  const first = { ...value.events[0]!, additions: undefined, files: undefined };
  const enriched = { ...first, additions: 3, files: ["src/a.ts"] };
  expect(() => parseSupplementalEvidenceV2({ ...value, events: [first, enriched, { ...enriched, additions: 4 }] }, "alice", reference)).not.toThrow();
  expect(ageSupplementalEvidence([record({ ...value, events: [first, enriched, { ...enriched, additions: 4 }] })], "alice", window).events[0]?.measurements.additions.status).toBe("unknown");
});
