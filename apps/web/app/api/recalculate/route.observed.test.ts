import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ selection: vi.fn(), enqueueCollection: vi.fn(), scheduleCollectionAdvance: vi.fn(), postWriteScore: vi.fn(), materialize: vi.fn() }));
vi.mock("@/lib/auth/resolve-request-auth", () => ({ resolveRequestAuth: vi.fn().mockResolvedValue({ handle: "alice", token: "secret" }) }));
vi.mock("@/lib/cache/redis", () => ({ rateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock("@/lib/scoring-render-selection", () => ({ readScoringRenderSelection: mocks.selection }));
vi.mock("@/lib/profile/orchestrated-profile", () => ({ materializeOrchestratedProfile: mocks.materialize, persistOrchestratedSnapshot: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/collection/enqueue", () => ({ enqueueCollection: mocks.enqueueCollection, scheduleCollectionAdvance: mocks.scheduleCollectionAdvance }));
vi.mock("@/lib/profile/post-write-score", () => ({ postWriteScore: mocks.postWriteScore }));
vi.mock("@/lib/profile/post-write-invalidation", () => ({ invalidateProfileReadModels: vi.fn() }));
vi.mock("@/lib/cache/craft-cache", () => ({ updateCraftCache: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { POST } from "./route";
const selected = { enabled: true, machinePolicy: "v7.2", cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00Z") };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.selection.mockResolvedValue(selected);
  mocks.enqueueCollection.mockResolvedValue([]);
  mocks.materialize.mockResolvedValue({ stats: { handle: "alice" }, displayImpact: { adjustedComposite: 80 }, rawImpact: { adjustedComposite: 80 }, statsComplete: true, craftResult: null });
});
describe("#1335 phase 4: recalculate enqueues collection and reports the owner's ScoringStatus", () => {
  it("enqueues a refresh-reason collection job and reports the resulting scoring status", async () => {
    mocks.postWriteScore.mockResolvedValue({ kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false });
    const response = await POST(new NextRequest("https://chapa.test/api/recalculate", { method: "POST" }), undefined);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, scoringStatus: { kind: "collecting", percent: 40 }, legacy: { impact: { adjustedComposite: 80 } } });
    expect(mocks.enqueueCollection).toHaveBeenCalledWith("alice", "refresh");
    expect(mocks.scheduleCollectionAdvance).toHaveBeenCalledOnce();
    expect(mocks.postWriteScore).toHaveBeenCalledWith("alice", selected);
  });

  it("falls back to the plain legacy response when postWriteScore reports null (flag off or authority read failed)", async () => {
    mocks.postWriteScore.mockResolvedValue(null);
    const response = await POST(new NextRequest("https://chapa.test/api/recalculate", { method: "POST" }), undefined);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).not.toHaveProperty("scoringStatus");
    expect(body).toMatchObject({ success: true, adjustedComposite: 80 });
  });

  it("never enqueues collection while v7.2 rendering is off", async () => {
    mocks.selection.mockResolvedValue({ enabled: false, machinePolicy: "v6", cacheable: true, capturedAt: Date.now() });
    mocks.postWriteScore.mockResolvedValue(null);
    await POST(new NextRequest("https://chapa.test/api/recalculate", { method: "POST" }), undefined);
    expect(mocks.enqueueCollection).not.toHaveBeenCalled();
    expect(mocks.scheduleCollectionAdvance).not.toHaveBeenCalled();
  });
});
