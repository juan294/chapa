import { beforeEach, describe, expect, it, vi } from "vitest";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
import { dbObservedReceiptManifest, dbReadObservedReceipt } from "@/lib/db/score-receipts-observed";
import { cacheGet, cacheSet } from "./redis";
import { getCachedObservedReceipt, buildObservedReceiptKey } from "./snapshot-cache-observed";
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbObservedReceiptManifest: vi.fn(), dbReadObservedReceipt: vi.fn() }));
vi.mock("./redis", () => ({ cacheGet: vi.fn(), cacheSet: vi.fn(), cacheDel: vi.fn().mockResolvedValue(true) }));
beforeEach(() => { vi.clearAllMocks(); });
describe("observed immutable receipt cache", () => {
  it("never consults Redis when current consent/read status is missing", async () => {
    vi.mocked(dbObservedReceiptManifest).mockResolvedValue({ status: "missing" });
    expect(await getCachedObservedReceipt("owner")).toEqual({ status: "missing" });
    expect(cacheGet).not.toHaveBeenCalled();
  });
  it("keys bytes by policy/revision and rechecks authority after a cache hit", async () => {
    const envelope = await observedReceiptFixture();
    const manifest = { revisionId: envelope.receipt.revisionId, policyVersion: "v7.2" as const, contentHash: envelope.contentHash.value, semanticDigest: "a".repeat(64), trend: null, isCurrent: true };
    vi.mocked(dbObservedReceiptManifest).mockResolvedValueOnce({ status: "found", manifest }).mockResolvedValueOnce({ status: "missing" });
    vi.mocked(cacheGet).mockResolvedValue(envelope);
    expect(await getCachedObservedReceipt("owner")).toEqual({ status: "missing" });
    expect(cacheGet).toHaveBeenCalledWith(buildObservedReceiptKey(envelope.receipt.revisionId));
    expect(dbReadObservedReceipt).not.toHaveBeenCalled();
  });
  it("falls back to authorized storage when cached bytes carry another revision", async () => {
    const envelope = await observedReceiptFixture(), wrong = await observedReceiptFixture();
    const manifest = { revisionId: envelope.receipt.revisionId, policyVersion: "v7.2" as const, contentHash: envelope.contentHash.value, semanticDigest: "a".repeat(64), trend: null, isCurrent: true };
    vi.mocked(dbObservedReceiptManifest).mockResolvedValue({ status: "found", manifest });
    vi.mocked(cacheGet).mockResolvedValue(wrong);
    vi.mocked(dbReadObservedReceipt).mockResolvedValue({ status: "found", envelope, semanticDigest: manifest.semanticDigest, trend: null, isCurrent: true });
    expect(await getCachedObservedReceipt("owner")).toMatchObject({ status: "found", envelope });
    expect(dbReadObservedReceipt).toHaveBeenCalledWith("owner", envelope.receipt.revisionId);
    expect(cacheSet).toHaveBeenCalledWith(buildObservedReceiptKey(envelope.receipt.revisionId), envelope, 86400);
  });
  it("rejects a validly resealed altered score with the same revision UUID", async () => {
    const envelope = await observedReceiptFixture();
    const forged = await observedReceiptFixture({ delivery: 1, receiptId: envelope.receipt.receiptId, revisionId: envelope.receipt.revisionId });
    const manifest = { revisionId: envelope.receipt.revisionId, policyVersion: "v7.2" as const, contentHash: envelope.contentHash.value, semanticDigest: "a".repeat(64), trend: null, isCurrent: true };
    vi.mocked(dbObservedReceiptManifest).mockResolvedValue({ status: "found", manifest });
    vi.mocked(cacheGet).mockResolvedValue(forged);
    vi.mocked(dbReadObservedReceipt).mockResolvedValue({ status: "found", envelope, semanticDigest: manifest.semanticDigest, trend: null, isCurrent: true });
    expect(await getCachedObservedReceipt("owner")).toMatchObject({ status: "found", envelope });
    expect(dbReadObservedReceipt).toHaveBeenCalledWith("owner", envelope.receipt.revisionId);
  });
});
