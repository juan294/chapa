import type { PrivateCriterionAssessment, PrivateEvidenceClaim, PrivateEvidenceReference } from "@chapa/shared";
import type { VerifiedLedgerFacts } from "./validation";

export interface LedgerClaimRecord {
  readonly claim: PrivateEvidenceClaim;
  readonly channel: "core" | "craft";
  readonly occurredAt: string;
}
export interface LedgerAssessmentRecord {
  readonly assessment: PrivateCriterionAssessment;
  readonly facts: VerifiedLedgerFacts | null;
  readonly conflicts: readonly string[];
  /** Immutable service-authenticated authorization captured at insert, independent of later revocation. */
  readonly authorizedAt: string;
}
export interface EngineeringLedgerSnapshot {
  readonly ownerId: string;
  readonly claims: readonly LedgerClaimRecord[];
  readonly assessments: readonly LedgerAssessmentRecord[];
  readonly references: readonly PrivateEvidenceReference[];
}
