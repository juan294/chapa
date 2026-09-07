import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockRateLimit,
  mockGetCachedLatestSnapshot,
  mockDbGetToolInsights,
  mockGetClientIp,
  mockIsValidHandle,
  mockMaterializeDisplayProfile,
  mockReadScoreReceiptV7,
  mockCacheGet,
  mockCacheSet,
  mockFetchStats,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetCachedLatestSnapshot: vi.fn(),
  mockDbGetToolInsights: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockMaterializeDisplayProfile: vi.fn(),
  mockReadScoreReceiptV7: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockFetchStats: vi.fn(),
}));

vi.mock("@/lib/profile/score-receipt-v7", () => ({
  readScoreReceiptV7: mockReadScoreReceiptV7,
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: mockIsValidHandle,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

// The warm-cache test below runs the REAL materializer and the REAL
// `getStats` so that the read-only stats path is exercised end to end from
// this route; only the I/O boundaries beneath them are stubbed.
vi.mock("@/lib/env", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/env")>(),
  getGithubToken: () => "server-token",
  getNextauthSecret: () => "profile-route-fixture-secret",
}));
vi.mock("@/lib/github/stats", () => ({ fetchStats: mockFetchStats }));
vi.mock("@/lib/platform/source-authorization", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/platform/source-authorization")>(),
  readSourceAuthorization: async () => ({ status: "unlinked" }),
}));
vi.mock("@/lib/platform/source-refresh", () => ({ refreshSourceLink: async (value: unknown) => value }));
vi.mock("@/lib/platform/source-collectors", () => ({ selectSourceEvidence: vi.fn() }));
vi.mock("@/lib/db/supplemental", () => ({ dbGetSupplemental: async () => null }));
vi.mock("@/lib/bitbucket/client", () => ({ fetchBitbucketIfLinked: async () => null }));
vi.mock("@/lib/codeberg/client", () => ({ fetchCodebergIfLinked: async () => null }));
vi.mock("@/lib/gitlab/client", () => ({ fetchGitlabIfLinked: async () => null }));
vi.mock("@/lib/cache/craft-cache", () => ({ getCachedCraftScore: async () => null }));
vi.mock("@/lib/profile/score-model", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/profile/score-model")>(),
  readRenderableReceipt: async () => null,
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: mockGetCachedLatestSnapshot,
}));

vi.mock("@/lib/db/tool-insights", () => ({
  dbGetToolInsights: mockDbGetToolInsights,
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mockGetClientIp,
}));

// #1180 (PE-L2) — route.ts calls materializeDisplayProfile directly (not
// materializePublicProfile/materializeProfile), which never re-reads the
// snapshot the route already fetched via getCachedLatestSnapshot above.
vi.mock("@/lib/profile/materialize-profile", () => ({
  materializeDisplayProfile: mockMaterializeDisplayProfile,
}));

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------

import { GET, OPTIONS } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(handle: string): NextRequest {
  return new NextRequest(
    `https://chapa.thecreativetoken.com/api/profile/${handle}`,
  );
}

function makeParams(handle: string) {
  return { params: Promise.resolve({ handle }) };
}

const MOCK_SNAPSHOT = {
  date: "2026-03-27",
  capturedAt: "2026-03-27T10:30:00Z",
  commitsTotal: 500,
  prsMergedCount: 42,
  prsMergedWeight: 84,
  reviewsSubmittedCount: 30,
  issuesClosedCount: 15,
  reposContributed: 8,
  activeDays: 200,
  linesAdded: 50000,
  linesDeleted: 20000,
  totalStars: 100,
  totalForks: 20,
  totalWatchers: 50,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 3,
  delivery: 100,
  quality: 40,
  consistency: 46,
  breadth: 69,
  archetype: "Builder",
  profileType: "full",
  compositeScore: 68,
  adjustedComposite: 68,
  confidence: 85,
  tier: "High",
};

const MOCK_CRAFT = {
  tool: "claude-code" as const,
  dimensions: { proficiency: 70, effectiveness: 75, sophistication: 74 },
  craftScore: 73,
  tier: "Expert" as const,
  reportPeriod: { start: "2026-02-20", end: "2026-03-27" },
  computedAt: "2026-03-27T08:00:00.000Z",
};

