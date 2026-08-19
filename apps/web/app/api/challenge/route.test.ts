import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import {
  MAX_CHALLENGE_BYTES,
  MAX_CHALLENGE_REASON_LENGTH,
} from "@/lib/challenge/validation";

const { mockCaptureServerError } = vi.hoisted(() => ({
  mockCaptureServerError: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
}));
vi.mock("@/lib/cache/redis", () => ({
  rateLimitStrict: vi.fn(async () => ({ allowed: true, current: 1, limit: 3 })),
  refundRateLimit: vi.fn(async () => true),
}));
vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn(() => "1.2.3.4"),
  NO_TRUSTED_IP: "unknown",
}));
vi.mock("@/lib/email/challenge", () => ({
  sendChallengeEmail: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/validation", () => ({
  isValidHandle: vi.fn(() => true),
}));
vi.mock("@/lib/analytics/server-errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/server-errors")>();
  return {
    ...actual,
    captureServerError: mockCaptureServerError,
  };
});

import { requireSession } from "@/lib/auth/require-session";
import { rateLimitStrict, refundRateLimit } from "@/lib/cache/redis";
import { sendChallengeEmail } from "@/lib/email/challenge";
import { isValidHandle } from "@/lib/validation";

function makeRequest(body: unknown, sessionLogin = "octocat") {
  vi.mocked(requireSession).mockResolvedValue({
    session: { login: sessionLogin, name: "Octocat", avatar_url: "" },
    error: null,
  } as never);
  return new NextRequest("http://localhost/api/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/challenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimitStrict).mockResolvedValue({ allowed: true, current: 1, limit: 3 });
    vi.mocked(sendChallengeEmail).mockResolvedValue({ success: true });
    vi.mocked(isValidHandle).mockReturnValue(true);
    vi.mocked(refundRateLimit).mockResolvedValue(true);
    mockCaptureServerError.mockClear();
    mockCaptureServerError.mockResolvedValue(undefined);
  });

  it("returns 401 when no session", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never);
    const req = new NextRequest("http://localhost/api/challenge", {
      method: "POST",
      body: JSON.stringify({ handle: "octocat", reason: "My score seems off." }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 429 when IP rate limit exceeded", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: { login: "octocat", name: "Octocat", avatar_url: "" },
      error: null,
    } as never);
    vi.mocked(rateLimitStrict).mockResolvedValueOnce({ allowed: false, current: 6, limit: 5 });
    const req = makeRequest({ handle: "octocat", reason: "My score seems off." });

    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it("uses the fail-closed limiter for the per-IP check", async () => {
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });

    await POST(req);

    expect(rateLimitStrict).toHaveBeenCalledWith("ratelimit:challenge-ip:1.2.3.4", 5, 3600);
  });

  it("returns 429 when the per-IP limiter fails closed (Redis unavailable)", async () => {
    vi.mocked(rateLimitStrict).mockResolvedValueOnce({ allowed: false, current: 0, limit: 5 });
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });

    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it("returns 400 when handle is missing", async () => {
    const req = makeRequest({ reason: "My score seems off to me and I want to know why." });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/handle/i);
  });

  it("returns 400 when reason is too short", async () => {
    const req = makeRequest({ handle: "octocat", reason: "Too short" });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reason/i);
  });

  it("returns 400 when reason exceeds 1000 chars", async () => {
    const req = makeRequest({
      handle: "octocat",
      reason: "a".repeat(MAX_CHALLENGE_REASON_LENGTH + 1),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when handle is invalid", async () => {
    vi.mocked(isValidHandle).mockReturnValue(false);
    const req = makeRequest({
      handle: "-octocat",
      reason: "My score seems off and I cannot understand why it is this low.",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid handle/i);
  });

  it("returns 413 when payload exceeds 4 KB", async () => {
    const req = makeRequest({
      handle: "octocat",
      reason: "My score seems off and I cannot understand why it is this low.",
      padding: "x".repeat(MAX_CHALLENGE_BYTES),
    });

    const res = await POST(req);

    expect(res.status).toBe(413);
  });

  it("returns 400 when JSON body is not an object", async () => {
    const req = makeRequest(null);

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("returns 403 when session handle does not match body handle", async () => {
    const req = makeRequest(
      {
        handle: "someone-else",
        reason: "My score seems off and I cannot understand why it is this low.",
      },
      "octocat",
    );

    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("returns 429 when per-handle limit exceeded", async () => {
    vi.mocked(rateLimitStrict)
      .mockResolvedValueOnce({ allowed: true, current: 1, limit: 5 }) // IP check
      .mockResolvedValueOnce({ allowed: false, current: 4, limit: 3 }); // handle check
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });

    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it("uses the fail-closed limiter for the per-handle check", async () => {
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });

    await POST(req);

    expect(rateLimitStrict).toHaveBeenCalledWith("ratelimit:challenge:octocat", 3, 86400);
  });

  it("returns 429 when the per-handle limiter fails closed (Redis unavailable)", async () => {
    vi.mocked(rateLimitStrict)
      .mockResolvedValueOnce({ allowed: true, current: 1, limit: 5 }) // IP check
      .mockResolvedValueOnce({ allowed: false, current: 0, limit: 3 }); // handle check
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });

    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it("returns 200 { success: true } on valid submission", async () => {
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(sendChallengeEmail).toHaveBeenCalledWith(
      "octocat",
      "My delivery score seems off because all my PRs were merged in March.",
    );
  });

  it("returns 502 { success: false }, captures the failure, and refunds the per-handle quota when email send fails", async () => {
    vi.mocked(sendChallengeEmail).mockResolvedValue({ success: false });
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });

    const res = await POST(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "delivery_failed" });
    expect(mockCaptureServerError).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/challenge",
        statusCode: 502,
        error: expect.any(Error),
      }),
    );
    const capturedArg = mockCaptureServerError.mock.calls[0]![0];
    expect((capturedArg.error as Error).message).toMatch(/handle=octocat/);
    expect(refundRateLimit).toHaveBeenCalledWith("ratelimit:challenge:octocat");
  });

  it("captures a second error when the quota refund itself fails, without masking the delivery failure response", async () => {
    vi.mocked(sendChallengeEmail).mockResolvedValue({ success: false });
    vi.mocked(refundRateLimit).mockResolvedValue(false);
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });

    const res = await POST(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "delivery_failed" });
    expect(mockCaptureServerError).toHaveBeenCalledTimes(2);
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: expect.stringMatching(/refund failed/i) }),
      }),
    );
  });

  it("does not refund the per-handle quota or capture a server error when the email send succeeds", async () => {
    const req = makeRequest({
      handle: "octocat",
      reason: "My delivery score seems off because all my PRs were merged in March.",
    });

    await POST(req);

    expect(refundRateLimit).not.toHaveBeenCalled();
    expect(mockCaptureServerError).not.toHaveBeenCalled();
  });
});
