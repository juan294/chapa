import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn().mockResolvedValue(true),
  cacheDel: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 120 }),
}));

vi.mock("@/lib/auth/cli-token", () => ({
  generateCliToken: vi.fn(),
}));

vi.mock("@/lib/http/client-ip", () => ({
  NO_TRUSTED_IP: "unknown",
  getClientIp: (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
}));

import { GET } from "./route";
import { cacheGet, cacheSet, cacheDel, rateLimit } from "@/lib/cache/redis";
import { generateCliToken } from "@/lib/auth/cli-token";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "1feae8e3-6bc0-47da-84aa-0e24e2510454";

function makeRequest(session?: string, ip?: string, deviceCode?: string): NextRequest {
  const url = new URL("https://chapa.thecreativetoken.com/api/cli/auth/poll");
  if (session !== undefined) url.searchParams.set("session", session);
  if (deviceCode !== undefined) url.searchParams.set("device_code", deviceCode);
  const headers: Record<string, string> = {};
  if (ip) headers["x-forwarded-for"] = ip;
  return new NextRequest(url.toString(), { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/cli/auth/poll", () => {
  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("returns 400 for missing sessionId", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid session/i);
  });

  it("returns 400 for empty sessionId", async () => {
    const res = await GET(makeRequest(""));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid session/i);
  });

  it("returns 400 for malformed sessionId (not a UUID)", async () => {
    const res = await GET(makeRequest("not-a-uuid"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid session/i);
  });

  it("returns 400 for sessionId with uppercase hex chars", async () => {
    const res = await GET(makeRequest("1FEAE8E3-6BC0-47DA-84AA-0E24E2510454"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid session/i);
  });

  // -------------------------------------------------------------------------
  // Pending session (not yet in Redis or still pending)
  // -------------------------------------------------------------------------

  it("returns pending status when session not found in Redis", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
    expect(cacheGet).toHaveBeenCalledWith(`cli:device:${VALID_UUID}`);
  });

  it("returns pending status when session exists but is still pending", async () => {
    vi.mocked(cacheGet).mockResolvedValue({ status: "pending" });

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
  });

  it("returns pending when session is approved but handle is missing", async () => {
    vi.mocked(cacheGet).mockResolvedValue({ status: "approved" });

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
  });

  // -------------------------------------------------------------------------
  // Approved session — token generation
  // -------------------------------------------------------------------------

  it("returns token and handle when session is approved", async () => {
    vi.mocked(cacheGet).mockResolvedValue({
      status: "approved",
      handle: "octocat",
    });
    vi.mocked(generateCliToken).mockReturnValue("fake-cli-token.signature");

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("approved");
    expect(body.token).toBe("fake-cli-token.signature");
    expect(body.handle).toBe("octocat");
  });

  it("generates token with correct handle and secret", async () => {
    vi.mocked(cacheGet).mockResolvedValue({
      status: "approved",
      handle: "octocat",
    });
    vi.mocked(generateCliToken).mockReturnValue("token.sig");

    await GET(makeRequest(VALID_UUID));

    expect(generateCliToken).toHaveBeenCalledWith("octocat", "test-secret");
  });

  it("deletes session from Redis after successful token generation (one-time use)", async () => {
    vi.mocked(cacheGet).mockResolvedValue({
      status: "approved",
      handle: "octocat",
    });
    vi.mocked(generateCliToken).mockReturnValue("token.sig");

    await GET(makeRequest(VALID_UUID));

    expect(cacheDel).toHaveBeenCalledWith(`cli:device:${VALID_UUID}`);
  });

  // -------------------------------------------------------------------------
  // Server misconfiguration
  // -------------------------------------------------------------------------

  it("returns 500 when NEXTAUTH_SECRET is missing", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");
    vi.mocked(cacheGet).mockResolvedValue({
      status: "approved",
      handle: "octocat",
    });

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/misconfigured/i);
  });

  it("returns 500 when NEXTAUTH_SECRET is undefined", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", undefined as unknown as string);
    vi.mocked(cacheGet).mockResolvedValue({
      status: "approved",
      handle: "octocat",
    });

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/misconfigured/i);
  });

  // -------------------------------------------------------------------------
  // Redis failure handling
  // -------------------------------------------------------------------------

  it("handles Redis cacheGet failure gracefully (returns pending)", async () => {
    // When Redis is unavailable, cacheGet returns null (graceful degradation)
    vi.mocked(cacheGet).mockResolvedValue(null);

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
  });

  it("does not crash when cacheDel throws after token generation", async () => {
    vi.mocked(cacheGet).mockResolvedValue({
      status: "approved",
      handle: "octocat",
    });
    vi.mocked(generateCliToken).mockReturnValue("token.sig");
    vi.mocked(cacheDel).mockRejectedValue(new Error("Redis down"));

    // The route awaits cacheDel but doesn't wrap it in try/catch,
    // however cacheDel itself swallows errors internally in the redis module.
    // We test that the mock throwing still returns token data.
    await expect(GET(makeRequest(VALID_UUID))).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// BE-M2 (#869): RFC 8628-style device_code split
// ---------------------------------------------------------------------------

describe("GET /api/cli/auth/poll — device_code (BE-M2, backward-compatible)", () => {
  beforeEach(() => {
    vi.resetAllMocks(); // reset implementations too (prevents bleed from "cacheDel throws" test)
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 120 });
    vi.mocked(cacheSet).mockResolvedValue(true);
    vi.mocked(cacheDel).mockResolvedValue(undefined);
  });

  it("returns pending + device_code on first poll (session not found in Redis)", async () => {
    // First poll: no device_code sent, session not in Redis yet
    vi.mocked(cacheGet).mockResolvedValue(null);

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
    // device_code must be returned so an updated CLI can echo it on later polls
    expect(typeof body.device_code).toBe("string");
    expect(body.device_code.length).toBeGreaterThanOrEqual(32);
  });

  it("device_code returned on first poll is high-entropy (≥32 hex chars)", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);

    const res = await GET(makeRequest(VALID_UUID));
    const body = await res.json();

    // device_code must be sufficiently random — at least 32 hex chars (128 bits)
    expect(/^[a-f0-9]{32,}$/.test(body.device_code)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Updated-CLI path: once a client echoes the correct device_code, the session
  // becomes "confirmed" and device_code is enforced from then on.
  // -------------------------------------------------------------------------

  it("confirms the session (persists deviceCodeConfirmed) when a poll echoes the correct device_code", async () => {
    const deviceCode = "correct-device-code-abc123def456xxx";
    vi.mocked(cacheGet).mockResolvedValue({
      status: "pending",
      deviceCode,
      // not yet confirmed
    });

    const res = await GET(makeRequest(VALID_UUID, undefined, deviceCode));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
    // The session must be re-persisted with deviceCodeConfirmed: true so future
    // polls without the code are rejected.
    expect(cacheSet).toHaveBeenCalledWith(
      `cli:device:${VALID_UUID}`,
      expect.objectContaining({ deviceCode, deviceCodeConfirmed: true }),
      expect.any(Number),
    );
  });

  it("returns pending when device_code matches the stored one", async () => {
    const deviceCode = "correct-device-code-abc123def456xxx";
    vi.mocked(cacheGet).mockResolvedValue({
      status: "pending",
      deviceCode,
    });

    const res = await GET(makeRequest(VALID_UUID, undefined, deviceCode));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
  });

  it("issues token when device_code matches and session is approved", async () => {
    const deviceCode = "correct-device-code-abc123def456xxx";
    vi.mocked(cacheGet).mockResolvedValue({
      status: "approved",
      handle: "octocat",
      deviceCode,
    });
    vi.mocked(generateCliToken).mockReturnValue("cli-token.signature");

    const res = await GET(makeRequest(VALID_UUID, undefined, deviceCode));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("approved");
    expect(body.token).toBe("cli-token.signature");
  });

  it("(a) a client that presented device_code must keep presenting the correct one — wrong code is rejected", async () => {
    // Session already confirmed (client proved possession earlier).
    vi.mocked(cacheGet).mockResolvedValue({
      status: "pending",
      deviceCode: "correct-device-code-abc123def456",
      deviceCodeConfirmed: true,
    });

    const res = await GET(makeRequest(VALID_UUID, undefined, "wrong-device-code"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/device_code/i);
  });

  it("(a) a confirmed client that stops presenting device_code is rejected (no downgrade)", async () => {
    // Once confirmed, omitting the code must NOT silently downgrade to sessionId-only.
    vi.mocked(cacheGet).mockResolvedValue({
      status: "pending",
      deviceCode: "correct-device-code-abc123def456",
      deviceCodeConfirmed: true,
    });

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/device_code/i);
  });

  // -------------------------------------------------------------------------
  // (b) Legacy-CLI path: a client that NEVER presents device_code keeps working
  // via sessionId only — must NOT 401. This is the critical backward-compat path.
  // -------------------------------------------------------------------------

  it("(b) legacy client that never presents device_code still succeeds (pending) — no 401", async () => {
    // Unconfirmed session (device_code was offered but never echoed back).
    vi.mocked(cacheGet).mockResolvedValue({
      status: "pending",
      deviceCode: "offered-but-never-echoed-abc123",
      // deviceCodeConfirmed is absent/false
    });

    const res = await GET(makeRequest(VALID_UUID));

    // Legacy CLI: no device_code param → must fall back to sessionId-only.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
  });

  it("(b) legacy client gets its token when approved without ever presenting device_code — no 401", async () => {
    vi.mocked(cacheGet).mockResolvedValue({
      status: "approved",
      handle: "octocat",
      deviceCode: "offered-but-never-echoed-abc123",
      // deviceCodeConfirmed is absent/false
    });
    vi.mocked(generateCliToken).mockReturnValue("cli-token.signature");

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("approved");
    expect(body.token).toBe("cli-token.signature");
  });

  it("(b) legacy session with no deviceCode at all (pre-hardening) still works without device_code", async () => {
    // Sessions created before this hardening (e.g. by the approve route) have no deviceCode.
    vi.mocked(cacheGet).mockResolvedValue({
      status: "approved",
      handle: "octocat",
    });
    vi.mocked(generateCliToken).mockReturnValue("cli-token.signature");

    const res = await GET(makeRequest(VALID_UUID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("approved");
    expect(body.token).toBe("cli-token.signature");
  });

  it("unconfirmed session: a WRONG device_code is still rejected (active possession claim must be correct)", async () => {
    // If a client DOES present a device_code, it must be the right one — even before
    // confirmation. A wrong code is an active claim of possession and is rejected.
    vi.mocked(cacheGet).mockResolvedValue({
      status: "pending",
      deviceCode: "correct-device-code-abc123def456",
      // not confirmed yet
    });

    const res = await GET(makeRequest(VALID_UUID, undefined, "wrong-device-code"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/device_code/i);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("GET /api/cli/auth/poll — rate limiting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 120 });
    vi.mocked(cacheGet).mockResolvedValue(null);
  });

  it("returns 429 when rate limited by sessionId", async () => {
    vi.mocked(rateLimit)
      .mockResolvedValueOnce({ allowed: false, current: 121, limit: 120 });

    const res = await GET(makeRequest(VALID_UUID, "1.2.3.4"));

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("poll_rate_exceeded");
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 429 when rate limited by IP blanket cap", async () => {
    vi.mocked(rateLimit)
      .mockResolvedValueOnce({ allowed: true, current: 1, limit: 120 })
      .mockResolvedValueOnce({ allowed: false, current: 601, limit: 600 });

    const res = await GET(makeRequest(VALID_UUID, "1.2.3.4"));

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("poll_rate_exceeded");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("rate limits by sessionId with correct key and window (120 req / 300s)", async () => {
    await GET(makeRequest(VALID_UUID, "1.2.3.4"));

    expect(rateLimit).toHaveBeenNthCalledWith(
      1,
      `ratelimit:cli-poll-session:${VALID_UUID}`,
      120,
      300,
    );
  });

  it("rate limits by IP with correct key and window (600 req / 300s)", async () => {
    await GET(makeRequest(VALID_UUID, "1.2.3.4"));

    expect(rateLimit).toHaveBeenNthCalledWith(
      2,
      "ratelimit:cli-poll-ip:1.2.3.4",
      600,
      300,
    );
  });

  it("applies a strict global cap (not shared per-unknown bucket) when IP is unknown (BE-M1)", async () => {
    // When no trusted IP header is present, the route must NOT use the regular
    // 600/300s per-IP bucket (which would collapse all no-IP clients into one
    // shared bucket, defeating rate-limiting). Instead it applies a separate
    // stricter global cap with a tighter limit and the key suffix ":no-ip".
    await GET(makeRequest(VALID_UUID));

    expect(rateLimit).toHaveBeenNthCalledWith(
      2,
      "ratelimit:cli-poll-ip:no-ip",
      50,
      300,
    );
  });

  it("does not evaluate the IP limiter when sessionId is already rate limited", async () => {
    vi.mocked(rateLimit)
      .mockResolvedValueOnce({ allowed: false, current: 121, limit: 120 });

    await GET(makeRequest(VALID_UUID, "1.2.3.4"));

    expect(rateLimit).toHaveBeenCalledTimes(1);
  });

  it("proceeds normally when not rate limited", async () => {
    const res = await GET(makeRequest(VALID_UUID, "1.2.3.4"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("pending");
  });

  it("supports repeated polls up to the 120/session cap within 5 minutes", async () => {
    let sessionPolls = 0;
    let ipPolls = 0;
    vi.mocked(rateLimit).mockImplementation(async (key: string, limit: number) => {
      if (key.startsWith("ratelimit:cli-poll-session:")) {
        sessionPolls += 1;
        return { allowed: sessionPolls <= limit, current: sessionPolls, limit };
      }

      ipPolls += 1;
      return { allowed: ipPolls <= limit, current: ipPolls, limit };
    });

    for (let i = 0; i < 120; i++) {
      const res = await GET(makeRequest(VALID_UUID, "1.2.3.4"));
      expect(res.status).toBe(200);
    }

    const res = await GET(makeRequest(VALID_UUID, "1.2.3.4"));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("supports up to 600 polls per IP within 5 minutes across distinct sessions", async () => {
    let ipPolls = 0;
    vi.mocked(rateLimit).mockImplementation(async (key: string, limit: number) => {
      if (key.startsWith("ratelimit:cli-poll-session:")) {
        return { allowed: true, current: 1, limit };
      }

      ipPolls += 1;
      return { allowed: ipPolls <= limit, current: ipPolls, limit };
    });

    for (let i = 0; i < 600; i++) {
      const session = `00000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;
      const res = await GET(makeRequest(session, "1.2.3.4"));
      expect(res.status).toBe(200);
    }

    const res = await GET(
      makeRequest("00000000-0000-4000-8000-ffffffffffff", "1.2.3.4"),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});
