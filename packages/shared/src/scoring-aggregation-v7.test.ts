import { describe, expect, it } from "vitest";
import { aggregateEngineeringEvidence, classifyDocumentationFiles, mergeEngineeringEvidence } from "./scoring-aggregation-v7";
import { observed, unknown, type EngineeringEvidenceInput, type NormalizedEngineeringEvent, type SourceCoverage } from "./scoring-evidence";
import { createScoringWindow } from "./scoring-window";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "person" };
const coverage: SourceCoverage = { source, window, dataThrough: window.referenceTime, status: "complete", discovery: "explicit_repositories", repositoryIds: ["repo"], repositoryDiscoveryComplete: true, eventKinds: { accepted_change: "complete", authored_commit: "complete" }, reasonCodes: [], unknownPeriods: [] };
const yes = <T>(value: T) => observed(value, "complete", "source_observed");
function event(id: string, overrides: Partial<NormalizedEngineeringEvent> = {}): NormalizedEngineeringEvent {
  return { ...source, schemaVersion: "v7", repositoryId: "repo", actorId: "person", eventId: id, kind: "accepted_change", occurredAt: "2026-08-01T12:00:00Z", dataThrough: window.referenceTime, canonicalProjectId: "unverified-client-label", workItemId: `work-${id}`, artifactRevision: `sha-${id}`, artifactReferenceIds: [`ref-${id}`], attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [], measurements: { changedFiles: yes(["src/app.ts"]), additions: yes(10), deletions: yes(5), leadTimeHours: yes(1), hasDescription: yes(true), hasIssueLink: yes(false), usesFeatureBranch: yes(true) }, acceptance: yes({ method: "merged_change", acceptedAt: "2026-08-01T12:00:00Z", acceptedResultId: `result-${id}` }), ...overrides };
}
function input(events: readonly NormalizedEngineeringEvent[], overrides: Partial<EngineeringEvidenceInput> = {}): EngineeringEvidenceInput {
  return { schemaVersion: "v7", window, scope: { sources: [coverage], excludedSources: [], ledgerRevisionIds: [] }, events, repositoryAliases: [], equivalentWorkItems: [], assessments: [], ...overrides };
}
function measured(id: string, hours: number, description: boolean) {
  const value = event(id);
  return { ...value, measurements: { ...value.measurements, leadTimeHours: yes(hours), hasDescription: yes(description) } };
}

