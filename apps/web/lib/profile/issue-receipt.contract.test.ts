import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
import { dbPublishObservedReceipt } from "@/lib/db/score-receipts-observed";
import { dbPublishReceiptV7, dbReadReceiptV7 } from "@/lib/db/snapshots";
import { issueScoreReceipt } from "./issue-receipt";
import { issueReceiptVerificationV7, getReceiptVerificationV7 } from "@/lib/verification/store";
import { resolveBadgeVerification } from "./badge-verification";
import { receiptViewModel } from "./score-view-model";
import * as env from "@/lib/env";

vi.mock("@/lib/scoring-render-selection", () => ({ readScoringRenderSelection: async () => ({ enabled: true, machinePolicy: "v7.2", cacheable: true, capturedAt: Date.now() }) }));
vi.mock("@/lib/cache/snapshot-cache", () => ({ getCachedReceiptSnapshotV7: async () => null }));
// The test starts at a real partial write: receipt committed, verification absent.
// Collection is excluded so retries exercise durable identity and issuance only.
vi.mock("./score-receipt-observed", async importOriginal => {
  const actual = await importOriginal<typeof import("./score-receipt-observed")>();
  return { ...actual, materializeObservedScoreReceipt: async (owner: string) => {
    const stored = await actual.readObservedScoreReceipt(owner);
    return stored.status === "found" ? { status: "stored", snapshot: { receipt: stored.envelope, trend: stored.trend }, freshness: "current" } : { status: "unavailable", reason: "no_receipt" };
  } };
});
const owner = "contract-receipt-repair";
const db = () => getServiceClient();
const cleanup = async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); };
beforeEach(async () => {
  await cleanup();
  expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
});
afterEach(async () => { vi.restoreAllMocks(); await cleanup(); });

describe("receipt verification repair against durable local state", () => {
  it("C11/C13 seals and authenticates the authoritative current-policy concurrent winner", async () => {
    const candidates = await Promise.all([observedReceiptFixture(), observedReceiptFixture()]);
    const results = await Promise.all(candidates.map(envelope => dbPublishObservedReceipt(owner, owner, envelope, "a".repeat(64))));
    expect(results.map(row => row.status).sort()).toEqual(["duplicate", "inserted"]);
    if (results[0]!.status === "failed" || results[1]!.status === "failed") throw new Error("Publication failed");
    const envelope = results[0]!.envelope;
    expect(results[1]!.envelope).toEqual(envelope);
    const token = await issueReceiptVerificationV7(owner, owner, envelope);
    const verified = await getReceiptVerificationV7(token);
    expect(verified).toMatchObject({ signatureAuthenticated: true, envelope: { receipt: { policyVersion: "v7.2", core: { composite: { displayValue: 46 } } } } });
    await cleanup();
    expect((await getReceiptVerificationV7(token))?.status).toBe("revoked");
  });
  it("C15 repairs a partial write on unchanged retry and retains exactly one receipt", async () => {
    const envelope = await observedReceiptFixture();
    await dbPublishObservedReceipt(owner, owner, envelope, "b".repeat(64));
    vi.spyOn(env, "getChapaVerificationSecret").mockReturnValueOnce(undefined);
    expect(await issueScoreReceipt(owner)).toEqual({ status: "failed", reason: "storage_error" });
    expect((await db().from("scoring_v7_verification").select("receipt_id").eq("receipt_id", envelope.receipt.revisionId)).data).toEqual([]);
    expect(await issueScoreReceipt(owner)).toEqual({ status: "unchanged" });
    expect((await db().from("scoring_v7_verification").select("receipt_id").eq("receipt_id", envelope.receipt.revisionId)).data).toHaveLength(1);
    expect((await db().from("scoring_v7_receipts").select("id").eq("owner_handle", owner)).data).toEqual([{ id: envelope.receipt.revisionId }]);
  });

  it("C14 materialized A keeps recorded token A after B supersedes it", async () => {
    const a = await receiptFixtureV7("2026-09-01", 4);
    const b = await receiptFixtureV7("2026-09-01", 9, a.receipt);
    const publishedA = await dbPublishReceiptV7(owner, owner, a);
    const tokenA = await issueReceiptVerificationV7(owner, owner, a);
    const materialized = { stats: { handle: owner }, displayImpact: {}, statsComplete: true, scoring: receiptViewModel(owner, publishedA.snapshot) } as unknown as Parameters<typeof resolveBadgeVerification>[0];
    await dbPublishReceiptV7(owner, owner, b);
    await issueReceiptVerificationV7(owner, owner, b);
    expect((await dbReadReceiptV7(owner))!.receipt.receipt.revisionId).toBe(b.receipt.revisionId);
    expect(await resolveBadgeVerification(materialized)).toEqual({ hash: tokenA, date: "2026-09-01" });
    expect((await getReceiptVerificationV7(tokenA))?.status).toBe("superseded");
  });

  it("C16 cannot repair an envelope after withdrawal", async () => {
    const envelope = await receiptFixtureV7();
    await dbPublishReceiptV7(owner, owner, envelope);
    await cleanup();
    await expect(issueReceiptVerificationV7(owner, owner, envelope)).rejects.toThrow();
    expect((await db().from("scoring_v7_verification").select("receipt_id").eq("receipt_id", envelope.receipt.revisionId)).data).toEqual([]);
  });
});
