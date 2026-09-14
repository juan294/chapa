import { describe, expect, it } from "vitest";
import { createScoringWindow, observed, type EngineeringEvidenceInput, type NormalizedEngineeringEvent, type SourceCoverage } from "@chapa/shared";
import { computeObservedImpactV7 } from "./observed-v7";
import { deriveCoreEvidenceV7 } from "./v7-evidence";

const window = createScoringWindow("2026-09-07T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "synthetic-owner" };
const yes = <T>(value: T) => observed(value, "complete", "source_observed");
const coverage: SourceCoverage = { source, window, dataThrough: window.referenceTime, status: "complete", discovery: "explicit_repositories", repositoryIds: ["repo"], repositoryDiscoveryComplete: true, eventKinds: { accepted_change: "complete", authored_commit: "complete", review: "complete", issue_work: "complete", documentation_design: "complete", maintenance: "complete", practice_evidence: "complete" }, reasonCodes: [], unknownPeriods: [] };
function event(id: string, date: string): NormalizedEngineeringEvent {
  return { ...source, schemaVersion: "v7", repositoryId: "repo", actorId: "synthetic-owner", eventId: id, kind: "accepted_change", occurredAt: `${date}T12:00:00Z`, dataThrough: window.referenceTime, canonicalProjectId: "repo", workItemId: id, artifactRevision: `sha-${id}`, artifactReferenceIds: [`ref-${id}`], attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [], measurements: { changedFiles: yes(["src/app.ts"]), additions: yes(1), deletions: yes(0), leadTimeHours: yes(1), hasDescription: yes(true), hasIssueLink: yes(true), usesFeatureBranch: yes(true) }, acceptance: yes({ method: "merged_change", acceptedAt: `${date}T12:00:00Z`, acceptedResultId: id }) };
}
function input(events: readonly NormalizedEngineeringEvent[], sources = [coverage]): EngineeringEvidenceInput {
  return { schemaVersion: "v7", window, scope: { sources, excludedSources: [], ledgerRevisionIds: [] }, events, repositoryAliases: [], equivalentWorkItems: [], assessments: [] };
}

describe("v7.2 recorded evidence seam", () => {
  it("C04: preserves unassessed Quality and original coverage alongside scalar points", () => {
    const evidence = input([event("a", "2026-08-01"), event("b", "2026-08-02"), event("c", "2026-08-03")]);
    const original = deriveCoreEvidenceV7(evidence);
    const result = computeObservedImpactV7(evidence);
    expect(result.inputs.counts).toEqual(original.inputs.counts);
    expect(result.aggregation).toEqual(original.aggregation);
    expect(result.limitations).toContain("not_assessed");
    expect(result.core.dimensions.quality.exact).toBe(0);
    expect(result.trace.quality.rationale.originalBounds).toEqual({ lower: 0, upper: 3 });
    expect(result.observedCounts).toEqual(original.observedCounts);
    expect(result.activityCalendar).toEqual(original.activityCalendar);
    expect(Object.values(result.core.dimensions).every(point => point.kind === "point")).toBe(true);
    expect(result.core.archetype).toBeNull();
  });
  it("C05: duplicate work and same project/date splits add no observed credit", () => {
    const a = event("a", "2026-08-01");
    const baseline = computeObservedImpactV7(input([a]));
    expect(computeObservedImpactV7(input([a, a])).core).toEqual(baseline.core);
    const split = computeObservedImpactV7(input([a, event("split", "2026-08-01")]));
    expect(split.core).toEqual(baseline.core);
    expect(split.observedCounts.deliveryUnits).toBe(1);
  });
  it("C05: recorded additions across dates cannot lower the score", () => {
    const events: NormalizedEngineeringEvent[] = [];
    let previous = 0;
    for (let day = 1; day <= 20; day++) {
      events.push(event(String(day), `2026-08-${String(day).padStart(2, "0")}`));
      const result = computeObservedImpactV7(input(events));
      expect(result.core.composite.exact).toBeGreaterThanOrEqual(previous);
      previous = result.core.composite.exact;
    }
  });
  it("C04: incomplete source metadata changes bounds but never estimates observed credit", () => {
    const events = [event("a", "2026-08-01")];
    const complete = computeObservedImpactV7(input(events));
    const partial: SourceCoverage = { ...coverage, status: "partial", repositoryDiscoveryComplete: false, reasonCodes: ["pagination_incomplete"], unknownPeriods: [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }] };
    const result = computeObservedImpactV7(input(events, [partial]));
    expect(result.core.composite).toEqual(complete.core.composite);
    expect(result.core.dimensions).toEqual(complete.core.dimensions);
    expect(result.inputs.counts.deliveryUnits.upper).toBe(120);
    expect(result.inputs.counts.deliveryUnits.lower).toBe(1);
    expect(result.aggregation.scope.sources[0]).toMatchObject({ status: "partial", repositoryDiscoveryComplete: false, reasonCodes: ["pagination_incomplete"] });
  });
  it("does not catch a failed/malformed source read and manufacture successful empty observations", () => {
    expect(() => computeObservedImpactV7({ status: "unavailable", reason: "source_error" } as unknown as EngineeringEvidenceInput)).toThrow();
  });
  it("C17: report presence and removal never enter the engineering-evidence boundary", () => {
    const evidence = input([event("a", "2026-08-01")]);
    const expected = computeObservedImpactV7(evidence);
    for (const craft of [null, { status: "scored", exact: 57 }, { status: "scored", exact: 0 }, { status: "removed" }]) {
      expect(computeObservedImpactV7({ ...evidence, craft } as EngineeringEvidenceInput)).toEqual(expected);
    }
  });
});
