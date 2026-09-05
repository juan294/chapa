import type { PrivateCriterionAssessment, PrivateEvidenceClaim, PrivateEvidenceReference } from "@chapa/shared";

export function evidenceReferenceToRow(reference: PrivateEvidenceReference) {
  return {
    owner_handle: reference.ownerId,
    reference_id: reference.referenceId,
    artifact_uri: reference.artifactUri,
    artifact_revision: reference.artifactRevision,
    observed_at: reference.observedAt,
    retention: reference.retention,
    expires_at: reference.expiresAt,
  };
}

/** Private persistence projection; never pass these rows to a public renderer. */
export function evidenceClaimToRow(claim: PrivateEvidenceClaim, channel: "core" | "craft") {
  return {
    id: claim.revisionId,
    owner_handle: claim.ownerId,
    claim_id: claim.claimId,
    revision: claim.revision,
    supersedes_id: claim.supersedesRevisionId,
    action: claim.action,
    state: claim.action === "retract" ? "retracted" : "submitted",
    channel,
    work_item_id: claim.workItemId,
    category: claim.category,
    period_start: claim.observationPeriod.startInclusive,
    period_end: claim.observationPeriod.endExclusive,
    recorded_at: claim.recordedAt,
    payload: claim,
  };
}

export function assessmentToRow(owner: string, assessment: PrivateCriterionAssessment) {
  return {
    id: assessment.revisionId,
    owner_handle: owner,
    assessment_id: assessment.assessmentId,
    evidence_id: assessment.claimRevisionId,
    work_item_id: assessment.workItemId,
    revision: assessment.revision,
    action: assessment.action,
    recorded_at: assessment.recordedAt,
    supersedes_id: assessment.supersedesRevisionId,
    criterion: assessment.criterion,
    verdict: assessment.status,
    evaluator_handle: assessment.evaluator.id,
    evaluator_type: assessment.evaluator.kind,
    evaluator_version: assessment.evaluator.version,
    evaluator_independent: assessment.evaluator.independent,
    independently_corroborated: assessment.provenance === "independently_corroborated",
    provenance: assessment.provenance,
    rubric_version: assessment.rubricVersion,
    rationale: assessment.rationale,
    reason_code: assessment.reasonCode,
    evidence_reference_ids: assessment.evidenceReferenceIds,
    assessed_at: assessment.assessedAt,
  };
}

export type AssessmentRow = ReturnType<typeof assessmentToRow>;

/** Dates are canonicalized because PostgREST may serialize UTC as +00:00. */
export function assessmentFromRow(row: AssessmentRow): PrivateCriterionAssessment {
  return {
    revisionId: row.id,
    assessmentId: row.assessment_id,
    claimRevisionId: row.evidence_id,
    workItemId: row.work_item_id,
    revision: row.revision,
    action: row.action,
    recordedAt: new Date(row.recorded_at).toISOString(),
    supersedesRevisionId: row.supersedes_id,
    criterion: row.criterion,
    status: row.verdict,
    evaluator: { id: row.evaluator_handle, kind: row.evaluator_type, version: row.evaluator_version, independent: row.evaluator_independent },
    provenance: row.provenance,
    rubricVersion: row.rubric_version,
    rationale: row.rationale,
    reasonCode: row.reason_code,
    evidenceReferenceIds: row.evidence_reference_ids,
    assessedAt: new Date(row.assessed_at).toISOString(),
  };
}
