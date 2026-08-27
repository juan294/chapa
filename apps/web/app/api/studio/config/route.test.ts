import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockGetOptionalRequestSession,
  mockGetSessionSecret,
  mockRequireRequestSession,
  mockRateLimit,
  mockDbUpsertStudioConfig,
  mockLoadStudioConfig,
} =
  vi.hoisted(() => ({
    mockGetOptionalRequestSession: vi.fn(),
    mockGetSessionSecret: vi.fn(),
    mockRequireRequestSession: vi.fn(),
    mockRateLimit: vi.fn(),
    mockDbUpsertStudioConfig: vi.fn(),
    mockLoadStudioConfig: vi.fn(),
  }));

vi.mock("@/lib/auth/session", () => ({
  getOptionalRequestSession: mockGetOptionalRequestSession,
  getSessionSecret: mockGetSessionSecret,
  requireRequestSession: mockRequireRequestSession,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

// Deliberately does not export refreshStudioConfigCache/cacheStudioConfig —
// removed in the BE-L1 remediation (nothing read that Redis mirror back).
// If route.ts ever re-imports either, this mock throws instead of silently
// providing a stub, which is what the regression test below depends on.
vi.mock("@/lib/db/studio", () => ({
  dbUpsertStudioConfig: mockDbUpsertStudioConfig,
  loadStudioConfig: mockLoadStudioConfig,
}));

// Re-export real validation functions through the mock to avoid alias resolution issues
vi.mock("@/lib/validation", async () => {
  const actual = await import("../../../../lib/validation");
  return actual;
});

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabled: () => Promise.resolve(true),
}));

// ---------------------------------------------------------------------------
// Import handlers AFTER mocks
// ---------------------------------------------------------------------------

import { GET, PUT } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest("https://chapa.thecreativetoken.com/api/studio/config", {
    headers,
  });
}

