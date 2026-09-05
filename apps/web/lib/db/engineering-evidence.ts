import "server-only";
import { databaseInstant } from "@/lib/evidence/database-time";
import { randomUUID } from "node:crypto";
import { scoringInstant, type PrivateEvidenceClaim, type PrivateEvidenceReference, type ScoringWindow } from "@chapa/shared";
import { getSupabase } from "./supabase";
import { assessmentFromRow, type AssessmentRow } from "./scoring-v7-contract";
import { craftClaimToRow } from "./craft-v7";
import { parseLedgerCommand, type ClaimCommand, type LedgerCommand, type VerifiedLedgerFacts } from "@/lib/evidence/validation";
import { ledgerAuthorityGrantedAt } from "@/lib/evidence/authorization";
import { projectEngineeringLedger } from "@/lib/evidence/projection";
import type { EngineeringLedgerSnapshot } from "@/lib/evidence/types";

export class LedgerStorageError extends Error {
  constructor(readonly code: string) { super("Evidence ledger operation failed"); }
}
function client() { const db = getSupabase(); if (!db) throw new LedgerStorageError("unavailable"); return db; }

/** Server allocates identity. Neither a submitted claim nor a locator establishes a verdict. */
export function prepareLedgerClaim(owner: string, value: ClaimCommand, referenceTime: string) {
  const input = parseLedgerCommand(value, referenceTime) as ClaimCommand;
  if (input.owner !== owner) throw new RangeError("Claim owner mismatch");
  const references: PrivateEvidenceReference[] = input.references.map(reference => ({ referenceId: randomUUID(), ownerId: owner,
    artifactUri: reference.artifactUri, artifactRevision: reference.artifactRevision, observedAt: scoringInstant(reference.observedAt).toISOString(), retention: "until_owner_withdrawal", expiresAt: null }));
  const claim: PrivateEvidenceClaim = { claimId: randomUUID(), revisionId: randomUUID(), revision: 1, supersedesRevisionId: null, action: "create", recordedAt: scoringInstant(referenceTime).toISOString(),
    ownerId: owner, category: input.category, workItemId: `portfolio:${owner}:claim:${randomUUID()}`, artifactRevision: input.artifactRevision,
    claim: input.claim, baseline: input.baseline, observedResult: input.observedResult, method: input.method, contributorRole: input.contributorRole,
    attribution: input.attribution, observationPeriod: input.observationPeriod, evidenceReferenceIds: references.map(reference => reference.referenceId), provenance: "self_reported", limitations: input.limitations, counterevidence: input.counterevidence };
  // Shared Craft seam validates the episode date separately from the outcome observation horizon.
  if (input.channel === "craft") craftClaimToRow(claim, input.occurredAt);
  return { claim, references, channel: input.channel, previousRevisionId: input.previousRevisionId, occurredAt: input.occurredAt,
    bodies: input.references.flatMap((reference, index) => reference.body === undefined ? [] : [{ referenceId: references[index]!.referenceId, body: reference.body }]) };
}
export async function dbWriteEngineeringEvidence(actor: string, command: LedgerCommand, referenceTime: string) {
  const input = parseLedgerCommand(command, referenceTime);
  const { data, error } = await client().rpc("scoring_v7_ledger_write", { p_owner: input.owner, p_actor: actor.toLowerCase(), p_action: input.action,
    p_data: input.action === "claim" ? prepareLedgerClaim(input.owner, input, referenceTime) : input });
  if (error || !data || typeof data !== "object") throw new LedgerStorageError(error?.code ?? "unavailable");
  return data as Record<string, unknown>;
}
interface ClaimRow { id: string; owner_handle: string; claim_id: string; revision: number; supersedes_id: string | null; action: PrivateEvidenceClaim["action"]; recorded_at: string; work_item_id: string; channel: "core" | "craft"; category: string; occurred_at: string; payload: PrivateEvidenceClaim }
interface LedgerAssessmentRow extends AssessmentRow { ledger_payload: { authorization?: unknown; facts?: VerifiedLedgerFacts | null; conflicts?: string[] } }
interface ReferenceRow { reference_id: string; owner_handle: string; artifact_uri: string; artifact_revision: string; observed_at: string; retention: "until_owner_withdrawal"; expires_at: null }
interface SnapshotRows { ownerId: string; publicConsent: boolean; claims: ClaimRow[]; assessments: LedgerAssessmentRow[]; references: ReferenceRow[] }

