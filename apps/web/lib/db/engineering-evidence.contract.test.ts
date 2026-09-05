import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { dbReadCraftV7 } from "./craft-v7";
import { dbReadEngineeringArtifact, dbReadEngineeringEvidence, dbWriteEngineeringEvidence, prepareLedgerClaim } from "./engineering-evidence";
import { projectEngineeringLedger } from "@/lib/evidence/projection";
import { deriveCoreEvidenceV7 } from "@/lib/impact/v7-evidence";
import type { AssessmentCommand, ClaimCommand } from "@/lib/evidence/validation";
const owner = "contract-ledger-owner";
const reviewer = "contract-ledger-reviewer";
const db = () => getServiceClient();
const now = () => new Date().toISOString();
const input = (channel: "core" | "craft" = "core"): ClaimCommand => ({ action: "claim", owner, channel, previousRevisionId: null,
  category: "performance_accessibility", artifactRevision: "sha", occurredAt: "2026-08-01T00:00:00Z", claim: "Reduced latency", baseline: { kind: "measured", value: "100ms" },
  observedResult: "80ms", method: "Paired reproducible benchmark", contributorRole: "Implemented optimization", attribution: "individual",
  observationPeriod: { startInclusive: "2026-08-02T00:00:00Z", endExclusive: "2026-09-01T00:00:00Z" }, limitations: ["Single workload"], counterevidence: ["Memory cost"],
  references: [{ artifactUri: `urn:chapa:artifact:${randomUUID()}`, artifactRevision: "sha", observedAt: "2026-09-01T00:00:00Z", body: "Archived issue result and measured output" }] });
