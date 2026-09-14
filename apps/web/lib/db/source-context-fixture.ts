import { observed, unknown } from "@chapa/shared";
import type { NormalizedEngineeringEvent, ScoringWindow, SourceIdentity } from "@chapa/shared";
/** Synthetic normalized event used by unit and real database contracts. */
export function sourceEventFixture(source: SourceIdentity, window: ScoringWindow): NormalizedEngineeringEvent {
 return { ...source, schemaVersion: "v7", repositoryId: "known", actorId: source.subjectId, eventId: "event1", kind: "accepted_change",
  occurredAt: "2026-09-01T12:00:00.000Z", dataThrough: window.referenceTime, canonicalProjectId: "project1", workItemId: "work1", artifactRevision: "revision1", artifactReferenceIds: ["artifact1"],
  attribution: "individual", provenance: "source_observed", coverage: "complete",
  measurements: { changedFiles: observed(["src/index.ts"], "complete", "source_observed"), additions: observed(0, "complete", "source_observed"), deletions: observed(0, "complete", "source_observed"), leadTimeHours: unknown("unavailable", "not_supported"), hasDescription: observed(true, "complete", "source_observed"), hasIssueLink: observed(false, "complete", "source_observed"), usesFeatureBranch: observed(false, "complete", "source_observed") },
  categories: [{ category: "implementation", evidenceReferenceIds: ["artifact1"] }],
  acceptance: observed({ method: "merged_change", acceptedAt: "2026-09-01T12:00:00.000Z", acceptedResultId: "result1" }, "complete", "source_observed"),
 };
}
