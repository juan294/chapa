import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), store: vi.fn(), read: vi.fn(), rate: vi.fn(), invalidate: vi.fn(), dirty: vi.fn() }));
vi.mock("@/lib/auth/resolve-request-auth", () => ({ resolveRequestAuth: mocks.auth }));
vi.mock("@/lib/cache/redis", () => ({ cacheSet: vi.fn(), cacheDel: vi.fn(), rateLimitStrict: mocks.rate }));
vi.mock("@/lib/cache/dirty-stats", () => ({ markStatsDirty: mocks.dirty }));
vi.mock("@/lib/db/supplemental-v7", () => ({ dbStoreSupplementalEvidenceV2: mocks.store, readSupplementalEvidenceV2: mocks.read }));
vi.mock("@/lib/profile/post-write-invalidation", () => ({ invalidateProfileReadModels: mocks.invalidate }));
import { POST } from "./route";
const value = { schemaVersion: "supplemental-v2", targetHandle: "alice", source: { provider: "github", host: "github.com", subjectId: "work-42", handle: "alice-work" },
  observationPeriod: { startInclusive: "2026-01-01T00:00:00.000Z", endExclusive: "2026-02-01T00:00:00.000Z" }, observedThrough: "2026-02-01T00:00:00.000Z", events: [] };
function request(body: unknown = value, token = true) {
  return new NextRequest("https://chapa.test/api/supplemental", { method: "POST", body: JSON.stringify(body), headers: token ? { Authorization: "Bearer cli-test" } : {} });
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ handle: "alice" }); mocks.rate.mockResolvedValue({ allowed: true });
  mocks.store.mockResolvedValue({ uploadId: "stored", uploadedAt: new Date().toISOString(), value }); mocks.read.mockResolvedValue({ cacheRefreshed: true });
});
describe("versioned supplemental upload route", () => {
  it("commits dated declarations and returns their self-reported eligibility without a fabricated score", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, persisted: true, schemaVersion: "supplemental-v2", uploadId: "stored", cacheRefreshed: true, eligibility: "dated_self_reported", coverage: "partial" });
    expect(mocks.store.mock.calls[0]?.[0]).toBe("alice");
    expect(mocks.invalidate).toHaveBeenCalled(); expect(mocks.dirty).toHaveBeenCalledWith("alice");
  });
  it("does not publish or invalidate before the durable transaction commits", async () => {
    let resolve!: (value: unknown) => void;
    mocks.store.mockReturnValue(new Promise(done => { resolve = done; }));
    const response = POST(request());
    await vi.waitFor(() => expect(mocks.store).toHaveBeenCalled());
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
    resolve({ uploadId: "stored", uploadedAt: new Date().toISOString(), value });
    expect((await response).status).toBe(200);
  });
  it("requires a bearer token and target ownership before the owner quota or persistence", async () => {
    expect((await POST(request(value, false))).status).toBe(401);
    expect((await POST(request({ ...value, targetHandle: "bob" }))).status).toBe(403);
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.rate.mock.calls.filter(([key]) => String(key).startsWith("ratelimit:supplemental:bob"))).toHaveLength(0);
  });
  it.each([{ provenance: "source_observed" }, { assessments: [] }, { events: [{ actorId: "other" }] }, { source: "primary" }])("rejects forged source authority %j", patch => {
    return POST(request({ ...value, ...patch })).then(response => { expect(response.status).toBe(400); expect(mocks.store).not.toHaveBeenCalled(); });
  });
  it("reports database failure without exposing private storage errors or publishing", async () => {
    mocks.store.mockRejectedValue(new Error("PRIVATE UPLOAD CONTENT"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("PRIVATE UPLOAD");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("keeps durable success explicit when a later cache rebuild fails", async () => {
    mocks.read.mockRejectedValue(new Error("CACHE FAILED"));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ persisted: true, cacheRefreshed: false });
  });
  it("honors owner rate limits without any writes", async () => {
    mocks.rate.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.store).not.toHaveBeenCalled();
  });
});

it("returns a conflict without claiming persistence or rebuilding caches", async () => {
  const { SupplementalEvidenceConflict } = await import("@/lib/platform/evidence-aging");
  mocks.store.mockRejectedValue(new SupplementalEvidenceConflict());
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ success: false, persisted: false });
  expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
});
