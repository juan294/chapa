import { describe, expect, it } from "vitest";
import { createScoringWindow, observed, unknown, type EngineeringEvidenceInput, type NormalizedEngineeringEvent, type SourceCoverage } from "@chapa/shared";
import { deriveCoreEvidenceV7 } from "./v7-evidence";
import { computeObservedImpactV7 } from "./observed-v7";

// Equivalence proof for #1351 phase 1: dropping the GitHub issue-closure scan
// (the `issue_work` events evidence.ts:456-463 emits) must not change core
// scoring inputs or the canonical displayed score. `acceptedKind`
// (v7-evidence.ts:89-95) only accepts `issue_work` with a
// `linked_issue_result` acceptance method; the collector never produces that
// -- every emitted `issue_work` event carries
// `unknown("partial", "attribution_unknown")` -- so these events can never
// become known delivery. A realistic incomplete-discovery source
// (owned_and_contributed, repositoryDiscoveryComplete: false, the shape the
// collector reports while a job is unfinished) already saturates every upper
// bound at its policy cap, so their count cannot move the upper bound either.
const window = createScoringWindow("2026-09-05T12:00:00Z");
const source = { provider: "github" as const, host: "github.com", subjectId: "person" };
const yes = <T>(value: T) => observed(value, "complete", "source_observed");
const unavailableMeasurements = {
  changedFiles: unknown("unavailable", "not_supported"), additions: unknown("unavailable", "not_supported"),
  deletions: unknown("unavailable", "not_supported"), leadTimeHours: unknown("unavailable", "not_supported"),
  hasDescription: unknown("unavailable", "not_supported"), hasIssueLink: unknown("unavailable", "not_supported"),
  usesFeatureBranch: unknown("unavailable", "not_supported"),
} as const;

function coverage(issueWorkStatus: "partial" | "unavailable"): SourceCoverage {
  return {
    source, window, dataThrough: window.referenceTime, status: "partial", discovery: "owned_and_contributed",
    repositoryIds: ["repo"], repositoryDiscoveryComplete: false,
    eventKinds: {
      accepted_change: "partial", authored_commit: "partial", review: "partial", issue_work: issueWorkStatus,
      documentation_design: "unavailable", maintenance: "unavailable", practice_evidence: "unavailable",
    },
    reasonCodes: ["discovery_incomplete"], unknownPeriods: [],
  };
}
function change(id: string, date: string): NormalizedEngineeringEvent {
  return {
    ...source, schemaVersion: "v7", repositoryId: "repo", actorId: "person", eventId: id, kind: "accepted_change",
    occurredAt: `${date}T12:00:00Z`, dataThrough: window.referenceTime, canonicalProjectId: "github:repo",
    workItemId: `github:${id}`, artifactRevision: `sha-${id}`, artifactReferenceIds: [`github:${id}`],
    attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [],
    measurements: {
      changedFiles: yes(["src/app.ts"]), additions: yes(4), deletions: yes(1), leadTimeHours: yes(3),
      hasDescription: yes(true), hasIssueLink: yes(true), usesFeatureBranch: yes(true),
    },
    acceptance: yes({ method: "merged_change", acceptedAt: `${date}T12:00:00Z`, acceptedResultId: id }),
  };
}
function commit(id: string, date: string): NormalizedEngineeringEvent {
  return {
    ...source, schemaVersion: "v7", repositoryId: "repo", actorId: "person", eventId: id, kind: "authored_commit",
    occurredAt: `${date}T12:00:00Z`, dataThrough: window.referenceTime, canonicalProjectId: "github:repo",
    workItemId: `github:${id}`, artifactRevision: id, artifactReferenceIds: [`github:${id}`],
    attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [],
    measurements: { ...unavailableMeasurements, additions: yes(2), deletions: yes(1) },
    acceptance: unknown("unavailable", "acceptance_time_unknown"),
  };
}
function review(id: string, date: string): NormalizedEngineeringEvent {
  return {
    ...source, schemaVersion: "v7", repositoryId: "repo", actorId: "person", eventId: id, kind: "review",
    occurredAt: `${date}T12:00:00Z`, dataThrough: window.referenceTime, canonicalProjectId: "github:repo",
    workItemId: "github:reviewed-pr", artifactRevision: id, artifactReferenceIds: [`github:${id}`],
    attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [],
    measurements: unavailableMeasurements, acceptance: unknown("unavailable", "not_supported"),
  };
}
/** Shaped exactly as evidence.ts:456-463 emits it: empty categories, no
 * measurements, `unknown("partial", "attribution_unknown")` acceptance --
 * `acceptedKind` (v7-evidence.ts) never accepts this shape.
 */
