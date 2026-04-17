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

import { adminAuthBeforeEach } from "@/lib/test-helpers/admin-auth";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { dbGetCampaign } from "@/lib/db/campaigns";
import { initiateCampaign, processCampaignBatch } from "@/lib/email/campaigns";
import { POST } from "./route";

const mockParams = Promise.resolve({ id: "c-1" });

beforeEach(() => {
  adminAuthBeforeEach();
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
    const body = await res.json();
    expect(body.error).toBe("Campaign already started");
  });

  it("returns 400 for sent campaigns", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "sent" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(400);
  });

  it("returns 400 for failed campaigns", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "failed" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(400);
  });

  it("returns 400 for engagement campaigns", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "draft", type: "engagement" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Engagement campaigns are sent automatically");
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
    expect(body.message).toContain("200 emails");
  });

  it("returns 500 when initiateCampaign returns null", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "draft" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(initiateCampaign).mockResolvedValue(null);

    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to initiate campaign");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, current: 11, limit: 10 });
    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 500 when NEXTAUTH_SECRET is missing (server misconfiguration)", async () => {
    delete process.env.NEXTAUTH_SECRET;
    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(500);
  });

  it("returns 401 without session", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(isAdminHandle).mockReturnValue(false);
    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(403);
  });

  it("includes firstBatch result in response", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "draft" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(initiateCampaign).mockResolvedValue({ totalRecipients: 50 });
    vi.mocked(processCampaignBatch).mockResolvedValue({ sent: 50, failed: 0, remaining: 0 });

    const res = await POST(makeRequest(), { params: mockParams });
    const body = await res.json();

    expect(body.firstBatch).toEqual({ sent: 50, failed: 0, remaining: 0 });
  });

  it("passes campaign id and pre-fetched campaign to initiateCampaign", async () => {
    const campaign = { status: "draft" };
    vi.mocked(dbGetCampaign).mockResolvedValue(campaign as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(initiateCampaign).mockResolvedValue({ totalRecipients: 1 });
    vi.mocked(processCampaignBatch).mockResolvedValue({ sent: 1, failed: 0, remaining: 0 });

    await POST(makeRequest(), { params: mockParams });

    expect(initiateCampaign).toHaveBeenCalledWith("c-1", campaign);
    expect(processCampaignBatch).toHaveBeenCalledWith("c-1");
  });

  it("reports firstBatch with partial failures", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "draft" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(initiateCampaign).mockResolvedValue({ totalRecipients: 30 });
    vi.mocked(processCampaignBatch).mockResolvedValue({ sent: 25, failed: 5, remaining: 0 });

    const res = await POST(makeRequest(), { params: mockParams });
    const body = await res.json();

    expect(body.firstBatch.sent).toBe(25);
    expect(body.firstBatch.failed).toBe(5);
    expect(body.message).toBe("All emails sent");
  });

  it("shows single-batch message when recipients exactly 95", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "draft" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(initiateCampaign).mockResolvedValue({ totalRecipients: 95 });
    vi.mocked(processCampaignBatch).mockResolvedValue({ sent: 95, failed: 0, remaining: 0 });

    const res = await POST(makeRequest(), { params: mockParams });
    const body = await res.json();

    expect(body.message).toBe("All emails sent");
  });

  it("shows multi-batch message when recipients = 96", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({ status: "draft" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(initiateCampaign).mockResolvedValue({ totalRecipients: 96 });
    vi.mocked(processCampaignBatch).mockResolvedValue({ sent: 50, failed: 0, remaining: 46 });

    const res = await POST(makeRequest(), { params: mockParams });
    const body = await res.json();

    expect(body.message).toContain("daily batches of 95");
  });
});
