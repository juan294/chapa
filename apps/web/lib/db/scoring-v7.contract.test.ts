import { inspectLocalSql as sql } from "@/test/contract/local-sql";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrivateCriterionAssessment, PrivateEvidenceClaim, PrivateEvidenceReference } from "@chapa/shared";
import { assessmentToRow, assessmentFromRow, evidenceClaimToRow, evidenceReferenceToRow, type AssessmentRow } from "./scoring-v7-contract";
import { getServiceClient } from "@/test/contract/invoke";

const owner = "contract-scoring-v7-owner";
const reviewer = "contract-scoring-v7-reviewer";
const stranger = "contract-scoring-v7-stranger";
const db = () => getServiceClient();

/** Foundation fixtures exercise storage invariants, not S12 arithmetic. */
function boundReceiptRow(row: { id: string | undefined; owner_handle: string; policy_version: string; reference_time: string; revision: number; public_receipt: object; supersedes_id?: string; canonical_receipt: string }) {
  const payload = { ...row.public_receipt, schemaVersion: "v7", policyVersion: row.policy_version, revisionId: row.id, receiptId: row.supersedes_id ?? row.id,
    revision: row.revision, supersedesRevisionId: row.supersedes_id ?? null, action: row.revision === 1 ? "create" : "correct", recordedAt: row.reference_time, window: { referenceTime: row.reference_time } };
  return { ...row, issued_at: row.reference_time, public_receipt: payload, canonical_receipt: JSON.stringify(payload) };
}



