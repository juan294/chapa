import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/verification", () => ({
  dbStoreVerification: vi.fn(() => Promise.resolve()),
  dbGetVerification: vi.fn(() => Promise.resolve(null)),
}));

import { storeVerificationRecord, getVerificationRecord } from "./store";
import { dbStoreVerification, dbGetVerification } from "@/lib/db/verification";
import type { VerificationRecord } from "./types";

const record: VerificationRecord = {
  handle: "testuser",
  displayName: "Test User",
  adjustedComposite: 52,
  confidence: 85,
  tier: "Solid",
  archetype: "Builder",
  dimensions: { building: 70, guarding: 50, consistency: 60, breadth: 40 },
  commitsTotal: 200,
  prsMergedCount: 30,
  reviewsSubmittedCount: 50,
  generatedAt: "2025-06-15",
  profileType: "collaborative",
};

beforeEach(() => {
  vi.clearAllMocks();
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
  it("delegates to dbGetVerification and returns result", async () => {
    vi.mocked(dbGetVerification).mockResolvedValue(record);
    const result = await getVerificationRecord("abc12345");
    expect(result).toEqual(record);
    expect(dbGetVerification).toHaveBeenCalledWith("abc12345");
  });

  it("returns null on Supabase miss", async () => {
    vi.mocked(dbGetVerification).mockResolvedValue(null);
    const result = await getVerificationRecord("abc12345");
    expect(result).toBeNull();
  });

  it("returns null if dbGetVerification throws", async () => {
    vi.mocked(dbGetVerification).mockRejectedValue(new Error("Supabase down"));
    const result = await getVerificationRecord("abc12345");
    expect(result).toBeNull();
  });
});
