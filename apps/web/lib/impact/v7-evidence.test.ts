import { describe, expect, it } from "vitest";
import { createScoringWindow, observed, unknown, type EngineeringEvidenceInput, type NormalizedEngineeringEvent, type PrivateCriterionAssessment, type QualityCriterion, type SourceCoverage } from "@chapa/shared";
import { deriveCoreEvidenceV7 } from "./v7-evidence";
import { computeImpactV7 } from "./v7";
const window = createScoringWindow("2026-09-05T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "person" };
const yes = <T>(value: T) => observed(value, "complete", "source_observed");
const criteria: QualityCriterion[] = ["rationale", "verification", "review_or_correction", "outcome_followup"];
const coverage: SourceCoverage = { source, window, dataThrough: window.referenceTime, status: "complete", discovery: "explicit_repositories", repositoryIds: ["repo"], repositoryDiscoveryComplete: true, eventKinds: { accepted_change: "complete", authored_commit: "complete", review: "complete", issue_work: "complete", documentation_design: "complete", maintenance: "complete", practice_evidence: "complete" }, reasonCodes: [], unknownPeriods: [] };
function event(id: string, date = "2026-08-01", overrides: Partial<NormalizedEngineeringEvent> = {}): NormalizedEngineeringEvent {
  return { ...source, schemaVersion: "v7", repositoryId: "repo", actorId: "person", eventId: id, kind: "accepted_change", occurredAt: `${date}T12:00:00Z`, dataThrough: window.referenceTime, canonicalProjectId: "repo", workItemId: id, artifactRevision: `sha-${id}`, artifactReferenceIds: [`ref-${id}`], attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [], measurements: { changedFiles: yes(["src/app.ts"]), additions: yes(1), deletions: yes(0), leadTimeHours: yes(1), hasDescription: yes(true), hasIssueLink: yes(true), usesFeatureBranch: yes(true) }, acceptance: yes({ method: "merged_change", acceptedAt: `${date}T12:00:00Z`, acceptedResultId: id }), ...overrides };
}
function assessment(workItemId: string, criterion: QualityCriterion, status: "accepted" | "rejected" = "accepted"): PrivateCriterionAssessment {
  return { revisionId: `${workItemId}-${criterion}-r1`, revision: 1, supersedesRevisionId: null, action: "create", recordedAt: "2026-09-04T12:00:00Z", assessmentId: `${workItemId}-${criterion}`, claimRevisionId: `claim-${workItemId}`, workItemId, criterion, status, rubricVersion: "v7", reasonCode: status === "accepted" ? "criterion_demonstrated" : "criterion_not_demonstrated", evaluator: { id: "reviewer", kind: "human", version: "1", independent: true }, rationale: "Artifact-specific recorded verdict", assessedAt: "2026-09-04T11:00:00Z", evidenceReferenceIds: [`ref-${workItemId}`, `evidence-${workItemId}-${criterion}`], provenance: "human_assessed" };
}
function input(events: NormalizedEngineeringEvent[], assessments: PrivateCriterionAssessment[] = [], sources = [coverage]): EngineeringEvidenceInput {
  return { schemaVersion: "v7", window, scope: { sources, excludedSources: [], ledgerRevisionIds: [...new Set(assessments.map(a => a.claimRevisionId))] }, events, repositoryAliases: [], equivalentWorkItems: [], assessments };
}

describe("v7 qualifying evidence and component-specific bounds", () => {
  it("does not reward splitting or line magnitude within the same project/day", () => {
    const one = deriveCoreEvidenceV7(input([event("one")]));
    const split = deriveCoreEvidenceV7(input(Array.from({ length: 50 }, (_, i) => event(`split-${i}`))));
    expect(one.inputs.counts.deliveryUnits).toEqual({ lower: 1, upper: 1 });
    expect(split.inputs.counts.deliveryUnits).toEqual(one.inputs.counts.deliveryUnits);
    const deleted = event("one", "2026-08-01", { measurements: { ...event("one").measurements, additions: yes(0), deletions: yes(1e8) } });
    expect(deriveCoreEvidenceV7(input([deleted])).inputs).toEqual(one.inputs);
    expect(split.inputs.counts.activeIsoWeeks).toEqual({ lower: 1, upper: 1 });
  });
  it("does not turn metadata or empty approvals into proven practices or active weeks", () => {
    const pr = deriveCoreEvidenceV7(input([event("pr")]));
    for (const criterion of criteria) expect(pr.inputs.counts.quality[criterion]).toEqual({ lower: 0, upper: 1 });
    const review = event("approval", "2026-08-01", { kind: "review", acceptance: unknown("unavailable", "not_supported") });
    const result = deriveCoreEvidenceV7(input([review]));
    expect(result.inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 0 });
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 0, upper: 1 });
    expect(result.activityCalendar.every(day => day.count === 0)).toBe(true);
  });
  it("counts accepted quality once per work item and records inspected rejection as zero", () => {
    const events = [event("a"), event("b")];
    const assessments = criteria.flatMap(c => [assessment("a", c), assessment("b", c, "rejected")]);
    const result = deriveCoreEvidenceV7(input(events, [...assessments, ...assessments]));
    for (const criterion of criteria) expect(result.inputs.counts.quality[criterion]).toEqual({ lower: 1, upper: 1 });
  });
  it("allows documented solo correction to establish review practice without AI or a report", () => {
    const commit = event("debug", "2026-08-01", { kind: "authored_commit", acceptance: unknown("partial", "acceptance_time_unknown") });
    const result = deriveCoreEvidenceV7(input([commit], [assessment("debug", "review_or_correction")]));
    expect(result.inputs.counts.quality.review_or_correction).toEqual({ lower: 1, upper: 1 });
    expect(result.inputs.counts.activeIsoWeeks.lower).toBe(1);
  });
  it("requires three distinct dates before a project or category qualifies", () => {
    const two = [event("a", "2026-08-01"), event("b", "2026-08-02")];
    expect(deriveCoreEvidenceV7(input(two)).inputs.counts.eligibleProjects).toEqual({ lower: 0, upper: 0 });
    const three = [...two, event("c", "2026-08-03")];
    expect(deriveCoreEvidenceV7(input(three)).inputs.counts.eligibleProjects).toEqual({ lower: 1, upper: 1 });
    expect(deriveCoreEvidenceV7(input(three)).inputs.counts.eligibleCategories).toEqual({ lower: 1, upper: 4 });
  });
  it("does not count unknown item totals directly as weeks or qualifying projects", () => {
    const reviews = Array.from({ length: 100 }, (_, i) => event(`review-${i}`, "2026-08-01", { kind: "review", acceptance: unknown("unavailable", "not_supported") }));
    const result = deriveCoreEvidenceV7(input(reviews));
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 0, upper: 1 });
    expect(result.inputs.counts.eligibleProjects).toEqual({ lower: 0, upper: 0 });
    expect(result.inputs.counts.eligibleCategories).toEqual({ lower: 0, upper: 0 });
  });
  it("restricts missing temporal coverage to the intersecting UTC weeks", () => {
    const partial = { ...coverage, status: "partial" as const, eventKinds: { ...coverage.eventKinds, review: "partial" as const }, unknownPeriods: [{ startInclusive: "2026-08-03T00:00:00Z", endExclusive: "2026-08-04T00:00:00Z" }] };
    const result = deriveCoreEvidenceV7(input([], [], [partial]));
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 0, upper: 1 });
    expect(result.inputs.counts.eligibleProjects).toEqual({ lower: 0, upper: 0 });
  });
  it("bounds missing Delivery by known project/date capacity", () => {
    const partial = { ...coverage, status: "partial" as const, eventKinds: { ...coverage.eventKinds, accepted_change: "partial" as const }, unknownPeriods: [{ startInclusive: "2026-08-03T00:00:00Z", endExclusive: "2026-08-04T00:00:00Z" }] };
    expect(deriveCoreEvidenceV7(input([], [], [partial])).inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 1 });
  });
  it("allows an unknown acceptance in another week without multiplying a single item's dates", () => {
    const pending = event("pending", "2026-08-01", { kind: "authored_commit", acceptance: unknown("partial", "acceptance_time_unknown") });
    const result = deriveCoreEvidenceV7(input([event("known"), pending]));
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 1, upper: 2 });
    expect(result.inputs.counts.eligibleProjects).toEqual({ lower: 0, upper: 0 });
    expect(result.inputs.counts.eligibleCategories).toEqual({ lower: 0, upper: 0 });
    const second = { ...pending, eventId: "second", workItemId: "second" };
    const more = deriveCoreEvidenceV7(input([event("known"), pending, second]));
    expect(more.inputs.counts.activeIsoWeeks).toEqual({ lower: 1, upper: 3 });
    expect(more.inputs.counts.eligibleProjects).toEqual({ lower: 0, upper: 1 });
  });
  it("does not make unaccepted implementation-only activity a known active week", () => {
    const pending = event("pending", "2026-08-01", { kind: "authored_commit", acceptance: unknown("partial", "acceptance_time_unknown"), categories: [{ category: "implementation", evidenceReferenceIds: ["ref-pending"] }] });
    expect(deriveCoreEvidenceV7(input([pending])).inputs.counts.activeIsoWeeks).toEqual({ lower: 0, upper: 2 });
  });
  it("keeps inaccessible connected sources in the completion range", () => {
    const inaccessible = { ...coverage, status: "unavailable" as const, repositoryDiscoveryComplete: false, repositoryIds: [], dataThrough: null, eventKinds: {}, reasonCodes: ["not_accessible" as const], unknownPeriods: [] };
    const result = deriveCoreEvidenceV7(input([], [], [inaccessible]));
    expect(result.inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 120 });
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 0, upper: 40 });
    expect(result.inputs.counts.eligibleProjects).toEqual({ lower: 0, upper: 4 });
    expect(result.inputs.counts.eligibleCategories).toEqual({ lower: 0, upper: 4 });
  });
  it("applies dated correction/retraction revisions without silently crediting old acceptance", () => {
    const original = assessment("a", "verification");
    const corrected = { ...original, revisionId: "corrected", revision: 2, supersedesRevisionId: original.revisionId, action: "correct" as const, status: "rejected" as const, reasonCode: "criterion_not_demonstrated" as const };
    expect(deriveCoreEvidenceV7(input([event("a")], [original, corrected])).inputs.counts.quality.verification).toEqual({ lower: 0, upper: 0 });
    const retracted = { ...corrected, action: "retract" as const, status: "retracted" as const, reasonCode: "retracted" as const };
    expect(deriveCoreEvidenceV7(input([event("a")], [original, retracted])).inputs.counts.quality.verification).toEqual({ lower: 0, upper: 1 });
  });
  it("does not accept unregistered claims, self-reported verdicts or unspecified rubric versions", () => {
    const result = deriveCoreEvidenceV7({ ...input([event("a")], [assessment("a", "rationale")]), scope: { ...input([]).scope, ledgerRevisionIds: [] } });
    expect(result.inputs.counts.quality.rationale).toEqual({ lower: 0, upper: 1 });
    for (const record of [{ ...assessment("a", "rationale"), provenance: "self_reported" as const }, { ...assessment("a", "rationale"), rubricVersion: "unpublished" }]) {
      expect(deriveCoreEvidenceV7(input([event("a")], [record])).inputs.counts.quality.rationale).toEqual({ lower: 0, upper: 1 });
    }
  });
  it("keeps AI, tool choice, report disclosure, tenure and diagnostic volume outside core arithmetic", () => {
    const base = input([event("a")], criteria.map(criterion => assessment("a", criterion)));
    const expected = computeImpactV7(base);
    for (const tool of ["manual", "Claude Code", "Codex", "other"]) {
      const varied = { ...base, aiUsage: tool !== "manual", tool, accountCreatedAt: "2026-09-04", craft: { score: 0 }, reports: ["optional"], stars: 100000,
        events: base.events.map(item => ({ ...item, tool, generated: true, measurements: { ...item.measurements, additions: yes(1000000), deletions: yes(1000000), leadTimeHours: yes(0) } })) };
      const result = computeImpactV7(varied);
      expect(result.core).toEqual(expected.core);
      expect(result.calculation).toEqual(expected.calculation);
    }
  });
  it("reaches every full-scale endpoint with admissible, dated engineering evidence", () => {
    const repositories = ["repo", "r2", "r3", "r4"];
    const categories = ["implementation", "verification_review", "documentation_design", "maintenance_support"] as const;
    const events = Array.from({ length: 120 }, (_, index) => {
      const date = new Date(Date.parse(window.startInclusive) + index * 3 * 86400000).toISOString().slice(0, 10);
      return event(`work-${index}`, date, { repositoryId: repositories[index % 4]!, categories: categories.map(category => ({ category, evidenceReferenceIds: [`${category}-${index}`] })) });
    });
    const assessments = events.slice(0, 12).flatMap(item => criteria.map(criterion => assessment(item.workItemId, criterion)));
    const result = computeImpactV7(input(events, assessments, [{ ...coverage, repositoryIds: repositories }]));
    for (const dimension of Object.values(result.core.dimensions)) expect(dimension).toEqual({ kind: "point", value: 100, displayValue: 100 });
    expect(result.core.composite).toEqual({ kind: "point", value: 100, displayValue: 100 });
    expect(result.observedCounts.deliveryUnits).toBe(120);
    expect(result.activityCalendar).toHaveLength(365);
    expect(result.activityCalendar.reduce((sum, day) => sum + day.count, 0)).toBe(120);
  });
  it("does not spread one practice assessment across unrelated reviews of the same item", () => {
    const reviews = [event("a", "2026-08-01", { kind: "review", acceptance: unknown("unavailable", "not_supported") }), event("later-review", "2026-08-17", { workItemId: "a", kind: "review", acceptance: unknown("unavailable", "not_supported") })];
    const result = deriveCoreEvidenceV7(input(reviews, [assessment("a", "review_or_correction")]));
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 1, upper: 2 });
    expect(result.inputs.counts.quality.review_or_correction).toEqual({ lower: 1, upper: 1 });
    expect(result.activityCalendar.find(day => day.date === "2026-08-17")?.count).toBe(0);
  });
  it("uses assessments as of the reference instant and requires complete revision chains", () => {
    const original = assessment("a", "verification");
    const future = { ...original, revisionId: "future", revision: 2, supersedesRevisionId: original.revisionId, action: "retract" as const, status: "retracted" as const, recordedAt: "2026-09-06T00:00:00Z", assessedAt: "2026-09-06T00:00:00Z" };
    expect(deriveCoreEvidenceV7(input([event("a")], [original, future])).inputs.counts.quality.verification.lower).toBe(1);
    for (const broken of [{ ...original, revision: 2 }, { ...original, action: "correct" as const }, { ...original, supersedesRevisionId: "missing" }]) {
      expect(() => deriveCoreEvidenceV7(input([event("a")], [broken]))).toThrow("revision chain");
    }
    expect(() => deriveCoreEvidenceV7(input([event("a")], [original, { ...original, status: "rejected" }]))).toThrow("Conflicting assessment revision");
  });
  it("retains disputed claim verdicts as unknown and accepts separate demonstrated claims once", () => {
    const accepted = assessment("a", "verification");
    const rejected = { ...assessment("a", "verification", "rejected"), assessmentId: "second-review", revisionId: "second-review-r1" };
    expect(deriveCoreEvidenceV7(input([event("a")], [accepted, rejected])).inputs.counts.quality.verification).toEqual({ lower: 0, upper: 1 });
    const independentClaim = { ...accepted, assessmentId: "other-claim-assessment", revisionId: "other-claim-r1", claimRevisionId: "other-claim" };
    expect(deriveCoreEvidenceV7(input([event("a")], [accepted, rejected, independentClaim])).inputs.counts.quality.verification).toEqual({ lower: 1, upper: 1 });
  });
  it("keeps unclear attribution possible without crediting another person's work", () => {
    const unclear = event("unclear", "2026-08-01", { attribution: "unclear" });
    const teammate = event("teammate", "2026-08-02", { actorId: "someone-else" });
    const result = deriveCoreEvidenceV7(input([unclear, teammate]));
    expect(result.inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 1 });
    expect(result.inputs.counts.quality.verification).toEqual({ lower: 0, upper: 1 });
    expect(result.limitations).toContain("attribution_unknown");
  });
  it("contains admissible acceptance-date completions and ignores event ordering/duplicate uploads", () => {
    const pending = event("pending", "2026-08-01", { kind: "authored_commit", acceptance: unknown("partial", "acceptance_time_unknown") });
    const base = input([event("known"), pending]);
    const bounds = deriveCoreEvidenceV7(base).inputs.counts;
    for (const date of ["2026-08-01", "2026-08-03", "2026-08-10", "2026-09-05"]) {
      const accepted = event(`accept-${date}`, date, { workItemId: "pending" });
      const complete = deriveCoreEvidenceV7(input([...base.events, accepted])).inputs.counts;
      for (const key of ["deliveryUnits", "activeIsoWeeks", "eligibleProjects", "eligibleCategories"] as const) {
        expect(complete[key].lower).toBeGreaterThanOrEqual(bounds[key].lower);
        expect(complete[key].upper).toBeLessThanOrEqual(bounds[key].upper);
      }
    }
    expect(computeImpactV7({ ...base, events: [...base.events, ...base.events].reverse() })).toEqual(computeImpactV7(base));
  });
  it("recognizes linked accepted results and direct first-reachability without awarding review deliveries", () => {
    for (const [kind, method] of [["authored_commit", "default_branch_first_reachability"], ["issue_work", "linked_issue_result"], ["documentation_design", "accepted_artifact"], ["maintenance", "accepted_artifact"]] as const) {
      const accepted = event("a", "2026-08-01", { kind, acceptance: yes({ method, acceptedAt: "2026-08-01T12:00:00Z", acceptedResultId: "result" }) });
      expect(deriveCoreEvidenceV7(input([accepted])).inputs.counts.deliveryUnits).toEqual({ lower: 1, upper: 1 });
    }
    const review = event("a", "2026-08-01", { kind: "review" });
    expect(deriveCoreEvidenceV7(input([review])).inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 0 });
  });
  it("treats stale coverage as a dated tail and ignores missing periods outside the window", () => {
    const stale = { ...coverage, status: "stale" as const, dataThrough: "2026-09-05T00:00:00Z" };
    const result = deriveCoreEvidenceV7(input([], [], [stale]));
    expect(result.inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 1 });
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 0, upper: 1 });
    const outside = { ...coverage, eventKinds: {}, unknownPeriods: [{ startInclusive: "2025-01-01T00:00:00Z", endExclusive: "2025-02-01T00:00:00Z" }] };
    expect(deriveCoreEvidenceV7(input([], [], [outside])).inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 0 });
    expect(() => deriveCoreEvidenceV7(input([], [], [{ ...outside, unknownPeriods: [{ startInclusive: window.endExclusive, endExclusive: window.startInclusive }] }]))).toThrow("Invalid unknown observation period");
  });
  it("requires distinct category support and complete nonempty files for automatic documentation classification", () => {
    const docs = event("docs", "2026-08-01", { measurements: { ...event("docs").measurements, changedFiles: yes(["docs/design.md"]) } });
    expect(deriveCoreEvidenceV7(input([docs])).activityCalendar.find(day => day.date === "2026-08-01")?.count).toBe(1);
    const dates = ["2026-08-01", "2026-08-02", "2026-08-03"];
    const duplicateCategoryEvidence = dates.map((date, index) => event(`a-${index}`, date, { kind: "practice_evidence", acceptance: unknown("unavailable", "not_supported"), categories: [{ category: "documentation_design", evidenceReferenceIds: ["same-proof"] }, { category: "maintenance_support", evidenceReferenceIds: ["same-proof"] }] }));
    expect(deriveCoreEvidenceV7(input(duplicateCategoryEvidence)).inputs.counts.eligibleCategories.lower).toBe(0);
    const partial = dates.map((date, index) => event(`partial-${index}`, date, { measurements: { ...docs.measurements, changedFiles: observed(["docs/design.md"], "partial", "source_observed") } }));
    expect(deriveCoreEvidenceV7(input(partial)).inputs.counts.eligibleCategories.lower).toBe(0);
  });
  it("does not turn later mirror acceptances of one work item into extra activity dates", () => {
    const events = [event("original", "2026-08-01"), event("mirror-one", "2026-08-10"), event("mirror-two", "2026-08-20")];
    const result = deriveCoreEvidenceV7({ ...input(events), equivalentWorkItems: [{ workItemIds: events.map(item => item.workItemId), canonicalWorkItemId: "original", acceptedEventId: "original", evidenceReferenceIds: ["verified-equivalence"] }] });
    expect(result.inputs.counts.deliveryUnits).toEqual({ lower: 1, upper: 1 });
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 1, upper: 1 });
    expect(result.inputs.counts.eligibleProjects).toEqual({ lower: 0, upper: 0 });
    expect(result.inputs.counts.eligibleCategories).toEqual({ lower: 0, upper: 0 });
  });
  it("does not rejuvenate a linked old acceptance through a recent mirrored merge", () => {
    const events = [event("original", "2025-01-01"), event("mirror", "2026-08-20")];
    const result = deriveCoreEvidenceV7({ ...input(events), equivalentWorkItems: [{ workItemIds: events.map(item => item.workItemId), canonicalWorkItemId: "original", acceptedEventId: "original", evidenceReferenceIds: ["verified-equivalence"] }] });
    expect(result.inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 0 });
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 0, upper: 0 });
    expect(result.inputs.counts.quality.verification).toEqual({ lower: 0, upper: 0 });
  });
  it("withholds possibly aliased sources from minima while retaining their possible contributions", () => {
    const otherSource = { ...source, provider: "gitlab" as const, host: "gitlab.com" };
    const events = ["2026-08-01", "2026-08-10", "2026-08-20"].flatMap((date, index) => [event(`a-${index}`, date), { ...event(`b-${index}`, date), ...otherSource }]);
    const assessments = events.map(item => assessment(item.workItemId, "verification"));
    const sources = [coverage, { ...coverage, source: otherSource, reasonCodes: ["alias_unresolved" as const] }];
    const result = deriveCoreEvidenceV7(input(events, assessments, sources));
    expect(result.inputs.counts.deliveryUnits).toEqual({ lower: 3, upper: 6 });
    expect(result.inputs.counts.quality.verification).toEqual({ lower: 3, upper: 6 });
    expect(result.inputs.counts.eligibleProjects).toEqual({ lower: 1, upper: 4 });
    expect(result.limitations).toContain("alias_unresolved");
    const unresolved = deriveCoreEvidenceV7(input(events, assessments, sources.map(item => ({ ...item, reasonCodes: ["alias_unresolved" as const] }))));
    expect(unresolved.inputs.counts.activeIsoWeeks.lower).toBe(0);
  });
  it("does not rejuvenate old practice verdicts through unrelated current evidence of the same work item", () => {
    const events = [event("old", "2025-01-01"), event("current", "2026-08-20", { workItemId: "old", kind: "review", acceptance: unknown("unavailable", "not_supported") })];
    for (const status of ["accepted", "rejected"] as const) {
      const result = deriveCoreEvidenceV7(input(events, [assessment("old", "verification", status)]));
      expect(result.inputs.counts.quality.verification).toEqual({ lower: 0, upper: 1 });
    }
  });
  it("does not constrain a possible acceptance date to an unverified assertion", () => {
    const claimed = event("claimed", "2026-08-01", { acceptance: observed({ method: "merged_change", acceptedAt: "2026-08-01T12:00:00Z", acceptedResultId: "claimed" }, "complete", "self_reported") });
    const result = deriveCoreEvidenceV7(input([event("known"), claimed]));
    expect(result.inputs.counts.activeIsoWeeks).toEqual({ lower: 1, upper: 2 });
    const established = event("observed", "2026-08-20", { workItemId: "claimed" });
    expect(deriveCoreEvidenceV7(input([event("known"), claimed, established])).inputs.counts.activeIsoWeeks.lower).toBeLessThanOrEqual(result.inputs.counts.activeIsoWeeks.upper);
  });
  it("excludes a known future same-day acceptance from possible current delivery", () => {
    const future = event("future", "2026-09-05", { kind: "authored_commit", acceptance: yes({ method: "default_branch_first_reachability", acceptedAt: "2026-09-05T18:00:00Z", acceptedResultId: "future" }) });
    expect(deriveCoreEvidenceV7(input([future])).inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 0 });
  });
  it("contains project-identity resolutions that combine dates across possible mirrors", () => {
    const events = [event("a1", "2026-08-01"), event("a2", "2026-08-02"), event("b1", "2026-08-03", { repositoryId: "mirror" }), event("b2", "2026-08-04", { repositoryId: "mirror" })];
    const scoped = { ...coverage, repositoryIds: ["repo", "mirror"] };
    const unresolved = deriveCoreEvidenceV7(input(events, [], [{ ...scoped, reasonCodes: ["alias_unresolved"] }]));
    const resolved = deriveCoreEvidenceV7({ ...input(events, [], [scoped]), repositoryAliases: [{ repositories: [events[0]!, events[2]!], canonicalProjectId: "one-project", verifiedAt: window.referenceTime, evidenceReferenceIds: ["verified-project-identity"] }] });
    expect(resolved.inputs.counts.eligibleProjects.lower).toBe(1);
    expect(unresolved.inputs.counts.eligibleProjects.upper).toBeGreaterThanOrEqual(resolved.inputs.counts.eligibleProjects.lower);
  });
});