describe("v7 scoring database foundation (real local contract)", () => {
  beforeEach(async () => {
    expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
    expect((await db().from("scoring_v7_subjects").insert({ owner_handle: owner })).error).toBeNull();
  });
  afterEach(async () => {
    expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
  });

  it("denies direct anon/authenticated access and has forced RLS on every new table", () => {
    const rows = sql("SELECT relname, relrowsecurity, relforcerowsecurity, has_table_privilege('anon', oid, 'SELECT'), has_table_privilege('authenticated', oid, 'SELECT') FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname LIKE 'scoring_v7_%' ORDER BY relname").split("\n");
    expect(rows).toHaveLength(12);
    for (const row of rows) expect(row.split("|").slice(1)).toEqual(["t", "t", "f", "f"]);
    expect(sql("SELECT has_function_privilege('anon', 'public.scoring_v7_withdraw(text)', 'EXECUTE'), has_function_privilege('authenticated', 'public.scoring_v7_can_review(text,text)', 'EXECUTE')")).toBe("f|f");
  });

  it("separates owner/reviewer/stranger access without assuming GitHub is Supabase auth", async () => {
    expect((await db().rpc("scoring_v7_can_review", { p_owner: owner, p_actor: owner })).data).toBe(true);
    expect((await db().rpc("scoring_v7_can_review", { p_owner: owner, p_actor: stranger })).data).toBe(false);
    expect((await db().from("scoring_v7_reviewer_grants").insert({ owner_handle: owner, reviewer_handle: reviewer, granted_by: owner })).error).toBeNull();
    expect((await db().rpc("scoring_v7_can_review", { p_owner: owner, p_actor: reviewer })).data).toBe(true);
    expect((await db().from("scoring_v7_reviewer_grants").insert({ owner_handle: owner, reviewer_handle: stranger, granted_by: stranger })).error).not.toBeNull();
  });

  it("stores dated evidence, enforces immutable revisions and prevents false corroboration", async () => {
    expect((await db().from("scoring_v7_reviewer_grants").insert({ owner_handle: owner, reviewer_handle: reviewer, granted_by: owner })).error).toBeNull();
    const claimId = randomUUID();
    const id = randomUUID();
    const evidence = { id, claim_id: claimId, owner_handle: owner, revision: 1, channel: "core", work_item_id: "project:accepted-item", category: "maintenance_incident_recovery", occurred_at: "2026-09-01T12:00:00Z", payload: { claim: "Resolved a reproduced defect", artifactRevision: "abc", role: "individual", limitations: [] } };
    expect((await db().from("scoring_v7_evidence").insert(evidence)).error).toBeNull();
    expect((await db().from("scoring_v7_evidence").insert(evidence)).error).not.toBeNull();
    expect((await db().from("scoring_v7_evidence").update({ payload: {} }).eq("id", id)).error).not.toBeNull();
    const assessment = { owner_handle: owner, evidence_id: id, work_item_id: evidence.work_item_id, criterion: "verification", verdict: "accepted", evaluator_handle: owner, evaluator_type: "human", evaluator_independent: true, rubric_version: "v7", rationale: "Reproduction fails before the change and passes at the delivered revision", reason_code: "criterion_demonstrated", independently_corroborated: true, provenance: "independently_corroborated" };
    expect((await db().from("scoring_v7_assessments").insert(assessment)).error).not.toBeNull();
    expect((await db().from("scoring_v7_assessments").insert({ ...assessment, evaluator_handle: stranger })).error).not.toBeNull();
    expect((await db().from("scoring_v7_assessments").insert({ ...assessment, evaluator_handle: reviewer })).error).toBeNull();
    expect((await db().from("scoring_v7_evidence").insert({ ...evidence, id: randomUUID(), revision: 2, supersedes_id: id, action: "retract", state: "retracted" })).error).toBeNull();
    expect((await db().from("scoring_v7_evidence").insert({ ...evidence, id: randomUUID(), revision: 3, supersedes_id: id, action: "correct" })).error).not.toBeNull();
    expect((await db().rpc("scoring_v7_delete_user", { p_handle: reviewer })).error).toBeNull();
    expect((await db().from("scoring_v7_assessments").select("id").eq("evaluator_handle", reviewer)).data).toEqual([]);
    expect((await db().from("scoring_v7_reviewer_grants").select("owner_handle").eq("reviewer_handle", reviewer)).data).toEqual([]);
    expect((await db().from("scoring_v7_evidence").select("id").eq("id", id)).data).toHaveLength(1);
  });

  it("round-trips the frozen private claim and assessment contracts without dropping revision or provenance", async () => {
    const recordedAt = "2026-09-05T12:00:00.000Z";
    const reference: PrivateEvidenceReference = { ownerId: owner, referenceId: "private:measurement", artifactUri: "https://private.example/measurements/1", artifactRevision: "revision-1", observedAt: recordedAt, retention: "until_owner_withdrawal", expiresAt: null };
    const storedReference = await db().from("scoring_v7_evidence_references").insert(evidenceReferenceToRow(reference)).select("artifact_uri, reference_id").single();
    expect(storedReference.error).toBeNull();
    expect(storedReference.data).toEqual({ artifact_uri: reference.artifactUri, reference_id: reference.referenceId });
    const claim: PrivateEvidenceClaim = {
      revisionId: randomUUID(), revision: 1, recordedAt, supersedesRevisionId: null, action: "create",
      claimId: randomUUID(), ownerId: owner, category: "delivered_benefit", workItemId: "ledger:item", artifactRevision: "revision-1",
      claim: "Reduced measured response time", baseline: { kind: "measured", value: "100ms" }, observedResult: "80ms", method: "Same fixed query sample", contributorRole: "Implemented query change", attribution: "individual",
      observationPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-02T00:00:00.000Z" },
      evidenceReferenceIds: ["private:measurement"], provenance: "self_reported", limitations: ["Single workload"], counterevidence: [],
    };
    const written = await db().from("scoring_v7_evidence").insert(evidenceClaimToRow(claim, "core")).select("payload").single();
    expect(written.error).toBeNull();
    expect(written.data?.payload).toEqual(claim);
    const assessment: PrivateCriterionAssessment = {
      revisionId: randomUUID(), revision: 1, recordedAt, supersedesRevisionId: null, action: "create", assessmentId: randomUUID(),
      claimRevisionId: claim.revisionId, workItemId: claim.workItemId, criterion: "outcome_followup", status: "accepted", rubricVersion: "v7", reasonCode: "criterion_demonstrated",
      evaluator: { id: owner, kind: "human", version: "owner-v1", independent: false }, rationale: "Measurement relates to the delivered revision", assessedAt: recordedAt,
      evidenceReferenceIds: ["private:measurement"], provenance: "human_assessed",
    };
    const stored = await db().from("scoring_v7_assessments").insert(assessmentToRow(owner, assessment)).select("*").single();
    expect(stored.error).toBeNull();
    expect(assessmentFromRow(stored.data as AssessmentRow)).toEqual(assessment);
  });

  it("persists source coverage and rejects invalid windows and overlong raw retention", async () => {
    const sourceId = randomUUID();
    expect((await db().from("scoring_v7_sources").insert({ id: sourceId, owner_handle: owner, provider: "github", host: "github.com", subject_id: "123", access_context_id: "opaque-principal-context" })).error).toBeNull();
    const observation = { source_id: sourceId, owner_handle: owner, reference_time: "2026-09-05T12:00:00Z", window_start: "2025-09-06T00:00:00Z", window_end: "2026-09-06T00:00:00Z", data_through: "2026-09-05T11:00:00Z", coverage: { discovery: "partial", unknownItems: 3 }, payload: { events: [] } };
    expect((await db().from("scoring_v7_source_observations").insert(observation)).error).toBeNull();
    expect((await db().from("scoring_v7_source_observations").insert({ ...observation, data_through: null, coverage: { status: "unavailable" } })).error).toBeNull();
    expect((await db().from("scoring_v7_source_observations").insert({ ...observation, window_start: "2025-09-05T00:00:00Z" })).error).not.toBeNull();
    expect((await db().from("scoring_v7_raw_artifacts").insert({ owner_handle: owner, kind: "insights", body: "private", created_at: "2026-09-01T00:00:00Z", expires_at: "2026-10-02T00:00:00Z" })).error).not.toBeNull();
    expect((await db().from("scoring_v7_raw_artifacts").insert({ owner_handle: owner, kind: "insights", body: "private", created_at: "2026-09-01T00:00:00Z", expires_at: "2026-10-01T00:00:00Z" })).error).toBeNull();
  });

  it("binds trend anchors to point receipts and freezes a predecessor once later history exists", async () => {
    const handle = `${owner}-trend`;
    expect((await db().from("scoring_v7_subjects").insert({ owner_handle: handle })).error).toBeNull();
    try {
      const ids = [randomUUID(), randomUUID()];
      for (let index = 0; index < 2; index++) {
        const payload = { core: { composite: { kind: "point", value: 60 + 10 * index } } };
        expect((await db().from("scoring_v7_receipts").insert(boundReceiptRow({ id: ids[index], owner_handle: handle, policy_version: "v7", reference_time: `2026-09-0${index + 3}T12:00:00Z`, revision: 1, canonical_receipt: JSON.stringify(payload), public_receipt: payload }))).error).toBeNull();
      }
      const first = { owner_handle: handle, policy_version: "v7", date: "2026-09-03", receipt_id: ids[0], value: 60, raw_value: 60 };
      expect((await db().from("scoring_v7_trend_anchors").insert({ ...first, previous_date: "2026-09-02" })).error).not.toBeNull();
      expect((await db().from("scoring_v7_trend_anchors").insert({ ...first, date: "2026-09-02" })).error).not.toBeNull();
      expect((await db().from("scoring_v7_trend_anchors").insert({ ...first, raw_value: 59 })).error).not.toBeNull();
      expect((await db().from("scoring_v7_trend_anchors").insert(first)).error).toBeNull();
      const second = { ...first, date: "2026-09-04", receipt_id: ids[1], value: 61.5, raw_value: 70, previous_receipt_id: ids[0], previous_date: "2026-09-03", previous_value: 60 };
      expect((await db().from("scoring_v7_trend_anchors").insert({ ...second, previous_value: 59 })).error).not.toBeNull();
      expect((await db().from("scoring_v7_trend_anchors").insert(second)).error).toBeNull();
      expect((await db().from("scoring_v7_trend_anchors").update({ value: 55 }).eq("owner_handle", handle).eq("date", "2026-09-03")).error).not.toBeNull();
      expect((await db().from("scoring_v7_trend_anchors").update({ previous_value: 59 }).eq("owner_handle", handle).eq("date", "2026-09-04")).error).not.toBeNull();
    } finally {
      expect((await db().rpc("scoring_v7_withdraw", { p_owner: handle })).error).toBeNull();
    }
  });

  it("keeps exact receipt/trend revisions then withdraws backing data with a content-free tombstone", async () => {
    const id = randomUUID();
    const payload = { schemaVersion: 7, core: { composite: { kind: "point", value: 69.999, displayValue: 70 } }, craft: { status: "not_observed" } };
    const receipt = { id, owner_handle: owner, policy_version: "v7", reference_time: "2026-09-05T12:00:00Z", revision: 1, canonical_receipt: JSON.stringify(payload), public_receipt: payload };
    expect((await db().from("scoring_v7_receipts").insert(boundReceiptRow(receipt))).error).toBeNull();
    for (const changed of [
      { id: randomUUID(), revision: 99, supersedes_id: id },
      { id: randomUUID(), revision: 2, supersedes_id: id, policy_version: "other-policy" },
      { id: randomUUID(), revision: 2, supersedes_id: id, reference_time: "2026-09-04T12:00:00Z" },
    ]) expect((await db().from("scoring_v7_receipts").insert(boundReceiptRow({ ...receipt, ...changed }))).error).not.toBeNull();
    const cycle = randomUUID();
    expect((await db().from("scoring_v7_receipts").insert(boundReceiptRow({ ...receipt, id: cycle, revision: 2, supersedes_id: cycle }))).error).not.toBeNull();
    expect((await db().from("scoring_v7_receipts").update({ public_receipt: {} }).eq("id", id)).error).not.toBeNull();
    expect((await db().from("scoring_v7_verification").insert({ receipt_id: id, signature: "a".repeat(64), key_version: "test" })).error).toBeNull();
    expect((await db().from("scoring_v7_trend_anchors").insert({ owner_handle: owner, policy_version: "v7", date: "2026-09-05", receipt_id: id, value: 69.999, raw_value: 69.999 })).error).toBeNull();
    expect((await db().from("scoring_v7_trend_anchors").select("value").eq("receipt_id", id).single()).data?.value).toBe(69.999);
    expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
    expect((await db().from("scoring_v7_receipts").select("id").eq("id", id)).data).toEqual([]);
    expect((await db().from("scoring_v7_verification").select("receipt_id").eq("receipt_id", id)).data).toEqual([]);
    expect((await db().from("scoring_v7_subjects").insert({ owner_handle: owner })).error).toBeNull();
    expect((await db().from("scoring_v7_receipts").insert(boundReceiptRow(receipt))).error).not.toBeNull();
    expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
    const tombstone = await db().from("scoring_v7_revocations").select("*").eq("receipt_id", id).single();
    expect(tombstone.error).toBeNull();
    expect(Object.keys(tombstone.data!).sort()).toEqual(["receipt_id", "revoked_at"]);
    for (const table of ["subjects", "sources", "source_observations", "evidence", "assessments", "evidence_references", "reviewer_grants", "raw_artifacts", "trend_anchors"]) {
      expect((await db().from(`scoring_v7_${table}`).select("owner_handle").eq("owner_handle", owner)).data).toEqual([]);
    }
  });
});
