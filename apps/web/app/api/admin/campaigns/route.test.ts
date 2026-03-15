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

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { dbGetCampaigns, dbCreateCampaign } from "@/lib/db/campaigns";
import { GET, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_SECRET = "test-secret";
  vi.mocked(readSessionCookie).mockReturnValue({
    token: "t", login: "admin", name: "Admin", avatar_url: "",
  });
  vi.mocked(isAdminHandle).mockReturnValue(true);
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
});

describe("POST /api/admin/campaigns", () => {
  it("creates draft campaign", async () => {
    vi.mocked(dbCreateCampaign).mockResolvedValue("new-id");
    const res = await POST(
      makeRequest("POST", {
        name: "Test", subject: "Subject", headline: "Headline",
        bodyText: "Body", ctaText: "Click", ctaUrl: "https://example.com",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("new-id");
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest("POST", { name: "Test" }));
    expect(res.status).toBe(400);
  });
});
