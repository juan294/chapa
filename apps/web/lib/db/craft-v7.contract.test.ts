import { inspectLocalSql } from "@/test/contract/local-sql";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScoringWindow, type PrivateEvidenceClaim, type PrivateCriterionAssessment } from "@chapa/shared";
import { craftClaimToRow, dbReadCraftV7, dbStoreCraftReportV7 } from "./craft-v7";
import { assessmentToRow } from "./scoring-v7-contract";
import { getServiceClient } from "@/test/contract/invoke";

const owner = "contract-craft-v7-owner";
const db = () => getServiceClient();
function args() {
  return { p_owner: owner, p_actor: owner, p_upload: randomUUID(), p_digest: "a".repeat(64),
    p_period_start: "2026-02-20T00:00:00Z", p_period_end: "2026-03-08T00:00:00Z",
    p_diagnostics: { schemaVersion: "v7", kind: "insights_diagnostics", tool: "claude-code", totalSessions: 10 },
    p_body: "private report" };
}

describe("Craft v7 private report transaction", () => {
  beforeEach(async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); });
  afterEach(async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); });
  it("appends reports, deduplicates replay and stores 30-day raw expiry independently of evidence", async () => {
    const first = args();
    expect((await db().rpc("scoring_v7_store_craft_report", first)).error).toBeNull();
    expect((await db().rpc("scoring_v7_store_craft_report", { ...first, p_upload: randomUUID() })).error).toBeNull();
    expect((await db().rpc("scoring_v7_store_craft_report", { ...first, p_upload: randomUUID(), p_digest: "b".repeat(64) })).error).toBeNull();
    const evidence = await db().from("scoring_v7_evidence").select("*").eq("owner_handle", owner);
    expect(evidence.data).toHaveLength(2);
    expect(evidence.data?.every(row => row.channel === "craft" && row.category === "craft")).toBe(true);
    const raw = await db().from("scoring_v7_raw_artifacts").select("*").eq("owner_handle", owner);
    expect(raw.data).toHaveLength(2);
    for (const row of raw.data ?? []) expect(Date.parse(row.expires_at) - Date.parse(row.created_at)).toBe(30 * 86400000);
    expect((await db().from("scoring_v7_raw_artifacts").delete().eq("owner_handle", owner)).error).toBeNull();
    expect((await db().from("scoring_v7_evidence").select("id").eq("owner_handle", owner)).data).toHaveLength(2);
    expect((await db().rpc("scoring_v7_delete_user", { p_handle: owner })).error).toBeNull();
    expect((await db().from("scoring_v7_evidence").select("id").eq("owner_handle", owner)).data).toEqual([]);
  });
  it("rejects a foreign owner, oversized raw content and invalid periods without partial persistence", async () => {
    for (const patch of [{ p_actor: "stranger" }, { p_body: "a".repeat(262145) }, { p_period_end: "2020-01-01T00:00:00Z" }]) {
      expect((await db().rpc("scoring_v7_store_craft_report", { ...args(), ...patch })).error).not.toBeNull();
      expect((await db().from("scoring_v7_evidence").select("id").eq("owner_handle", owner)).data).toEqual([]);
      expect((await db().from("scoring_v7_raw_artifacts").select("id").eq("owner_handle", owner)).data).toEqual([]);
    }
  });
});

it("purges only expired bodies/temporary locators and denies foreign private readers", async () => {
  const service = db();
  try {
    expect((await service.rpc("scoring_v7_store_craft_report", args())).error).toBeNull();
    const captured = Date.now();
    const created = new Date(captured - 32 * 86400000).toISOString();
    const expired = new Date(captured - 2 * 86400000).toISOString();
    expect((await service.from("scoring_v7_raw_artifacts").insert({ owner_handle: owner, kind: "insights", body: "expired", created_at: created, expires_at: expired })).error).toBeNull();
    expect((await service.from("scoring_v7_evidence_references").insert([
      { owner_handle: owner, reference_id: "temporary", artifact_uri: "private:temporary", artifact_revision: "1", observed_at: created, recorded_at: created, retention: "raw_30_days", expires_at: expired },
      { owner_handle: owner, reference_id: "extracted", artifact_uri: "private:extracted", artifact_revision: "1", observed_at: created, recorded_at: created, retention: "until_owner_withdrawal" },
    ])).error).toBeNull();
    const purge = await service.rpc("scoring_v7_purge_expired_raw");
    expect(purge.error).toBeNull();
    expect(purge.data).toBeGreaterThanOrEqual(2);
    // The purge is global and contract files run concurrently. A second call
    // may validly claim another test's newly expired row, so prove idempotence
    // on this owner's rows instead of asserting that the whole database is idle.
    expect((await service.from("scoring_v7_raw_artifacts").select("id").eq("owner_handle", owner).lte("expires_at", new Date().toISOString())).data).toEqual([]);
    expect((await service.from("scoring_v7_evidence_references").select("reference_id").eq("owner_handle", owner)).data).toEqual([{ reference_id: "extracted" }]);
    expect((await service.from("scoring_v7_evidence").select("id").eq("owner_handle", owner)).data).toHaveLength(1);
    expect((await service.rpc("scoring_v7_read_craft", { p_owner: owner, p_actor: "stranger", p_reference: new Date().toISOString() })).error).not.toBeNull();
  } finally { await service.rpc("scoring_v7_withdraw", { p_owner: owner }); }
});


