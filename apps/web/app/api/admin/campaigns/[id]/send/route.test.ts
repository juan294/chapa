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
vi.mock("@/lib/email/campaigns", () => ({
  initiateCampaign: vi.fn(),
  processCampaignBatch: vi.fn(),
  DAILY_SEND_LIMIT: 95,
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { dbGetCampaign } from "@/lib/db/campaigns";
import { initiateCampaign, processCampaignBatch } from "@/lib/email/campaigns";
import { POST } from "./route";

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
  return new NextRequest("https://example.com/api/admin/campaigns/c-1/send", {
    method: "POST",
    headers: { cookie: "session=x" },
  });
}

describe("POST /api/admin/campaigns/[id]/send", () => {
  it("returns 404 for non-existent campaign", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(404);
  });

  it("returns 400 if campaign is not draft", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "sending" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(400);
  });

  it("initiates campaign and processes first batch", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "draft" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(initiateCampaign).mockResolvedValue({ totalRecipients: 10 });
    vi.mocked(processCampaignBatch).mockResolvedValue({ sent: 10, failed: 0, remaining: 0 });

    const res = await POST(makeRequest(), { params: mockParams });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalRecipients).toBe(10);
    expect(body.message).toBe("All emails sent");
  });

  it("indicates multi-day delivery when recipients > 95", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "draft" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(initiateCampaign).mockResolvedValue({ totalRecipients: 200 });
    vi.mocked(processCampaignBatch).mockResolvedValue({ sent: 50, failed: 0, remaining: 150 });

    const res = await POST(makeRequest(), { params: mockParams });
    const body = await res.json();

    expect(body.message).toContain("daily batches of 95");
  });
});
