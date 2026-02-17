import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VerificationRecord } from "@/lib/verification/types";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn();
const mockDelete = vi.fn();
let terminalResolve: { data: unknown; error: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((): any => {
  const chain: Record<string, unknown> = {};
  chain.upsert = mockUpsert;
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.gt = () => chain;
  chain.lt = () => chain;
  chain.delete = () => {
    mockDelete();
    return chain;
  };
  chain.maybeSingle = () => ({
    then: (
      resolve: (v: unknown) => void,
      reject: (e: unknown) => void,
    ) => {
      if (terminalResolve.error) reject(terminalResolve.error);
      else resolve(terminalResolve);
    },
  });
  // For delete().select() chain
  chain.then = (
    resolve: (v: unknown) => void,
    reject: (e: unknown) => void,
  ) => {
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
  dbStoreVerification,
  dbGetVerification,
  dbCleanExpiredVerifications,
} from "./verification";

const record: VerificationRecord = {
  handle: "testuser",
  displayName: "Test User",
  adjustedComposite: 52,
  confidence: 85,
  tier: "Solid",
  archetype: "Builder",
  profileType: "collaborative",
  dimensions: { building: 70, guarding: 50, consistency: 60, breadth: 40 },
  commitsTotal: 200,
  prsMergedCount: 30,
  reviewsSubmittedCount: 50,
  generatedAt: "2025-06-15",
};

beforeEach(() => {
  vi.clearAllMocks();
  terminalResolve = { data: null, error: null };
});

// ---------------------------------------------------------------------------
// dbStoreVerification
// ---------------------------------------------------------------------------

describe("dbStoreVerification", () => {
  it("upserts the record with flattened dimensions", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await dbStoreVerification("abc12345", record);

    expect(mockFrom).toHaveBeenCalledWith("verification_records");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: "abc12345",
        handle: "testuser",
        display_name: "Test User",
        building: 70,
        guarding: 50,
        consistency: 60,
        breadth: 40,
        adjusted_composite: 52,
        generated_at: "2025-06-15",
      }),
      { onConflict: "hash" },
    );
  });

  it("normalizes handle to lowercase", async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const upperRecord = { ...record, handle: "TestUser" };

    await dbStoreVerification("abc12345", upperRecord);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ handle: "testuser" }),
      expect.any(Object),
    );
  });

  it("does not throw on error", async () => {
    mockUpsert.mockResolvedValue({ error: new Error("DB down") });

    await expect(
      dbStoreVerification("abc12345", record),
    ).resolves.toBeUndefined();
  });

  it("returns void when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    await expect(
      dbStoreVerification("abc12345", record),
    ).resolves.toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// dbGetVerification
// ---------------------------------------------------------------------------

describe("dbGetVerification", () => {
  it("returns the verification record on hit", async () => {
    const row = {
      hash: "abc12345",
      handle: "testuser",
      display_name: "Test User",
      adjusted_composite: 52,
      confidence: 85,
      tier: "Solid",
      archetype: "Builder",
      profile_type: "collaborative",
      building: 70,
      guarding: 50,
      consistency: 60,
      breadth: 40,
      commits_total: 200,
      prs_merged_count: 30,
      reviews_submitted: 50,
      generated_at: "2025-06-15",
    };
    terminalResolve = { data: row, error: null };

    const result = await dbGetVerification("abc12345");

    expect(result).toEqual(record);
  });

  it("returns null on miss", async () => {
    terminalResolve = { data: null, error: null };
    const result = await dbGetVerification("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetVerification("abc12345");
    expect(result).toBeNull();
  });

  it("returns null on error without throwing", async () => {
    terminalResolve = { data: null, error: new Error("DB error") };
    const result = await dbGetVerification("abc12345");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dbCleanExpiredVerifications
// ---------------------------------------------------------------------------

describe("dbCleanExpiredVerifications", () => {
  it("returns count of deleted rows", async () => {
    terminalResolve = { data: [{ id: 1 }, { id: 2 }], error: null };

    const result = await dbCleanExpiredVerifications();
    expect(result).toBe(2);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("returns 0 when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbCleanExpiredVerifications();
    expect(result).toBe(0);
  });

  it("returns 0 on error without throwing", async () => {
    terminalResolve = { data: null, error: new Error("delete failed") };
    const result = await dbCleanExpiredVerifications();
    expect(result).toBe(0);
  });
});