/** Owner/reviewer private read. The RPC checks current access; captured authority determines historical scoring. */
export async function dbReadEngineeringEvidence(owner: string, actor: string, window: ScoringWindow): Promise<EngineeringLedgerSnapshot> {
  const { data, error } = await client().rpc("scoring_v7_ledger_read", { p_owner: owner, p_actor: actor.toLowerCase(), p_reference: window.referenceTime });
  if (error) throw new LedgerStorageError(error.code);
  const rows = data as SnapshotRows | null;
  if (!rows || rows.ownerId !== owner || !Array.isArray(rows.claims) || !Array.isArray(rows.assessments) || !Array.isArray(rows.references)) throw new LedgerStorageError("contract");
  const claims = rows.claims.map(row => {
    const claim = row.payload;
    if (!claim || claim.ownerId !== owner || row.owner_handle !== owner || claim.revisionId !== row.id || claim.claimId !== row.claim_id || claim.revision !== row.revision || claim.supersedesRevisionId !== row.supersedes_id || claim.action !== row.action || claim.workItemId !== row.work_item_id || claim.category !== row.category || !["core", "craft"].includes(row.channel)) throw new LedgerStorageError("contract");
    return { claim: { ...claim, recordedAt: databaseInstant(row.recorded_at) }, channel: row.channel, occurredAt: databaseInstant(row.occurred_at) };
  });
  const assessments = rows.assessments.flatMap(row => {
    if (row.owner_handle !== owner) throw new LedgerStorageError("contract");
    const assessment = assessmentFromRow(row);
    const authorizedAt = ledgerAuthorityGrantedAt(owner, assessment, row.ledger_payload?.authorization);
    if (!authorizedAt) return []; // Older foundation records have no ledger authority and cannot gain trust here.
    return [{ assessment, authorizedAt, facts: row.ledger_payload.facts ?? null, conflicts: row.ledger_payload.conflicts ?? [] }];
  });
  const references = rows.references.map(row => {
    if (row.owner_handle !== owner || row.retention !== "until_owner_withdrawal" || row.expires_at !== null) throw new LedgerStorageError("contract");
    return { referenceId: row.reference_id, ownerId: owner, artifactUri: row.artifact_uri, artifactRevision: row.artifact_revision, observedAt: databaseInstant(row.observed_at), retention: row.retention, expiresAt: null };
  });
  return { ownerId: owner, publicConsent: rows.publicConsent === true, claims, assessments, references };
}
/** Internal scoring input only (contains private assessment rationale). Never serialize through a public route. */
export async function dbProjectConsentedEngineeringEvidence(owner: string, window: ScoringWindow) {
  const snapshot = await dbReadEngineeringEvidence(owner, owner, window);
  return snapshot.publicConsent ? projectEngineeringLedger(snapshot, window) : null;
}

export async function dbReadEngineeringArtifact(owner: string, actor: string, referenceId: string) {
  const { data, error } = await client().rpc("scoring_v7_ledger_artifact", { p_owner: owner, p_actor: actor.toLowerCase(), p_reference_id: referenceId });
  if (error) throw new LedgerStorageError(error.code);
  if (data === null) return null;
  if (!data || data.referenceId !== referenceId || typeof data.body !== "string" || new TextEncoder().encode(data.body).length > 65536 || typeof data.expiresAt !== "string") throw new LedgerStorageError("contract");
  return { referenceId, body: data.body as string, expiresAt: databaseInstant(data.expiresAt) };
}
