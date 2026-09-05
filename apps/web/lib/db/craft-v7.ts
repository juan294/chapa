import "server-only";
import { databaseInstant } from "@/lib/evidence/database-time";
import { reconcileCraftIdentity } from "@/lib/evidence/craft-identity";
import type { VerifiedLedgerFacts } from "@/lib/evidence/validation";
import { createHash, randomUUID } from "node:crypto";
import { createScoringWindow, scoringInstant, type CraftEvidencePortfolio, type CraftEpisode, type PrivateEvidenceClaim, type ScoringWindow } from "@chapa/shared";
import { ledgerAuthorityGrantedAt } from "@/lib/evidence/authorization";
import { getSupabase } from "./supabase";
import { assessmentFromRow, evidenceClaimToRow, type AssessmentRow } from "./scoring-v7-contract";
import { buildCraftInputs, calculateCraftV7, CRAFT_CRITERIA } from "@/lib/insights/craft-v7";
import { ageInsightsDescriptionV7, describeInsightsReportV7, parseInsightsReportV7, type InsightsReportV7, type InsightsReportDescriptionV7 } from "@/lib/insights/report-v7";

function client() {
  const db = getSupabase();
  if (!db) throw new Error("Craft storage unavailable");
  return db;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Owner comes from the authenticated request. Reports cannot supply any rubric verdict. */
export async function dbStoreCraftReportV7(owner: string, value: InsightsReportV7, referenceTime: string) {
  const report = parseInsightsReportV7(value, referenceTime);
  const description = describeInsightsReportV7(report, createScoringWindow(referenceTime));
  const body = canonical(report);
  const { data, error } = await client().rpc("scoring_v7_store_craft_report", {
    p_owner: owner.toLowerCase(), p_actor: owner.toLowerCase(), p_upload: randomUUID(),
    p_digest: createHash("sha256").update(body).digest("hex"),
    p_period_start: description.diagnostics.reportPeriod.startInclusive, p_period_end: description.diagnostics.reportPeriod.endExclusive,
    p_diagnostics: { schemaVersion: "v7", kind: "insights_diagnostics", tool: report.tool, ...description }, p_body: body,
  });
  if (error || typeof data !== "string") throw new Error("Craft report persistence failed");
  return { uploadId: data };
}

interface CraftSnapshot {
  evidence: { id: string; claim_id: string; revision: number; supersedes_id: string | null; action: PrivateEvidenceClaim["action"]; recorded_at: string; owner_handle: string; work_item_id: string; category: string; occurred_at: string | null; payload: unknown }[];
  assessments: (AssessmentRow & { ledger_payload?: { authorization?: unknown; conflicts?: string[]; facts?: VerifiedLedgerFacts | null } })[];
  references: { reference_id: string; owner_handle: string; retention: string; artifact_uri?: string; artifact_revision?: string }[];
  grants: { reviewer_handle: string; granted_at: string; revoked_at: string | null }[];
}

/** Private owner/reviewer projection. Never expose this result through a public profile route. */
export async function dbReadCraftV7(owner: string, actor: string, window: ScoringWindow) {
  scoringInstant(window.referenceTime);
  const { data, error } = await client().rpc("scoring_v7_read_craft", { p_owner: owner.toLowerCase(), p_actor: actor.toLowerCase(), p_reference: window.referenceTime });
  if (error || !data || !Array.isArray(data.evidence) || !Array.isArray(data.assessments) || !Array.isArray(data.references) || !Array.isArray(data.grants)) throw new Error("Craft portfolio read failed");
  const snapshot = data as CraftSnapshot;
  const claims: PrivateEvidenceClaim[] = [];
  const reports: { uploadId: string; receivedAt: string; description: unknown }[] = [];
  for (const row of snapshot.evidence) {
    if (row.owner_handle !== owner.toLowerCase()) throw new Error("Craft owner mismatch");
    if (row.category === "craft") {
      reports.push({ uploadId: row.id, receivedAt: row.recorded_at, description: ageInsightsDescriptionV7(row.payload as InsightsReportDescriptionV7, window) });
      continue;
    }
    const claim = row.payload as PrivateEvidenceClaim;
    // Immutable relational identity is authoritative over a private JSON payload.
    if (!claim || claim.revisionId !== row.id || claim.claimId !== row.claim_id || claim.revision !== row.revision || claim.action !== row.action ||
        claim.supersedesRevisionId !== row.supersedes_id || claim.workItemId !== row.work_item_id || claim.ownerId !== row.owner_handle ||
        !Array.isArray(claim.evidenceReferenceIds) || !claim.observationPeriod || !claim.artifactRevision) throw new Error("Invalid Craft claim contract");
    claims.push({ ...claim, recordedAt: databaseInstant(row.recorded_at) });
  }
  const grants = new Map(snapshot.grants.map(grant => [grant.reviewer_handle, grant]));
  const captured = new Set<string>();
  const authorizedAssessments = snapshot.assessments.flatMap(row => {
    const assessment = assessmentFromRow(row);
    if (row.ledger_payload?.authorization) {
      if (!ledgerAuthorityGrantedAt(owner.toLowerCase(), assessment, row.ledger_payload.authorization)) return [];
      captured.add(assessment.evaluator.id);
      return [{ ...assessment, ...(row.ledger_payload.conflicts?.length && assessment.action !== "retract" ? { status: "unassessed" as const, reasonCode: "not_assessed" as const } : {}) }];
    }
    const grant = grants.get(assessment.evaluator.id);
    return grant && Date.parse(grant.granted_at) <= Date.parse(assessment.recordedAt) && Date.parse(grant.granted_at) <= Date.parse(assessment.assessedAt) &&
      (!grant.revoked_at || Date.parse(grant.revoked_at) > Date.parse(assessment.recordedAt)) ? [assessment] : [];
  });
  const reconciled = reconcileCraftIdentity(owner.toLowerCase(), claims, authorizedAssessments,
    new Map(snapshot.assessments.map(row => [row.id, row.ledger_payload ?? {}])), snapshot.references, window.referenceTime);
  const assessments = reconciled.assessments;
  const dated = new Map(snapshot.evidence.filter(row => row.occurred_at !== null).map(row => [row.id, databaseInstant(row.occurred_at!)]));
  const episodes: CraftEpisode[] = reconciled.claims.filter(claim => dated.has(claim.revisionId)).map(claim => ({ episodeId: claim.revisionId, workItemId: claim.workItemId,
    occurredAt: reconciled.occurredAtByWork.get(claim.workItemId) ?? dated.get(claim.revisionId)!, artifactRevision: claim.artifactRevision, evidenceReferenceIds: claim.evidenceReferenceIds,
    assessments: assessments.filter((assessment): assessment is typeof assessment & { criterion: typeof CRAFT_CRITERIA[number] } => assessment.claimRevisionId === claim.revisionId && CRAFT_CRITERIA.some(criterion => criterion === assessment.criterion)) }));
  const portfolios: CraftEvidencePortfolio[] = [{ schemaVersion: "v7", uploadId: "registered-craft-ledger", ownerId: owner.toLowerCase(), receivedAt: window.startInclusive,
    reportPeriod: window, coverage: "complete", episodes, diagnostics: null }];
  const inputs = buildCraftInputs({ ownerId: owner.toLowerCase(), window, claims: reconciled.claims, portfolios,
    authorizedEvaluatorIds: [...new Set([...grants.keys(), ...captured])], referenceIds: snapshot.references.filter(ref => ref.owner_handle === owner.toLowerCase() && ref.retention === "until_owner_withdrawal").map(ref => ref.reference_id) });
  const calculation = calculateCraftV7(inputs);
  return { inputs, ...calculation, reports, undatedClaimCount: claims.filter(claim => !dated.has(claim.revisionId)).length };
}

/** Maintenance errors propagate; the cron records failure rather than claiming deletion succeeded. */
export async function dbPurgeExpiredCraftRawV7(): Promise<number> {
  const { data, error } = await client().rpc("scoring_v7_purge_expired_raw");
  if (error || !Number.isSafeInteger(data) || data < 0) throw new Error("Craft raw retention purge failed");
  return data;
}

/** S11 ledger writer contract: record when the practice episode occurred separately from the measurement horizon. */
export function craftClaimToRow(claim: PrivateEvidenceClaim, occurredAt: string) {
  const occurred = scoringInstant(occurredAt);
  const start = scoringInstant(claim.observationPeriod.startInclusive);
  const end = scoringInstant(claim.observationPeriod.endExclusive);
  if (start >= end || end > scoringInstant(claim.recordedAt) || occurred > scoringInstant(claim.recordedAt)) throw new RangeError("Invalid Craft episode time");
  return { ...evidenceClaimToRow(claim, "craft"), occurred_at: occurred.toISOString() };
}
