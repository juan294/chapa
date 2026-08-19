import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn();

vi.mock("../supabase", () => ({
  getSupabase: vi.fn(() => ({ rpc: mockRpc })),
}));

import { getSupabase } from "../supabase";
import { CampaignStatsReadError, dbGetCampaignStats } from "./sends";

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({
    data: [{ sent: 0, pending: 0, processing: 0, failed: 0 }],
    error: null,
  });
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
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("uses one atomic aggregate RPC without transferring send rows", async () => {
    mockRpc.mockResolvedValue({
      data: [{ sent: 2, pending: 1, processing: 3, failed: 4 }],
      error: null,
    });

    await expect(dbGetCampaignStats("campaign-1")).resolves.toEqual({
      sent: 2,
      pending: 1,
      processing: 3,
      failed: 4,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("get_campaign_send_stats", {
      p_campaign_id: "campaign-1",
    });
  });

  it("preserves exact counts above the PostgREST row cap", async () => {
    mockRpc.mockResolvedValue({
      data: [{ sent: 1250, pending: 0, processing: 0, failed: 0 }],
      error: null,
    });

    await expect(dbGetCampaignStats("campaign-1")).resolves.toEqual({
      sent: 1250,
      pending: 0,
      processing: 0,
      failed: 0,
    });
  });

  it("propagates a typed failure when the aggregate query fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error("query failed"),
    });

    await expect(dbGetCampaignStats("campaign-1")).rejects.toEqual(
      expect.objectContaining({
        name: "CampaignStatsReadError",
        campaignId: "campaign-1",
        cause: expect.objectContaining({ message: "query failed" }),
      }),
    );
  });

  it("fails loudly on a malformed aggregate response", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await expect(dbGetCampaignStats("campaign-1")).rejects.toMatchObject({
      name: "CampaignStatsReadError",
      campaignId: "campaign-1",
    });
  });

  it("keeps the exported error type stable", () => {
    expect(
      new CampaignStatsReadError("campaign-1", new Error("cause")),
    ).toBeInstanceOf(CampaignStatsReadError);
  });
});
