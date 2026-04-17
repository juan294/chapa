import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFullStats, makeSnapshot } from "../test-helpers/fixtures";
import type { MaterializedProfile } from "./materialize-profile";
import {
  getPublicProfileVerification,
  materializePublicProfile,
  runPublicProfileSideEffects,
} from "./public-profile";

const mockMaterializeProfile = vi.fn();
const mockGenerateVerificationCode = vi.fn();
const mockStoreVerificationRecord = vi.fn();
const mockTrackBadgeGenerated = vi.fn();
const mockNotifyFirstBadge = vi.fn();
const mockDbInsertSnapshot = vi.fn();
const mockUpdateSnapshotCache = vi.fn();
const mockDbUpsertUser = vi.fn();

vi.mock("./materialize-profile", () => ({
  materializeProfile: (...args: unknown[]) => mockMaterializeProfile(...args),
}));

vi.mock("@/lib/verification/hmac", () => ({
  generateVerificationCode: (...args: unknown[]) => mockGenerateVerificationCode(...args),
}));

vi.mock("@/lib/verification/store", () => ({
  storeVerificationRecord: (...args: unknown[]) => mockStoreVerificationRecord(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  trackBadgeGenerated: (...args: unknown[]) => mockTrackBadgeGenerated(...args),
}));

vi.mock("@/lib/email/notifications", () => ({
  notifyFirstBadge: (...args: unknown[]) => mockNotifyFirstBadge(...args),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: (...args: unknown[]) => mockDbInsertSnapshot(...args),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  updateSnapshotCache: (...args: unknown[]) => mockUpdateSnapshotCache(...args),
}));

vi.mock("@/lib/db/users", () => ({
  dbUpsertUser: (...args: unknown[]) => mockDbUpsertUser(...args),
}));

function makeMaterializedProfile(): MaterializedProfile {
  return {
    stats: makeFullStats({
      handle: "testuser",
      displayName: "Test User",
      avatarUrl: "https://avatars.example.com/testuser.png",
      commitsTotal: 42,
      prsMergedCount: 10,
      reviewsSubmittedCount: 5,
    }),
    craftResult: null,
    latestSnapshot: null,
    rawImpact: {
      handle: "testuser",
      profileType: "collaborative",
      compositeScore: 73,
      adjustedComposite: 73,
      tier: "High",
      confidence: 88,
      confidencePenalties: [],
      computedAt: "2026-04-17T12:00:00.000Z",
      dimensions: { delivery: 70, quality: 68, consistency: 74, breadth: 66 },
      archetype: "Builder",
    },
    displayImpact: {
      handle: "testuser",
      profileType: "collaborative",
      compositeScore: 73,
      adjustedComposite: 65,
      tier: "Solid",
      confidence: 88,
      confidencePenalties: [],
      computedAt: "2026-04-17T12:00:00.000Z",
      dimensions: { delivery: 70, quality: 68, consistency: 74, breadth: 66 },
      archetype: "Builder",
    },
    snapshot: makeSnapshot({
      adjustedComposite: 65,
      tier: "Solid",
      craft: undefined,
    }),
  };
}

describe("materializePublicProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the shared materializer with the public display policy", async () => {
    const materialized = makeMaterializedProfile();
    mockMaterializeProfile.mockResolvedValue(materialized);

    const result = await materializePublicProfile("testuser", { token: "oauth-token" });

    expect(mockMaterializeProfile).toHaveBeenCalledWith("testuser", {
      token: "oauth-token",
      today: undefined,
      craftMode: "cached",
      policy: "public-display",
    });
    expect(result).toBe(materialized);
  });
});

describe("getPublicProfileVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the shared display impact for verification", () => {
    const materialized = makeMaterializedProfile();
    mockGenerateVerificationCode.mockReturnValue({ hash: "abc123", date: "2026-04-17" });

    const result = getPublicProfileVerification(materialized);

    expect(mockGenerateVerificationCode).toHaveBeenCalledWith(
      materialized.stats,
      materialized.displayImpact,
    );
    expect(result).toEqual({ hash: "abc123", date: "2026-04-17" });
  });
});

describe("runPublicProfileSideEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrackBadgeGenerated.mockResolvedValue(undefined);
    mockNotifyFirstBadge.mockResolvedValue(undefined);
    mockDbInsertSnapshot.mockResolvedValue(true);
    mockUpdateSnapshotCache.mockResolvedValue(undefined);
    mockDbUpsertUser.mockResolvedValue(undefined);
    mockStoreVerificationRecord.mockResolvedValue(undefined);
    mockGenerateVerificationCode.mockReturnValue({ hash: "abc123", date: "2026-04-17" });
  });

  it("stores verification, snapshot, tracking, and user metadata from the display profile", async () => {
    const materialized = makeMaterializedProfile();

    await runPublicProfileSideEffects("testuser", materialized);

    expect(mockStoreVerificationRecord).toHaveBeenCalledWith(
      "abc123",
      expect.objectContaining({
        handle: "testuser",
        adjustedComposite: 65,
        tier: "Solid",
        generatedAt: "2026-04-17",
      }),
    );
    expect(mockTrackBadgeGenerated).toHaveBeenCalledWith("testuser");
    expect(mockNotifyFirstBadge).toHaveBeenCalledWith("testuser", materialized.displayImpact);
    expect(mockDbInsertSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
    expect(mockUpdateSnapshotCache).toHaveBeenCalledWith("testuser", materialized.snapshot);
    expect(mockDbUpsertUser).toHaveBeenCalledWith("testuser", {
      displayName: "Test User",
      avatarUrl: "https://avatars.example.com/testuser.png",
    });
  });

  it("skips snapshot cache writes when the snapshot was not inserted", async () => {
    const materialized = makeMaterializedProfile();
    mockDbInsertSnapshot.mockResolvedValue(false);

    await runPublicProfileSideEffects("testuser", materialized);

    expect(mockUpdateSnapshotCache).not.toHaveBeenCalled();
  });

  it("respects a provided verification code without recomputing it", async () => {
    const materialized = makeMaterializedProfile();

    await runPublicProfileSideEffects("testuser", materialized, {
      verification: { hash: "prefetched", date: "2026-04-18" },
    });

    expect(mockGenerateVerificationCode).not.toHaveBeenCalled();
    expect(mockStoreVerificationRecord).toHaveBeenCalledWith(
      "prefetched",
      expect.objectContaining({ generatedAt: "2026-04-18" }),
    );
  });
});
