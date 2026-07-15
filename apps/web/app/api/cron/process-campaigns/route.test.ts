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

  function makeCampaign(id: string, name: string) {
    return {
      id,
      type: "announcement" as const,
      name,
      status: "sending" as const,
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
    };
  }

  it("round-robins across ALL active campaigns in a single run, not just the first", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([
      makeCampaign("c-1", "Campaign One"),
      makeCampaign("c-2", "Campaign Two"),
    ]);
    vi.mocked(processCampaignBatch).mockImplementation(async (campaignId: string) => {
      if (campaignId === "c-1") return { sent: 5, failed: 0, remaining: 3 };
      return { sent: 4, failed: 0, remaining: 0 };
    });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("ok");
    expect(processCampaignBatch).toHaveBeenCalledTimes(2);
    expect(processCampaignBatch).toHaveBeenNthCalledWith(1, "c-1");
    expect(processCampaignBatch).toHaveBeenNthCalledWith(2, "c-2");
    expect(body.processed).toBe(2);
    expect(body.campaigns).toEqual([
      { campaignId: "c-1", campaignName: "Campaign One", sent: 5, failed: 0, remaining: 3 },
      { campaignId: "c-2", campaignName: "Campaign Two", sent: 4, failed: 0, remaining: 0 },
    ]);
    expect(cacheSet).toHaveBeenCalledWith(
      "cron:lastrun:process-campaigns",
      expect.any(Number),
      172800,
    );
  });

  it("stops iterating and defers remaining campaigns once the shared daily quota is exhausted", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([
      makeCampaign("c-1", "Campaign One"),
      makeCampaign("c-2", "Campaign Two"),
    ]);
    // remaining: -1 is processCampaignBatch's signal that the shared Redis
    // daily-send quota is exhausted (see lib/email/campaigns.ts).
    vi.mocked(processCampaignBatch).mockImplementation(async (campaignId: string) => {
      if (campaignId === "c-1") return { sent: 95, failed: 0, remaining: -1 };
      throw new Error("campaign c-2 must not be processed once quota is exhausted");
    });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("ok");
    // Only the first campaign was ever attempted — the second is deferred,
    // never calling processCampaignBatch (and therefore never able to send
    // past the daily cap).
    expect(processCampaignBatch).toHaveBeenCalledTimes(1);
    expect(processCampaignBatch).toHaveBeenCalledWith("c-1");
    expect(body.processed).toBe(1);
    expect(body.campaigns).toEqual([
      { campaignId: "c-1", campaignName: "Campaign One", sent: 95, failed: 0, remaining: -1 },
    ]);
    expect(body.deferred).toEqual([
      { campaignId: "c-2", campaignName: "Campaign Two", reason: "quota_exhausted" },
    ]);
  });
});
