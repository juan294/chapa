import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalJson } from "@chapa/shared";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
import { dbPublishObservedReceipt, dbReadObservedReceipt } from "./score-receipts-observed";
import { getSupabase } from "./supabase";
vi.mock("./supabase", () => ({ getSupabase: vi.fn() }));
const rpc = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getSupabase).mockReturnValue({ rpc } as unknown as NonNullable<ReturnType<typeof getSupabase>>); vi.spyOn(console, "error").mockImplementation(() => undefined); });
const stored = (envelope: Awaited<ReturnType<typeof observedReceiptFixture>>) => ({ revisionId: envelope.receipt.revisionId, policyVersion: "v7.2", contentHash: envelope.contentHash.value, canonicalReceipt: canonicalJson(envelope.receipt), semanticDigest: "a".repeat(64), trend: null, isCurrent: true });
describe("observed receipt storage adapter", () => {
  it("returns the authoritative concurrent winner rather than the losing prepared envelope", async () => {
    const candidate = await observedReceiptFixture(), winner = await observedReceiptFixture();
    rpc.mockResolvedValue({ data: { ...stored(winner), status: "duplicate" }, error: null });
    const result = await dbPublishObservedReceipt("Owner", "Owner", candidate, "a".repeat(64));
    expect(result).toMatchObject({ status: "duplicate", envelope: winner, isCurrent: true });
    expect(rpc).toHaveBeenCalledWith("scoring_observed_publish_receipt", expect.objectContaining({ p_owner: "owner", p_actor: "owner", p_semantic_digest: "a".repeat(64) }));
  });
  it("binds private core semantic metadata to the durable winner", async () => {
    const candidate = await observedReceiptFixture();
    rpc.mockResolvedValueOnce({ data: { ...stored(candidate), coreSemanticDigest: "c".repeat(64), status: "inserted" }, error: null });
    expect(await dbPublishObservedReceipt("owner", "owner", candidate, "a".repeat(64), "c".repeat(64))).toMatchObject({ status: "inserted", coreSemanticDigest: "c".repeat(64) });
    rpc.mockResolvedValueOnce({ data: { ...stored(candidate), coreSemanticDigest: "d".repeat(64), status: "duplicate" }, error: null });
    expect(await dbPublishObservedReceipt("owner", "owner", candidate, "a".repeat(64), "c".repeat(64))).toEqual({ status: "failed" });
  });
  it("reads only the observed policy RPC and exact requested revision", async () => {
    const winner = await observedReceiptFixture();
    rpc.mockResolvedValue({ data: stored(winner), error: null });
    expect(await dbReadObservedReceipt("Owner", winner.receipt.revisionId)).toMatchObject({ status: "found", envelope: winner });
    expect(rpc).toHaveBeenCalledWith("scoring_observed_read_receipt", { p_owner: "owner", p_revision: winner.receipt.revisionId });
  });
  it("keeps missing separate from database failure and mismatched policy", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await dbReadObservedReceipt("owner")).toEqual({ status: "missing" });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(await dbReadObservedReceipt("owner")).toEqual({ status: "unavailable" });
    rpc.mockResolvedValueOnce({ data: { ...stored(await observedReceiptFixture()), policyVersion: "v7" }, error: null });
    expect(await dbReadObservedReceipt("owner")).toEqual({ status: "unavailable" });
  });
  it("rejects a semantic winner mismatch and unavailable durable write", async () => {
    const candidate = await observedReceiptFixture();
    rpc.mockResolvedValueOnce({ data: { ...stored(candidate), semanticDigest: "b".repeat(64), status: "duplicate" }, error: null });
    expect(await dbPublishObservedReceipt("owner", "owner", candidate, "a".repeat(64))).toEqual({ status: "failed" });
    vi.mocked(getSupabase).mockReturnValue(null);
    expect(await dbPublishObservedReceipt("owner", "owner", candidate, "a".repeat(64))).toEqual({ status: "failed" });
  });
});
