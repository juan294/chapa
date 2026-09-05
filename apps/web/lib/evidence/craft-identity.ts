import type { PrivateEvidenceClaim, PrivateCriterionAssessment } from "@chapa/shared";
import type { VerifiedLedgerFacts } from "./validation";
interface Metadata { authorization?: unknown; conflicts?: string[]; facts?: VerifiedLedgerFacts | null }
interface Reference { reference_id: string; artifact_uri?: string; artifact_revision?: string; owner_handle: string; retention: string }
/** Review identity and exact retained artifact identity reconcile private Craft uploads.
 * Unknown/conflicting mappings suppress verdicts, preserving episode uncertainty. */
export function reconcileCraftIdentity(owner: string, claims: readonly PrivateEvidenceClaim[], assessments: readonly PrivateCriterionAssessment[],
  metadata: ReadonlyMap<string, Metadata>, references: readonly Reference[], referenceTime: string) {
  const parent = new Map(claims.map(claim => [claim.workItemId, claim.workItemId]));
  const root = (id: string): string => { let next = parent.get(id)!; while (next !== parent.get(next)) next = parent.get(next)!; return next; };
  const union = (left: string, right: string) => { const a = root(left), b = root(right); if (a !== b) parent.set(a < b ? b : a, a < b ? a : b); };
  const latestClaims = new Map<string, PrivateEvidenceClaim>();
  for (const claim of claims) if (Date.parse(claim.recordedAt) <= Date.parse(referenceTime) && claim.revision > (latestClaims.get(claim.claimId)?.revision ?? 0)) latestClaims.set(claim.claimId, claim);
  const active = [...latestClaims.values()].filter(claim => claim.action !== "retract");
  const activeByRevision = new Map(active.map(claim => [claim.revisionId, claim]));
  const reviewedDates = new Map<string, Set<string>>();
  const refs = new Map(references.filter(ref => ref.owner_handle === owner && ref.retention === "until_owner_withdrawal").map(ref => [ref.reference_id, ref]));
  const artifacts = new Map<string, string>();
  for (const claim of active) for (const id of claim.evidenceReferenceIds) {
    const ref = refs.get(id);
    if (!ref?.artifact_uri || ref.artifact_revision !== claim.artifactRevision) continue;
    const key = JSON.stringify([ref.artifact_uri, ref.artifact_revision]);
    const prior = artifacts.get(key);
    if (prior) union(prior, claim.workItemId); else artifacts.set(key, claim.workItemId);
  }
  const latest = new Map<string, PrivateCriterionAssessment>();
  for (const assessment of assessments) if (Date.parse(assessment.recordedAt) <= Date.parse(referenceTime) && assessment.revision > (latest.get(assessment.assessmentId)?.revision ?? 0)) latest.set(assessment.assessmentId, assessment);
  const identities = new Map<string, Set<string>>();
  const linked = new Map<string, string>();
  const ledgerWork = new Set<string>();
  for (const assessment of assessments) if (metadata.get(assessment.revisionId)?.authorization) ledgerWork.add(assessment.workItemId);
  for (const assessment of latest.values()) {
    const info = metadata.get(assessment.revisionId);
    const claim = activeByRevision.get(assessment.claimRevisionId);
    const fact = info?.facts;
    if (!claim || !fact || info?.conflicts?.length || assessment.action === "retract" || assessment.status === "unassessed" || assessment.status === "retracted" ||
      !fact.identity.referenceIds.length || !fact.identity.referenceIds.every(id => claim.evidenceReferenceIds.includes(id) && assessment.evidenceReferenceIds.includes(id) && refs.has(id))) continue;
    const date = fact.acceptance?.acceptedAt ?? fact.occurredAt;
    const parsed = Date.parse(date);
    if (!Number.isFinite(parsed) || parsed > Date.parse(assessment.assessedAt)) continue;
    const dates = reviewedDates.get(claim.workItemId) ?? new Set<string>();
    dates.add(new Date(parsed).toISOString()); reviewedDates.set(claim.workItemId, dates);
    const key = fact.identity.equivalentWork?.canonicalWorkItemId ?? JSON.stringify([fact.identity.repository ?? fact.identity.projectKey, fact.identity.workKey]);
    const keys = identities.get(claim.workItemId) ?? new Set<string>(); keys.add(key); identities.set(claim.workItemId, keys);
    const prior = linked.get(key); if (prior) union(prior, claim.workItemId); else linked.set(key, claim.workItemId);
  }
  const groupIdentities = new Map<string, Set<string>>();
  for (const [work, keys] of identities) { const group = groupIdentities.get(root(work)) ?? new Set<string>(); for (const key of keys) group.add(key); groupIdentities.set(root(work), group); }
  const groupDates = new Map<string, Set<string>>();
  for (const [work, dates] of reviewedDates) { const group = groupDates.get(root(work)) ?? new Set<string>(); for (const date of dates) group.add(date); groupDates.set(root(work), group); }
  const uncertain = new Set<string>();
  for (const work of ledgerWork) if ((groupIdentities.get(root(work))?.size ?? 0) !== 1 || (groupDates.get(root(work))?.size ?? 0) !== 1) uncertain.add(root(work));
  const occurredAtByWork = new Map<string, string>();
  for (const [work, dates] of groupDates) if (dates.size) occurredAtByWork.set(work, [...dates].sort().at(-1)!);
  return { occurredAtByWork, claims: claims.map(claim => ({ ...claim, workItemId: root(claim.workItemId) })), assessments: assessments.map(assessment => ({ ...assessment, workItemId: root(assessment.workItemId),
    ...(uncertain.has(root(assessment.workItemId)) && assessment.action !== "retract" ? { status: "unassessed" as const, reasonCode: "not_assessed" as const } : {}) })) };
}
