import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalJson, sealScoreReceipt } from "@chapa/shared";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { getServiceClient } from "@/test/contract/invoke";
const owner = "contract-history-v7";
const db = () => getServiceClient();
const publish = async (receipt: Awaited<ReturnType<typeof receiptFixtureV7>>) => db().rpc("scoring_v7_publish_receipt", { p_owner: owner, p_actor: owner, p_receipt: receipt.receipt, p_canonical: canonicalJson(receipt.receipt) });
const anchors = async () => (await db().from("scoring_v7_trend_anchors").select("*").eq("owner_handle", owner).order("date")).data ?? [];
beforeEach(async () => {
  expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
  expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
});
afterEach(async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); });
describe("atomic v7 receipt history", () => {
  it("rejects NULL or absent authenticated actors without writing receipt or trend rows", async () => {
    const receipt = await receiptFixtureV7();
    const args = { p_owner: owner, p_receipt: receipt.receipt, p_canonical: canonicalJson(receipt.receipt) };
    expect((await db().rpc("scoring_v7_publish_receipt", { ...args, p_actor: null })).error?.code).toBe("42501");
    expect((await db().rpc("scoring_v7_publish_receipt", args)).error).not.toBeNull();
    expect((await db().from("scoring_v7_receipts").select("id").eq("owner_handle", owner)).data).toEqual([]);
    expect(await anchors()).toEqual([]);
  });
  it("atomically permits only one root publication for a family across concurrent owners", async () => {
    const other = `${owner}-other`;
    expect((await db().rpc("scoring_v7_withdraw", { p_owner: other })).error).toBeNull();
    expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: other })).error).toBeNull();
    try {
      const first = await receiptFixtureV7(), independent = await receiptFixtureV7();
      const second = await sealScoreReceipt({ ...independent.receipt, receiptId: first.receipt.receiptId });
      const results = await Promise.all([publish(first), db().rpc("scoring_v7_publish_receipt", { p_owner: other, p_actor: other, p_receipt: second.receipt, p_canonical: canonicalJson(second.receipt) })]);
      expect(results.filter(result => result.error === null)).toHaveLength(1);
      expect(results.filter(result => result.error !== null)).toHaveLength(1);
      expect((await db().from("scoring_v7_receipts").select("id").in("owner_handle", [owner, other])).data).toHaveLength(1);
      expect((await db().from("scoring_v7_trend_anchors").select("receipt_id").in("owner_handle", [owner, other])).data).toHaveLength(1);
    } finally { expect((await db().rpc("scoring_v7_withdraw", { p_owner: other })).error).toBeNull(); }
  });
  it("writes exact prepared retries idempotently and rejects conflicts without partial writes", async () => {
    const first = await receiptFixtureV7();
    expect((await publish(first)).data?.status).toBe("inserted");
    expect((await publish(first)).data?.status).toBe("duplicate");
    const conflict = await receiptFixtureV7("2026-09-01", 8);
    expect((await publish(conflict)).error).not.toBeNull();
    expect((await db().from("scoring_v7_receipts").select("id").eq("owner_handle", owner)).data).toHaveLength(1);
    expect(await anchors()).toHaveLength(1);
  });
  it("uses the same prior-day anchor across corrections, gaps and elapsed dates", async () => {
    const prior = await receiptFixtureV7("2026-09-01", 4), current = await receiptFixtureV7("2026-09-04", 8);
    expect((await publish(prior)).error).toBeNull(); expect((await publish(current)).error).toBeNull();
    const [a, b] = await anchors();
    expect(b.value).toBeCloseTo(0.85 ** 3 * a.value + (1 - 0.85 ** 3) * b.raw_value, 10);
    const revision = await receiptFixtureV7("2026-09-04", 12, current.receipt);
    expect((await publish(revision)).error).toBeNull();
    const updated = (await anchors())[1];
    expect(updated.previous_receipt_id).toBe(prior.receipt.revisionId);
    expect(updated.value).toBeCloseTo(0.85 ** 3 * a.value + (1 - 0.85 ** 3) * updated.raw_value, 10);
    const gap = await receiptFixtureV7("2026-09-04", 12, revision.receipt, true);
    expect((await publish(gap)).error).toBeNull(); expect(await anchors()).toHaveLength(1);
    const later = await receiptFixtureV7("2026-09-06", 8);
    expect((await publish(later)).error).toBeNull();
    expect((await anchors())[1].previous_receipt_id).toBe(prior.receipt.revisionId);
    expect((await db().from("scoring_v7_receipts").select("id").eq("owner_handle", owner)).data).toHaveLength(5);
  });
  it("treats point retractions as gaps and restores later corrected points from the prior day", async () => {
    const first = await receiptFixtureV7("2026-09-01", 4), current = await receiptFixtureV7("2026-09-02", 8);
    expect((await publish(first)).error).toBeNull(); expect((await publish(current)).error).toBeNull();
    const prepared = await receiptFixtureV7("2026-09-02", 8, current.receipt);
    const retracted = await sealScoreReceipt({ ...prepared.receipt, action: "retract" });
    expect((await publish(retracted)).error).toBeNull(); expect(await anchors()).toHaveLength(1);
    const restored = await receiptFixtureV7("2026-09-02", 8, retracted.receipt);
    expect((await publish(restored)).error).toBeNull();
    expect((await anchors())[1].previous_receipt_id).toBe(first.receipt.revisionId);
    const historical = await receiptFixtureV7("2026-09-01", 4, first.receipt);
    const historicalRetraction = await sealScoreReceipt({ ...historical.receipt, action: "retract" });
    const before = await anchors(); expect((await publish(historicalRetraction)).error).toBeNull(); expect(await anchors()).toEqual(before);
  });
  it("freezes consumed anchors, checks arithmetic and preserves historical correction receipts", async () => {
    const prior = await receiptFixtureV7("2026-09-01", 4), later = await receiptFixtureV7("2026-09-02", 8);
    expect((await publish(prior)).error).toBeNull(); expect((await publish(later)).error).toBeNull();
    const before = await anchors();
    expect((await db().from("scoring_v7_trend_anchors").delete().eq("receipt_id", prior.receipt.revisionId)).error).not.toBeNull();
    expect((await db().from("scoring_v7_trend_anchors").update({ value: 1 }).eq("receipt_id", later.receipt.revisionId)).error).not.toBeNull();
    const corrected = await receiptFixtureV7("2026-09-01", 12, prior.receipt);
    expect((await publish(corrected)).error).toBeNull(); expect(await anchors()).toEqual(before);
  });
  it("fails closed after withdrawal, tombstones revisions and preserves exact canonical bytes", async () => {
    const first = await receiptFixtureV7(); expect((await publish(first)).error).toBeNull();
    const read = await db().rpc("scoring_v7_read_receipt", { p_owner: owner, p_revision: first.receipt.revisionId });
    expect(read.data?.canonicalReceipt).toBe(canonicalJson(first.receipt));
    expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
    expect((await db().rpc("scoring_v7_receipt_manifest", { p_owner: owner })).data).toBeNull();
    expect((await publish(first)).error).not.toBeNull();
    expect((await db().from("scoring_v7_revocations").select("receipt_id").eq("receipt_id", first.receipt.revisionId)).data).toHaveLength(1);
  });
});