/**
 * #1062 — the FRESH, badge-consistent impact. Deliberately different from the
 * snapshot's smoothed `adjustedComposite`/`tier` so the two can't be confused.
 */
const MOCK_MATERIALIZED = {
  displayImpact: { adjustedComposite: 69, tier: "Solid" },
  // #1311 — the route reads its headline from the resolved model, since that
  // is what the badge draws and what this field is documented to match.
  scoring: {
    policyVersion: "v6" as const, handle: "juan294", identity: null, window: null,
    dimensions: {
      delivery: { kind: "point" as const, value: 69, display: 69 },
      quality: { kind: "point" as const, value: 69, display: 69 },
      consistency: { kind: "point" as const, value: 69, display: 69 },
      breadth: { kind: "point" as const, value: 69, display: 69 },
    },
    composite: { kind: "point" as const, value: 69, display: 69 },
    tier: "Solid" as const, archetype: "Builder" as const, craft: null,
    coverage: [], exclusions: [], limitations: ["legacy_aggregate" as const],
  },
};

const LATEST_UPLOADED_CRAFT = {
  ...MOCK_CRAFT,
  tool: "cursor" as const,
  craftScore: 81,
  tier: "Master" as const,
  computedAt: "2026-03-28T08:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockIsValidHandle.mockReturnValue(true);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 60 });
  mockGetCachedLatestSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
  mockDbGetToolInsights.mockResolvedValue(MOCK_CRAFT);
  mockGetClientIp.mockReturnValue("127.0.0.1");
  mockMaterializeDisplayProfile.mockResolvedValue(MOCK_MATERIALIZED);
  mockReadScoreReceiptV7.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/profile/:handle", () => {
  // --- Success: full profile with craft ---

  it("returns 200 with full profile when snapshot and craft exist", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toEqual({
      handle: "juan294",
      dimensions: {
        delivery: 100,
        quality: 40,
        consistency: 46,
        breadth: 69,
        craft: 73,
      },
      compositeScore: 68,
      adjustedComposite: 68,
      archetype: "Builder",
      tier: "High",
      craft: {
        tool: "claude-code",
        tier: "Expert",
        score: 73,
      },
      snapshotDate: "2026-03-27",
      computedAt: "2026-03-27T10:30:00Z",
      displayScore: 69,
      displayTier: "Solid",
      scoring: null,
    });
  });

  // A v7 receipt is projected through the one shared view model, so this
  // payload names the same revision the badge and verification link resolve to.
  it("projects an issued v7 receipt through the shared view model", async () => {
    const { buildReceiptSnapshotV7 } = await import("@/lib/history/snapshot");
    const { receiptFixtureV7 } = await import("@/lib/history/__fixtures__/receipts-v7");
    const { receiptViewModel } = await import("@/lib/profile/score-view-model");
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4), null);
    mockReadScoreReceiptV7.mockResolvedValue(snapshot);

    const body = await (await GET(makeRequest("juan294"), makeParams("juan294"))).json();

    expect(body.scoring).toEqual(JSON.parse(JSON.stringify(receiptViewModel("juan294", snapshot))));
    expect(body.scoring.identity.contentHash).toBe(snapshot.receipt.contentHash.value);
    expect(body.scoring.policyVersion).toBe("v7");
  });

  // --- Success: profile without craft ---

  it("returns craft: null and no dimensions.craft when no tool insights exist", async () => {
    mockDbGetToolInsights.mockResolvedValue(null);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.craft).toBeNull();
    expect(body.dimensions).not.toHaveProperty("craft");
  });

  it("uses snapshot.craft for dimensions when present (not tool insights)", async () => {
    // Snapshot has craft=80 stored from when it was computed
    mockGetCachedLatestSnapshot.mockResolvedValue({
      ...MOCK_SNAPSHOT,
      craft: 80,
    });
    // Tool insights returns a different score (73) — dimensions should use snapshot value
    mockDbGetToolInsights.mockResolvedValue(MOCK_CRAFT);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(200);
    const body = await resp.json();
    // dimensions.craft comes from snapshot for consistency
    expect(body.dimensions.craft).toBe(80);
    expect(body.craft).toBeNull();
    expect(mockDbGetToolInsights).not.toHaveBeenCalled();
  });

  it("falls back to tool insights craft when snapshot has no craft", async () => {
    // Snapshot without craft (legacy row before craft column was added)
    mockGetCachedLatestSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
    mockDbGetToolInsights.mockResolvedValue(MOCK_CRAFT);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));
    const body = await resp.json();

    // Falls back to tool insights craft score
    expect(body.dimensions.craft).toBe(73);
  });

  it("surfaces the latest uploaded craft details returned by the DB layer", async () => {
    mockGetCachedLatestSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
    mockDbGetToolInsights.mockResolvedValue(LATEST_UPLOADED_CRAFT);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));
    const body = await resp.json();

    expect(body.dimensions.craft).toBe(81);
    expect(body.craft).toEqual({
      tool: "cursor",
      tier: "Master",
      score: 81,
    });
  });

  // --- 404: no snapshot ---

  it("returns 404 when no snapshot exists for handle", async () => {
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    const resp = await GET(makeRequest("unknown"), makeParams("unknown"));

    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.error).toContain("No profile found");
  });

  it("uses the latest snapshot cache and skips craft on 404", async () => {
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    await GET(makeRequest("unknown"), makeParams("unknown"));

    expect(mockGetCachedLatestSnapshot).toHaveBeenCalledWith("unknown");
    expect(mockDbGetToolInsights).not.toHaveBeenCalled();
  });

  // --- Validation ---

  it("returns 400 for invalid handle", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const resp = await GET(makeRequest("-invalid"), makeParams("-invalid"));

    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain("Invalid handle");
  });

  it("does not call DB when handle is invalid", async () => {
    mockIsValidHandle.mockReturnValue(false);

    await GET(makeRequest("-bad"), makeParams("-bad"));

    expect(mockGetCachedLatestSnapshot).not.toHaveBeenCalled();
    expect(mockDbGetToolInsights).not.toHaveBeenCalled();
  });

  // --- Rate limiting ---

  it("returns 429 when IP rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
    });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.status).toBe(429);
    const body = await resp.json();
    expect(body.error).toContain("Too many requests");
  });

  it("returns Retry-After header on 429", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
    });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Retry-After")).toBe("60");
  });

  it("does not call DB when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
    });

    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockGetCachedLatestSnapshot).not.toHaveBeenCalled();
    expect(mockDbGetToolInsights).not.toHaveBeenCalled();
  });

  it("passes correct rate limit key based on client IP", async () => {
    mockGetClientIp.mockReturnValue("192.168.1.42");

    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:profile:192.168.1.42",
      60,
      60,
    );
  });

  // --- CORS headers ---

  it("includes CORS header on success response", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS header on 400 response", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const resp = await GET(makeRequest("-bad"), makeParams("-bad"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS header on 404 response", async () => {
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    const resp = await GET(makeRequest("unknown"), makeParams("unknown"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS header on 429 response", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
    });

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  // --- Cache headers ---

  it("includes Cache-Control header with 5-minute CDN cache", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(resp.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=3600",
    );
  });

  // --- Error handling ---

  it("re-throws when getCachedLatestSnapshot throws (handled by withErrorCapture)", async () => {
    mockGetCachedLatestSnapshot.mockRejectedValue(new Error("DB down"));

    await expect(GET(makeRequest("juan294"), makeParams("juan294"))).rejects.toThrow("DB down");
  });
});

