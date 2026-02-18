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

import { GET } from "./route";

function makeRequest(handle?: string): NextRequest {
  const url = new URL("https://chapa.thecreativetoken.com/api/notifications/unsubscribe");
  if (handle) url.searchParams.set("handle", handle);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdateEmailNotifications.mockResolvedValue(undefined);
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

  it("does not throw when DB update fails", async () => {
    mockDbUpdateEmailNotifications.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeRequest("testuser"));

    // Still shows confirmation — fail-open for UX
    expect(res.status).toBe(200);
  });
});
