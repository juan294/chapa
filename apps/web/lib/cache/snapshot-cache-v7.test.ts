import { beforeEach, describe, expect, it, vi } from "vitest";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { dbReceiptManifestV7, dbReadReceiptV7 } from "@/lib/db/snapshots";
import { cacheGet, cacheSet, cacheDel } from "./redis";
import { getCachedReceiptSnapshotV7, buildReceiptSnapshotKeyV7 } from "./snapshot-cache";
vi.mock("./redis", () => ({ cacheGet: vi.fn(), cacheSet: vi.fn(), cacheDel: vi.fn() }));
vi.mock("@/lib/db/snapshots", () => ({ dbGetLatestSnapshot: vi.fn(), dbReceiptManifestV7: vi.fn(), dbReadReceiptV7: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(cacheDel).mockResolvedValue(true); });
describe("authorized v7 receipt cache", () => {
  it("checks consent before hits and again after delayed reads", async () => {
    const receipt = await receiptFixtureV7();
    const manifest = { revisionId: receipt.receipt.revisionId, policyVersion: "v7" as const, trend: null };
    vi.mocked(dbReceiptManifestV7).mockResolvedValueOnce(null);
    expect(await getCachedReceiptSnapshotV7("owner")).toBeNull();
    expect(cacheGet).not.toHaveBeenCalled();
    vi.mocked(dbReceiptManifestV7).mockResolvedValueOnce(manifest).mockResolvedValueOnce(null);
    vi.mocked(cacheGet).mockResolvedValue(receipt);
    expect(await getCachedReceiptSnapshotV7("owner")).toBeNull();
    expect(dbReadReceiptV7).not.toHaveBeenCalled();
  });
  it("removes a delayed cache SET that completes after the withdrawal purge, awaiting deletion", async () => {
    const envelope = await receiptFixtureV7();
    const manifest = { revisionId: envelope.receipt.revisionId, policyVersion: "v7" as const, trend: null };
    const key = buildReceiptSnapshotKeyV7(envelope.receipt.revisionId);
    expect(key).toBe(`snapshot:v7:receipt:${envelope.receipt.revisionId}`);
    const stored = new Map<string, unknown>();
    let startSet!: () => void, completeSet!: () => void, startDelete!: () => void, completeDelete!: () => void;
    const setting = new Promise<void>(resolve => { startSet = resolve; });
    const setWait = new Promise<void>(resolve => { completeSet = resolve; });
    const deleting = new Promise<void>(resolve => { startDelete = resolve; });
    const deleteWait = new Promise<void>(resolve => { completeDelete = resolve; });
    vi.mocked(dbReceiptManifestV7).mockResolvedValueOnce(manifest).mockResolvedValueOnce(null);
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbReadReceiptV7).mockResolvedValue({ version: "v7", replayStatus: "replayable", receipt: envelope, trend: { status: "gap", referenceDate: envelope.receipt.window.referenceDate, reason: "missing" } });
    vi.mocked(cacheSet).mockImplementation(async (key, value) => { startSet(); await setWait; stored.set(key, value); return true; });
    vi.mocked(cacheDel).mockImplementation(async key => { startDelete(); await deleteWait; stored.delete(key); return true; });
    let settled = false;
    const request = getCachedReceiptSnapshotV7("owner").then(value => { settled = true; return value; });
    await setting;
    stored.delete(key); // Withdrawal purges before this request's delayed SET completes.
    completeSet();
    await deleting;
    expect(stored.has(key)).toBe(true);
    expect(settled).toBe(false);
    completeDelete();
    expect(await request).toBeNull();
    expect(stored.has(key)).toBe(false);
    expect(cacheDel).toHaveBeenCalledWith(key);
  });
  it("cleans up on final authorization errors and explicitly reports failed deletion", async () => {
    const envelope = await receiptFixtureV7();
    const manifest = { revisionId: envelope.receipt.revisionId, policyVersion: "v7" as const, trend: null };
    vi.mocked(cacheGet).mockResolvedValue(envelope);
    vi.mocked(dbReceiptManifestV7).mockResolvedValueOnce(manifest).mockRejectedValueOnce(new Error("authorization unavailable"));
    await expect(getCachedReceiptSnapshotV7("owner")).rejects.toThrow("authorization unavailable");
    expect(cacheDel).toHaveBeenCalledWith(buildReceiptSnapshotKeyV7(envelope.receipt.revisionId));
    vi.mocked(dbReceiptManifestV7).mockResolvedValueOnce(manifest).mockResolvedValueOnce(null);
    vi.mocked(cacheDel).mockResolvedValueOnce(false);
    await expect(getCachedReceiptSnapshotV7("owner")).rejects.toMatchObject({ code: "receipt_cache_cleanup_failed" });
    vi.mocked(dbReceiptManifestV7).mockResolvedValueOnce(manifest).mockRejectedValueOnce(new Error("authorization unavailable"));
    vi.mocked(cacheDel).mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(getCachedReceiptSnapshotV7("owner")).rejects.toMatchObject({ code: "receipt_cache_cleanup_failed" });
  });
  it("detaches validated cache content before the final authorization await", async () => {
    const original = await receiptFixtureV7();
    const mutable = structuredClone(original);
    const manifest = { revisionId: original.receipt.revisionId, policyVersion: "v7" as const, trend: null };
    vi.mocked(cacheGet).mockResolvedValue(mutable);
    vi.mocked(dbReceiptManifestV7).mockResolvedValueOnce(manifest).mockImplementationOnce(async () => {
      Object.assign(mutable.receipt, { subjectRef: "private-identity" });
      return manifest;
    });
    const result = await getCachedReceiptSnapshotV7("owner");
    expect(result?.receipt).toEqual(original);
    expect(result?.receipt).not.toBe(mutable);
    expect(Object.isFrozen(result?.receipt.receipt)).toBe(true);
  });
  it("never falls back to cache after authorization/storage failure", async () => {
    vi.mocked(dbReceiptManifestV7).mockRejectedValue(new Error("unavailable"));
    await expect(getCachedReceiptSnapshotV7("owner")).rejects.toThrow();
    expect(cacheGet).not.toHaveBeenCalled(); expect(cacheSet).not.toHaveBeenCalled();
  });
  it("returns receipt raw output separately from exact unrounded trend", async () => {
    const receipt = await receiptFixtureV7();
    const raw = receipt.receipt.core.composite;
    if (raw.kind !== "point") throw new Error("Expected point");
    const trend = { policyVersion: "v7" as const, referenceDate: receipt.receipt.window.referenceDate, receiptRevisionId: receipt.receipt.revisionId, rawPoint: raw.value, unroundedValue: 60.123456789, previousAnchorRevisionId: null };
    vi.mocked(dbReceiptManifestV7).mockResolvedValue({ revisionId: receipt.receipt.revisionId, policyVersion: "v7", trend });
    vi.mocked(cacheGet).mockResolvedValue(receipt);
    expect(await getCachedReceiptSnapshotV7("owner")).toMatchObject({ receipt, trend: { status: "point", anchor: { unroundedValue: 60.123456789 } } });
  });
});
