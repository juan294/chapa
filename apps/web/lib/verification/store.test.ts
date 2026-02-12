import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

import { storeVerificationRecord, getVerificationRecord } from "./store";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
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

  it("also stores a handle index entry", async () => {
    await storeVerificationRecord("abc12345", record);
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
