import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupplementalStats } from "@chapa/shared";
import { makeStats } from "@/lib/test-helpers/fixtures";

const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
let terminalResolve: { data: unknown; error: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((): any => {
  const chain: Record<string, unknown> = {};
  chain.upsert = mockUpsert;
  chain.select = (...args: unknown[]) => {
    mockSelect(...args);
    return chain;
  };
  chain.eq = (...args: unknown[]) => {
    mockEq(...args);
    return chain;
  };
  chain.delete = () => {
    mockDelete();
    return chain;
  };
  chain.maybeSingle = () => ({
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      if (terminalResolve.error) reject(terminalResolve.error);
      else resolve(terminalResolve);
    },
  });
  // For delete().eq() chain
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
    if (terminalResolve.error) reject(terminalResolve.error);
    else resolve(terminalResolve);
  };
  return chain;
});

vi.mock("./supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { getSupabase } from "./supabase";
import {
  dbUpsertSupplemental,
  dbGetSupplemental,
  dbDeleteSupplemental,
} from "./supplemental";

const supplemental: SupplementalStats = {
  targetHandle: "juan294",
  sourceHandle: "Juan-GonzalezPonce_avoltagh",
  stats: makeStats({
    handle: "Juan-GonzalezPonce_avoltagh",
    commitsTotal: 1312,
    prsMergedCount: 28,
    reviewsSubmittedCount: 10,
  }),
  uploadedAt: "2026-04-26T08:08:14.276Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  terminalResolve = { data: null, error: null };
});

describe("dbUpsertSupplemental", () => {
  it("upserts row keyed on target_handle (lowercased)", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await dbUpsertSupplemental("Juan294", supplemental);

    expect(mockFrom).toHaveBeenCalledWith("supplemental_stats");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        target_handle: "juan294",
        source_handle: "Juan-GonzalezPonce_avoltagh",
        uploaded_at: "2026-04-26T08:08:14.276Z",
      }),
      { onConflict: "target_handle" },
    );
  });

  it("stores stats payload as JSONB column", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await dbUpsertSupplemental("juan294", supplemental);

    const firstCall = mockUpsert.mock.calls[0]?.[0] as
      | { stats: { commitsTotal: number } }
      | undefined;
    expect(firstCall?.stats.commitsTotal).toBe(1312);
  });

  it("returns true on success", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const result = await dbUpsertSupplemental("juan294", supplemental);

    expect(result).toBe(true);
  });

  it("returns false on error", async () => {
    mockUpsert.mockResolvedValue({ error: new Error("DB down") });

    const result = await dbUpsertSupplemental("juan294", supplemental);

    expect(result).toBe(false);
  });

  it("returns false when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbUpsertSupplemental("juan294", supplemental);

    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("dbGetSupplemental", () => {
  it("returns the SupplementalStats payload on hit", async () => {
    terminalResolve = {
      data: {
        target_handle: "juan294",
        source_handle: "Juan-GonzalezPonce_avoltagh",
        stats: supplemental.stats,
        uploaded_at: "2026-04-26T08:08:14.276Z",
      },
      error: null,
    };

    const result = await dbGetSupplemental("juan294");

    expect(result).toEqual(supplemental);
  });

  it("queries by lowercased target_handle", async () => {
    await dbGetSupplemental("Juan294");

    expect(mockEq).toHaveBeenCalledWith("target_handle", "juan294");
  });

  it("returns null on miss", async () => {
    terminalResolve = { data: null, error: null };
    expect(await dbGetSupplemental("nobody")).toBeNull();
  });

  it("returns null when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    expect(await dbGetSupplemental("juan294")).toBeNull();
  });

  it("returns null on error without throwing", async () => {
    terminalResolve = { data: null, error: new Error("DB error") };
    expect(await dbGetSupplemental("juan294")).toBeNull();
  });

  it("returns null when row is missing required fields", async () => {
    terminalResolve = {
      // Missing source_handle and stats — must reject not coerce
      data: { target_handle: "juan294", uploaded_at: "2026-04-26T00:00:00Z" },
      error: null,
    };
    expect(await dbGetSupplemental("juan294")).toBeNull();
  });
});

describe("dbDeleteSupplemental", () => {
  it("deletes by lowercased target_handle", async () => {
    terminalResolve = { data: null, error: null };

    const ok = await dbDeleteSupplemental("Juan294");

    expect(ok).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("target_handle", "juan294");
  });

  it("returns false on error", async () => {
    terminalResolve = { data: null, error: new Error("DB error") };
    expect(await dbDeleteSupplemental("juan294")).toBe(false);
  });

  it("returns false when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    expect(await dbDeleteSupplemental("juan294")).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
