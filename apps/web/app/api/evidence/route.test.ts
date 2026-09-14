import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), write: vi.fn(), read: vi.fn(), artifact: vi.fn(), limit: vi.fn(), invalidate: vi.fn(), del: vi.fn(), capture: vi.fn(), withdraw: vi.fn() }));
vi.mock("@/lib/verification/cleanup", () => ({ withdrawReceiptPublicationV7: mocks.withdraw }));
vi.mock("@/lib/auth/resolve-request-auth", () => ({ resolveRequestAuth: mocks.auth }));
vi.mock("@/lib/cache/redis", () => ({ rateLimitStrict: mocks.limit, cacheDel: mocks.del }));
vi.mock("@/lib/profile/post-write-invalidation", () => ({ invalidateProfileReadModels: mocks.invalidate }));
vi.mock("@/lib/db/engineering-evidence", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/db/engineering-evidence")>(), dbWriteEngineeringEvidence: mocks.write, dbReadEngineeringEvidence: mocks.read, dbReadEngineeringArtifact: mocks.artifact }));
vi.mock("@/lib/analytics/server-errors", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/analytics/server-errors")>(), captureServerError: mocks.capture }));
import { POST, GET } from "./route";
import { LedgerStorageError } from "@/lib/db/engineering-evidence";
beforeEach(() => { vi.clearAllMocks(); mocks.limit.mockResolvedValue({ allowed: true }); mocks.auth.mockResolvedValue({ handle: "owner" }); mocks.write.mockResolvedValue({ success: true }); mocks.read.mockResolvedValue({ ownerId: "owner", claims: [] }); mocks.invalidate.mockResolvedValue(undefined); mocks.del.mockResolvedValue(true); mocks.withdraw.mockResolvedValue({ success: true, withdrawn: true, cleanup: { complete: true } }); });
const request = (body: unknown) => new NextRequest("http://localhost/api/evidence", { method: "POST", body: JSON.stringify(body) });
describe("private evidence route boundary", () => {
  it("requires authentication and applies a limit before authentication", async () => {
    mocks.limit.mockResolvedValue({ allowed: false });
    expect((await POST(request({}))).status).toBe(429); expect(mocks.auth).not.toHaveBeenCalled();
    mocks.limit.mockResolvedValue({ allowed: true }); mocks.auth.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(401); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("denies owner forgery before persistence", async () => {
    expect((await POST(request({ action: "withdraw", owner: "other", publicationAcknowledged: true }))).status).toBe(403);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("invalidates the supplemental private cache on withdrawal and returns no-store", async () => {
    const response = await POST(request({ action: "withdraw", owner: "owner", publicationAcknowledged: true }));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.withdraw).toHaveBeenCalledWith("owner", "owner", true);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("rejects oversized and undeclared trusted properties", async () => {
    expect((await POST(request({ action: "withdraw", owner: "owner", publicationAcknowledged: true, authorization: "forged" }))).status).toBe(400);
    expect((await POST(request({ value: "x".repeat(262145) }))).status).toBe(413);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("maps denied reads and revision conflicts without leaking database details", async () => {
    mocks.read.mockRejectedValue(new LedgerStorageError("42501"));
    expect((await GET(new NextRequest("http://localhost/api/evidence?owner=other"))).status).toBe(403);
    mocks.withdraw.mockRejectedValue(new LedgerStorageError("40001"));
    expect((await POST(request({ action: "withdraw", owner: "owner", publicationAcknowledged: true }))).status).toBe(409);
  });
  it("serves a single authorized raw body as JSON without fetching its locator", async () => {
    const ref = "00000000-0000-0000-0000-000000000000";
    mocks.artifact.mockResolvedValue({ referenceId: ref, body: "<script>untrusted</script>", expiresAt: "2026-09-06T00:00:00Z" });
    const response = await GET(new NextRequest(`http://localhost/api/evidence?artifactReferenceId=${ref}`));
    expect(response.status).toBe(200); expect(response.headers.get("content-type")).toContain("application/json");
    expect(mocks.artifact).toHaveBeenCalledWith("owner", "owner", ref);
  });
});

it("captures only a fixed error for unexpected private failures in both handlers", async () => {
  const privateDetail = "https://private.example.org/secret-artifact PRIVATE_BODY";
  mocks.auth.mockRejectedValue(new Error(privateDetail));
  for (const handler of [POST, GET]) {
    const response = await handler(new NextRequest("http://localhost/api/evidence"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toContain(privateDetail);
  }
  expect(mocks.capture).toHaveBeenCalledTimes(2);
  for (const [call] of mocks.capture.mock.calls) {
    expect(call.route).toBe("/api/evidence");
    expect(call.error.message).toBe("Evidence request failed");
    expect(call.error.stack).not.toContain(privateDetail);
    expect(call.error.cause).toBeUndefined();
  }
});

it("routes consent-off through atomic withdrawal and reports partial cache cleanup", async () => {
  mocks.withdraw.mockResolvedValue({ success: false, withdrawn: true, cleanup: { complete: false } });
  const response = await POST(request({ action: "consent", owner: "owner", enabled: false, publicationAcknowledged: true }));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ withdrawn: true, cleanup: { complete: false } });
  expect(mocks.withdraw).toHaveBeenCalledWith("owner", "owner", true);
  expect(mocks.write).not.toHaveBeenCalled();
});

it("returns accepted/pending for an empty withdrawal retry without inviting targeted retry", async () => {
  mocks.withdraw.mockResolvedValue({ success: false, withdrawn: true, cleanup: { complete: false, status: "pending" } });
  const response = await POST(request({ action: "withdraw", owner: "owner", publicationAcknowledged: true }));
  expect(response.status).toBe(202);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const body = await response.json();
  expect(body).toMatchObject({ withdrawn: true, cleanup: { complete: false, status: "pending" } });
  expect(JSON.stringify(body)).not.toContain("Retry cleanup");
});
