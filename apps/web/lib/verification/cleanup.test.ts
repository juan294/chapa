import { beforeEach, expect, it, vi } from "vitest";
import { sweepRevokedReceiptCachesV7, withdrawReceiptPublicationV7 } from "./cleanup";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/db/verification", () => ({ dbVerificationRpcV7: mocks.rpc }));
vi.mock("@/lib/cache/redis", () => ({ cacheGet: mocks.get, cacheSet: mocks.set, cacheDel: mocks.del }));
vi.mock("@/lib/cache/snapshot-cache", () => ({ buildReceiptSnapshotKeyV7: (id: string) => `snapshot:v7:receipt:${id}` }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => { vi.resetAllMocks(); mocks.get.mockResolvedValue(null); mocks.set.mockResolvedValue(true); });
it("keeps failed batch eligible for retry and reports incomplete cleanup", async () => {
  mocks.rpc.mockResolvedValue([id]); mocks.del.mockResolvedValue(false);
  expect(await sweepRevokedReceiptCachesV7()).toEqual({ attempted: 1, deleted: 0, failed: 1, cursorSaved: false });
  expect(mocks.set).not.toHaveBeenCalled();
});
it("cycles tombstones again so a delayed cache write is swept on a later pass", async () => {
  mocks.rpc.mockResolvedValueOnce([id]).mockResolvedValueOnce([]).mockResolvedValueOnce([id]);
  mocks.del.mockResolvedValue(true);
  await sweepRevokedReceiptCachesV7(); await sweepRevokedReceiptCachesV7(); await sweepRevokedReceiptCachesV7();
  expect(mocks.del).toHaveBeenCalledTimes(2);
  expect(mocks.del).toHaveBeenCalledWith(`snapshot:v7:receipt:${id}`);
  expect(mocks.set).toHaveBeenNthCalledWith(2, "scoring:v7:revocation-sweep-cursor", null, 0);
});

it("awaits captured receipt and private-copy deletion after durable withdrawal", async () => {
  mocks.rpc.mockResolvedValue([id]);
  let finish!: (value: boolean) => void;
  mocks.del.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; })).mockResolvedValue(true);
  let settled = false;
  const pending = withdrawReceiptPublicationV7("owner", "owner", true).then(result => { settled = true; return result; });
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(settled).toBe(false);
  finish(true);
  expect(await pending).toMatchObject({ withdrawn: true, cleanup: { complete: true } });
  expect(mocks.del.mock.calls.map(([key]) => key)).toEqual([`snapshot:v7:receipt:${id}`, "supplemental:v7:owner"]);
});
it("reports private cleanup failure without claiming withdrawal failed", async () => {
  mocks.rpc.mockResolvedValue([id]);
  mocks.del.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("private failure")).mockResolvedValueOnce(true);
  expect(await withdrawReceiptPublicationV7("owner", "owner", true)).toEqual({ success: false, withdrawn: true, cleanup: { complete: false, status: "failed", receipts: { attempted: 1, deleted: 0, failed: 1 }, privateCopies: { attempted: 1, deleted: 0, failed: 1 } } });
});

it("cannot confirm an earlier failed receipt deletion from an empty retry batch", async () => {
  const retained = new Set([`snapshot:v7:receipt:${id}`]);
  mocks.rpc.mockResolvedValueOnce([id]).mockResolvedValueOnce([]);
  mocks.del.mockImplementation(async key => !retained.has(key));
  const first = await withdrawReceiptPublicationV7("owner", "owner", true);
  expect(first.cleanup.complete).toBe(false);
  expect(first.cleanup.receipts.failed).toBe(1);
  const retried = await withdrawReceiptPublicationV7("owner", "owner", true);
  expect(retried).toMatchObject({ success: false, withdrawn: true, cleanup: { complete: false, status: "pending" } });
  expect(retained.size).toBe(1);
  expect(mocks.del).toHaveBeenLastCalledWith("supplemental:v7:owner");
});
