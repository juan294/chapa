import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();

type CountResult = { count: number | null; error: unknown };
let countResults: Record<string, CountResult>;

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
const mockFrom = vi.fn((_table: string): any => ({
  select: (...selectArgs: unknown[]) => {
    mockSelect(...selectArgs);
    const query: any = {
      eq: (field: string, value: string) => {
        mockEq(field, value);
        if (field === "status") {
          return Promise.resolve(countResults[value]);
        }
        return query;
      },
    };
    return query;
  },
}));

vi.mock("../supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { getSupabase } from "../supabase";
import { CampaignStatsReadError, dbGetCampaignStats } from "./sends";

beforeEach(() => {
  vi.clearAllMocks();
  countResults = {
    sent: { count: 0, error: null },
    pending: { count: 0, error: null },
    processing: { count: 0, error: null },
    failed: { count: 0, error: null },
  };
});

describe("dbGetCampaignStats", () => {
  it("fails loudly when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    await expect(dbGetCampaignStats("campaign-1")).rejects.toEqual(
      expect.objectContaining({
        name: "CampaignStatsReadError",
        campaignId: "campaign-1",
      }),
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("uses four exact HEAD counts without transferring send rows", async () => {
    countResults = {
      sent: { count: 2, error: null },
      pending: { count: 1, error: null },
      processing: { count: 3, error: null },
      failed: { count: 4, error: null },
    };

    await expect(dbGetCampaignStats("campaign-1")).resolves.toEqual({
      sent: 2,
      pending: 1,
      processing: 3,
      failed: 4,
    });

    expect(mockFrom).toHaveBeenCalledTimes(4);
    expect(mockSelect).toHaveBeenCalledTimes(4);
    expect(mockSelect).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });
    expect(mockEq).toHaveBeenCalledTimes(8);
    expect(mockEq).toHaveBeenCalledWith("campaign_id", "campaign-1");
    for (const status of ["sent", "pending", "processing", "failed"]) {
      expect(mockEq).toHaveBeenCalledWith("status", status);
    }
  });

  it("preserves exact counts above the PostgREST row cap", async () => {
    countResults.sent = { count: 1250, error: null };

    await expect(dbGetCampaignStats("campaign-1")).resolves.toEqual({
      sent: 1250,
      pending: 0,
      processing: 0,
      failed: 0,
    });
  });

  it("propagates a typed failure when any count query fails", async () => {
    countResults.processing = {
      count: null,
      error: new Error("query failed"),
    };

    await expect(dbGetCampaignStats("campaign-1")).rejects.toEqual(
      expect.objectContaining({
        name: "CampaignStatsReadError",
        campaignId: "campaign-1",
        cause: expect.objectContaining({ message: "query failed" }),
      }),
    );
  });

  it("treats a successful null count as zero", async () => {
    countResults.failed = { count: null, error: null };

    await expect(dbGetCampaignStats("campaign-1")).resolves.toEqual({
      sent: 0,
      pending: 0,
      processing: 0,
      failed: 0,
    });
  });

  it("keeps the exported error type stable", () => {
    expect(
      new CampaignStatsReadError("campaign-1", new Error("cause")),
    ).toBeInstanceOf(CampaignStatsReadError);
  });
});
