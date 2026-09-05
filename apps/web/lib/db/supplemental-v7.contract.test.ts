import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aggregateEngineeringEvidence, createScoringWindow } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { redisFake } from "@/test/contract/redis-fake";
import { dbStoreSupplementalEvidenceV2, readSupplementalEvidenceV2 } from "./supplemental-v7";
const owner = "contract-supplemental-v2";
function fixture() {
  const now = Date.now();
  const through = new Date(now - 1000).toISOString();
  const occurred = new Date(now - 86400000).toISOString();
  return { schemaVersion: "supplemental-v2" as const, targetHandle: owner,
    source: { provider: "github" as const, host: "github.com", subjectId: "work-42", handle: "contract-work-account" },
    observationPeriod: { startInclusive: new Date(now - 2 * 86400000).toISOString(), endExclusive: through }, observedThrough: through,
    events: [{ eventId: "merge-1", repositoryId: "repo-1", actorId: "work-42", workItemId: "pr-1", kind: "accepted_change" as const,
      occurredAt: occurred, artifactRevision: "sha-1", files: ["src/a.ts"], additions: 10, deletions: 2,
      hasDescription: true, acceptance: { method: "merged_change" as const, acceptedAt: occurred, acceptedResultId: "merge-1" } }] };
}
async function withdraw() { expect((await getServiceClient().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); }
describe("supplemental v2 real durable source transactions", () => {
  beforeEach(async () => { await withdraw(); redisFake.__reset(); });
  afterEach(withdraw);
  it("deduplicates replay without modifying original receipt time, then unions overlapping uploads", async () => {
    const value = fixture(); const now = new Date().toISOString();
    const first = await dbStoreSupplementalEvidenceV2(owner, value, now);
    const replay = await dbStoreSupplementalEvidenceV2(owner, value, new Date().toISOString());
    expect(replay).toEqual(first);
    const expanded = { ...value, events: [...value.events, { ...value.events[0]!, eventId: "merge-2", workItemId: "pr-2", artifactRevision: "sha-2" }] };
    await dbStoreSupplementalEvidenceV2(owner, expanded, new Date().toISOString());
    const current = await readSupplementalEvidenceV2(owner, createScoringWindow(new Date().toISOString()));
    expect(current.evidence.events).toHaveLength(2);
    expect(aggregateEngineeringEvidence(current.evidence).acceptedWork).toEqual([]);
    expect((await getServiceClient().from("scoring_v7_source_observations").select("id").eq("owner_handle", owner)).data).toHaveLength(2);
  });
  it("denies foreign actors and forged owner/provenance fields atomically", async () => {
    const service = getServiceClient();
    for (const patch of [{ p_actor: "stranger" }, { p_value: { ...fixture(), targetHandle: "stranger" } }, { p_value: { ...fixture(), provenance: "source_observed" } }]) {
      const result = await service.rpc("scoring_v7_store_supplemental", { p_owner: owner, p_actor: owner, p_upload: randomUUID(), p_digest: "a".repeat(64), p_value: fixture(), ...patch });
      expect(result.error).not.toBeNull();
      expect((await service.from("scoring_v7_source_observations").select("id").eq("owner_handle", owner)).data).toEqual([]);
      expect((await service.from("scoring_v7_sources").select("id").eq("owner_handle", owner)).data).toEqual([]);
    }
  });
  it("requires current durable authorization even if Redis holds a complete prior portfolio", async () => {
    const stored = await dbStoreSupplementalEvidenceV2(owner, fixture(), new Date().toISOString());
    const window = createScoringWindow(new Date().toISOString());
    const before = await readSupplementalEvidenceV2(owner, window);
    expect(before.evidence.events).toHaveLength(1);
    expect((await getServiceClient().rpc("scoring_v7_supplemental_manifest", { p_owner: owner, p_actor: "stranger", p_reference: window.referenceTime, p_limit: 1001 })).error).not.toBeNull();
    expect((await getServiceClient().rpc("scoring_v7_read_supplemental", { p_owner: owner, p_actor: "stranger", p_reference: window.referenceTime, p_upload_ids: [stored.uploadId] })).error).not.toBeNull();
    await withdraw();
    expect((await readSupplementalEvidenceV2(owner, window)).evidence.events).toEqual([]);
  });
  it("uses identical dated inputs after cache failure and excludes pre-upload historical access", async () => {
    const before = new Date().toISOString();
    await dbStoreSupplementalEvidenceV2(owner, fixture(), new Date().toISOString());
    redisFake.__failNext("cacheSet"); redisFake.__failNext("cacheDel");
    const window = createScoringWindow(new Date().toISOString());
    const failedCache = await readSupplementalEvidenceV2(owner, window);
    expect(failedCache.cacheRefreshed).toBe(false);
    const fallback = await readSupplementalEvidenceV2(owner, window);
    const hit = await readSupplementalEvidenceV2(owner, window);
    expect(hit.evidence).toEqual(fallback.evidence);
    expect(hit.evidence).toEqual(failedCache.evidence);
    expect((await readSupplementalEvidenceV2(owner, createScoringWindow(before))).evidence.events).toEqual([]);
  });
  it("denies browser roles every private supplemental RPC", () => {
    const project = readFileSync("supabase/config.toml", "utf8").match(/^project_id = "([\w-]+)"/m)?.[1];
    if (!project) throw new Error("Missing disposable database project");
    const query = "SELECT has_function_privilege('anon','public.scoring_v7_store_supplemental(text,text,uuid,text,jsonb)','EXECUTE'), has_function_privilege('authenticated','public.scoring_v7_supplemental_manifest(text,text,timestamptz,integer)','EXECUTE'), has_function_privilege('authenticated','public.scoring_v7_read_supplemental(text,text,uuid[],timestamptz)','EXECUTE')";
    expect(execFileSync("docker", ["exec", `supabase_db_${project}`, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], { encoding: "utf8" }).trim()).toBe("f|f|f");
  });

});

it("the SQL transaction rejects within-upload contradictions even without the HTTP validator", async () => {
  const value = fixture();
  try {
    await withdraw();
    const result = await getServiceClient().rpc("scoring_v7_store_supplemental", { p_owner: owner, p_actor: owner, p_upload: randomUUID(), p_digest: "f".repeat(64),
      p_value: { ...value, events: [value.events[0], { ...value.events[0]!, artifactRevision: "contradiction" }] } });
    expect(result.error?.code).toBe("23505");
    expect((await getServiceClient().from("scoring_v7_source_observations").select("id").eq("owner_handle", owner)).data).toEqual([]);
  } finally { await withdraw(); }
});
