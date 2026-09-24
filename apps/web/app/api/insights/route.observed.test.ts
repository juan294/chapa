import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ store: vi.fn(), prepare: vi.fn(), materialize: vi.fn(), verify: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/db/report-craft", () => ({ dbStoreReportCraft: mocks.store }));
vi.mock("@/lib/insights/report-craft-import", () => ({ prepareReportCraftImport: mocks.prepare }));
vi.mock("@/lib/profile/issue-receipt", () => ({ materializeCurrentObservedReceipt: mocks.materialize }));
vi.mock("@/lib/verification/store", () => ({ issueReceiptVerificationV7: mocks.verify }));
vi.mock("@/lib/render/badge-svg-cache", () => ({ invalidateBadgeSvgCacheForHandle: mocks.invalidate, isBadgeCacheRefreshed: (r: { refreshed: boolean }) => r.refreshed }));
vi.mock("@/lib/auth/resolve-request-auth", () => ({ resolveRequestAuth: vi.fn(async () => ({ handle: "alice" })) }));
vi.mock("@/lib/cache/redis", () => ({ rateLimitStrict: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/feature-flags", () => ({ isInsightsEnabled: vi.fn(async () => true) }));
vi.mock("@/lib/profile/post-write-invalidation", () => ({ invalidateProfileReadModels: vi.fn() }));
vi.mock("@/lib/db/tool-insights", () => ({ dbUpsertToolInsights: vi.fn() }));
vi.mock("@/lib/db/craft-v7", () => ({ dbStoreCraftReportV7: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { POST } from "./route";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
const request = () => new NextRequest("http://localhost/api/insights", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ schemaVersion: "v7.2", report: {} }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prepare.mockResolvedValue({ calculation: { inputs: { reportPeriod: { endExclusive: "2026-09-07T12:00:00.000Z" } } } });
  mocks.store.mockResolvedValue({ status: "stored", persisted: true, reportId: "report", selection: "selected", consented: true });
  mocks.invalidate.mockResolvedValue({ refreshed: true });
  mocks.verify.mockResolvedValue("token");
});
it("separates persistence from failed publication and makes an identical retry repair verification and purge", async () => {
  const snapshot = { receipt: await observedReceiptFixture(), trend: null };
  mocks.materialize.mockResolvedValue({ status: "stored", snapshot, freshness: "current" });
  mocks.verify.mockRejectedValueOnce(new Error("verification unavailable"));
  expect(await (await POST(request())).json()).toMatchObject({ persisted: true, publication: "pending", refreshed: false });
  expect(await (await POST(request())).json()).toMatchObject({ persisted: true, publication: "unchanged", refreshed: true, scoring: { policyVersion: "v7.2" } });
  expect(mocks.verify).toHaveBeenCalledTimes(2);
  expect(mocks.invalidate).toHaveBeenCalledTimes(1);
});
it("returns an explicit same-period correction identity without issuing", async () => {
  mocks.store.mockResolvedValue({ status: "correction_required", persisted: false, supersedesReportId: "selected-report" });
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: "same_period_requires_explicit_correction", supersedesReportId: "selected-report" });
  expect(mocks.materialize).not.toHaveBeenCalled();
});

it("rejects a negotiated legacy browser after policy enablement before writing", async () => {
  const response = await POST(new NextRequest("http://localhost/api/insights", { method: "POST", headers: { "X-Chapa-Scoring-Policy": "v6" }, body: JSON.stringify({ tool: "claude-code" }) }));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: "policy_changed", persisted: false });
});

it("uses first server ingestion time even when cached policy lookup predates UTC midnight", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2026-09-08T00:00:02.000Z"));
    mocks.store.mockResolvedValue({ status: "consent_required", persisted: false });
    await POST(request());
    expect(mocks.prepare).toHaveBeenCalledWith({}, "2026-09-08T00:00:02.000Z");
  } finally { vi.useRealTimers(); }
});

it("identifies an insufficient import separately from its retained public score", async () => {
  mocks.store.mockResolvedValue({ status: "stored", persisted: true, reportId: "insufficient", selection: "insufficient", consented: true });
  mocks.materialize.mockResolvedValue({ status: "stored", snapshot: { receipt: await observedReceiptFixture(), trend: null }, freshness: "current" });
  expect(await (await POST(request())).json()).toMatchObject({ persisted: true, publication: "unchanged", reportSelection: "insufficient" });
});
