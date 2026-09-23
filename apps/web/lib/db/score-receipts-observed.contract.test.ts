import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalJson, createScoringWindow } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget, inspectLocalSql } from "@/test/contract/local-sql";

const owner = "contract-observed-receipts";
const db = () => getServiceClient();
function receipt(referenceTime = "2026-09-08T12:00:00.000Z", exact = 46, prior?: ReturnType<typeof rootReceipt>) {
  const root = rootReceipt(referenceTime, exact);
  return prior ? { ...root, receiptId: prior.receiptId, revision: prior.revision + 1, supersedesRevisionId: prior.revisionId, action: "correct" } : root;
}
function rootReceipt(referenceTime: string, exact: number) {
  return { schemaVersion: "v7", policyVersion: "v7.2", algorithm: { revision: "v7.2" }, receiptId: randomUUID(), revisionId: randomUUID(), revision: 1,
    supersedesRevisionId: null as string | null, action: "create", recordedAt: referenceTime, window: createScoringWindow(referenceTime), core: { composite: { kind: "point", exact } } };
}
const publish = (value: ReturnType<typeof receipt>, semantic = "a".repeat(64), actor: string | null = owner) => db().rpc("scoring_observed_publish_receipt", { p_owner: owner, p_actor: actor, p_receipt: value, p_canonical: canonicalJson(value), p_semantic_digest: semantic });
async function cleanup() { assertLocalSqlTarget(); expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); }
beforeEach(async () => { await cleanup(); expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull(); });
afterEach(cleanup);

