// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db/campaigns", () => ({
  dbGetCampaigns: vi.fn(),
}));

vi.mock("@/lib/email/campaigns", () => ({
  processCampaignBatch: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheSet: vi.fn(),
}));

import { dbGetCampaigns } from "@/lib/db/campaigns";
import { processCampaignBatch } from "@/lib/email/campaigns";
import { cacheSet } from "@/lib/cache/redis";
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.mocked(cacheSet).mockResolvedValue(true);
});

function makeRequest(bearer?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return new NextRequest("https://example.com/api/cron/process-campaigns", {
    headers,
  });
}

describe("process-campaigns cron", () => {
  it("returns 503 when CRON_SECRET is not set (fail-secure)", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    const res = await GET(makeRequest("anything"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Cron secret not configured");
  });

  it("returns 401 with wrong token", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("returns idle when no active campaigns", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([]);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("idle");
    expect(cacheSet).toHaveBeenCalledWith(
      "cron:lastrun:process-campaigns",
      expect.any(Number),
      172800,
    );
  });

  it("processes first active campaign", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([
      {
        id: "c-1",
        type: "announcement",
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
    expect(processCampaignBatch).toHaveBeenCalledWith("c-1");
    expect(cacheSet).toHaveBeenCalledWith(
      "cron:lastrun:process-campaigns",
      expect.any(Number),
      172800,
    );
  });
});
