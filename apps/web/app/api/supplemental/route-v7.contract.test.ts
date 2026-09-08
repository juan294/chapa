import { inspectLocalSql as sql } from "@/test/contract/local-sql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { getServiceClient, invokeJson, makeCliBearer } from "@/test/contract/invoke";
import { redisFake } from "@/test/contract/redis-fake";
import { readSupplementalEvidenceV2 } from "@/lib/db/supplemental-v7";
import { POST } from "./route";
const owner = "contract-supp-v2-api";
const cacheKey = `supplemental:v7:${owner}`;
function fixture(second = false) {
  const time = Date.now(); const through = new Date(time - 1000).toISOString(); const occurred = new Date(time - 86400000).toISOString();
  return { schemaVersion: "supplemental-v2", targetHandle: owner,
    source: { provider: "github", host: "github.com", subjectId: "work-42", handle: "contract-work-account" },
    observationPeriod: { startInclusive: new Date(time - 2 * 86400000).toISOString(), endExclusive: through }, observedThrough: through,
    events: [{ eventId: second ? "merge-2" : "merge-1", repositoryId: "repo-1", actorId: "work-42", workItemId: second ? "pr-2" : "pr-1",
      kind: "accepted_change", occurredAt: occurred, artifactRevision: second ? "sha-2" : "sha-1", additions: 1, deletions: 0 }] };
}

function clearFailure() {
  sql("DROP TRIGGER IF EXISTS contract_supplemental_v2_failure ON public.scoring_v7_source_observations; DROP FUNCTION IF EXISTS public.contract_supplemental_v2_failure()");
}
function failWrite() {
  sql(`CREATE FUNCTION public.contract_supplemental_v2_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.owner_handle='contract-supp-v2-api' THEN RAISE EXCEPTION 'contract injected durable failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER contract_supplemental_v2_failure BEFORE INSERT ON public.scoring_v7_source_observations FOR EACH ROW EXECUTE FUNCTION public.contract_supplemental_v2_failure()`);
}
async function post(body: unknown) { return invokeJson(POST, { method: "POST", path: "/api/supplemental", bearer: makeCliBearer(owner), body }); }
async function rows() {
  const result = await getServiceClient().from("scoring_v7_source_observations").select("id").eq("owner_handle", owner);
  expect(result.error).toBeNull(); return result.data;
}
beforeEach(async () => {
  clearFailure(); redisFake.__reset();
  expect((await getServiceClient().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
});
afterEach(async () => {
  clearFailure(); expect((await getServiceClient().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
});
describe("v2 upload real durable-first failure matrix", () => {
  it("writes authenticated dated inputs and labels their current eligibility", async () => {
    const response = await post(fixture());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, persisted: true, cacheRefreshed: true, eligibility: "dated_self_reported", coverage: "partial" });
    expect(await rows()).toHaveLength(1);
    expect((await readSupplementalEvidenceV2(owner, createScoringWindow(new Date().toISOString()))).evidence.events).toHaveLength(1);
  });
  it("rolls back an actual database failure and publishes none of the rejected upload", async () => {
    expect((await post(fixture())).status).toBe(200);
    const oldCache = await redisFake.cacheGet(cacheKey);
    failWrite();
    const response = await post(fixture(true));
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ success: false, persisted: false });
    expect(await rows()).toHaveLength(1);
    expect(await redisFake.cacheGet(cacheKey)).toEqual(oldCache);
    expect(JSON.stringify(response.body)).not.toContain("injected");
  });
  it.each([false, true])("preserves durable publication when SET fails and DEL also fails=%s", async failDelete => {
    expect((await post(fixture())).status).toBe(200);
    redisFake.__failNext("cacheSet"); if (failDelete) redisFake.__failNext("cacheDel");
    const response = await post(fixture(true));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, persisted: true, cacheRefreshed: !failDelete });
    expect(await rows()).toHaveLength(2);
    if (!failDelete) expect(await redisFake.cacheGet(cacheKey)).toBeNull();
    expect((await readSupplementalEvidenceV2(owner, createScoringWindow(new Date().toISOString()))).evidence.events).toHaveLength(2);
  });
  it("rejects identity and provenance injection before creating a source", async () => {
    for (const patch of [{ targetHandle: "foreign-owner" }, { provenance: "source_observed" }, { source: "primary" }]) {
      const response = await post({ ...fixture(), ...patch });
      expect([400, 403]).toContain(response.status);
    }
    expect(await rows()).toEqual([]);
    expect(await redisFake.cacheGet(cacheKey)).toBeNull();
  });
});

it.each(["workItemId", "artifactRevision", "occurredAt"])("atomically rejects cross-upload %s conflicts and preserves committed cache/readability", async field => {
  const first = fixture();
  expect((await post(first)).status).toBe(200);
  const priorRows = await rows(); const priorCache = await redisFake.cacheGet(cacheKey);
  const changed = { ...first.events[0]!, [field]: field === "occurredAt" ? new Date(Date.parse(first.events[0]!.occurredAt) + 1000).toISOString() : "changed" };
  const response = await post({ ...first, events: [changed] });
  expect(response.status).toBe(409);
  expect(response.body).toMatchObject({ success: false, persisted: false });
  expect(await rows()).toEqual(priorRows);
  expect(await redisFake.cacheGet(cacheKey)).toEqual(priorCache);
  expect((await readSupplementalEvidenceV2(owner, createScoringWindow(new Date().toISOString()))).evidence.events).toHaveLength(1);
});

it("rejects within-upload identity contradictions before persistence but allows diagnostic enrichment", async () => {
  const value = fixture();
  const bad = await post({ ...value, events: [value.events[0], { ...value.events[0]!, artifactRevision: "conflict" }] });
  expect(bad.status).toBe(400); expect(await rows()).toEqual([]);
  expect((await post(value)).status).toBe(200);
  expect((await post({ ...value, events: [{ ...value.events[0]!, files: ["src/a.ts"], additions: 2 }] })).status).toBe(200);
  const result = await readSupplementalEvidenceV2(owner, createScoringWindow(new Date().toISOString()));
  expect(result.evidence.events).toHaveLength(1);
  expect(result.evidence.events[0]?.measurements.additions.status).toBe("unknown");
});