async function grant(enabled = true) { return dbWriteEngineeringEvidence(owner, { action: "grant", owner, reviewer, enabled }, now()); }
async function submit(channel: "core" | "craft" = "core") { return dbWriteEngineeringEvidence(owner, input(channel), now()); }
function review(submitted: Record<string, unknown>, craft = false): AssessmentCommand {
  const refs = submitted.referenceIds as string[];
  return { action: "assessment", owner, previousRevisionId: null, claimRevisionId: submitted.revisionId as string, criterion: craft ? "verification_debugging" : "verification",
    status: "accepted", rubricVersion: "v7", rationale: "Reproduced paired benchmark at the delivered revision", evaluatorType: "human", evaluatorVersion: "rubric-v7-human", independentlyCorroborated: true, conflicts: [], referenceIds: refs,
    facts: { identity: { projectKey: "verified-project", workKey: "verified-work", repository: null, equivalentWork: null, referenceIds: refs }, occurredAt: "2026-08-01T00:00:00Z", kind: craft ? "practice_evidence" : "maintenance", attribution: "individual", categories: [],
      acceptance: craft ? null : { method: "accepted_artifact", acceptedAt: "2026-08-01T00:00:00Z", acceptedResultId: "reviewed-release:sha", referenceIds: refs } } };
}
beforeEach(async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); });
afterEach(async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); });
describe("ledger real transaction contracts", () => {
  it("round-trips a no-report archived issue artifact, reviewer acceptance and core counts", async () => {
    const stored = await submit();
    expect(await dbReadEngineeringArtifact(owner, owner, (stored.referenceIds as string[])[0]!)).toMatchObject({ body: "Archived issue result and measured output" });
    await grant(); await dbWriteEngineeringEvidence(reviewer, review(stored), now());
    const snapshot = await dbReadEngineeringEvidence(owner, owner, createScoringWindow(now()));
    expect(snapshot.claims[0]?.claim.provenance).toBe("self_reported");
    const core = deriveCoreEvidenceV7(projectEngineeringLedger(snapshot, createScoringWindow(now())));
    expect(core.observedCounts.deliveryUnits).toBe(1);
    expect(core.observedCounts.quality.verification).toBe(1);
  });
  it("derives immutable authority, rejects forged caller snapshots, and retains historical Craft after revoke/regrant", async () => {
    const stored = await submit("craft"); await grant();
    const command = review(stored, true);
    expect((await db().rpc("scoring_v7_ledger_write", { p_owner: owner, p_actor: reviewer, p_action: "assessment", p_data: { ...command, authorization: { grantedAt: "1900-01-01" } } })).error).not.toBeNull();
    await dbWriteEngineeringEvidence(reviewer, command, now());
    const before = await dbReadCraftV7(owner, owner, createScoringWindow(now()));
    expect(before.inputs.counts.verification_debugging.lower).toBe(1);
    await grant(false);
    await expect(dbReadCraftV7(owner, reviewer, createScoringWindow(now()))).rejects.toThrow();
    await expect(dbReadEngineeringArtifact(owner, reviewer, (stored.referenceIds as string[])[0]!)).rejects.toThrow();
    expect((await dbReadCraftV7(owner, owner, createScoringWindow(now()))).inputs.counts).toEqual(before.inputs.counts);
    await grant(true);
    expect((await dbReadCraftV7(owner, owner, createScoringWindow(now()))).inputs.counts).toEqual(before.inputs.counts);
    const saved = await db().from("scoring_v7_assessments").select("ledger_payload,evaluator_handle,assessed_at,recorded_at").eq("owner_handle", owner).single();
    expect(saved.error).toBeNull();
    expect(saved.data?.ledger_payload.authorization).toMatchObject({ ownerId: owner, evaluatorId: reviewer, version: "ledger-authority-v1" });
  });
  it("future grants deny assessment and private access", async () => {
    const stored = await submit(); await grant();
    expect((await db().from("scoring_v7_reviewer_grants").update({ granted_at: new Date(Date.now() + 86400000).toISOString() }).eq("owner_handle", owner)).error).toBeNull();
    await expect(dbWriteEngineeringEvidence(reviewer, review(stored), now())).rejects.toThrow();
    await expect(dbReadEngineeringEvidence(owner, reviewer, createScoringWindow(now()))).rejects.toThrow();
  });
  it("rolls back a bad reference and rejects cross-owner amendments", async () => {
    const prepared = prepareLedgerClaim(owner, input(), now());
    const bad = await db().rpc("scoring_v7_ledger_write", { p_owner: owner, p_actor: owner, p_action: "claim", p_data: { ...prepared, references: prepared.references.map(ref => ({ ...ref, ownerId: "stranger" })) } });
    expect(bad.error).not.toBeNull();
    expect((await db().from("scoring_v7_evidence").select("id").eq("owner_handle", owner)).data).toEqual([]);
    const stored = await submit();
    expect((await db().rpc("scoring_v7_ledger_write", { p_owner: owner, p_actor: "stranger", p_action: "retract", p_data: { revisionId: stored.revisionId, rationale: "forged" } })).error?.code).toBe("42501");
  });
  it("expires only raw bodies while keeping scored extracts and supports idempotent withdrawal", async () => {
    const stored = await submit(); await grant(); await dbWriteEngineeringEvidence(reviewer, review(stored), now());
    const refId = (stored.referenceIds as string[])[0]!;
    const instant = Date.now();
    expect((await db().from("scoring_v7_raw_artifacts").delete().eq("id", refId)).error).toBeNull();
    expect((await db().from("scoring_v7_raw_artifacts").insert({ id: refId, owner_handle: owner, kind: "supplemental", body: "expired", created_at: new Date(instant - 32 * 86400000).toISOString(), expires_at: new Date(instant - 2 * 86400000).toISOString() })).error).toBeNull();
    expect(await dbReadEngineeringArtifact(owner, owner, refId)).toBeNull();
    expect((await db().rpc("scoring_v7_purge_expired_raw")).error).toBeNull();
    const snapshot = await dbReadEngineeringEvidence(owner, owner, createScoringWindow(now()));
    expect(snapshot.references).toHaveLength(1);
    expect(deriveCoreEvidenceV7(projectEngineeringLedger(snapshot, createScoringWindow(now()))).observedCounts.deliveryUnits).toBe(1);
    for (let i = 0; i < 2; i++) await dbWriteEngineeringEvidence(owner, { action: "withdraw", owner, publicationAcknowledged: true }, now());
    for (const table of ["scoring_v7_evidence", "scoring_v7_assessments", "scoring_v7_evidence_references", "scoring_v7_raw_artifacts", "scoring_v7_reviewer_grants"]) {
      expect((await db().from(table).select("owner_handle").eq("owner_handle", owner)).data).toEqual([]);
    }
  });
});