it("round-trips dated no-report ledger evidence and excludes raw uploaded verdicts", async () => {
  const service = db();
  const reviewer = "contract-craft-v7-reviewer";
  try {
    await service.rpc("scoring_v7_withdraw", { p_owner: owner });
    expect((await service.from("scoring_v7_subjects").insert({ owner_handle: owner })).error).toBeNull();
    expect((await service.from("scoring_v7_reviewer_grants").insert({ owner_handle: owner, reviewer_handle: reviewer, granted_by: owner })).error).toBeNull();
    const now = new Date().toISOString();
    const start = new Date(Date.now() - 86400000).toISOString();
    const end = now;
    const claim: PrivateEvidenceClaim = { claimId: randomUUID(), revisionId: randomUUID(), revision: 1, supersedesRevisionId: null, action: "create", recordedAt: now,
      ownerId: owner, workItemId: "private:work", category: "delivered_benefit", artifactRevision: "sha", claim: "Verified a constrained result", baseline: { kind: "not_available", explanation: "New artifact" },
      observedResult: "Accepted", method: "Reviewed acceptance conditions", contributorRole: "Author", attribution: "individual", observationPeriod: { startInclusive: start, endExclusive: end },
      evidenceReferenceIds: ["private:artifact"], provenance: "self_reported", limitations: [], counterevidence: [] };
    expect(() => craftClaimToRow(claim, new Date(Date.parse(now) + 1).toISOString())).toThrow();
    expect((await service.from("scoring_v7_evidence").insert(craftClaimToRow(claim, start))).error).toBeNull();
    expect((await service.from("scoring_v7_evidence_references").insert({ owner_handle: owner, reference_id: "private:artifact", artifact_uri: "private:uri", artifact_revision: "sha", observed_at: start, retention: "until_owner_withdrawal" })).error).toBeNull();
    for (const criterion of ["framing", "verification_debugging", "tool_judgment", "accepted_outcome"] as const) {
      const assessment: PrivateCriterionAssessment = { assessmentId: randomUUID(), revisionId: randomUUID(), revision: 1, action: "create", supersedesRevisionId: null, recordedAt: now, assessedAt: now,
        claimRevisionId: claim.revisionId, workItemId: claim.workItemId, criterion, status: "accepted", reasonCode: "criterion_demonstrated", rubricVersion: "v7", rationale: "Checked the artifact against each acceptance condition",
        evaluator: { id: reviewer, kind: "human", version: "1", independent: true }, evidenceReferenceIds: claim.evidenceReferenceIds, provenance: "independently_corroborated" };
      expect((await service.from("scoring_v7_assessments").insert(assessmentToRow(owner, assessment))).error).toBeNull();
    }
    const window = createScoringWindow(new Date().toISOString());
    const portfolio = await dbReadCraftV7(owner, reviewer, window);
    expect(portfolio.inputs.counts.accepted_outcome).toEqual({ lower: 1, upper: 1 });
    expect(portfolio.inputs.independentlyCorroboratedCompleteEpisodes).toBe(1);
    expect(portfolio.reports).toEqual([]);
    const report = { schemaVersion: "v7" as const, tool: "claude-code" as const, reportPeriod: { start: "2026-02-20", end: "2026-03-07" }, totalSessions: 1,
      outcomes: { fully_achieved: 1 }, satisfaction: null, toolUsage: null, sessionTypes: null, friction: null, toolErrors: null, totalToolCalls: null,
      responseTime: { medianSeconds: null, averageSeconds: null }, volume: null, multiClauding: null };
    const stored = await dbStoreCraftReportV7(owner, report, window.referenceTime);
    const after = await dbReadCraftV7(owner, owner, createScoringWindow(new Date().toISOString()));
    expect(after.inputs.counts).toEqual(portfolio.inputs.counts);
    expect((await service.from("scoring_v7_reviewer_grants").update({ revoked_at: new Date().toISOString() }).eq("owner_handle", owner).eq("reviewer_handle", reviewer)).error).toBeNull();
    await expect(dbReadCraftV7(owner, reviewer, window)).rejects.toThrow("Craft portfolio read failed");
    expect((await dbReadCraftV7(owner, owner, createScoringWindow(new Date().toISOString()))).inputs.counts).toEqual(portfolio.inputs.counts);

    expect(after.reports.map(row => row.uploadId)).toContain(stored.uploadId);
    expect((await service.rpc("scoring_v7_store_craft_report", { ...args(), p_diagnostics: { schemaVersion: "v7", kind: "insights_diagnostics", assessments: [{ provenance: "independently_corroborated" }] } })).error).not.toBeNull();
  } finally { await service.rpc("scoring_v7_withdraw", { p_owner: owner }); }
});


