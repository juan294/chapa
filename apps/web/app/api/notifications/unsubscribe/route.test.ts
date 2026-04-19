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
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/auth/unsubscribe-token";

const TEST_SECRET = "test-nextauth-secret-32chars-abcdef";

function makeRequest(handle?: string, token?: string): NextRequest {
  const url = new URL(
    "https://chapa.thecreativetoken.com/api/notifications/unsubscribe",
  );
  if (handle) url.searchParams.set("handle", handle);
  if (token) url.searchParams.set("token", token);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdateEmailNotifications.mockResolvedValue(undefined);
  mockDbGetUserEmail.mockResolvedValue(null);
  mockMarkUnsubscribed.mockResolvedValue(null);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  vi.stubEnv("NEXTAUTH_SECRET", TEST_SECRET);
});

// ---------------------------------------------------------------------------
// HMAC token unit tests
// ---------------------------------------------------------------------------

describe("unsubscribe token utilities", () => {
  it("generateUnsubscribeToken returns a non-empty string", () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("verifyUnsubscribeToken returns true for a freshly generated token", () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    expect(verifyUnsubscribeToken("testuser", token, TEST_SECRET)).toBe(true);
  });

  it("verifyUnsubscribeToken returns false for wrong handle", () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    expect(verifyUnsubscribeToken("otheruser", token, TEST_SECRET)).toBe(false);
  });

  it("verifyUnsubscribeToken returns false for wrong secret", () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    expect(verifyUnsubscribeToken("testuser", token, "wrong-secret")).toBe(
      false,
    );
  });

  it("verifyUnsubscribeToken returns false for tampered token", () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    const tampered = token.slice(0, -4) + "XXXX";
    expect(verifyUnsubscribeToken("testuser", tampered, TEST_SECRET)).toBe(
      false,
    );
  });

  it("verifyUnsubscribeToken returns false for empty string", () => {
    expect(verifyUnsubscribeToken("testuser", "", TEST_SECRET)).toBe(false);
  });

  it("verifyUnsubscribeToken returns false for garbage input", () => {
    expect(
      verifyUnsubscribeToken("testuser", "notavalidtoken", TEST_SECRET),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Route: token enforcement
// ---------------------------------------------------------------------------

describe("GET /api/notifications/unsubscribe — token enforcement", () => {
  it("returns 401 when token is missing", async () => {
    const res = await GET(makeRequest("testuser"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    const res = await GET(makeRequest("testuser", "invalid-token-value"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is for a different handle", async () => {
    const token = generateUnsubscribeToken("otheruser", TEST_SECRET);
    const res = await GET(makeRequest("testuser", token));
    expect(res.status).toBe(401);
  });

  it("returns 200 when valid token is provided", async () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    const res = await GET(makeRequest("testuser", token));
    expect(res.status).toBe(200);
  });

  it("does NOT call dbUpdateEmailNotifications without a valid token", async () => {
    await GET(makeRequest("testuser"));
    expect(mockDbUpdateEmailNotifications).not.toHaveBeenCalled();
  });

  it("calls dbUpdateEmailNotifications with valid token", async () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    await GET(makeRequest("testuser", token));
    expect(mockDbUpdateEmailNotifications).toHaveBeenCalledWith(
      "testuser",
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Route: existing behaviour preserved when token is valid
// ---------------------------------------------------------------------------

describe("GET /api/notifications/unsubscribe", () => {
  it("returns 400 when handle is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns HTML confirmation page", async () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    const res = await GET(makeRequest("testuser", token));

    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("Unsubscribed");
    expect(body).toContain("testuser");
  });

  it("lowercases handle", async () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    await GET(makeRequest("TestUser", token));

    expect(mockDbUpdateEmailNotifications).toHaveBeenCalledWith(
      "testuser",
      false,
    );
  });

  it("escapes HTML in handle to prevent XSS", async () => {
    const xssHandle = '<script>alert("xss")</script>';
    const token = generateUnsubscribeToken(
      xssHandle.toLowerCase(),
      TEST_SECRET,
    );
    const res = await GET(makeRequest(xssHandle, token));
    const body = await res.text();

    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("does not throw when DB update fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockDbUpdateEmailNotifications.mockRejectedValue(new Error("DB down"));

    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    const res = await GET(makeRequest("testuser", token));

    expect(res.status).toBe(200);

    consoleSpy.mockRestore();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    const res = await GET(makeRequest("testuser", token));

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

    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    await GET(makeRequest("testuser", token));

    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).toHaveBeenCalledWith("dev@example.com");
  });

  it("does not call Resend sync when user has no email", async () => {
    mockDbGetUserEmail.mockResolvedValue(null);

    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    await GET(makeRequest("testuser", token));

    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).not.toHaveBeenCalled();
  });

  it("does not call Resend sync when dbGetUserEmail rejects (catch returns null)", async () => {
    mockDbGetUserEmail.mockRejectedValue(new Error("DB unreachable"));

    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    const res = await GET(makeRequest("testuser", token));

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

    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    const res = await GET(makeRequest("testuser", token));

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).toHaveBeenCalledWith("dev@example.com");
  });

  it("does not call Resend sync when email field is empty string", async () => {
    mockDbGetUserEmail.mockResolvedValue({ email: "", emailNotifications: true });

    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    await GET(makeRequest("testuser", token));

    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).not.toHaveBeenCalled();
  });

  it("does not call Resend sync when email field is undefined", async () => {
    mockDbGetUserEmail.mockResolvedValue({ emailNotifications: true });

    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    await GET(makeRequest("testuser", token));

    await new Promise((r) => setTimeout(r, 10));
    expect(mockMarkUnsubscribed).not.toHaveBeenCalled();
  });

  it("still updates DB even when dbGetUserEmail fails", async () => {
    mockDbGetUserEmail.mockRejectedValue(new Error("query fail"));

    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    await GET(makeRequest("testuser", token));

    expect(mockDbUpdateEmailNotifications).toHaveBeenCalledWith(
      "testuser",
      false,
    );
  });

  it("passes the rate limit key with the client IP", async () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    await GET(makeRequest("testuser", token));

    expect(mockRateLimit).toHaveBeenCalledWith(
      "ratelimit:unsubscribe:127.0.0.1",
      10,
      60,
    );
  });

  it("includes lang attribute on html tag", async () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    const res = await GET(makeRequest("testuser", token));
    const body = await res.text();

    expect(body).toContain('<html lang="en">');
  });

  it("includes viewport meta tag", async () => {
    const token = generateUnsubscribeToken("testuser", TEST_SECRET);
    const res = await GET(makeRequest("testuser", token));
    const body = await res.text();

    expect(body).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
    );
  });
});