it("denies browser roles the ledger RPCs and keeps its existing tables under forced RLS", () => {
  const project = readFileSync("supabase/config.toml", "utf8").match(/^project_id = "([\w-]+)"/m)?.[1];
  if (!project) throw new Error("Missing local database project");
  const query = "SELECT has_function_privilege('anon','public.scoring_v7_ledger_write(text,text,text,jsonb)','EXECUTE'), has_function_privilege('authenticated','public.scoring_v7_ledger_read(text,text,timestamptz)','EXECUTE'), has_function_privilege('authenticated','public.scoring_v7_ledger_artifact(text,text,text)','EXECUTE'), bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('scoring_v7_evidence','scoring_v7_assessments','scoring_v7_evidence_references','scoring_v7_raw_artifacts')";
  expect(execFileSync("docker", ["exec", `supabase_db_${project}`, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], { encoding: "utf8" }).trim()).toBe("f|f|f|t");
});

it("a conflicted latest Craft verdict does not resurrect its prior accepted revision", async () => {
  const stored = await submit("craft"); await grant();
  const command = review(stored, true);
  const accepted = await dbWriteEngineeringEvidence(reviewer, command, now());
  await dbWriteEngineeringEvidence(reviewer, { ...command, criterion: "framing" }, now());
  expect((await dbReadCraftV7(owner, owner, createScoringWindow(now()))).inputs.counts.verification_debugging.lower).toBe(1);
  await dbWriteEngineeringEvidence(reviewer, { ...command, previousRevisionId: accepted.revisionId as string, independentlyCorroborated: false, conflicts: ["Owns the vendor"] }, now());
  expect((await dbReadCraftV7(owner, owner, createScoringWindow(now()))).inputs.counts.verification_debugging.lower).toBe(0);
});

it("deduplicates repeated Craft artifacts and reviewed same-work mappings with fresh submission identities", async () => {
  const body = input("craft"); await grant();
  for (let index = 0; index < 3; index++) {
    const stored = await dbWriteEngineeringEvidence(owner, index < 2 ? body : { ...body, references: [{ ...body.references[0]!, artifactUri: `urn:chapa:artifact:${randomUUID()}` }] }, now());
    await dbWriteEngineeringEvidence(reviewer, review(stored, true), now());
  }
  const result = await dbReadCraftV7(owner, owner, createScoringWindow(now()));
  expect(result.inputs.eligibleEpisodes).toBe(1);
  expect(result.inputs.counts.verification_debugging.lower).toBe(1);
});

it("reviewed old Craft dates govern reuploads and conflicting mirror dates never rejuvenate work", async () => {
  const body = input("craft"); await grant();
  for (const date of ["2024-08-01T00:00:00Z", "2026-08-01T00:00:00Z"]) {
    const stored = await dbWriteEngineeringEvidence(owner, { ...body, occurredAt: date }, now());
    const command = review(stored, true);
    await dbWriteEngineeringEvidence(reviewer, { ...command, facts: { ...command.facts!, occurredAt: "2024-08-01T00:00:00Z" } }, now());
  }
  const old = await dbReadCraftV7(owner, owner, createScoringWindow(now()));
  expect(old.inputs.eligibleEpisodes).toBe(0);
  expect(old.inputs.counts.verification_debugging.lower).toBe(0);
  const stored = await dbWriteEngineeringEvidence(owner, body, now());
  await dbWriteEngineeringEvidence(reviewer, review(stored, true), now());
  const conflicting = await dbReadCraftV7(owner, owner, createScoringWindow(now()));
  expect(conflicting.inputs.counts.verification_debugging.lower).toBe(0);
  expect(conflicting.inputs.eligibleEpisodes).toBe(1);
  expect(conflicting.inputs.counts.verification_debugging.upper).toBeGreaterThan(0);
});
