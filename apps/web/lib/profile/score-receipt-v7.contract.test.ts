import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalJson } from "@chapa/shared";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { getServiceClient } from "@/test/contract/invoke";
import { dbPublishReceiptV7 } from "@/lib/db/snapshots";
import { readScoreReceiptV7, materializeScoreReceiptV7 } from "./score-receipt-v7";
import { receiptViewModel, renderableScore } from "./score-view-model";

// Real Supabase publication and read-back. Only the Redis mirror is controlled,
// so a cache miss exercises the durable path this seam actually depends on.
vi.mock("@/lib/cache/snapshot-cache", () => ({ getCachedReceiptSnapshotV7: vi.fn(async () => null) }));

const owner = "contract-receipt-materialization";
const db = () => getServiceClient();

beforeEach(async () => {
  expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
  expect((await db().from("scoring_v7_subjects").insert({ owner_handle: owner, public_evidence_consent: true, consent_recorded_at: "2026-09-01T00:00:00Z" })).error).toBeNull();
});
afterEach(async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); });

describe("receipt materialization seams against real persistence", () => {
  it("reads back the exact issued artifact every consumer projects", async () => {
    const envelope = await receiptFixtureV7("2026-09-01", 7);
    const published = await dbPublishReceiptV7(owner, owner, envelope);
    expect(published.status).toBe("inserted");

    const stored = await readScoreReceiptV7(owner.toUpperCase());
    expect(stored).not.toBeNull();
    expect(canonicalJson(stored!.receipt.receipt)).toBe(canonicalJson(envelope.receipt));
    expect(stored!.receipt.contentHash.value).toBe(envelope.contentHash.value);
    // The projection a badge, share page and API all render is byte-identical.
    expect(renderableScore(receiptViewModel(owner, stored!)))
      .toEqual(renderableScore(receiptViewModel(owner, published.snapshot)));
  });

  it("treats an exact republication as a duplicate rather than a second revision", async () => {
    const envelope = await receiptFixtureV7("2026-09-01", 7);
    expect((await dbPublishReceiptV7(owner, owner, envelope)).status).toBe("inserted");
    expect((await dbPublishReceiptV7(owner, owner, envelope)).status).toBe("duplicate");

    const rows = await db().from("scoring_v7_receipts").select("id").eq("owner_handle", owner);
    expect(rows.data).toHaveLength(1);
  });

  it("resolves a superseding correction and still serves the superseded revision by id", async () => {
    const first = await receiptFixtureV7("2026-09-01", 4);
    // A correction is a same-day revision of the receipt it supersedes.
    const corrected = await receiptFixtureV7("2026-09-01", 9, first.receipt);
    await dbPublishReceiptV7(owner, owner, first);
    await dbPublishReceiptV7(owner, owner, corrected);

    const latest = await readScoreReceiptV7(owner);
    expect(latest!.receipt.receipt.revisionId).toBe(corrected.receipt.revisionId);
    expect(latest!.receipt.receipt.supersedesRevisionId).toBe(first.receipt.revisionId);

    const superseded = await readScoreReceiptV7(owner, first.receipt.revisionId);
    expect(superseded!.receipt.receipt.revisionId).toBe(first.receipt.revisionId);
    expect(receiptViewModel(owner, superseded!).identity!.revision).toBe(1);
  });

  it("serves durable evidence on a read-only call and publishes nothing", async () => {
    const envelope = await receiptFixtureV7("2026-09-01", 7);
    await dbPublishReceiptV7(owner, owner, envelope);

    const result = await materializeScoreReceiptV7(owner, { readOnly: true });

    expect(result.status).toBe("stored");
    expect((await db().from("scoring_v7_receipts").select("id").eq("owner_handle", owner)).data).toHaveLength(1);
  });

  it("reports an explicit miss for a subject with no issued receipt", async () => {
    expect(await readScoreReceiptV7(`${owner}-absent`)).toBeNull();
    expect(await materializeScoreReceiptV7(`${owner}-absent`, { readOnly: true }))
      .toEqual({ status: "unavailable", reason: "no_receipt" });
  });

  it("fails closed after withdrawal instead of serving a revoked receipt", async () => {
    await dbPublishReceiptV7(owner, owner, await receiptFixtureV7("2026-09-01", 7));
    expect(await readScoreReceiptV7(owner)).not.toBeNull();

    expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();

    expect(await readScoreReceiptV7(owner)).toBeNull();
  });
});
