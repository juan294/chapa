import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockDbStoreVerification,
  mockFrom,
  mockTimingSafeEqual,
} = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const gt = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ gt }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    mockDbStoreVerification: vi.fn(() => Promise.resolve()),
    mockFrom: Object.assign(from, { select, eq, gt, maybeSingle }),
    mockTimingSafeEqual: vi.fn(() => true),
  };
});

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    timingSafeEqual: mockTimingSafeEqual,
  };
});

vi.mock("@/lib/db/verification", () => ({
  dbStoreVerification: mockDbStoreVerification,
}));

vi.mock("@/lib/db/supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { storeVerificationRecord, getVerificationRecord } from "./store";
import { dbStoreVerification } from "@/lib/db/verification";
import { getSupabase } from "@/lib/db/supabase";
import type { VerificationRecord } from "./types";

const record: VerificationRecord = {
  handle: "testuser",
  displayName: "Test User",
  adjustedComposite: 52,
  confidence: 85,
  tier: "Solid",
  archetype: "Builder",
  dimensions: { delivery: 70, quality: 50, consistency: 60, breadth: 40 },
  commitsTotal: 200,
  prsMergedCount: 30,
  reviewsSubmittedCount: 50,
  generatedAt: "2025-06-15",
  profileType: "collaborative",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);
  mockFrom.select.mockReturnValue({ eq: mockFrom.eq });
  mockFrom.eq.mockReturnValue({ gt: mockFrom.gt });
  mockFrom.gt.mockReturnValue({ maybeSingle: mockFrom.maybeSingle });
  mockFrom.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockTimingSafeEqual.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// storeVerificationRecord — writes to Supabase only (Phase 5)
// ---------------------------------------------------------------------------

describe("storeVerificationRecord", () => {
  it("calls dbStoreVerification with hash and record", async () => {
    await storeVerificationRecord("abc12345", record);

    expect(vi.mocked(dbStoreVerification)).toHaveBeenCalledWith(
      "abc12345",
      record,
    );
  });

  it("does not throw when Supabase write fails", async () => {
    vi.mocked(dbStoreVerification).mockRejectedValue(new Error("Supabase down"));

    await expect(
      storeVerificationRecord("abc12345", record),
    ).resolves.toBeUndefined();
  });

  it("calls dbStoreVerification exactly once per invocation", async () => {
    await storeVerificationRecord("abc12345", record);

    expect(vi.mocked(dbStoreVerification)).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getVerificationRecord — reads from Supabase (Phase 4, unchanged)
// ---------------------------------------------------------------------------

describe("getVerificationRecord", () => {
  it("compares the stored hash via timingSafeEqual and returns the record", async () => {
    mockFrom.maybeSingle.mockResolvedValue({
      data: {
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
      },
      error: null,
    });
    const result = await getVerificationRecord("abc12345");

    expect(result).toEqual(record);
    expect(mockFrom).toHaveBeenCalledWith("verification_records");
    expect(mockTimingSafeEqual).toHaveBeenCalled();
  });

  it("returns null on Supabase miss", async () => {
    const result = await getVerificationRecord("abc12345");
    expect(result).toBeNull();
  });

  it("returns null when the stored hash length differs", async () => {
    mockFrom.maybeSingle.mockResolvedValue({
      data: {
        hash: "abc12345abc12345",
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
      },
      error: null,
    });

    const result = await getVerificationRecord("abc12345");
    expect(result).toBeNull();
  });

  it("returns null if the verification lookup throws", async () => {
    mockFrom.maybeSingle.mockRejectedValue(new Error("Supabase down"));
    const result = await getVerificationRecord("abc12345");
    expect(result).toBeNull();
  });
});