function issueWork(id: string, date: string, workItemId: string, artifactReferenceIds: readonly string[]): NormalizedEngineeringEvent {
  return {
    ...source, schemaVersion: "v7", repositoryId: "repo", actorId: "person", eventId: id, kind: "issue_work",
    occurredAt: `${date}T12:00:00Z`, dataThrough: window.referenceTime, canonicalProjectId: "github:repo",
    workItemId, artifactRevision: id, artifactReferenceIds: [...artifactReferenceIds],
    attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [],
    measurements: unavailableMeasurements, acceptance: unknown("partial", "attribution_unknown"),
  };
}
function input(events: readonly NormalizedEngineeringEvent[], issueWorkStatus: "partial" | "unavailable"): EngineeringEvidenceInput {
  return { schemaVersion: "v7", window, scope: { sources: [coverage(issueWorkStatus)], excludedSources: [], ledgerRevisionIds: [] }, events: [...events], repositoryAliases: [], equivalentWorkItems: [], assessments: [] };
}

describe("GitHub issue_work never changes v7.2 scoring (#1351 phase 1 equivalence)", () => {
  const acceptedPr = change("pr1", "2026-08-01");
  const authoredCommit = commit("commit1", "2026-08-05");
  const reviewEvent = review("review1", "2026-08-10");
  // A closer that is the subject's own merged PR the merged search already
  // found -- same workItemId as `acceptedPr`, so this is the one side path
  // (evidence.ts:466-473) that could otherwise add another delivery date.
  const linkedToOwnMergedPr = issueWork("closure1", "2026-08-02", "github:pr1", ["github:closure1", "github:pr1"]);
  // A closer that is a merged PR authored by someone else.
  const linkedToOthersMergedPr = issueWork("closure2", "2026-08-15", "github:pr2", ["github:closure2", "github:pr2"]);
  // No linked closer at all (closed manually or by a commit reference).
  const noLinkedCloser = issueWork("closure3", "2026-08-20", "github:issue3", ["github:closure3"]);
  const coreEvents = [acceptedPr, authoredCommit, reviewEvent];
  const issueWorkEvents = [linkedToOwnMergedPr, linkedToOthersMergedPr, noLinkedCloser];
  const withIssueWork = input([...coreEvents, ...issueWorkEvents], "partial");
  const without = input(coreEvents, "unavailable");

  it("never changes core scoring inputs or observed counts", () => {
    const withResult = deriveCoreEvidenceV7(withIssueWork);
    const withoutResult = deriveCoreEvidenceV7(without);
    expect(withoutResult.inputs).toEqual(withResult.inputs);
    expect(withoutResult.observedCounts).toEqual(withResult.observedCounts);
  });

  it("never changes the canonical exact score, display score or tier", () => {
    const withResult = computeObservedImpactV7(withIssueWork);
    const withoutResult = computeObservedImpactV7(without);
    expect(withoutResult.core.composite.exact).toBe(withResult.core.composite.exact);
    expect(withoutResult.core.composite.displayValue).toBe(withResult.core.composite.displayValue);
    expect(withoutResult.core.tier).toBe(withResult.core.tier);
  });
});
