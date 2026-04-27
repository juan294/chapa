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
const mockDbReplaceSnapshot = vi.fn();
const mockUpdateSnapshotCache = vi.fn();
const mockDbUpsertUser = vi.fn();
const mockCacheSetNxStatus = vi.fn();
const mockClearStatsDirty = vi.fn();

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
  cacheSetNxStatus: (...args: unknown[]) => mockCacheSetNxStatus(...args),
}));

vi.mock("@/lib/email/notifications", () => ({
  notifyFirstBadge: (...args: unknown[]) => mockNotifyFirstBadge(...args),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: (...args: unknown[]) => mockDbInsertSnapshot(...args),
  dbReplaceSnapshot: (...args: unknown[]) => mockDbReplaceSnapshot(...args),
}));

vi.mock("@/lib/cache/dirty-stats", () => ({
  clearStatsDirty: (...args: unknown[]) => mockClearStatsDirty(...args),
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
    inputsChanged: false,
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
    // SETNX guard: first call succeeds (key was unset) by default
    mockCacheSetNxStatus.mockResolvedValue("acquired");
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

  it("skips storeVerificationRecord when verification is null", async () => {
    const materialized = makeMaterializedProfile();
    mockGenerateVerificationCode.mockReturnValue(null);

    await runPublicProfileSideEffects("testuser", materialized);

    expect(mockStoreVerificationRecord).not.toHaveBeenCalled();
    expect(mockTrackBadgeGenerated).toHaveBeenCalledWith("testuser");
  });

  it("skips dbUpsertUser when displayName and avatarUrl are both absent", async () => {
    const materialized = makeMaterializedProfile();
    materialized.stats = makeFullStats({
      handle: "testuser",
      displayName: undefined,
      avatarUrl: undefined,
    });

    await runPublicProfileSideEffects("testuser", materialized);

    expect(mockDbUpsertUser).not.toHaveBeenCalled();
    expect(mockTrackBadgeGenerated).toHaveBeenCalledWith("testuser");
  });

  it("silently ignores dbUpsertUser rejection via catch handler", async () => {
    const materialized = makeMaterializedProfile();
    mockDbUpsertUser.mockRejectedValue(new Error("DB write failed"));

    await expect(runPublicProfileSideEffects("testuser", materialized)).resolves.toBeUndefined();
    expect(mockDbUpsertUser).toHaveBeenCalled();
  });

  describe("sideeffect guard (#718 / #695)", () => {
    it("skips all heavy Supabase writes when the SETNX guard key already exists", async () => {
      mockCacheSetNxStatus.mockResolvedValue("exists");
      const materialized = makeMaterializedProfile();

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockStoreVerificationRecord).not.toHaveBeenCalled();
      expect(mockTrackBadgeGenerated).not.toHaveBeenCalled();
      expect(mockNotifyFirstBadge).not.toHaveBeenCalled();
      expect(mockDbInsertSnapshot).not.toHaveBeenCalled();
      expect(mockDbUpsertUser).not.toHaveBeenCalled();
    });

    it("fires all writes when SETNX succeeds (first CDN miss of the day)", async () => {
      mockCacheSetNxStatus.mockResolvedValue("acquired");
      const materialized = makeMaterializedProfile();

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockStoreVerificationRecord).toHaveBeenCalled();
      expect(mockTrackBadgeGenerated).toHaveBeenCalled();
      expect(mockNotifyFirstBadge).toHaveBeenCalled();
      expect(mockDbInsertSnapshot).toHaveBeenCalled();
      expect(mockDbUpsertUser).toHaveBeenCalled();
    });

    it("uses the correct key prefix for the guard", async () => {
      const materialized = makeMaterializedProfile();

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockCacheSetNxStatus).toHaveBeenCalledWith(
        expect.stringMatching(/^sideeffects:done:testuser:/),
        86400,
      );
    });

    it("still fires when Redis is unavailable", async () => {
      mockCacheSetNxStatus.mockResolvedValue("unavailable");
      const materialized = makeMaterializedProfile();

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockTrackBadgeGenerated).toHaveBeenCalled();
      expect(mockDbInsertSnapshot).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // #826 — Same-day refresh after a supplemental upload
  // -------------------------------------------------------------------------

  describe("#826 inputsChanged path", () => {
    beforeEach(() => {
      mockDbReplaceSnapshot.mockResolvedValue(true);
      mockClearStatsDirty.mockResolvedValue(undefined);
    });

    it("uses dbReplaceSnapshot (not dbInsertSnapshot) when inputsChanged=true", async () => {
      const materialized = { ...makeMaterializedProfile(), inputsChanged: true };

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockDbReplaceSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
      expect(mockDbInsertSnapshot).not.toHaveBeenCalled();
    });

    it("clears the stats:dirty marker after a successful replacement", async () => {
      const materialized = { ...makeMaterializedProfile(), inputsChanged: true };

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockClearStatsDirty).toHaveBeenCalledWith("testuser");
    });

    it("bypasses the SETNX dedup guard so today's pre-upload guard does not block the refresh", async () => {
      // The SETNX guard normally prevents a second pass on the same day. After
      // a supplemental upload, that's exactly the path we want to run.
      mockCacheSetNxStatus.mockResolvedValue("exists");
      const materialized = { ...makeMaterializedProfile(), inputsChanged: true };

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockDbReplaceSnapshot).toHaveBeenCalled();
      expect(mockUpdateSnapshotCache).toHaveBeenCalled();
    });

    it("does not touch the dirty marker when inputsChanged=false (existing behavior preserved)", async () => {
      const materialized = makeMaterializedProfile();

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockClearStatsDirty).not.toHaveBeenCalled();
      expect(mockDbReplaceSnapshot).not.toHaveBeenCalled();
      expect(mockDbInsertSnapshot).toHaveBeenCalled();
    });

    it("skips clearStatsDirty when the snapshot replacement fails", async () => {
      mockDbReplaceSnapshot.mockResolvedValue(false);
      const materialized = { ...makeMaterializedProfile(), inputsChanged: true };

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockClearStatsDirty).not.toHaveBeenCalled();
    });
  });
});
