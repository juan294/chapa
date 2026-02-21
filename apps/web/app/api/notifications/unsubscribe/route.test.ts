import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDbUpdateEmailNotifications = vi.fn();

vi.mock("@/lib/db/users", () => ({
  dbUpdateEmailNotifications: (...args: unknown[]) =>
    mockDbUpdateEmailNotifications(...args),
}));

vi.mock("@/lib/email/resend", () => ({
  escapeHtml: (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;"),
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/cache/redis", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: () => "127.0.0.1",
}));

import { GET } from "./route";

function makeRequest(handle?: string): NextRequest {
  const url = new URL("https://chapa.thecreativetoken.com/api/notifications/unsubscribe");
  if (handle) url.searchParams.set("handle", handle);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdateEmailNotifications.mockResolvedValue(undefined);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/notifications/unsubscribe", () => {
  it("returns 400 when handle is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("calls dbUpdateEmailNotifications with handle and false", async () => {
    const res = await GET(makeRequest("testuser"));

    expect(mockDbUpdateEmailNotifications).toHaveBeenCalledWith(
      "testuser",
      false,
    );
    expect(res.status).toBe(200);
  });

  it("returns HTML confirmation page", async () => {
    const res = await GET(makeRequest("testuser"));

    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("Unsubscribed");
    expect(body).toContain("testuser");
  });

  it("lowercases handle", async () => {
    await GET(makeRequest("TestUser"));

    expect(mockDbUpdateEmailNotifications).toHaveBeenCalledWith(
      "testuser",
      false,
    );
  });

  it("escapes HTML in handle to prevent XSS", async () => {
    const res = await GET(makeRequest('<script>alert("xss")</script>'));
    const body = await res.text();

    // Must NOT contain raw script tag
    expect(body).not.toContain("<script>");
    // Must contain the escaped version
    expect(body).toContain("&lt;script&gt;");
  });

  it("does not throw when DB update fails", async () => {
    // Silence expected console.error from the fail-open error-handling path
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockDbUpdateEmailNotifications.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeRequest("testuser"));

    // Still shows confirmation — fail-open for UX
    expect(res.status).toBe(200);

    consoleSpy.mockRestore();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const res = await GET(makeRequest("testuser"));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = await res.json();
    expect(body.error).toMatch(/too many requests/i);
  });
});
