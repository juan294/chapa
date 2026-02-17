import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/lib/db/verification", () => ({
  dbStoreVerification: vi.fn(() => Promise.resolve()),
}));

import { storeVerificationRecord, getVerificationRecord } from "./store";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { dbStoreVerification } from "@/lib/db/verification";
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

describe("storeVerificationRecord", () => {
  it("stores the record with verify: prefix and 30-day TTL", async () => {
    await storeVerificationRecord("abc12345", record);
    expect(vi.mocked(cacheSet)).toHaveBeenCalledWith(
      "verify:abc12345",
      record,
      2_592_000,
    );
  });

  it("also stores a handle index entry (lowercase normalized)", async () => {
    await storeVerificationRecord("abc12345", record);
    expect(vi.mocked(cacheSet)).toHaveBeenCalledWith(
      "verify-handle:testuser",
      "abc12345",
      2_592_000,
    );
  });

  it("normalizes handle to lowercase in handle index key", async () => {
    const upperRecord = { ...record, handle: "TestUser" };
    await storeVerificationRecord("abc12345", upperRecord);
    expect(vi.mocked(cacheSet)).toHaveBeenCalledWith(
      "verify-handle:testuser",
      "abc12345",
      2_592_000,
    );
  });

  it("calls cacheSet twice (record + handle index)", async () => {
    await storeVerificationRecord("abc12345", record);
    expect(vi.mocked(cacheSet)).toHaveBeenCalledTimes(2);
  });

  it("does not throw if cacheSet fails", async () => {
    vi.mocked(cacheSet).mockRejectedValue(new Error("Redis down"));
    await expect(
      storeVerificationRecord("abc12345", record),
    ).resolves.toBeUndefined();
  });
});

describe("getVerificationRecord", () => {
  it("returns the record from cache on hit", async () => {
    vi.mocked(cacheGet).mockResolvedValue(record);
    const result = await getVerificationRecord("abc12345");
    expect(result).toEqual(record);
    expect(vi.mocked(cacheGet)).toHaveBeenCalledWith("verify:abc12345");
  });

  it("returns null on cache miss", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    const result = await getVerificationRecord("abc12345");
    expect(result).toBeNull();
  });

  it("returns null if cacheGet throws", async () => {
    vi.mocked(cacheGet).mockRejectedValue(new Error("Redis down"));
    const result = await getVerificationRecord("abc12345");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// storeVerificationRecord — Supabase dual-write
// ---------------------------------------------------------------------------

describe("storeVerificationRecord — Supabase dual-write", () => {
  it("calls dbStoreVerification with hash and record", async () => {
    await storeVerificationRecord("abc12345", record);

    expect(vi.mocked(dbStoreVerification)).toHaveBeenCalledWith(
      "abc12345",
      record,
    );
  });

  it("writes to Supabase even when Redis fails", async () => {
    vi.mocked(cacheSet).mockRejectedValue(new Error("Redis down"));

    await storeVerificationRecord("abc12345", record);

    expect(vi.mocked(dbStoreVerification)).toHaveBeenCalledWith(
      "abc12345",
      record,
    );
  });

  it("does not throw when Supabase write throws synchronously", async () => {
    vi.mocked(dbStoreVerification).mockImplementation(() => {
      throw new Error("Supabase down");
    });

    await expect(
      storeVerificationRecord("abc12345", record),
    ).resolves.toBeUndefined();
  });

  it("still writes to Redis regardless of Supabase", async () => {
    await storeVerificationRecord("abc12345", record);

    expect(vi.mocked(cacheSet)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(dbStoreVerification)).toHaveBeenCalledTimes(1);
  });
});
