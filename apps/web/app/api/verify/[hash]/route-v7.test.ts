import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ read: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/verification/store", () => ({ getReceiptVerificationV7: mocks.read, getVerificationRecord: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ rateLimit: mocks.limit }));
vi.mock("@/lib/http/client-ip", () => ({ getClientIp: () => "test" }));
vi.mock("@/lib/env", () => ({ getBaseUrl: () => "https://example.test" }));
import { GET, POST } from "./route";
const token = `v7.11111111-1111-4111-8111-111111111111.${"0".repeat(64)}`;
const ctx = (hash = token) => ({ params: Promise.resolve({ hash }) });
beforeEach(() => { vi.resetAllMocks(); mocks.limit.mockResolvedValue({ allowed: true }); });
it("marks revoked UUIDs unauthenticated and never caches the response", async () => {
  mocks.read.mockResolvedValue({ version: "v7", status: "revoked", signatureAuthenticated: false });
  const response = await GET(new NextRequest(`https://example.test/api/verify/${token}`), ctx());
  expect(response.status).toBe(410);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ signatureAuthenticated: false });
});
it("does not echo invalid private submissions or storage errors", async () => {
  const response = await POST(new NextRequest(`https://example.test/api/verify/${token}`, { method: "POST", body: "private project secret" }), ctx());
  expect(response.status).toBe(400);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.text()).not.toContain("private project");
  expect(mocks.read).not.toHaveBeenCalled();
});
it("bounds the body before receipt validation", async () => {
  const response = await POST(new NextRequest(`https://example.test/api/verify/${token}`, { method: "POST", body: "x".repeat(2 * 1024 * 1024 + 1) }), ctx());
  expect(response.status).toBe(413);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("fails closed with no-store on lookup errors and malformed v7 tokens", async () => {
  mocks.read.mockRejectedValue(new Error("private storage detail"));
  const response = await GET(new NextRequest(`https://example.test/api/verify/${token}`), ctx());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private storage");
  const invalid = await GET(new NextRequest("https://example.test/api/verify/v7.bad"), ctx("v7.bad"));
  expect(invalid.status).toBe(400);
  expect(invalid.headers.get("Cache-Control")).toBe("no-store");
});

it("rejects malformed UTF-8 rather than replacing bytes", async () => {
  const response = await POST(new NextRequest(`https://example.test/api/verify/${token}`, { method: "POST", body: new Uint8Array([0x22, 0xff, 0x22]) }), ctx());
  expect(response.status).toBe(400);
  expect(mocks.read).not.toHaveBeenCalled();
});