describe("v7.2 atomic publication and policy history", () => {
  it("C13 converges concurrent equivalent roots on the authoritative envelope", async () => {
    const a = receipt(), b = receipt("2026-09-08T12:01:00.000Z");
    const responses = await Promise.all([publish(a), publish(b)]);
    expect(responses.every(row => !row.error)).toBe(true);
    expect(responses.map(row => row.data.status).sort()).toEqual(["duplicate", "inserted"]);
    expect(new Set(responses.map(row => row.data.canonicalReceipt)).size).toBe(1);
    expect((await db().from("scoring_v7_receipts").select("id").eq("owner_handle", owner)).data).toHaveLength(1);
  });
  it("C12 never deduplicates against superseded historical semantic state", async () => {
    const a = receipt(), b = receipt("2026-09-08T12:01:00.000Z", 60), c = receipt("2026-09-08T12:02:00.000Z");
    expect((await publish(a)).data.status).toBe("inserted");
    expect((await publish(b, "b".repeat(64))).data.status).toBe("inserted");
    expect((await publish(c)).data.status).toBe("inserted");
    expect((await db().rpc("scoring_observed_read_receipt", { p_owner: owner })).data.revisionId).toBe(c.revisionId);
  });
  it("C13 allows new families at the same reference but fences correction lineage", async () => {
    const a = receipt(), b = receipt(undefined, 60);
    expect((await publish(a)).error).toBeNull();
    expect((await publish(b, "b".repeat(64))).error).toBeNull();
    const correction = receipt(a.window.referenceTime, 47, a);
    expect((await publish(correction, "c".repeat(64))).error).toBeNull();
    expect((await db().rpc("scoring_observed_read_receipt", { p_owner: owner })).data.revisionId).toBe(b.revisionId);
    const bad = receipt("2026-09-08T12:01:00.000Z", 48, b);
    expect((await publish(bad, "d".repeat(64))).error).not.toBeNull();
  });
  it("does not swallow a historical family correction matching the current family's semantic digest", async () => {
    const a = receipt(), b = receipt("2026-09-08T12:01:00.000Z", 60);
    expect((await publish(a)).error).toBeNull();
    expect((await publish(b, "b".repeat(64))).error).toBeNull();
    const correctedA = receipt(a.window.referenceTime, 60, a);
    const result = await publish(correctedA, "b".repeat(64));
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ status: "inserted", revisionId: correctedA.revisionId, isCurrent: false });
    expect((await db().rpc("scoring_observed_read_receipt", { p_owner: owner })).data.revisionId).toBe(b.revisionId);
  });
  it("C19 recomputes same-day anchors from the preceding day, not today's prior value", async () => {
    const a = receipt("2026-09-07T12:00:00.000Z", 40), b = receipt(undefined, 60), c = receipt("2026-09-08T12:01:00.000Z", 80);
    expect((await publish(a)).error).toBeNull();
    expect((await publish(b, "b".repeat(64))).data.trend.value).toBeCloseTo(43, 10);
    const updated = await publish(c, "c".repeat(64));
    expect(updated.error).toBeNull();
    expect(updated.data.trend.value).toBeCloseTo(46, 10);
    expect(updated.data.trend.previous_receipt_id).toBe(a.revisionId);
  });
  it("C19 keeps historical policy reads and trend anchors separate", async () => {
    const old = { ...receipt("2026-09-07T12:00:00.000Z", 80), policyVersion: "v7", algorithm: { revision: "v7.1" }, core: { composite: { kind: "point", value: 80 } } };
    expect((await db().rpc("scoring_v7_publish_receipt", { p_owner: owner, p_actor: owner, p_receipt: old, p_canonical: canonicalJson(old) })).error).toBeNull();
    const current = receipt();
    const saved = await publish(current);
    expect(saved.error).toBeNull();
    expect(saved.data.trend.value).toBe(46);
    expect(saved.data.trend.previous_receipt_id).toBeNull();
    expect((await db().rpc("scoring_v7_read_receipt", { p_owner: owner })).data.revisionId).toBe(old.revisionId);
    expect((await db().rpc("scoring_observed_read_receipt", { p_owner: owner })).data.revisionId).toBe(current.revisionId);
    expect((await db().rpc("scoring_observed_read_receipt", { p_owner: owner, p_revision: old.revisionId })).data).toBeNull();
  });
  it("never lets semantic no-op swallow a retraction or restoration", async () => {
    const a = receipt();
    expect((await publish(a)).error).toBeNull();
    const retracted = { ...receipt(a.window.referenceTime, 46, a), action: "retract" };
    expect((await publish(retracted)).data.status).toBe("inserted");
    const restored = receipt("2026-09-08T12:01:00.000Z");
    expect((await publish(restored)).data.status).toBe("inserted");
    expect((await db().rpc("scoring_observed_read_receipt", { p_owner: owner })).data.revisionId).toBe(restored.revisionId);
  });
  it("C16 denies mismatched/missing actors and withdrawn retries", async () => {
    const a = receipt();
    expect((await publish(a, undefined, null)).error).not.toBeNull();
    expect((await publish(a, undefined, "other")).error).not.toBeNull();
    expect((await publish(a)).error).toBeNull();
    await cleanup();
    expect((await publish(a)).error).not.toBeNull();
    expect((await db().rpc("scoring_observed_read_receipt", { p_owner: owner })).data).toBeNull();
    expect((await db().from("scoring_v7_revocations").select("receipt_id").eq("receipt_id", a.revisionId)).data).toHaveLength(1);
  });
  it("has exact service-only RPC and current-pointer grants", () => {
    expect(inspectLocalSql("SELECT p.proname,p.pronargs,has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('service_role',p.oid,'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('scoring_observed_publish_receipt','scoring_observed_receipt_manifest','scoring_observed_read_receipt') ORDER BY p.proname,p.pronargs").split("\n")).toEqual(["scoring_observed_publish_receipt|5|f|f|t", "scoring_observed_publish_receipt|6|f|f|t", "scoring_observed_read_receipt|2|f|f|t", "scoring_observed_receipt_manifest|2|f|f|t"]);
    expect(inspectLocalSql("SELECT has_table_privilege('anon','public.scoring_observed_current','SELECT'),has_table_privilege('authenticated','public.scoring_observed_current','SELECT'),has_table_privilege('service_role','public.scoring_observed_current','SELECT'),has_table_privilege('service_role','public.scoring_observed_current','INSERT'),has_table_privilege('service_role','public.scoring_observed_current','UPDATE'),has_table_privilege('service_role','public.scoring_observed_current','DELETE')")).toBe("f|f|t|t|t|t");
  });
});
