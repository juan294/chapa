import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  mockInvalidateBadgeSvgCacheForHandle,
} =
  vi.hoisted(() => ({
    mockGetOptionalRequestSession: vi.fn(),
    mockGetSessionSecret: vi.fn(),
    mockRequireRequestSession: vi.fn(),
    mockRateLimit: vi.fn(),
    mockDbUpsertStudioConfig: vi.fn(),
    mockLoadStudioConfig: vi.fn(),
    mockInvalidateBadgeSvgCacheForHandle: vi.fn(),
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

vi.mock("@/lib/render/badge-svg-cache", () => ({
  invalidateBadgeSvgCacheForHandle: mockInvalidateBadgeSvgCacheForHandle,
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
    mockInvalidateBadgeSvgCacheForHandle.mockResolvedValue({
      redis: true,
      edge: "purged",
    });
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
    expect(mockInvalidateBadgeSvgCacheForHandle).not.toHaveBeenCalled();
  });

  it("returns 400 for non-JSON body", async () => {
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/studio/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: "session=abc" },
      body: "not json{{{",
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(mockInvalidateBadgeSvgCacheForHandle).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 31, limit: 30 });

    const res = await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));
    expect(res.status).toBe(429);
    expect(mockInvalidateBadgeSvgCacheForHandle).not.toHaveBeenCalled();
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
    expect(await res.json()).toEqual({ success: true, badgeRefreshed: true });
    expect(mockDbUpsertStudioConfig).toHaveBeenCalledWith("juan294", config);
  });

  // #1191 step 5 — a Studio tab loaded before the three preview-only
  // categories were dropped still posts nine keys. Rejecting it would 400 a
  // client that is otherwise sending a perfectly good config, and persisting
  // it verbatim would write retired keys back into the database that the read
  // path then has to strip again forever.
  it("accepts a stale client's legacy config and persists only the surviving keys", async () => {
    const res = await PUT(
      makePutRequest(
        {
          ...DEFAULT_BADGE_CONFIG,
          background: "aurora",
          interaction: "tilt-3d",
          statsDisplay: "animated-ease",
          celebration: "confetti",
        },
        "session=abc",
      ),
    );

    expect(res.status).toBe(200);
    expect(mockDbUpsertStudioConfig).toHaveBeenCalledWith("juan294", {
      ...DEFAULT_BADGE_CONFIG,
      background: "aurora",
    });
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
    expect(mockInvalidateBadgeSvgCacheForHandle).not.toHaveBeenCalled();
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
    expect(mockInvalidateBadgeSvgCacheForHandle).not.toHaveBeenCalled();
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

  // hotfix v2.29.2 — the save now awaits the shared cache invalidation (both
  // Redis and the Vercel edge) instead of firing it after the response, and
  // reports the outcome to the client as `badgeRefreshed`.
  describe("badge cache invalidation (#1191 hotfix, v2.29.2)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls invalidateBadgeSvgCacheForHandle with the lowercased login and today's date", async () => {
      await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));

      expect(mockInvalidateBadgeSvgCacheForHandle).toHaveBeenCalledTimes(1);
      expect(mockInvalidateBadgeSvgCacheForHandle).toHaveBeenCalledWith(
        "juan294",
        "2026-09-01",
      );
    });

    it("awaits the invalidation before sending the response, and only calls it after the durable write", async () => {
      const order: string[] = [];
      mockDbUpsertStudioConfig.mockImplementation(async () => {
        order.push("db-write");
        return { ok: true };
      });

      let resolveInvalidation!: (value: { redis: boolean; edge: string }) => void;
      const deferredInvalidation = new Promise<{ redis: boolean; edge: string }>(
        (resolve) => {
          resolveInvalidation = resolve;
        },
      );
      mockInvalidateBadgeSvgCacheForHandle.mockImplementation(async () => {
        order.push("invalidation-called");
        return deferredInvalidation;
      });

      let resolved = false;
      const responsePromise = PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc")).then(
        (res) => {
          resolved = true;
          return res;
        },
      );

      // Flush microtasks so the DB write and the invalidation call both run,
      // without letting the still-pending invalidation promise resolve.
      await vi.advanceTimersByTimeAsync(0);
      expect(order).toEqual(["db-write", "invalidation-called"]);
      expect(resolved).toBe(false);

      resolveInvalidation({ redis: true, edge: "purged" });
      const res = await responsePromise;

      expect(resolved).toBe(true);
      expect(res.status).toBe(200);
    });

    it.each([
      [{ redis: true, edge: "purged" as const }, true],
      [{ redis: true, edge: "skipped" as const }, true],
      [{ redis: true, edge: "failed" as const }, false],
      [{ redis: false, edge: "purged" as const }, false],
    ])(
      "maps invalidation result %o to badgeRefreshed=%s",
      async (invalidationResult, expectedBadgeRefreshed) => {
        mockInvalidateBadgeSvgCacheForHandle.mockResolvedValue(invalidationResult);

        const res = await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          success: true,
          badgeRefreshed: expectedBadgeRefreshed,
        });
      },
    );

    it("still returns 200 with badgeRefreshed: false when the invalidation call throws", async () => {
      mockInvalidateBadgeSvgCacheForHandle.mockRejectedValue(new Error("edge down"));

      const res = await PUT(makePutRequest(DEFAULT_BADGE_CONFIG, "session=abc"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, badgeRefreshed: false });
    });
  });
});
