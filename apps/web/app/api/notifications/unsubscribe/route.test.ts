import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDbUpdateEmailNotifications = vi.fn();
const mockDbGetUserEmail = vi.fn();

vi.mock("@/lib/db/users", () => ({
  dbUpdateEmailNotifications: (...args: unknown[]) =>
    mockDbUpdateEmailNotifications(...args),
  dbGetUserEmail: (...args: unknown[]) => mockDbGetUserEmail(...args),
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

const mockMarkUnsubscribed = vi.fn();
vi.mock("@/lib/email/audience", () => ({
  markUnsubscribed: (...args: unknown[]) => mockMarkUnsubscribed(...args),
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
  mockDbGetUserEmail.mockResolvedValue(null);
  mockMarkUnsubscribed.mockResolvedValue(null);
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

  it("syncs unsubscribe to Resend when user has email", async () => {
    mockDbGetUserEmail.mockResolvedValue({
      email: "dev@example.com",
      emailNotifications: true,
    });

    await GET(makeRequest("testuser"));

    // Wait for fire-and-forget to flush
    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).toHaveBeenCalledWith("dev@example.com");
  });

  it("does not call Resend sync when user has no email", async () => {
    mockDbGetUserEmail.mockResolvedValue(null);

    await GET(makeRequest("testuser"));

    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).not.toHaveBeenCalled();
  });

  it("does not call Resend sync when dbGetUserEmail rejects (catch returns null)", async () => {
    mockDbGetUserEmail.mockRejectedValue(new Error("DB unreachable"));

    const res = await GET(makeRequest("testuser"));

    // Should still succeed (fail-open)
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).not.toHaveBeenCalled();
  });

  it("does not throw when markUnsubscribed rejects (fire-and-forget)", async () => {
    mockDbGetUserEmail.mockResolvedValue({
      email: "dev@example.com",
      emailNotifications: true,
    });
    mockMarkUnsubscribed.mockRejectedValue(new Error("Resend down"));

    const res = await GET(makeRequest("testuser"));

    expect(res.status).toBe(200);
    // Wait for the fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).toHaveBeenCalledWith("dev@example.com");
  });

  it("does not call Resend sync when email field is empty string", async () => {
    mockDbGetUserEmail.mockResolvedValue({ email: "", emailNotifications: true });

    await GET(makeRequest("testuser"));

    await new Promise((r) => setTimeout(r, 10));
    // Empty string is falsy, so markUnsubscribed should not be called
    expect(mockMarkUnsubscribed).not.toHaveBeenCalled();
  });

  it("does not call Resend sync when email field is undefined", async () => {
    mockDbGetUserEmail.mockResolvedValue({ emailNotifications: true });

    await GET(makeRequest("testuser"));

    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).not.toHaveBeenCalled();
  });

  it("still updates DB even when dbGetUserEmail fails", async () => {
    mockDbGetUserEmail.mockRejectedValue(new Error("query fail"));

    await GET(makeRequest("testuser"));

    // dbUpdate should still have been called (Promise.all runs both)
    expect(mockDbUpdateEmailNotifications).toHaveBeenCalledWith("testuser", false);
  });

  it("passes the rate limit key with the client IP", async () => {
    await GET(makeRequest("testuser"));

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:unsubscribe:127.0.0.1",
      10,
      60,
    );
  });
});
