import type { EvidenceCriterion, PrivateCriterionAssessment } from "@chapa/shared";
import type { EngineeringLedgerSnapshot } from "./types";

/**
 * What the owner sees for one submitted piece of evidence.
 *
 * `pending` is the honest default: a submitted claim with no accountable
 * assessment yet is neither accepted nor rejected, and showing it as either
 * would misstate where it stands. `withdrawn` is the owner's own retraction.
 */
export type EvidenceWorkflowState = "pending" | "accepted" | "rejected" | "withdrawn";

export interface EvidenceWorkflowItem {
  readonly claimId: string;
  readonly revisionId: string;
  readonly workItemId: string;
  readonly channel: "core" | "craft";
  readonly state: EvidenceWorkflowState;
  /** The criteria an accountable reviewer has ruled on, in rubric order. */
  readonly assessedCriteria: readonly { readonly criterion: EvidenceCriterion; readonly status: PrivateCriterionAssessment["status"] }[];
  readonly submittedAt: string;
}

/** Latest revision per claim, at or before the reference time. */
function currentClaims(snapshot: EngineeringLedgerSnapshot) {
  const byClaim = new Map<string, EngineeringLedgerSnapshot["claims"][number]>();
  for (const record of snapshot.claims) {
    const existing = byClaim.get(record.claim.claimId);
    if (!existing || record.claim.revision > existing.claim.revision) byClaim.set(record.claim.claimId, record);
  }
  return [...byClaim.values()];
}

function currentAssessments(snapshot: EngineeringLedgerSnapshot) {
  const byAssessment = new Map<string, PrivateCriterionAssessment>();
  for (const record of snapshot.assessments) {
    const existing = byAssessment.get(record.assessment.assessmentId);
    if (!existing || record.assessment.revision > existing.revision) byAssessment.set(record.assessment.assessmentId, record.assessment);
  }
  return [...byAssessment.values()];
}

/**
 * Project the owner's evidence ledger into the states their settings page
 * shows. This is the whole of the owner-facing workflow rule, in one pure
 * function, so the page cannot invent a fifth state or quietly promote a
 * pending claim.
 */
export function evidenceWorkflowItems(snapshot: EngineeringLedgerSnapshot): EvidenceWorkflowItem[] {
  const assessments = currentAssessments(snapshot);
  return currentClaims(snapshot)
    .map(record => {
      const { claim } = record;
      const ruled = assessments
        .filter(row => row.claimRevisionId === claim.revisionId && row.action !== "retract" && row.status !== "retracted")
        .map(row => ({ criterion: row.criterion, status: row.status }));
      const state: EvidenceWorkflowState =
        claim.action === "retract" ? "withdrawn"
        : ruled.some(row => row.status === "accepted") ? "accepted"
        : ruled.some(row => row.status === "rejected") ? "rejected"
        : "pending";
      return {
        claimId: claim.claimId,
        revisionId: claim.revisionId,
        workItemId: claim.workItemId,
        channel: record.channel,
        state,
        assessedCriteria: ruled,
        submittedAt: claim.recordedAt,
      };
    })
    .sort((a, b) => (a.submittedAt === b.submittedAt ? a.claimId.localeCompare(b.claimId) : a.submittedAt < b.submittedAt ? 1 : -1));
}

export interface EvidenceWorkflowSummary {
  readonly pending: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly withdrawn: number;
  /** True when this owner has submitted no Craft episode at all. A Craft
   * portfolio is open to everyone: it records engineering practice, and
   * choosing not to use an AI tool demonstrates judgment the same way using
   * one does. */
  readonly craftPortfolioEmpty: boolean;
}

export function summarizeEvidenceWorkflow(items: readonly EvidenceWorkflowItem[]): EvidenceWorkflowSummary {
  const count = (state: EvidenceWorkflowState) => items.filter(item => item.state === state).length;
  return {
    pending: count("pending"),
    accepted: count("accepted"),
    rejected: count("rejected"),
    withdrawn: count("withdrawn"),
    craftPortfolioEmpty: !items.some(item => item.channel === "craft" && item.state !== "withdrawn"),
  };
}
