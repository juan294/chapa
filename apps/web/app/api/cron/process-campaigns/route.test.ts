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
    let c1Calls = 0;
    vi.mocked(processCampaignBatch).mockImplementation(async (campaignId: string) => {
      if (campaignId === "c-1") {
        c1Calls += 1;
        // First batch leaves work behind; second batch drains it.
        return c1Calls === 1
          ? { sent: 5, failed: 0, remaining: 3 }
          : { sent: 3, failed: 0, remaining: 0 };
      }
      return { sent: 4, failed: 0, remaining: 0 };
    });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("ok");
    // c-1 still has remaining work after its first batch, but it must not
    // monopolize the run (BE-M5/#1176 critical constraint): c-2 gets its
    // turn in the same pass before c-1 is revisited for its second batch.
    expect(processCampaignBatch).toHaveBeenCalledTimes(3);
    expect(processCampaignBatch).toHaveBeenNthCalledWith(1, "c-1");
    expect(processCampaignBatch).toHaveBeenNthCalledWith(2, "c-2");
    expect(processCampaignBatch).toHaveBeenNthCalledWith(3, "c-1");
    expect(body.processed).toBe(2);
    expect(body.campaigns).toEqual([
      { campaignId: "c-1", campaignName: "Campaign One", sent: 8, failed: 0, remaining: 0 },
      { campaignId: "c-2", campaignName: "Campaign Two", sent: 4, failed: 0, remaining: 0 },
    ]);
    expect(cacheSet).toHaveBeenCalledWith(
      "cron:lastrun:process-campaigns",
      expect.any(Number),
      172800,
    );
  });

  // BE-M5 (#1176): a run used to call processCampaignBatch exactly ONCE per
  // campaign, claiming at most BATCH_SIZE (50) rows and returning — wasting
  // most of the day's quota when a campaign has a large backlog. The cron
  // must keep giving a campaign additional batches across passes (sharing
  // turns fairly with other active campaigns) until its backlog drains or
  // the shared daily quota runs out.
  it("gives a campaign multiple batches across passes in one run until its backlog drains (BE-M5)", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([
      makeCampaign("c-1", "Campaign One"),
      makeCampaign("c-2", "Campaign Two"),
    ]);
    let c1Calls = 0;
    vi.mocked(processCampaignBatch).mockImplementation(async (campaignId: string) => {
      if (campaignId === "c-1") {
        c1Calls += 1;
        // Simulate a 1000-recipient backlog needing several batches.
        return c1Calls < 3
          ? { sent: 50, failed: 0, remaining: 900 - (c1Calls - 1) * 50 }
          : { sent: 30, failed: 0, remaining: 0 };
      }
      return { sent: 4, failed: 0, remaining: 0 };
    });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("ok");
    // c-1: 3 batches (50 + 50 + 30 = 130 sent), c-2: 1 batch (4 sent).
    expect(processCampaignBatch).toHaveBeenCalledTimes(4);
    expect(body.campaigns).toEqual([
      { campaignId: "c-1", campaignName: "Campaign One", sent: 130, failed: 0, remaining: 0 },
      { campaignId: "c-2", campaignName: "Campaign Two", sent: 4, failed: 0, remaining: 0 },
    ]);
    expect(body.deferred).toBeUndefined();
  });

  // BE-M6 interaction: if a batch attempt makes no forward progress (e.g. a
  // permanently misconfigured Resend client, or an oversized recovered lease
  // group that never fits the remaining quota), looping "while remaining >
  // 0" would busy-spin that one campaign for the entire TIME_BUDGET_MS,
  // hammering the DB for no benefit and starving every other active
  // campaign. A stalled campaign must get exactly one attempt per run and
  // then yield, while other campaigns keep progressing.
  it("stops retrying a campaign that makes no forward progress instead of busy-spinning the run", async () => {
    vi.mocked(dbGetCampaigns).mockResolvedValue([
      makeCampaign("c-1", "Campaign One"),
      makeCampaign("c-2", "Campaign Two"),
    ]);
    vi.mocked(processCampaignBatch).mockImplementation(async (campaignId: string) => {
      // c-1 never makes progress (e.g. Resend permanently unavailable):
      // sent=0, failed=0, but remaining stays positive forever.
      if (campaignId === "c-1") return { sent: 0, failed: 0, remaining: 5 };
      return { sent: 4, failed: 0, remaining: 0 };
    });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("ok");
    // c-1 attempted exactly once despite never reaching remaining 0 or -1.
    expect(processCampaignBatch).toHaveBeenCalledTimes(2);
    expect(processCampaignBatch).toHaveBeenNthCalledWith(1, "c-1");
    expect(processCampaignBatch).toHaveBeenNthCalledWith(2, "c-2");
    expect(body.campaigns).toEqual([
      { campaignId: "c-1", campaignName: "Campaign One", sent: 0, failed: 0, remaining: 5 },
      { campaignId: "c-2", campaignName: "Campaign Two", sent: 4, failed: 0, remaining: 0 },
    ]);
    expect(body.deferred).toBeUndefined();
  });

  it("stops issuing new batches once the per-invocation time budget is exhausted, deferring the rest as time_budget", async () => {
    vi.useFakeTimers();
    try {
      const start = new Date("2026-01-01T00:00:00.000Z");
      vi.setSystemTime(start);
      vi.mocked(dbGetCampaigns).mockResolvedValue([
        makeCampaign("c-1", "Campaign One"),
        makeCampaign("c-2", "Campaign Two"),
      ]);
      vi.mocked(processCampaignBatch).mockImplementation(async () => {
        // Simulate a slow batch call that eats past the 270s time budget
        // (maxDuration=300s minus the 30s buffer).
        vi.setSystemTime(new Date(start.getTime() + 271_000));
        return { sent: 5, failed: 0, remaining: 3 };
      });

      const res = await GET(makeRequest("test-secret"));
      const body = await res.json();

      expect(body.status).toBe("ok");
      expect(processCampaignBatch).toHaveBeenCalledTimes(1);
      expect(processCampaignBatch).toHaveBeenCalledWith("c-1");
      expect(body.campaigns).toEqual([
        { campaignId: "c-1", campaignName: "Campaign One", sent: 5, failed: 0, remaining: 3 },
      ]);
      expect(body.deferred).toEqual([
        { campaignId: "c-2", campaignName: "Campaign Two", reason: "time_budget" },
      ]);
    } finally {
      vi.useRealTimers();
    }
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
