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
  dbGetCampaign: vi.fn(),
  dbUpdateCampaign: vi.fn(),
  dbDeleteCampaign: vi.fn(),
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { dbGetCampaign, dbUpdateCampaign, dbDeleteCampaign } from "@/lib/db/campaigns";
import { GET, PATCH, DELETE } from "./route";

const mockParams = Promise.resolve({ id: "c-1" });

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
  return new NextRequest("https://example.com/api/admin/campaigns/c-1", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const draftCampaign = {
  id: "c-1", name: "Test", status: "draft", subject: "Subject",
  headline: "Headline", bodyText: "Body", features: [], ctaText: "Click",
  ctaUrl: "https://example.com", previewText: null, totalRecipients: 0,
  sentCount: 0, failedCount: 0, createdAt: "2026-03-15T00:00:00Z",
  startedAt: null, completedAt: null,
};

describe("GET /api/admin/campaigns/[id]", () => {
  it("returns campaign by ID", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(draftCampaign as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = await GET(makeRequest(), { params: mockParams });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.campaign.id).toBe("c-1");
  });

  it("returns 404 for non-existent", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: mockParams });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/campaigns/[id]", () => {
  it("updates draft campaign", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(draftCampaign as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);
    const res = await PATCH(makeRequest("PATCH", { name: "Updated" }), { params: mockParams });
    expect(res.status).toBe(200);
  });

  it("returns 400 for non-draft campaign", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ ...draftCampaign, status: "sending" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = await PATCH(makeRequest("PATCH", { name: "Updated" }), { params: mockParams });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/campaigns/[id]", () => {
  it("deletes draft campaign", async () => {
    vi.mocked(dbDeleteCampaign).mockResolvedValue(true);
    const res = await DELETE(makeRequest("DELETE"), { params: mockParams });
    expect(res.status).toBe(200);
  });

  it("returns 400 when delete fails", async () => {
    vi.mocked(dbDeleteCampaign).mockResolvedValue(false);
    const res = await DELETE(makeRequest("DELETE"), { params: mockParams });
    expect(res.status).toBe(400);
  });
});
