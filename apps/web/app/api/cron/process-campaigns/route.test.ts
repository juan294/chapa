// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db/campaigns", () => ({
  dbGetCampaigns: vi.fn(),
}));

vi.mock("@/lib/email/campaigns", () => ({
  processCampaignBatch: vi.fn(),
}));

import { dbGetCampaigns } from "@/lib/db/campaigns";
import { processCampaignBatch } from "@/lib/email/campaigns";
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

function makeRequest(bearer?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return new NextRequest("https://example.com/api/cron/process-campaigns", {
    headers,
  });
}

describe("process-campaigns cron", () => {
  it("returns 401 without valid CRON_SECRET", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest("anything"));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("returns idle when no active campaigns", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([]);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("idle");
  });

  it("processes first active campaign", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([
      {
        id: "c-1",
        name: "Test Campaign",
        status: "sending",
        subject: "Test",
        previewText: null,
        headline: "Test",
        bodyText: "Test",
        features: [],
        ctaText: "Click",
        ctaUrl: "https://example.com",
        totalRecipients: 10,
        sentCount: 5,
        failedCount: 0,
        createdAt: "2026-03-15T00:00:00Z",
        startedAt: "2026-03-15T00:00:00Z",
        completedAt: null,
      },
    ]);
    vi.mocked(processCampaignBatch).mockResolvedValue({
      sent: 5,
      failed: 0,
      remaining: 0,
    });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("ok");
    expect(body.campaignId).toBe("c-1");
    expect(body.sent).toBe(5);
  });
});
