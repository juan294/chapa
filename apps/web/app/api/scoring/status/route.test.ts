import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireSession, mockRateLimitStrict, mockReadScoringStatus, mockEnqueueCollection, mockScheduleCollectionAdvance } = vi.hoisted(() => ({
  mockRequireSession: vi.fn(),
  mockRateLimitStrict: vi.fn(),
  mockReadScoringStatus: vi.fn(),
  mockEnqueueCollection: vi.fn(),
  mockScheduleCollectionAdvance: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({ requireSession: mockRequireSession }));
vi.mock("@/lib/cache/redis", () => ({ rateLimitStrict: mockRateLimitStrict }));
vi.mock("@/lib/collection/read-scoring-status", () => ({ readScoringStatus: mockReadScoringStatus }));
vi.mock("@/lib/collection/enqueue", () => ({ enqueueCollection: mockEnqueueCollection, scheduleCollectionAdvance: mockScheduleCollectionAdvance }));

import { GET, POST } from "./route";

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("https://chapa.test/api/scoring/status", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockReturnValue({ session: { login: "octocat", name: "Octocat", avatar_url: "" }, error: null });
  mockRateLimitStrict.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
  mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false });
  mockEnqueueCollection.mockResolvedValue([]);
});

describe("GET /api/scoring/status", () => {
  it("requires an authenticated session", async () => {
    mockRequireSession.mockReturnValue({ session: null, error: new Response(null, { status: 401 }) });
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("rate limits with the fail-closed limiter", async () => {
    await GET(makeRequest("GET"));
    expect(mockRateLimitStrict).toHaveBeenCalledWith("ratelimit:scoring-status:octocat", 30, 3600);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimitStrict.mockResolvedValue({ allowed: false, current: 31, limit: 30 });
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
  });

  it("returns the owner's scoring status with no-store", async () => {
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({ scoringStatus: { kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false } });
    expect(mockReadScoringStatus).toHaveBeenCalledWith("octocat");
  });

  it("returns 503 (not unregistered) when the authority read itself fails", async () => {
    mockReadScoringStatus.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("POST /api/scoring/status", () => {
  it("requires an authenticated session", async () => {
    mockRequireSession.mockReturnValue({ session: null, error: new Response(null, { status: 401 }) });
    const res = await POST(makeRequest("POST", { action: "retry", provider: "bitbucket" }));
    expect(res.status).toBe(401);
  });

  it("uses its own, stricter rate-limit bucket than GET", async () => {
    await POST(makeRequest("POST", { action: "retry", provider: "bitbucket" }));
    expect(mockRateLimitStrict).toHaveBeenCalledWith("ratelimit:scoring-status-retry:octocat", 5, 3600);
  });

  it("rejects an unsupported action", async () => {
    const res = await POST(makeRequest("POST", { action: "reset" }));
    expect(res.status).toBe(400);
    expect(mockEnqueueCollection).not.toHaveBeenCalled();
  });

  it("rejects a missing or invalid provider", async () => {
    const res = await POST(makeRequest("POST", { action: "retry", provider: "notaprovider" }));
    expect(res.status).toBe(400);
    expect(mockEnqueueCollection).not.toHaveBeenCalled();
  });

  it("rejects a malformed body without throwing", async () => {
    const res = await POST(makeRequest("POST", "not json"));
    expect(res.status).toBe(400);
  });

  it("enqueues a retry-reason job for the given provider and runs a background slice", async () => {
    const res = await POST(makeRequest("POST", { action: "retry", provider: "bitbucket" }));
    expect(res.status).toBe(200);
    expect(mockEnqueueCollection).toHaveBeenCalledWith("octocat", "retry", "bitbucket");
    expect(mockScheduleCollectionAdvance).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toEqual({ scoringStatus: { kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false } });
  });

  it("returns 503 when the post-retry status read fails", async () => {
    mockReadScoringStatus.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", { action: "retry", provider: "gitlab" }));
    expect(res.status).toBe(503);
  });
});
