import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDbUpdateFeatureFlag = vi.fn();
vi.mock("@/lib/db/feature-flags", () => ({
  dbUpdateFeatureFlag: (...args: unknown[]) => mockDbUpdateFeatureFlag(...args),
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/cache/redis", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: () => "127.0.0.1",
}));

const mockReadSessionCookie = vi.fn();
vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: (...args: unknown[]) => mockReadSessionCookie(...args),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: (handle: string) => handle === "admin-user",
}));

import { PATCH } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3001/api/admin/feature-flags", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      cookie: "chapa_session=valid-token",
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/feature-flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
    mockReadSessionCookie.mockReturnValue({
      login: "admin-user",
      token: "tok",
      name: null,
      avatar_url: "",
    });
    mockDbUpdateFeatureFlag.mockResolvedValue(true);
  });

  it("updates a feature flag", async () => {
    const res = await PATCH(makeRequest({ key: "coverage_agent", enabled: true }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockDbUpdateFeatureFlag).toHaveBeenCalledWith("coverage_agent", {
      enabled: true,
    });
  });

  it("updates config when provided", async () => {
    const res = await PATCH(
      makeRequest({
        key: "coverage_agent",
        config: { prompt: "custom" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockDbUpdateFeatureFlag).toHaveBeenCalledWith("coverage_agent", {
      config: { prompt: "custom" },
    });
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const res = await PATCH(makeRequest({ key: "test", enabled: true }));
    expect(res.status).toBe(429);
  });

  it("returns 401 when no session", async () => {
    mockReadSessionCookie.mockReturnValue(null);

    const res = await PATCH(makeRequest({ key: "test", enabled: true }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockReadSessionCookie.mockReturnValue({
      login: "regular-user",
      token: "tok",
      name: null,
      avatar_url: "",
    });

    const res = await PATCH(makeRequest({ key: "test", enabled: true }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when key is missing", async () => {
    const res = await PATCH(makeRequest({ enabled: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no updates provided", async () => {
    const res = await PATCH(makeRequest({ key: "test" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when DB update fails", async () => {
    mockDbUpdateFeatureFlag.mockResolvedValue(false);

    const res = await PATCH(makeRequest({ key: "test", enabled: true }));
    expect(res.status).toBe(500);
  });
});
