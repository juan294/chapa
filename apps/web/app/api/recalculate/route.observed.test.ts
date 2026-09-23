import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ selection: vi.fn(), enqueueAndReportScoringStatus: vi.fn(), materialize: vi.fn() }));
vi.mock("@/lib/auth/resolve-request-auth", () => ({ resolveRequestAuth: vi.fn().mockResolvedValue({ handle: "alice", token: "secret" }) }));
vi.mock("@/lib/cache/redis", () => ({ rateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock("@/lib/scoring-render-selection", () => ({ readScoringRenderSelection: mocks.selection }));
vi.mock("@/lib/profile/orchestrated-profile", () => ({ materializeOrchestratedProfile: mocks.materialize, persistOrchestratedSnapshot: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/profile/post-write-score", () => ({ enqueueAndReportScoringStatus: mocks.enqueueAndReportScoringStatus }));
vi.mock("@/lib/profile/post-write-invalidation", () => ({ invalidateProfileReadModels: vi.fn() }));
vi.mock("@/lib/cache/craft-cache", () => ({ updateCraftCache: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { POST } from "./route";
const selected = { enabled: true, machinePolicy: "v7.2", cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00Z") };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.selection.mockResolvedValue(selected);
  mocks.materialize.mockResolvedValue({ stats: { handle: "alice" }, displayImpact: { adjustedComposite: 80 }, rawImpact: { adjustedComposite: 80 }, statsComplete: true, craftResult: null });
});
describe("#1335 phase 4: recalculate enqueues collection and reports the owner's ScoringStatus", () => {
  it("reports the resulting scoring status via the shared enqueue-then-report helper", async () => {
    mocks.enqueueAndReportScoringStatus.mockResolvedValue({ kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false });
    const response = await POST(new NextRequest("https://chapa.test/api/recalculate", { method: "POST" }), undefined);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, scoringStatus: { kind: "collecting", percent: 40 }, legacy: { impact: { adjustedComposite: 80 } } });
    expect(mocks.enqueueAndReportScoringStatus).toHaveBeenCalledWith("alice", "refresh", selected);
  });

  it("falls back to the plain legacy response when the helper reports null (flag off or authority read failed)", async () => {
    mocks.enqueueAndReportScoringStatus.mockResolvedValue(null);
    const response = await POST(new NextRequest("https://chapa.test/api/recalculate", { method: "POST" }), undefined);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).not.toHaveProperty("scoringStatus");
    expect(body).toMatchObject({ success: true, adjustedComposite: 80 });
  });
});