describe("v7 evidence pooling", () => {
  it("pools individual lead times rather than medians of aggregates", () => {
    const a = input([1, 1, 1].map((hours, i) => measured(`a${i}`, hours, true)));
    const b = input([2, 100, 100].map((hours, i) => measured(`b${i}`, hours, false)));
    const result = aggregateEngineeringEvidence(mergeEngineeringEvidence(a, b));
    expect(result.diagnostics.leadTimeHours).toEqual({ observations: [1, 1, 1, 2, 100, 100], unknownCount: 0, median: 1.5 });
  });

  it("keeps the median finite for finite observations near the numeric ceiling", () => {
    const result = aggregateEngineeringEvidence(input([measured("a", 1e308, true), measured("b", 1e308, true)]));
    expect(result.diagnostics.leadTimeHours.median).toBe(1e308);
  });

  it("preserves measured denominators for every order and parenthesization", () => {
    const a = input([0, 1, 2].map(i => measured(`a${i}`, 1, true)));
    const b = input(Array.from({ length: 30 }, (_, i) => {
      const value = event(`b${i}`);
      return { ...value, measurements: { ...value.measurements, hasDescription: unknown("unavailable", "not_supported") } };
    }));
    const c = input([0, 1, 2].map(i => measured(`c${i}`, 1, false)));
    const permutations = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];
    for (const [first, second, third] of permutations) {
      for (const merged of [mergeEngineeringEvidence(mergeEngineeringEvidence(first!, second!), third!), mergeEngineeringEvidence(first!, mergeEngineeringEvidence(second!, third!))]) {
        expect(aggregateEngineeringEvidence(merged).diagnostics.descriptionRate).toEqual({ numerator: 3, denominator: 6, unknownCount: 30, value: 0.5 });
      }
    }
  });

  it("is idempotent and deterministic for overlapping uploads", () => {
    const a = input([event("a"), event("b")]);
    expect(aggregateEngineeringEvidence(mergeEngineeringEvidence(a, a))).toEqual(aggregateEngineeringEvidence(a));
    expect(mergeEngineeringEvidence(a, input([event("b"), event("c")]))).toEqual(mergeEngineeringEvidence(input([event("c"), event("b")]), a));
  });

  it("pools micro and documentation rates instead of their maxima", () => {
    const a = event("a", { measurements: { ...event("a").measurements, changedFiles: yes(["README.md"]), additions: yes(1), deletions: yes(1) } });
    const b = event("b", { measurements: { ...event("b").measurements, additions: yes(100) } });
    const result = aggregateEngineeringEvidence(mergeEngineeringEvidence(input([a]), input([b])));
    expect(result.diagnostics.microChangeRate.value).toBe(0.5);
    expect(result.diagnostics.documentationOnlyRate.value).toBe(0.5);
  });

  it("does not weight duplicate PR and linked issue acceptance twice", () => {
    const pr = event("pr");
    const closure = event("closure", { kind: "issue_work", workItemId: "issue", occurredAt: "2026-08-02T12:00:00Z", acceptance: yes({ method: "linked_issue_result", acceptedAt: "2026-08-02T12:00:00Z", acceptedResultId: "result-pr" }) });
    const data = input([pr, closure], { equivalentWorkItems: [{ workItemIds: [pr.workItemId, closure.workItemId], canonicalWorkItemId: pr.workItemId, acceptedEventId: pr.eventId, evidenceReferenceIds: ["link"] }] });
    const result = aggregateEngineeringEvidence(data);
    expect(result.acceptedWork).toHaveLength(1);
    expect(result.acceptedWork[0]?.acceptedAt).toBe("2026-08-01T12:00:00.000Z");
    expect(result.events.map(e => e.workItemId)).toEqual(["work-pr", "work-pr"]);
  });

  it("uses verified repo aliases across accounts and never an unverified client label", () => {
    const a = event("a");
    const b = event("b", { ...source, subjectId: "other", actorId: "other", repositoryId: "mirror" });
    const second = { ...coverage, source: { ...source, subjectId: "other" }, repositoryIds: ["mirror"] };
    const data = input([a, b], { scope: { sources: [coverage, second], excludedSources: [], ledgerRevisionIds: [] } });
    expect(new Set(aggregateEngineeringEvidence(data).events.map(e => e.canonicalProjectId)).size).toBe(2);
    const aliased = { ...data, repositoryAliases: [{ repositories: [a, b], canonicalProjectId: "verified", verifiedAt: window.referenceTime, evidenceReferenceIds: ["mirror-proof"] }] };
    expect(new Set(aggregateEngineeringEvidence(aliased).events.map(e => e.canonicalProjectId))).toEqual(new Set(["verified"]));
  });

  it("deduplicates diagnostic work linked across provider observations", () => {
    const original = measured("original", 2, true);
    const duplicate = event("copy", { repositoryId: "mirror", artifactRevision: original.artifactRevision, measurements: original.measurements });
    const data = input([original, duplicate, measured("other", 4, false)], {
      scope: { ...input([]).scope, sources: [{ ...coverage, repositoryIds: ["repo", "mirror"] }] },
      repositoryAliases: [{ repositories: [original, duplicate], canonicalProjectId: "canonical", verifiedAt: window.referenceTime, evidenceReferenceIds: ["alias"] }],
      equivalentWorkItems: [{ workItemIds: [original.workItemId, duplicate.workItemId], canonicalWorkItemId: original.workItemId, acceptedEventId: original.eventId, evidenceReferenceIds: ["link"] }],
    });
    const result = aggregateEngineeringEvidence(data);
    expect(result.diagnostics.descriptionRate).toEqual({ numerator: 1, denominator: 2, unknownCount: 0, value: 0.5 });
    expect(result.diagnostics.leadTimeHours.observations).toEqual([2, 4]);
    const commits = { ...data, events: data.events.slice(0, 2).map(e => ({ ...e, kind: "authored_commit" as const, acceptance: unknown("partial", "acceptance_time_unknown") })) };
    expect(aggregateEngineeringEvidence(commits).diagnostics.authoredCommits).toBe(1);
  });

  it("resolves overlapping equivalence groups transitively without depending on merge order", () => {
    const a = input([event("a"), event("b")], { equivalentWorkItems: [{ workItemIds: ["work-a", "work-b"], canonicalWorkItemId: "canonical-one", acceptedEventId: "a", evidenceReferenceIds: ["first-link"] }] });
    const b = input([event("b"), event("c")], { equivalentWorkItems: [{ workItemIds: ["work-b", "work-c"], canonicalWorkItemId: "canonical-two", acceptedEventId: "a", evidenceReferenceIds: ["second-link"] }] });
    const result = aggregateEngineeringEvidence(mergeEngineeringEvidence(a, b));
    expect(new Set(result.events.map(e => e.workItemId)).size).toBe(1);
    expect(result.acceptedWork).toHaveLength(1);
    expect(result).toEqual(aggregateEngineeringEvidence(mergeEngineeringEvidence(b, a)));
  });

  it("counts authored commits for concentration and real ten-minute windows", () => {
    const commits = [0, 1, 2].map(i => event(`c${i}`, { kind: "authored_commit", occurredAt: `2026-08-01T${12 + i}:00:00Z`, acceptance: unknown("partial", "acceptance_time_unknown") }));
    const result = aggregateEngineeringEvidence(input([...commits, ...Array.from({ length: 20 }, (_, i) => event(`pr${i}`))]));
    expect(result.diagnostics.authoredCommits).toBe(3);
    expect(result.diagnostics.maxAuthoredCommitsInTenMinutes).toBe(1);
    expect(result.diagnostics.topRepositoryCommitShare).toBe(1);
    expect(result.observedEventCalendar).toHaveLength(365);
    expect(result.observedEventCalendar.filter(day => day.count)).toEqual([{ date: "2026-08-01", count: 23 }]);
    const dense = { ...input(commits), heatmapData: Array.from({ length: 365 }, () => ({ count: 99 })) };
    expect(aggregateEngineeringEvidence(dense)).toEqual(aggregateEngineeringEvidence(input(commits)));
  });

  it("retains unknown measurements instead of inventing zeros", () => {
    const value = event("a");
    const result = aggregateEngineeringEvidence(input([{ ...value, measurements: { ...value.measurements, leadTimeHours: unknown("partial", "pagination_incomplete"), changedFiles: yes([]), additions: unknown("partial", "not_accessible") } }]));
    expect(result.diagnostics.leadTimeHours.median).toBeNull();
    expect(result.diagnostics.microChangeRate).toEqual({ numerator: 0, denominator: 0, unknownCount: 1, value: null });
    expect(result.diagnostics.documentationOnlyRate.value).toBeNull();
  });

  it("provides artifact-supported documentation categories only for complete observed paths", () => {
    const doc = event("docs", { measurements: { ...event("docs").measurements, changedFiles: yes(["docs/guide.md"]) } });
    const partial = event("partial", { measurements: { ...doc.measurements, changedFiles: observed(["README.md"], "partial", "source_observed") } });
    const result = aggregateEngineeringEvidence(input([doc, partial]));
    expect(result.events.find(e => e.eventId === "docs")?.categories).toEqual([{ category: "documentation_design", evidenceReferenceIds: ["ref-docs"] }]);
    expect(result.events.find(e => e.eventId === "partial")?.categories).toEqual([]);
  });

  it("does not turn a later linked closure into new acceptance inside the window", () => {
    const pr = event("old-pr", { occurredAt: "2024-01-01T12:00:00Z", acceptance: yes({ method: "merged_change", acceptedAt: "2024-01-01T12:00:00Z", acceptedResultId: "result" }) });
    const closure = event("closure", { kind: "issue_work", acceptance: yes({ method: "linked_issue_result", acceptedAt: "2026-08-01T12:00:00Z", acceptedResultId: "result" }) });
    const result = aggregateEngineeringEvidence(input([pr, closure], { equivalentWorkItems: [{ workItemIds: [pr.workItemId, closure.workItemId], canonicalWorkItemId: pr.workItemId, acceptedEventId: pr.eventId, evidenceReferenceIds: ["link"] }] }));
    expect(result.events).toHaveLength(1);
    expect(result.acceptedWork).toEqual([]);
  });

  it("does not award acceptance for a bare closure, uncertain attribution or raw self-report", () => {
    expect(aggregateEngineeringEvidence(input([
      event("closed", { kind: "issue_work", acceptance: unknown("unavailable", "not_supported") }),
      event("uncertain", { attribution: "unclear" }), event("claim", { provenance: "self_reported" }),
    ])).acceptedWork).toEqual([]);
  });

  it("does not promote self-reported acceptance fields or partial line counts to source facts", () => {
    const base = event("claim");
    const claim = { ...base, acceptance: observed({ method: "merged_change" as const, acceptedAt: base.occurredAt, acceptedResultId: "claim" }, "complete", "self_reported") };
    expect(aggregateEngineeringEvidence(input([claim])).acceptedWork).toEqual([]);
    const partial = { ...base, measurements: { ...base.measurements, additions: observed(1, "partial", "source_observed"), deletions: yes(1) } };
    expect(aggregateEngineeringEvidence(input([partial])).diagnostics.microChangeRate).toEqual({ numerator: 0, denominator: 0, unknownCount: 1, value: null });
  });

  it("rejects provenance conflicts instead of laundering a duplicate's claimed category", () => {
    const sourceEvent = event("source");
    const claimed = { ...sourceEvent, provenance: "self_reported" as const, acceptance: unknown("partial", "not_assessed"), categories: [{ category: "verification_review" as const, evidenceReferenceIds: ["self-assertion"] }] };
    expect(() => aggregateEngineeringEvidence(input([sourceEvent, claimed]))).toThrow(/conflict/i);
  });

  it("keeps conflicting measurements unknown and nonfinite lead times out of the median", () => {
    const a = event("a");
    const conflict = { ...a, measurements: { ...a.measurements, hasDescription: yes(false) } };
    const bad = event("bad", { measurements: { ...a.measurements, leadTimeHours: yes(Number.NaN) } });
    const result = aggregateEngineeringEvidence(input([a, conflict, bad]));
    expect(result.diagnostics.descriptionRate).toEqual({ numerator: 1, denominator: 1, unknownCount: 1, value: 1 });
    expect(result.diagnostics.leadTimeHours).toEqual({ observations: [1], unknownCount: 1, median: 1 });
  });

  it("uses an inclusive ten-minute diagnostic boundary", () => {
    const commits = ["12:00:00.000", "12:10:00.000", "12:20:00.001"].map((time, i) => event(String(i), { kind: "authored_commit", occurredAt: `2026-08-01T${time}Z`, acceptance: unknown("partial", "acceptance_time_unknown") }));
    expect(aggregateEngineeringEvidence(input(commits)).diagnostics.maxAuthoredCommitsInTenMinutes).toBe(2);
    const empty = aggregateEngineeringEvidence(input([]));
    expect(empty.diagnostics.topRepositoryCommitShare).toBeNull();
    expect(empty.observedEventCalendar.every(day => day.count === 0)).toBe(true);
  });

  it.each(["constructor", "__proto__"])("counts opaque canonical project ID %s safely", canonicalProjectId => {
    const commit = event("commit", { kind: "authored_commit", acceptance: unknown("partial", "acceptance_time_unknown") });
    const result = aggregateEngineeringEvidence(input([commit], { repositoryAliases: [{ repositories: [commit], canonicalProjectId, verifiedAt: window.referenceTime, evidenceReferenceIds: ["proof"] }] }));
    expect(result.diagnostics.authoredCommitsByRepository[canonicalProjectId]).toBe(1);
    expect(result.diagnostics.topRepositoryCommitShare).toBe(1);
  });

  it("rejects inconsistent scopes and unverified alias assertions", () => {
    expect(() => mergeEngineeringEvidence()).toThrow();
    expect(() => aggregateEngineeringEvidence(input([], { window: { ...window, calendarDays: 364 as 365 } }))).toThrow(/window/i);
    expect(() => aggregateEngineeringEvidence(input([], { scope: { ...input([]).scope, sources: [{ ...coverage, window: createScoringWindow("2026-09-04T12:00:00Z") }] } }))).toThrow(/window/i);
    expect(() => aggregateEngineeringEvidence(input([], { repositoryAliases: [{ repositories: [event("a")], canonicalProjectId: "alias", verifiedAt: window.referenceTime, evidenceReferenceIds: [] }] }))).toThrow(/verification/i);
    expect(aggregateEngineeringEvidence(input([event("outside", { repositoryId: "undeclared" })])).events).toEqual([]);
  });

  it("merges compatible facts but rejects conflicting immutable event identities", () => {
    const value = event("a");
    const partial = { ...value, measurements: { ...value.measurements, hasDescription: unknown("partial", "not_accessible") } };
    expect(aggregateEngineeringEvidence(input([value, partial])).diagnostics.descriptionRate.value).toBe(1);
    const conflict = { ...value, occurredAt: "2026-08-02T12:00:00Z" };
    expect(() => aggregateEngineeringEvidence(input([value, conflict]))).toThrow(/conflict/i);
  });

  it("requires a single reference window and excludes out-of-scope actors, dates and sources", () => {
    expect(() => mergeEngineeringEvidence(input([]), { ...input([]), window: createScoringWindow("2026-09-04T12:00:00Z") })).toThrow(/window/i);
    const events = [event("valid"), event("other", { actorId: "someone-else" }), event("future", { occurredAt: "2026-09-05T13:00:00Z" }), event("old", { occurredAt: "2024-08-01T12:00:00Z" }), event("unknown-source", { host: "other.example" })];
    const result = aggregateEngineeringEvidence(input(events));
    expect(result.events.map(e => e.eventId)).toEqual(["valid"]);
    expect(result.excludedEvents).toHaveLength(4);
  });
});

describe("complete-path documentation classification", () => {
  it.each(["README", "README.md", "CHANGELOG", "LICENSE", "CONTRIBUTING.rst", "CODE_OF_CONDUCT.md", "SECURITY.txt", "docs/guide", "nested/docs/intro.md", "design.adoc", "notes.mdx", "notes.txt"])("recognizes %s", path => {
    expect(classifyDocumentationFiles(yes([path]))).toEqual(yes(true));
  });
  it.each([["README.md", "src/a.ts"], ["src/docstring.ts"], ["docs-generator.ts"], ["README-malware.exe"]].map(paths => ({ paths })))("does not misclassify mixed or misleading paths $paths", ({ paths }) => {
    expect(classifyDocumentationFiles(yes(paths))).toEqual(yes(false));
  });
  it("does not infer docs-only from empty or partial lists", () => {
    expect(classifyDocumentationFiles(yes([])).status).toBe("unknown");
    expect(classifyDocumentationFiles(observed(["README.md"], "partial", "source_observed")).status).toBe("unknown");
    expect(classifyDocumentationFiles(unknown("unavailable", "not_supported"))).toEqual(unknown("unavailable", "not_supported"));
  });
});
