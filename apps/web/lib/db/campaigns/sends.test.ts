import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client — chain used by dbGetCampaignStats:
//   from("campaign_sends").select("status").eq(...).order("id").range(from, to)
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();

let rangeResolve: { data: unknown; error: unknown };
// Optional per-call resolver for simulating multiple distinct .range() pages.
let rangeResolver:
  | ((from: number, to: number) => { data: unknown; error: unknown })
  | null;

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
const mockFrom = vi.fn((_table: string): any => ({
  select: (...args: unknown[]) => {
    mockSelect(...args);
    return {
      eq: (...eqArgs: unknown[]) => {
        mockEq(...eqArgs);
        return {
          order: (...orderArgs: unknown[]) => {
            mockOrder(...orderArgs);
            return {
              range: (...rangeArgs: unknown[]) => {
                mockRange(...rangeArgs);
                if (rangeResolver) {
                  const [from, to] = rangeArgs as [number, number];
                  return Promise.resolve(rangeResolver(from, to));
                }
                return Promise.resolve(rangeResolve);
              },
            };
          },
        };
      },
    };
  },
}));

vi.mock("../supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { getSupabase } from "../supabase";
import { dbGetCampaignStats } from "./sends";

beforeEach(() => {
  vi.clearAllMocks();
  rangeResolve = { data: [], error: null };
  rangeResolver = null;
});

describe("dbGetCampaignStats", () => {
  it("returns zeroed stats when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbGetCampaignStats("campaign-1");

    expect(result).toEqual({ sent: 0, pending: 0, processing: 0, failed: 0 });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("aggregates status counts for a small campaign in a single page", async () => {
    rangeResolve = {
      data: [
        { status: "sent" },
        { status: "sent" },
        { status: "pending" },
        { status: "processing" },
        { status: "failed" },
      ],
      error: null,
    };

    const result = await dbGetCampaignStats("campaign-1");

    expect(result).toEqual({ sent: 2, pending: 1, processing: 1, failed: 1 });
    expect(mockFrom).toHaveBeenCalledWith("campaign_sends");
    expect(mockSelect).toHaveBeenCalledWith("status");
    expect(mockEq).toHaveBeenCalledWith("campaign_id", "campaign-1");
    expect(mockOrder).toHaveBeenCalledWith("id");
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });

  it("returns zeroed stats on query error", async () => {
    rangeResolve = { data: null, error: new Error("query failed") };

    const result = await dbGetCampaignStats("campaign-1");

    expect(result).toEqual({ sent: 0, pending: 0, processing: 0, failed: 0 });
  });

  it("ignores unrecognized status values instead of throwing", async () => {
    rangeResolve = {
      data: [{ status: "sent" }, { status: "some-unknown-status" }],
      error: null,
    };

    const result = await dbGetCampaignStats("campaign-1");

    expect(result).toEqual({ sent: 1, pending: 0, processing: 0, failed: 0 });
  });

  it("counts every send past the 1000-row max_rows cap instead of truncating (#1079)", async () => {
    // 1000 "sent" rows (a full page) + 250 "failed" rows past the cap.
    const page1 = Array.from({ length: 1000 }, () => ({ status: "sent" }));
    const page2 = Array.from({ length: 250 }, () => ({ status: "failed" }));

    rangeResolver = (from) =>
      from === 0 ? { data: page1, error: null } : { data: page2, error: null };

    const result = await dbGetCampaignStats("campaign-1");

    expect(result).toEqual({ sent: 1000, pending: 0, processing: 0, failed: 250 });
    expect(mockRange).toHaveBeenCalledWith(0, 999);
    expect(mockRange).toHaveBeenCalledWith(1000, 1999);
  });

  it("a mid-pagination error still surfaces as zeroed stats, not a partial undercount (#1079)", async () => {
    const page1 = Array.from({ length: 1000 }, () => ({ status: "sent" }));
    const err = new Error("connection reset");

    rangeResolver = (from) =>
      from === 0 ? { data: page1, error: null } : { data: null, error: err };

    const result = await dbGetCampaignStats("campaign-1");

    // Must NOT report { sent: 1000, ... } as if that were the complete
    // count — a partial page-1-only result would silently undercount and
    // could prematurely mark the campaign complete.
    expect(result).toEqual({ sent: 0, pending: 0, processing: 0, failed: 0 });
  });
});
