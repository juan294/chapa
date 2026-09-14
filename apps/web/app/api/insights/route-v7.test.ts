import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ store: vi.fn(), auth: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/auth/resolve-request-auth", () => ({ resolveRequestAuth: mocks.auth }));
vi.mock("@/lib/feature-flags", () => ({ isInsightsEnabled: () => true }));
vi.mock("@/lib/cache/redis", () => ({ rateLimitStrict: mocks.rate }));
vi.mock("@/lib/db/craft-v7", () => ({ dbStoreCraftReportV7: mocks.store }));
vi.mock("@/lib/profile/post-write-invalidation", () => ({ invalidateProfileReadModels: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { POST } from "./route";
const data = { schemaVersion: "v7", tool: "claude-code", reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
  totalSessions: 10, outcomes: { fully_achieved: 1 }, satisfaction: { likely_satisfied: 1 }, toolUsage: {}, totalToolCalls: 0,
  responseTime: { medianSeconds: null, averageSeconds: null }, volume: null, sessionTypes: null, friction: null, toolErrors: null, multiClauding: null };
function request(body: unknown = data) { return new NextRequest("https://chapa.test/api/insights", { method: "POST", body: JSON.stringify(body) }); }
beforeEach(() => { mocks.auth.mockResolvedValue({ handle: "owner" }); mocks.rate.mockResolvedValue({ allowed: true }); mocks.store.mockResolvedValue({ uploadId: "stored" }); });
describe("v7 insights route", () => {
  it("uses authenticated ownership, persists diagnostics only and returns no fabricated Craft rating", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.store.mock.calls[0]?.[0]).toBe("owner");
    expect(await response.json()).toMatchObject({ success: true, persisted: true, schemaVersion: "v7", uploadId: "stored" });
  });
  it("cannot submit purported independent assessments through report upload", async () => {
    expect((await POST(request({ ...data, episodes: [{ assessments: [{ status: "accepted" }] }] }))).status).toBe(400);
  });
  it("does not claim success when durable persistence failed", async () => {
    mocks.store.mockRejectedValue(new Error("PRIVATE REPORT CONTENT"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("PRIVATE REPORT");
  });
});