it("denies browser roles all private Craft RPC access", () => {
  const query = "SELECT has_function_privilege('anon','public.scoring_v7_store_craft_report(text,text,uuid,text,timestamptz,timestamptz,jsonb,text)','EXECUTE'), has_function_privilege('authenticated','public.scoring_v7_read_craft(text,text,timestamptz)','EXECUTE'), has_function_privilege('authenticated','public.scoring_v7_purge_expired_raw()','EXECUTE')";
  expect(inspectLocalSql(query)).toBe("f|f|f");
});


it("future grants deny private reads and assessment inserts; active then revoked grants change access", async () => {
  const service = db();
  const reviewer = "contract-future-reviewer";
  try {
    await service.rpc("scoring_v7_withdraw", { p_owner: owner });
    expect((await service.from("scoring_v7_subjects").insert({ owner_handle: owner })).error).toBeNull();
    expect((await service.from("scoring_v7_reviewer_grants").insert({ owner_handle: owner, reviewer_handle: reviewer, granted_by: owner, granted_at: new Date(Date.now() + 86400000).toISOString() })).error).toBeNull();
    expect((await service.rpc("scoring_v7_can_review", { p_owner: owner, p_actor: reviewer })).data).toBe(false);
    await expect(dbReadCraftV7(owner, reviewer, createScoringWindow(new Date().toISOString()))).rejects.toThrow();
    const id = randomUUID();
    expect((await service.from("scoring_v7_evidence").insert({ id, owner_handle: owner, claim_id: id, revision: 1, channel: "craft", category: "craft", work_item_id: "test-grant", payload: {} })).error).toBeNull();
    const assessment = { owner_handle: owner, evidence_id: id, work_item_id: "test-grant", criterion: "framing", verdict: "accepted", evaluator_handle: reviewer, evaluator_type: "human", rubric_version: "v7", rationale: "Examined the framing", reason_code: "criterion_demonstrated" };
    expect((await service.from("scoring_v7_assessments").insert(assessment)).error).not.toBeNull();
    expect((await service.from("scoring_v7_reviewer_grants").update({ granted_at: new Date(Date.now() - 1000).toISOString() }).eq("owner_handle", owner).eq("reviewer_handle", reviewer)).error).toBeNull();
    expect((await service.rpc("scoring_v7_can_review", { p_owner: owner, p_actor: reviewer })).data).toBe(true);
    expect((await service.from("scoring_v7_assessments").insert(assessment)).error).toBeNull();
    expect((await service.from("scoring_v7_reviewer_grants").update({ revoked_at: new Date().toISOString() }).eq("owner_handle", owner).eq("reviewer_handle", reviewer)).error).toBeNull();
    expect((await service.rpc("scoring_v7_can_review", { p_owner: owner, p_actor: reviewer })).data).toBe(false);
    expect((await service.from("scoring_v7_assessments").insert(assessment)).error).not.toBeNull();
  } finally { await service.rpc("scoring_v7_withdraw", { p_owner: owner }); }
});