// ---------------------------------------------------------------------------
// OPTIONS (CORS preflight)
// ---------------------------------------------------------------------------

describe("OPTIONS /api/profile/:handle", () => {
  it("returns 204 with CORS headers", async () => {
    const resp = await OPTIONS();

    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(resp.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, OPTIONS",
    );
    expect(resp.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
  });
});

// ---------------------------------------------------------------------------
// #1062 — display (fresh, badge-consistent) vs smoothed (trend) score
// ---------------------------------------------------------------------------

describe("GET /api/profile/:handle — display vs smoothed score (#1062)", () => {
  it("exposes the fresh badge headline alongside the smoothed trend value", async () => {
    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));
    const body = await resp.json();

    // The smoothed trend snapshot keeps its existing field names — no consumer
    // of the public API sees a changed meaning.
    expect(body.adjustedComposite).toBe(68);
    expect(body.tier).toBe("High");
    // The badge-consistent headline is additive.
    expect(body.displayScore).toBe(69);
    expect(body.displayTier).toBe("Solid");
  });

  it("materializes read-only so a public GET never triggers a cache write", async () => {
    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockMaterializeDisplayProfile).toHaveBeenCalledWith("juan294", {
      readOnly: true,
    });
  });

  it("returns null display fields when the profile cannot be materialized", async () => {
    mockMaterializeDisplayProfile.mockResolvedValue(null);

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));
    const body = await resp.json();

    expect(resp.status).toBe(200);
    expect(body.displayScore).toBeNull();
    expect(body.displayTier).toBeNull();
    // The snapshot half of the response is unaffected.
    expect(body.adjustedComposite).toBe(68);
  });

  it("degrades to null display fields when materialization throws, never 500s", async () => {
    // A 500 on legal user input is always a bug — this endpoint worked before
    // the display fields existed and must keep working if they cannot be
    // computed.
    mockMaterializeDisplayProfile.mockRejectedValue(new Error("redis down"));

    const resp = await GET(makeRequest("juan294"), makeParams("juan294"));
    const body = await resp.json();

    expect(resp.status).toBe(200);
    expect(body.displayScore).toBeNull();
    expect(body.displayTier).toBeNull();
    expect(body.compositeScore).toBe(68);
  });

  it("does not materialize when the snapshot is missing (404 path stays cheap)", async () => {
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    const resp = await GET(makeRequest("nobody"), makeParams("nobody"));

    expect(resp.status).toBe(404);
    expect(mockMaterializeDisplayProfile).not.toHaveBeenCalled();
  });

  // #1180 (PE-L2) — the route already read the snapshot once above for the
  // 404 check and the snapshot half of the response body. Materializing the
  // display headline via `materializeDisplayProfile` (rather than
  // `materializePublicProfile` -> `materializeProfile`) must not perform a
  // second, identical `getCachedLatestSnapshot` read for the same request —
  // that second read's result never affects `displayImpact` in the first
  // place (#1001), so deduplicating it is unnecessary; it should simply not
  // happen.
  it("reads the snapshot cache exactly once per request, not twice", async () => {
    await GET(makeRequest("juan294"), makeParams("juan294"));

    expect(mockGetCachedLatestSnapshot).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// LE-1-1 — a warm, bound stats cache must reach a read-only caller
// ---------------------------------------------------------------------------

describe("GET /api/profile/:handle — warm read-only stats (LE-1-1)", () => {
  // The badge route materializes live and writes `stats:v3:<handle>` under the
  // server token's binding. This route reads with `readOnly: true`, under the
  // same binding, so it must be served that record: a badge printing 80 beside
  // a `displayScore: null` from this endpoint is the finding this covers.
  it("reports the drawn headline from the bound stats cache without a live fetch", async () => {
    const actual = await vi.importActual<typeof import("@/lib/profile/materialize-profile")>("@/lib/profile/materialize-profile");
    const { makeStats } = await import("@/lib/test-helpers/fixtures");
    const { renderableScore } = await import("@/lib/profile/score-view-model");
    mockMaterializeDisplayProfile.mockImplementation(actual.materializeDisplayProfile);
    mockFetchStats.mockResolvedValue(makeStats({ handle: "juan294", commitsTotal: 400, prsMergedCount: 40, reviewsSubmittedCount: 20, activeDays: 200 }));
    mockCacheGet.mockResolvedValue(null);

    // What the live badge path leaves behind.
    const warm = await actual.materializeDisplayProfile("juan294");
    const entry = mockCacheSet.mock.calls.find(([key]) => key === "stats:v3:juan294")![1];
    mockCacheGet.mockImplementation(async key => key === "stats:v3:juan294" ? entry : null);
    mockFetchStats.mockClear();
    mockCacheSet.mockClear();

    const body = await (await GET(makeRequest("juan294"), makeParams("juan294"))).json();

    const drawn = renderableScore(warm!.scoring);
    expect(typeof drawn.composite).toBe("number");
    expect(body.displayScore).toBe(drawn.composite);
    expect(body.displayTier).toBe(drawn.tier);
    expect(mockFetchStats).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});
