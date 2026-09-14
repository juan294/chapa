import { databaseInstant } from "./database-time";
import { scoringInstant, type PrivateCriterionAssessment } from "@chapa/shared";
/** Only use with immutable metadata read from the service-only ledger transaction, never request JSON. */
export function ledgerAuthorityGrantedAt(owner: string, assessment: PrivateCriterionAssessment, value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const authority = value as Record<string, unknown>;
  if (authority.version !== "ledger-authority-v1" || authority.ownerId !== owner || authority.evaluatorId !== assessment.evaluator.id || assessment.evaluator.id === owner) return null;
  try {
    const granted = scoringInstant(databaseInstant(String(authority.grantedAt)));
    const assessed = scoringInstant(databaseInstant(String(authority.assessedAt)));
    const recorded = scoringInstant(databaseInstant(String(authority.recordedAt)));
    if (+assessed !== +scoringInstant(assessment.assessedAt) || +recorded !== +scoringInstant(assessment.recordedAt) || granted > assessed || granted > recorded || assessed > recorded) return null;
    return granted.toISOString();
  } catch { return null; }
}
