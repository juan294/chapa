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
}));
vi.mock("@/lib/email/templates/announcement", () => ({
  buildAnnouncementHtml: vi.fn(() => "<html><body>Preview</body></html>"),
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { dbGetCampaign } from "@/lib/db/campaigns";
import { buildAnnouncementHtml } from "@/lib/email/templates/announcement";
import { GET } from "./route";

const mockParams = Promise.resolve({ id: "c-1" });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_SECRET = "test-secret";
  vi.mocked(readSessionCookie).mockReturnValue({
    token: "t", login: "admin", name: "Admin", avatar_url: "",
  });
  vi.mocked(isAdminHandle).mockReturnValue(true);
});

function makeRequest(): NextRequest {
  return new NextRequest("https://example.com/api/admin/campaigns/c-1/preview", {
    headers: { cookie: "session=x" },
  });
}

const campaign = {
  id: "c-1", name: "Test", status: "draft", subject: "Subject",
  headline: "Headline", bodyText: "Body", features: [{ text: "Feature" }],
  ctaText: "Click", ctaUrl: "https://example.com", previewText: "Preview text",
  totalRecipients: 0, sentCount: 0, failedCount: 0,
  createdAt: "2026-03-15T00:00:00Z", startedAt: null, completedAt: null,
};

describe("GET /api/admin/campaigns/[id]/preview", () => {
  it("returns rendered HTML", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(campaign as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = await GET(makeRequest(), { params: mockParams });
    const html = await res.text();
    expect(html).toContain("Preview");
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("uses placeholder handle in preview", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(campaign as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    await GET(makeRequest(), { params: mockParams });
    expect(buildAnnouncementHtml).toHaveBeenCalledWith(
      expect.objectContaining({ handle: "your-handle" }),
    );
  });

  it("returns 404 for non-existent campaign", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: mockParams });
    expect(res.status).toBe(404);
  });
});
