import type { EngineeringLedgerSnapshot } from "./types";
export function ledgerFixture(options: { accepted?: boolean; occurredAt?: string } = {}): EngineeringLedgerSnapshot {
  const occurredAt = options.occurredAt ?? "2026-08-01T00:00:00.000Z";
  const recordedAt = "2026-09-02T00:00:00.000Z";
  return { ownerId: "owner", publicConsent: false, references: [{ ownerId: "owner", referenceId: "ref:1", artifactUri: "https://private.example.org/result", artifactRevision: "sha", observedAt: "2026-09-01T00:00:00Z", retention: "until_owner_withdrawal", expiresAt: null }],
    claims: [{ channel: "core", occurredAt, claim: { revisionId: "claim-rev:1", claimId: "claim:1", revision: 1, supersedesRevisionId: null, action: "create", recordedAt, ownerId: "owner", workItemId: "ledger:owner:work:1",
      category: "performance_accessibility", artifactRevision: "sha", claim: "Reduced query latency", baseline: { kind: "measured", value: "100ms" }, observedResult: "80ms", method: "Fixed sample", contributorRole: "Author", attribution: "individual",
      observationPeriod: { startInclusive: "2026-08-02T00:00:00Z", endExclusive: "2026-09-01T00:00:00Z" }, evidenceReferenceIds: ["ref:1"], provenance: "self_reported", limitations: ["One workload"], counterevidence: ["Memory overhead"] } }],
    assessments: [{ authorizedAt: "2026-09-01T00:00:00Z", conflicts: [], assessment: { revisionId: "assessment-rev:1", assessmentId: "assessment:1", revision: 1, supersedesRevisionId: null, action: "create", recordedAt,
      claimRevisionId: "claim-rev:1", workItemId: "ledger:owner:work:1", criterion: "verification", status: "accepted", rubricVersion: "v7", reasonCode: "criterion_demonstrated", rationale: "Checked before/after query samples at the accepted revision",
      evaluator: { id: "reviewer", kind: "human", version: "1", independent: true }, assessedAt: recordedAt, evidenceReferenceIds: ["ref:1"], provenance: "independently_corroborated" },
      facts: { identity: { projectKey: "reviewed-project", workKey: "reviewed-work", repository: null, equivalentWork: null, referenceIds: ["ref:1"] }, occurredAt, kind: options.accepted ? "maintenance" : "practice_evidence", attribution: "individual", categories: [],
        acceptance: options.accepted ? { method: "accepted_artifact", acceptedAt: occurredAt, acceptedResultId: "result:1", referenceIds: ["ref:1"] } : null } }],
  };
}
