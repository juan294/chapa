import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

const { mockWriteLocaleCookie } = vi.hoisted(() => ({
  mockWriteLocaleCookie: vi.fn(),
}));

vi.mock("@/lib/i18n/cookie", () => ({
  writeLocaleCookie: mockWriteLocaleCookie,
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("https://chapa.thecreativetoken.com/api/locale", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/locale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteLocaleCookie.mockResolvedValue(undefined);
  });

  it("persists a valid locale via writeLocaleCookie and returns 200", async () => {
    const res = await POST(makeRequest({ locale: "es" }));

    expect(res.status).toBe(200);
    expect(mockWriteLocaleCookie).toHaveBeenCalledWith("es");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("accepts the other supported locale", async () => {
    const res = await POST(makeRequest({ locale: "en" }));

    expect(res.status).toBe(200);
    expect(mockWriteLocaleCookie).toHaveBeenCalledWith("en");
  });

  it("rejects an unsupported locale without writing a cookie", async () => {
    const res = await POST(makeRequest({ locale: "fr" }));

    expect(res.status).toBe(400);
    expect(mockWriteLocaleCookie).not.toHaveBeenCalled();
  });

  it("rejects a missing locale field", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(mockWriteLocaleCookie).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON instead of throwing", async () => {
    const req = new NextRequest("https://chapa.thecreativetoken.com/api/locale", {
      method: "POST",
      body: "not json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockWriteLocaleCookie).not.toHaveBeenCalled();
  });
});
