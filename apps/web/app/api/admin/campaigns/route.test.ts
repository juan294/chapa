// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));
vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: vi.fn(),
}));
vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
}));
vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/db/campaigns", () => ({
  dbGetCampaigns: vi.fn(),
  dbCreateCampaign: vi.fn(),
}));

import { adminAuthBeforeEach } from "@/lib/test-helpers/admin-auth";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { dbGetCampaigns, dbCreateCampaign } from "@/lib/db/campaigns";
import { GET, POST } from "./route";

beforeEach(() => {
  adminAuthBeforeEach();
});

function makeRequest(method = "GET", body?: unknown): NextRequest {
  const headers: Record<string, string> = { cookie: "session=x" };
  if (body) headers["Content-Type"] = "application/json";
  return new NextRequest("https://example.com/api/admin/campaigns", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// GET /api/admin/campaigns
// ---------------------------------------------------------------------------

describe("GET /api/admin/campaigns", () => {
  it("returns 401 without session", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(isAdminHandle).mockReturnValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns campaign list", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([
      { id: "c-1", name: "Test", status: "draft" } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ]);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.campaigns).toHaveLength(1);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, current: 11, limit: 10 });
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 500 when NEXTAUTH_SECRET is missing (server misconfiguration)", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", undefined);
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns empty campaigns array when DB returns empty", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([]);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.campaigns).toEqual([]);
  });

  it("filters by a valid ?type= query param", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([]);
    const req = new NextRequest("https://example.com/api/admin/campaigns?type=announcement", {
      headers: { cookie: "session=x" },
    });
    await GET(req);
    expect(dbGetCampaigns).toHaveBeenCalledWith(undefined, "announcement");
  });

  it("ignores an invalid ?type= query param", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([]);
    const req = new NextRequest("https://example.com/api/admin/campaigns?type=bogus", {
      headers: { cookie: "session=x" },
    });
    await GET(req);
    expect(dbGetCampaigns).toHaveBeenCalledWith(undefined, undefined);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/campaigns
// ---------------------------------------------------------------------------

describe("POST /api/admin/campaigns", () => {
  const validBody = {
    name: "Test",
    subject: "Subject",
    headline: "Headline",
    bodyText: "Body",
    ctaText: "Click",
    ctaUrl: "https://example.com",
  };

  it("creates draft campaign", async () => {
    vi.mocked(dbCreateCampaign).mockResolvedValue("new-id");
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("new-id");
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest("POST", { name: "Test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for each missing required field", async () => {
    const required = ["name", "subject", "headline", "bodyText", "ctaText", "ctaUrl"];
    for (const field of required) {
      const body = { ...validBody };
      delete (body as Record<string, unknown>)[field];
      const res = await POST(makeRequest("POST", body));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain(field);
    }
  });

  it("returns 400 for non-string required field", async () => {
    const res = await POST(makeRequest("POST", { ...validBody, name: 123 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("name");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("https://example.com/api/admin/campaigns", {
      method: "POST",
      headers: { cookie: "session=x", "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 500 when dbCreateCampaign returns null", async () => {
    vi.mocked(dbCreateCampaign).mockResolvedValue(null);
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create campaign");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, current: 11, limit: 10 });
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(429);
  });

  it("returns 401 without session", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(isAdminHandle).mockReturnValue(false);
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(403);
  });

  it("returns 500 when NEXTAUTH_SECRET is missing (server misconfiguration)", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", undefined);
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(500);
  });

  it("passes optional previewText and features to dbCreateCampaign", async () => {
    vi.mocked(dbCreateCampaign).mockResolvedValue("new-id");
    const bodyWithOptionals = {
      ...validBody,
      previewText: "Preview text",
      features: [{ text: "Feature 1" }],
    };
    await POST(makeRequest("POST", bodyWithOptionals));

    expect(dbCreateCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        previewText: "Preview text",
        features: [{ text: "Feature 1" }],
      }),
    );
  });

  it("rejects malformed features on create", async () => {
    const res = await POST(
      makeRequest("POST", {
        ...validBody,
        features: [{ text: 42 }],
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/features\[0\]\.text/i);
    expect(dbCreateCampaign).not.toHaveBeenCalled();
  });

  it("rejects non-string previewText on create", async () => {
    const res = await POST(
      makeRequest("POST", {
        ...validBody,
        previewText: 42,
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/previewText/i);
    expect(dbCreateCampaign).not.toHaveBeenCalled();
  });

  it("defaults previewText to null and features to [] when not provided", async () => {
    vi.mocked(dbCreateCampaign).mockResolvedValue("new-id");
    await POST(makeRequest("POST", validBody));

    expect(dbCreateCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        previewText: null,
        features: [],
      }),
    );
  });

  // SE-L1: ctaUrl validation
  it("rejects javascript: ctaUrl with 400", async () => {
    const res = await POST(
      makeRequest("POST", { ...validBody, ctaUrl: "javascript:evil()" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ctaUrl/i);
  });

  it("rejects invalid URL as ctaUrl with 400", async () => {
    const res = await POST(
      makeRequest("POST", { ...validBody, ctaUrl: "not-a-url" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ctaUrl/i);
  });

  it("accepts https: ctaUrl", async () => {
    vi.mocked(dbCreateCampaign).mockResolvedValue("new-id");
    const res = await POST(
      makeRequest("POST", { ...validBody, ctaUrl: "https://example.com/path" }),
    );
    expect(res.status).toBe(201);
  });

  it("accepts http: ctaUrl", async () => {
    vi.mocked(dbCreateCampaign).mockResolvedValue("new-id");
    const res = await POST(
      makeRequest("POST", { ...validBody, ctaUrl: "http://example.com" }),
    );
    expect(res.status).toBe(201);
  });

  // BE-M2 (#951): zod schema validation for POST body
  describe("BE-M2 (#951): zod schema validation", () => {
    it("returns 400 with structured error when name is a number", async () => {
      const res = await POST(makeRequest("POST", { ...validBody, name: 999 }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });

    it("returns 400 with structured error when required fields are entirely absent", async () => {
      const res = await POST(makeRequest("POST", {}));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });

    it("returns 400 with error referencing the invalid field when subject is missing", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { subject: _subject, ...bodyWithoutSubject } = validBody;
      const res = await POST(makeRequest("POST", bodyWithoutSubject));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/subject/i);
    });
  });
});
