import {
  createScoringWindow,
  observed,
  unknown,
  type EngineeringEvidenceInput,
  type NormalizedEngineeringEvent,
  type PrivateCriterionAssessment,
  type QualityCriterion,
  type SourceCoverage,
  type WorkCategory,
} from "@chapa/shared";

/**
 * Matched-pair fixtures for the fairness suite.
 *
 * A matched pair changes exactly one thing that policy says must not matter —
 * AI provenance, tool choice, account age, work role, source visibility — and
 * holds everything else identical. That is the only construction that can
 * demonstrate invariance rather than assert it: if the two members of a pair
 * differ in any other way, a passing test proves nothing.
 *
 * These are fixtures, not empirical data. They test this rubric's arithmetic
 * against its own rules. They cannot substitute for the pilot in
 * `docs/research/scoring-v7-validation-protocol.md`.
 */
export const WINDOW = createScoringWindow("2026-09-05T12:00:00.000Z");
export const SOURCE = { provider: "github" as const, host: "github.com", subjectId: "person" };
export const QUALITY_CRITERIA: QualityCriterion[] = ["rationale", "verification", "review_or_correction", "outcome_followup"];

const yes = <T>(value: T) => observed(value, "complete", "source_observed");

export const COMPLETE_COVERAGE: SourceCoverage = {
  source: SOURCE, window: WINDOW, dataThrough: WINDOW.referenceTime, status: "complete",
  discovery: "explicit_repositories", repositoryIds: ["repo"], repositoryDiscoveryComplete: true,
  eventKinds: {
    accepted_change: "complete", authored_commit: "complete", review: "complete", issue_work: "complete",
    documentation_design: "complete", maintenance: "complete", practice_evidence: "complete",
  },
  reasonCodes: [], unknownPeriods: [],
};

/** The same source, with repository discovery unfinished. Redacting visibility
 * is a synthetic missingness intervention, never evidence about real private
 * populations. */
export const PARTIAL_COVERAGE: SourceCoverage = {
  ...COMPLETE_COVERAGE, status: "partial", repositoryDiscoveryComplete: false,
  reasonCodes: ["discovery_incomplete"],
  unknownPeriods: [{ startInclusive: WINDOW.startInclusive, endExclusive: WINDOW.endExclusive }],
};

export function event(
  id: string,
  date = "2026-08-01",
  overrides: Partial<NormalizedEngineeringEvent> = {},
): NormalizedEngineeringEvent {
  return {
    ...SOURCE, schemaVersion: "v7", repositoryId: "repo", actorId: "person", eventId: id,
    kind: "accepted_change", occurredAt: `${date}T12:00:00Z`, dataThrough: WINDOW.referenceTime,
    canonicalProjectId: "repo", workItemId: id, artifactRevision: `sha-${id}`,
    artifactReferenceIds: [`ref-${id}`], attribution: "individual", provenance: "source_observed",
    coverage: "complete", categories: [],
    measurements: {
      changedFiles: yes(["src/app.ts"]), additions: yes(12), deletions: yes(3), leadTimeHours: yes(4),
      hasDescription: yes(true), hasIssueLink: yes(true), usesFeatureBranch: yes(true),
    },
    acceptance: yes({ method: "merged_change", acceptedAt: `${date}T12:00:00Z`, acceptedResultId: id }),
    ...overrides,
  };
}

export function assessment(
  workItemId: string,
  criterion: QualityCriterion,
  status: "accepted" | "rejected" = "accepted",
): PrivateCriterionAssessment {
  return {
    revisionId: `${workItemId}-${criterion}-r1`, revision: 1, supersedesRevisionId: null, action: "create",
    recordedAt: "2026-09-04T12:00:00Z", assessmentId: `${workItemId}-${criterion}`,
    claimRevisionId: `claim-${workItemId}`, workItemId, criterion, status, rubricVersion: "v7",
    reasonCode: status === "accepted" ? "criterion_demonstrated" : "criterion_not_demonstrated",
    evaluator: { id: "reviewer", kind: "human", version: "1", independent: true },
    rationale: "Artifact-specific recorded verdict", assessedAt: "2026-09-04T11:00:00Z",
    evidenceReferenceIds: [`ref-${workItemId}`, `evidence-${workItemId}-${criterion}`],
    provenance: "human_assessed",
  };
}

export function input(
  events: NormalizedEngineeringEvent[],
  assessments: PrivateCriterionAssessment[] = [],
  sources: SourceCoverage[] = [COMPLETE_COVERAGE],
): EngineeringEvidenceInput {
  return {
    schemaVersion: "v7", window: WINDOW,
    scope: { sources, excludedSources: [], ledgerRevisionIds: [...new Set(assessments.map(row => row.claimRevisionId))] },
    events, repositoryAliases: [], equivalentWorkItems: [], assessments,
  };
}

/** Six primary work roles, each expressed as evidence rather than a job title.
 * A scoring policy that only represents feature authors is not neutral. */
export const WORK_ROLES = {
  implementation: (id: string, date: string) => event(id, date),
  one_line_change: (id: string, date: string) =>
    event(id, date, { measurements: { ...event(id, date).measurements, additions: yes(1), deletions: yes(0) } }),
  deletion_only: (id: string, date: string) =>
    event(id, date, { measurements: { ...event(id, date).measurements, additions: yes(0), deletions: yes(400) } }),
  documentation: (id: string, date: string) =>
    event(id, date, {
      kind: "documentation_design",
      categories: [{ category: "documentation_design" as WorkCategory, evidenceReferenceIds: [`ref-${id}`] }],
      measurements: { ...event(id, date).measurements, changedFiles: yes(["docs/guide.md", "README.md"]) },
    }),
  review: (id: string, date: string) =>
    event(id, date, { kind: "review", acceptance: unknown("unavailable", "not_supported") }),
  direct_push: (id: string, date: string) =>
    event(id, date, {
      kind: "authored_commit",
      acceptance: yes({ method: "default_branch_first_reachability", acceptedAt: `${date}T12:00:00Z`, acceptedResultId: id }),
    }),
  maintenance: (id: string, date: string) =>
    event(id, date, {
      kind: "maintenance",
      categories: [{ category: "maintenance_support" as WorkCategory, evidenceReferenceIds: [`ref-${id}`] }],
    }),
} as const;
