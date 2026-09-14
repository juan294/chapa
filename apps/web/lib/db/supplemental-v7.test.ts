import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), cacheGet: vi.fn(), cacheSet: vi.fn(), cacheDel: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabase: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/cache/redis", () => ({ cacheGet: mocks.cacheGet, cacheSet: mocks.cacheSet, cacheDel: mocks.cacheDel }));
import { dbStoreSupplementalEvidenceV2, readSupplementalEvidenceV2 } from "./supplemental-v7";
const reference = "2026-09-05T12:00:00.000Z";
const window = createScoringWindow(reference);
const value = { schemaVersion: "supplemental-v2" as const, targetHandle: "alice",
  source: { provider: "github" as const, host: "github.com", subjectId: "work-42", handle: "alice-work" },
  observationPeriod: { startInclusive: "2025-09-06T00:00:00.000Z", endExclusive: reference }, observedThrough: reference, events: [] };
const record = { uploadId: "row-1", uploadedAt: reference, value };
const manifest = [{ uploadId: record.uploadId, uploadedAt: record.uploadedAt }];
beforeEach(() => {
  vi.resetAllMocks(); mocks.cacheGet.mockResolvedValue(null); mocks.cacheSet.mockResolvedValue(true); mocks.cacheDel.mockResolvedValue(true);
});
describe("durable supplemental v2 publication", () => {
  it("commits before any cache publication and never publishes on database failure", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "write failed" } });
    await expect(dbStoreSupplementalEvidenceV2("alice", value, reference)).rejects.toThrow();
    expect(mocks.cacheSet).not.toHaveBeenCalled(); expect(mocks.cacheDel).not.toHaveBeenCalled();
  });
  it("derives the actor from server context and hashes canonical data", async () => {
    mocks.rpc.mockResolvedValue({ data: record, error: null });
    expect(await dbStoreSupplementalEvidenceV2("Alice", value, reference)).toEqual(record);
    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({ p_owner: "alice", p_actor: "alice", p_value: value });
    expect(mocks.rpc.mock.calls[0]?.[1].p_digest).toMatch(/^[a-f0-9]{64}$/);
    const firstDigest = mocks.rpc.mock.calls[0]?.[1].p_digest;
    await dbStoreSupplementalEvidenceV2("alice", Object.fromEntries(Object.entries(value).reverse()) as typeof value, reference);
    expect(mocks.rpc.mock.calls[1]?.[1].p_digest).toBe(firstDigest);
  });
  it("rejects a malformed success response and owner mismatch", async () => {
    mocks.rpc.mockResolvedValue({ data: { uploadId: "row" }, error: null });
    await expect(dbStoreSupplementalEvidenceV2("alice", value, reference)).rejects.toThrow();
    await expect(dbStoreSupplementalEvidenceV2("bob", value, reference)).rejects.toThrow();
  });
});
describe("fresh supplemental reads with retired cache cleanup", () => {
  it("requires an authorized current manifest and never consumes a private Redis copy", async () => {
    mocks.cacheGet.mockResolvedValue({ owner: "alice", manifest, records: [record] });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(readSupplementalEvidenceV2("alice", window)).rejects.toThrow();
    expect(mocks.cacheGet).not.toHaveBeenCalled();
    expect(mocks.cacheSet).not.toHaveBeenCalled();
    expect(mocks.cacheDel).toHaveBeenCalledWith("supplemental:v7:alice");
  });
  it("reads committed records and checks the final manifest without caching private content", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: manifest, error: null }).mockResolvedValueOnce({ data: [record], error: null }).mockResolvedValueOnce({ data: manifest, error: null });
    const result = await readSupplementalEvidenceV2("alice", window);
    expect(result.evidence.scope.sources).toHaveLength(1);
    expect(result.cacheRefreshed).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
    expect(mocks.cacheGet).not.toHaveBeenCalled(); expect(mocks.cacheSet).not.toHaveBeenCalled();
  });
  it("cannot return records withdrawn while a durable read was in flight", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: manifest, error: null }).mockResolvedValueOnce({ data: [record], error: null }).mockResolvedValueOnce({ data: [], error: null });
    await expect(readSupplementalEvidenceV2("alice", window)).rejects.toThrow("changed during read");
    expect(mocks.cacheSet).not.toHaveBeenCalled();
  });
  it("does not return false empty evidence when committed payloads disappear", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: manifest, error: null }).mockResolvedValueOnce({ data: [], error: null });
    await expect(readSupplementalEvidenceV2("alice", window)).rejects.toThrow();
  });
  it("reports failed retired-key cleanup explicitly while retaining authorized evidence", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: manifest, error: null }).mockResolvedValueOnce({ data: [record], error: null }).mockResolvedValueOnce({ data: manifest, error: null });
    mocks.cacheDel.mockResolvedValue(false);
    const result = await readSupplementalEvidenceV2("alice", window);
    expect(result.cacheRefreshed).toBe(false);
    expect(result.evidence.scope.sources).toHaveLength(1);
  });
  it("empty manifests expose no withdrawn evidence", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const result = await readSupplementalEvidenceV2("alice", window);
    expect(result.evidence.events).toEqual([]); expect(result.evidence.scope.sources).toEqual([]);
  });
});

it("reports immutable event conflicts separately from storage outages and leaves caches untouched", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "private SQL detail" } });
  await expect(dbStoreSupplementalEvidenceV2("alice", value, reference)).rejects.toMatchObject({ name: "SupplementalEvidenceConflict" });
  expect(mocks.cacheSet).not.toHaveBeenCalled(); expect(mocks.cacheDel).not.toHaveBeenCalled();
});
