import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbStoreVerification, mockDbGetVerification } = vi.hoisted(() => ({
  mockDbStoreVerification: vi.fn(() => Promise.resolve()),
  mockDbGetVerification: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/lib/db/verification", () => ({
  dbStoreVerification: mockDbStoreVerification,
  dbGetVerification: mockDbGetVerification,
}));

import { storeVerificationRecord, getVerificationRecord } from "./store";
import {
  dbGetVerification,
  dbStoreVerification,
} from "@/lib/db/verification";
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
  vi.mocked(dbStoreVerification).mockResolvedValue(undefined);
  vi.mocked(dbGetVerification).mockResolvedValue(null);
});

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

describe("getVerificationRecord", () => {
  it("delegates reads to dbGetVerification", async () => {
    vi.mocked(dbGetVerification).mockResolvedValue(record);

    const result = await getVerificationRecord("abc12345");

    expect(result).toEqual(record);
    expect(vi.mocked(dbGetVerification)).toHaveBeenCalledWith("abc12345");
  });

  it("returns null on Supabase miss", async () => {
    const result = await getVerificationRecord("abc12345");

    expect(result).toBeNull();
  });

  it("returns null if the verification lookup throws", async () => {
    vi.mocked(dbGetVerification).mockRejectedValue(new Error("Supabase down"));

    const result = await getVerificationRecord("abc12345");

    expect(result).toBeNull();
  });
});