function makePutRequest(body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest("https://chapa.thecreativetoken.com/api/studio/config", {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}

const SESSION = {
  token: "ghp_test123",
  login: "juan294",
  name: "Juan",
  avatar_url: "https://avatars.githubusercontent.com/u/1",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/studio/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret-32-characters-valid-ok");
    mockGetSessionSecret.mockReturnValue("test-secret-32-characters-valid-ok");
    mockLoadStudioConfig.mockResolvedValue({ status: "not_found" });
  });

  it("returns 401 when no session", async () => {
    mockGetOptionalRequestSession.mockReturnValue(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns { config: null } when no NEXTAUTH_SECRET", async () => {
    mockGetSessionSecret.mockReturnValue(null);

    const res = await GET(makeGetRequest("session=abc"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ config: null });
  });

  it("returns the config from the shared load helper", async () => {
    mockGetOptionalRequestSession.mockReturnValue(SESSION);
    const savedConfig = { ...DEFAULT_BADGE_CONFIG, background: "aurora" };
    mockLoadStudioConfig.mockResolvedValue({
      status: "found",
      config: savedConfig,
    });

    const res = await GET(makeGetRequest("session=abc"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.config).toEqual(savedConfig);
    expect(mockLoadStudioConfig).toHaveBeenCalledWith("juan294");
  });

  it("returns { config: null } when the shared load helper misses", async () => {
    mockGetOptionalRequestSession.mockReturnValue(SESSION);

    const res = await GET(makeGetRequest("session=abc"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ config: null });
  });

  it("returns 503 when the durable config store is unavailable", async () => {
    mockGetOptionalRequestSession.mockReturnValue(SESSION);
    mockLoadStudioConfig.mockResolvedValue({ status: "unavailable" });

    const res = await GET(makeGetRequest("session=abc"));

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(await res.json()).toEqual({
      error: "Storage temporarily unavailable",
    });
  });

  it("returns 500 when the persisted config is malformed", async () => {
    mockGetOptionalRequestSession.mockReturnValue(SESSION);
    mockLoadStudioConfig.mockResolvedValue({ status: "invalid" });

    const res = await GET(makeGetRequest("session=abc"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Invalid persisted studio config",
    });
  });
});

describe("PUT /api/studio/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRequestSession.mockReturnValue({ session: SESSION });
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
    mockDbUpsertStudioConfig.mockResolvedValue({ ok: true });
  });

  it("returns 401 when no session", async () => {
    mockRequireRequestSession.mockReturnValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

    const res = await PUT(makePutRequest(DEFAULT_BADGE_CONFIG));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid config body", async () => {
    const res = await PUT(makePutRequest({ background: "neon" }, "session=abc"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it("returns 400 for non-JSON body", async () => {
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/studio/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: "session=abc" },
      body: "not json{{{",
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 31, limit: 30 });

    const res = await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));
    expect(res.status).toBe(429);
  });

  it("commits directly to Supabase with no Redis mirror (BE-L1 remediation)", async () => {
    // Regression test for the orphaned Studio Redis write: the read path
    // (loadStudioConfig) stopped consulting Redis in #1186/BE-L1, which left
    // the write path's cacheStudioConfig/refreshStudioConfigCache publishing
    // to a key nothing ever read back. Both were removed. The "@/lib/db/studio"
    // mock above deliberately omits refreshStudioConfigCache, so if route.ts
    // ever re-imports and calls it, this request throws instead of resolving.
    const config = { ...DEFAULT_BADGE_CONFIG, background: "aurora" as const };
    const res = await PUT(makePutRequest(config, "session=abc"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDbUpsertStudioConfig).toHaveBeenCalledWith("juan294", config);
  });

  it("serializes concurrent saves for one handle so the last request wins", async () => {
    const operations: string[] = [];
    let releaseFirstWrite!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    mockDbUpsertStudioConfig.mockImplementation(
      async (_handle: string, value: { background: string }) => {
        operations.push(`durable:${value.background}`);
        if (value.background === "aurora") await firstWrite;
        return { ok: true };
      },
    );
    const firstConfig = {
      ...DEFAULT_BADGE_CONFIG,
      background: "aurora" as const,
    };
    const secondConfig = {
      ...DEFAULT_BADGE_CONFIG,
      background: "particles" as const,
    };

    const firstResponse = PUT(makePutRequest(firstConfig, "session=abc"));
    await vi.waitFor(() => {
      expect(operations).toEqual(["durable:aurora"]);
    });
    const secondResponse = PUT(makePutRequest(secondConfig, "session=abc"));
    await vi.waitFor(() => {
      expect(mockRateLimit).toHaveBeenCalledTimes(2);
    });
    expect(mockDbUpsertStudioConfig).toHaveBeenCalledTimes(1);
    releaseFirstWrite();

    expect((await firstResponse).status).toBe(200);
    expect((await secondResponse).status).toBe(200);
    expect(operations).toEqual(["durable:aurora", "durable:particles"]);
  });

  it("returns 400 when Supabase rejects the config with a constraint error", async () => {
    mockDbUpsertStudioConfig.mockResolvedValue({
      ok: false,
      reason: "constraint",
      code: "23502",
    });

    const config = { ...DEFAULT_BADGE_CONFIG, background: "aurora" as const };
    const res = await PUT(makePutRequest(config, "session=abc"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      success: false,
      error: "Invalid badge config",
    });
  });

  it("returns 503 with Retry-After when Supabase is unavailable", async () => {
    mockDbUpsertStudioConfig.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    const res = await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(await res.json()).toEqual({
      success: false,
      error: "Storage temporarily unavailable",
    });
  });

  it("returns 500 when Supabase fails unexpectedly", async () => {
    mockDbUpsertStudioConfig.mockResolvedValue({
      ok: false,
      reason: "error",
      code: "XX000",
    });

    const res = await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: "Failed to persist studio config",
    });
  });

  it("rate limits by user login", async () => {
    await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));

    expect(mockRateLimit).toHaveBeenCalledWith("ratelimit:config:juan294", 30, 3600);
  });
});
