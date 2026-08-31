import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFullStats, makeImpact, makeSnapshot } from "../test-helpers/fixtures";
import type { MaterializedProfile } from "./materialize-profile";
import {
  deferProfileCacheWork,
  getPublicProfileVerification,
  materializePublicProfile,
  persistProfileSnapshot,
  redactImpactForVisitor,
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
const mockDbUpdateUserProfile = vi.fn();
const mockDbUpsertUser = vi.fn();
const mockCacheSetNxStatus = vi.fn();
const mockCacheDel = vi.fn();
const mockClearStatsDirty = vi.fn();
const mockCaptureServerEvent =
  vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve());
const mockCaptureServerError =
  vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve());

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
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
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
  dbUpdateUserProfile: (...args: unknown[]) => mockDbUpdateUserProfile(...args),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
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
    statsComplete: true,
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
      readOnly: undefined,
      policy: "public-display",
    });
    expect(result).toBe(materialized);
  });

  it("passes read-only mode to the shared materializer", async () => {
    const materialized = makeMaterializedProfile();
    mockMaterializeProfile.mockResolvedValue(materialized);

    await materializePublicProfile("testuser", { readOnly: true });

    expect(mockMaterializeProfile).toHaveBeenCalledWith("testuser", {
      token: undefined,
      today: undefined,
      readOnly: true,
      policy: "public-display",
    });
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

  it("#1003: returns null when stats are incomplete, without calling generateVerificationCode", () => {
    const materialized = {
      ...makeMaterializedProfile(),
      statsComplete: false,
    };
    mockGenerateVerificationCode.mockReturnValue({ hash: "abc123", date: "2026-04-17" });

    const result = getPublicProfileVerification(materialized);

    expect(result).toBeNull();
    expect(mockGenerateVerificationCode).not.toHaveBeenCalled();
  });
});

describe("persistProfileSnapshot (#1003 persist-boundary integrity gate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheSetNxStatus.mockResolvedValue("acquired");
    mockDbInsertSnapshot.mockResolvedValue("inserted");
    mockDbReplaceSnapshot.mockResolvedValue(true);
    mockUpdateSnapshotCache.mockResolvedValue(true);
    mockClearStatsDirty.mockResolvedValue(undefined);
  });

  it("returns false and writes nothing when stats are incomplete (corrupt shape)", async () => {
    const materialized = {
      ...makeMaterializedProfile(),
      statsComplete: false,
    };

    const result = await persistProfileSnapshot("testuser", materialized);

    expect(result).toBe(false);
    expect(mockDbInsertSnapshot).not.toHaveBeenCalled();
    expect(mockDbReplaceSnapshot).not.toHaveBeenCalled();
    expect(mockUpdateSnapshotCache).not.toHaveBeenCalled();
    expect(mockCacheSetNxStatus).not.toHaveBeenCalled();
  });

  it("emits snapshot_skipped_incomplete_stats telemetry when stats are incomplete", async () => {
    const materialized = {
      ...makeMaterializedProfile(),
      statsComplete: false,
    };
    materialized.stats = { ...materialized.stats, prsMergedCount: 0, commitsTotal: 15585 };

    await persistProfileSnapshot("testuser", materialized);

    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      "snapshot_skipped_incomplete_stats",
      expect.objectContaining({
        handle: "testuser",
        prsMergedCount: 0,
        commitsTotal: 15585,
      }),
    );
  });

  it("persists a snapshot for a genuine new/empty account (not treated as corrupt)", async () => {
    const materialized = {
      ...makeMaterializedProfile(),
      statsComplete: true,
    };

    const result = await persistProfileSnapshot("testuser", materialized);

    expect(result).toBe(true);
    expect(mockDbInsertSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
  });

  it("persists normally for healthy stats (prsMergedCount > 0)", async () => {
    const materialized = makeMaterializedProfile();

    const result = await persistProfileSnapshot("testuser", materialized);

    expect(result).toBe(true);
    expect(mockDbInsertSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
  });

  // -------------------------------------------------------------------------
  // #1009 — badge-path snapshot writes escalate genuine failures, but never
  // benign insert-mode duplicates (which would flood the alert webhook on
  // every repeat CDN-miss hit for an already-snapshotted handle).
  // -------------------------------------------------------------------------

  describe("#1009 failure escalation", () => {
    it("returns false and escalates via captureServerError when the durable write genuinely fails", async () => {
      mockDbInsertSnapshot.mockResolvedValue("failed");
      const materialized = makeMaterializedProfile();

      const result = await persistProfileSnapshot("testuser", materialized);

      expect(result).toBe(false);
      expect(mockCaptureServerError).toHaveBeenCalledWith(
        expect.objectContaining({
          route: "lib/profile/public-profile",
          error: expect.objectContaining({
            message: expect.stringContaining("testuser"),
          }),
        }),
      );
    });

    it("does NOT escalate for a benign insert-mode duplicate (critical regression guard against alert flooding)", async () => {
      mockDbInsertSnapshot.mockResolvedValue("duplicate");
      const materialized = makeMaterializedProfile();

      const result = await persistProfileSnapshot("testuser", materialized);

      expect(result).toBe(true);
      expect(mockCaptureServerError).not.toHaveBeenCalled();
    });

    it("does NOT escalate on a genuinely fresh insert", async () => {
      mockDbInsertSnapshot.mockResolvedValue("inserted");
      const materialized = makeMaterializedProfile();

      const result = await persistProfileSnapshot("testuser", materialized);

      expect(result).toBe(true);
      expect(mockCaptureServerError).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // #1081 — A failed durable write must release the once-per-day SETNX guard
  // it already claimed, so the NEXT badge request the same day retries the
  // write instead of silently forfeiting the rest of the day's snapshot.
  // "inserted" and "duplicate" are correct terminal states and must leave the
  // guard in place.
  // -------------------------------------------------------------------------

  describe("#1081 day-guard release on failed durable write", () => {
    it("releases the day-guard key when the durable write genuinely fails", async () => {
      mockDbInsertSnapshot.mockResolvedValue("failed");
      const materialized = makeMaterializedProfile();

      await persistProfileSnapshot("testuser", materialized);

      expect(mockCacheDel).toHaveBeenCalledWith(
        expect.stringMatching(/^sideeffects:done:testuser:/),
      );
    });

    it("does NOT release the day-guard key on a genuinely fresh insert", async () => {
      mockDbInsertSnapshot.mockResolvedValue("inserted");
      const materialized = makeMaterializedProfile();

      await persistProfileSnapshot("testuser", materialized);

      expect(mockCacheDel).not.toHaveBeenCalled();
    });

    it("does NOT release the day-guard key on a benign duplicate", async () => {
      mockDbInsertSnapshot.mockResolvedValue("duplicate");
      const materialized = makeMaterializedProfile();

      await persistProfileSnapshot("testuser", materialized);

      expect(mockCacheDel).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // BE-L2 (#1186) — GitHub handles are case-insensitive. Every other
  // handle-derived cache key (dbReplaceSnapshot's row key, buildSnapshotKey,
  // buildBadgeSvgCacheKey) lowercases the handle first; the once-per-day
  // side-effects guard key did not, so `/u/JuanX` and `/u/juanx` claimed
  // independent day guards and each casing variant re-ran the deferred
  // sequence (extra Supabase upsert, extra dbUpsertUser, extra
  // trackBadgeGenerated INCR) once per day instead of sharing one guard.
  // -------------------------------------------------------------------------

  describe("#1186 case-insensitive day guard (BE-L2)", () => {
    it("builds the day-guard key from the lowercased handle", async () => {
      const materialized = makeMaterializedProfile();

      await persistProfileSnapshot("TestUser", materialized);

      expect(mockCacheSetNxStatus).toHaveBeenCalledWith(
        expect.stringMatching(/^sideeffects:done:testuser:/),
        86400,
      );
    });

    it("releases the day-guard key using the same lowercased casing on a genuine write failure", async () => {
      mockDbInsertSnapshot.mockResolvedValue("failed");
      const materialized = makeMaterializedProfile();

      await persistProfileSnapshot("TestUser", materialized);

      expect(mockCacheDel).toHaveBeenCalledWith(
        expect.stringMatching(/^sideeffects:done:testuser:/),
      );
    });

    it("treats differently-cased handles as the same day guard", async () => {
      const materialized = makeMaterializedProfile();

      await persistProfileSnapshot("TestUser", materialized);
      await persistProfileSnapshot("TESTUSER", materialized);
      await persistProfileSnapshot("testuser", materialized);

      const guardKeysUsed = mockCacheSetNxStatus.mock.calls.map((call) => call[0]);
      expect(new Set(guardKeysUsed).size).toBe(1);
    });
  });
});

describe("runPublicProfileSideEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrackBadgeGenerated.mockResolvedValue(undefined);
    mockNotifyFirstBadge.mockResolvedValue(undefined);
    mockDbInsertSnapshot.mockResolvedValue("inserted");
    mockUpdateSnapshotCache.mockResolvedValue(true);
    mockDbUpdateUserProfile.mockResolvedValue(undefined);
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
    expect(mockNotifyFirstBadge).not.toHaveBeenCalled();
    expect(mockDbInsertSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
    expect(mockUpdateSnapshotCache).toHaveBeenCalledWith("testuser", materialized.snapshot);
    expect(mockDbUpdateUserProfile).toHaveBeenCalledWith("testuser", {
      displayName: "Test User",
      avatarUrl: "https://avatars.example.com/testuser.png",
    });
  });

  it("skips snapshot cache writes when the snapshot write genuinely failed", async () => {
    const materialized = makeMaterializedProfile();
    mockDbInsertSnapshot.mockResolvedValue("failed");

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

  it("skips every persistent write in read-only mode", async () => {
    const materialized = makeMaterializedProfile();

    await runPublicProfileSideEffects("testuser", materialized, {
      readOnly: true,
    });

    expect(mockCacheSetNxStatus).not.toHaveBeenCalled();
    expect(mockStoreVerificationRecord).not.toHaveBeenCalled();
    expect(mockTrackBadgeGenerated).not.toHaveBeenCalled();
    expect(mockNotifyFirstBadge).not.toHaveBeenCalled();
    expect(mockDbInsertSnapshot).not.toHaveBeenCalled();
    expect(mockDbReplaceSnapshot).not.toHaveBeenCalled();
    expect(mockUpdateSnapshotCache).not.toHaveBeenCalled();
    expect(mockDbUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("sends the first-badge notification only when explicitly requested", async () => {
    const materialized = makeMaterializedProfile();

    await runPublicProfileSideEffects("testuser", materialized, {
      sendFirstBadgeNotification: true,
    });

    expect(mockNotifyFirstBadge).toHaveBeenCalledWith("testuser", materialized.displayImpact);
  });

  it("skips the profile refresh when displayName and avatarUrl are both absent", async () => {
    const materialized = makeMaterializedProfile();
    materialized.stats = makeFullStats({
      handle: "testuser",
      displayName: undefined,
      avatarUrl: undefined,
    });

    await runPublicProfileSideEffects("testuser", materialized);

    expect(mockDbUpdateUserProfile).not.toHaveBeenCalled();
    expect(mockTrackBadgeGenerated).toHaveBeenCalledWith("testuser");
  });

  it("silently ignores a profile refresh rejection via catch handler", async () => {
    const materialized = makeMaterializedProfile();
    mockDbUpdateUserProfile.mockRejectedValue(new Error("DB write failed"));

    await expect(runPublicProfileSideEffects("testuser", materialized)).resolves.toBeUndefined();
    expect(mockDbUpdateUserProfile).toHaveBeenCalled();
  });

  // #1239 — The badge path may refresh the name/avatar of someone who already
  // signed up, but it must never be the reason a row exists. A public badge
  // view is not consent, and `/u/:handle` accepts any handle on earth.
  it("#1239: refreshes the profile with an update that cannot insert", async () => {
    const materialized = makeMaterializedProfile();
    materialized.stats = makeFullStats({
      handle: "testuser",
      displayName: "Test User",
      avatarUrl: "https://avatars.example.com/test.png",
    });

    await runPublicProfileSideEffects("testuser", materialized);

    expect(mockDbUpsertUser).not.toHaveBeenCalled();
    expect(mockDbUpdateUserProfile).toHaveBeenCalledWith("testuser", {
      displayName: "Test User",
      avatarUrl: "https://avatars.example.com/test.png",
    });
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
      expect(mockDbUpdateUserProfile).not.toHaveBeenCalled();
    });

    it("fires all writes when SETNX succeeds (first CDN miss of the day)", async () => {
      mockCacheSetNxStatus.mockResolvedValue("acquired");
      const materialized = makeMaterializedProfile();

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockStoreVerificationRecord).toHaveBeenCalled();
      expect(mockTrackBadgeGenerated).toHaveBeenCalled();
      expect(mockNotifyFirstBadge).not.toHaveBeenCalled();
      expect(mockDbInsertSnapshot).toHaveBeenCalled();
      expect(mockDbUpdateUserProfile).toHaveBeenCalled();
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

  // -------------------------------------------------------------------------
  // #1003 — Persist-boundary integrity gate: incomplete stats never mint a
  // permanent snapshot row or a verification record, but the badge still
  // rendered for a real visitor, so non-safety-critical deferred work
  // (telemetry, user metadata upsert) still runs. This is NOT the same as the
  // same-day SETNX dedup skip above — that case means the work already ran
  // today; incomplete stats means it never ran and should still fire once.
  // -------------------------------------------------------------------------

  describe("#1003 incomplete-stats path", () => {
    it("does not persist a snapshot but still runs telemetry/notification side effects", async () => {
      const materialized = { ...makeMaterializedProfile(), statsComplete: false };

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockDbInsertSnapshot).not.toHaveBeenCalled();
      expect(mockDbReplaceSnapshot).not.toHaveBeenCalled();
      expect(mockUpdateSnapshotCache).not.toHaveBeenCalled();
      expect(mockTrackBadgeGenerated).toHaveBeenCalledWith("testuser");
      expect(mockDbUpdateUserProfile).toHaveBeenCalled();
    });

    it("does not store a verification record when stats are incomplete", async () => {
      const materialized = { ...makeMaterializedProfile(), statsComplete: false };

      await runPublicProfileSideEffects("testuser", materialized);

      expect(mockStoreVerificationRecord).not.toHaveBeenCalled();
      expect(mockGenerateVerificationCode).not.toHaveBeenCalled();
    });

    it("still skips everything in read-only mode even when stats are incomplete", async () => {
      const materialized = { ...makeMaterializedProfile(), statsComplete: false };

      await runPublicProfileSideEffects("testuser", materialized, { readOnly: true });

      expect(mockTrackBadgeGenerated).not.toHaveBeenCalled();
      expect(mockDbUpdateUserProfile).not.toHaveBeenCalled();
      expect(mockDbInsertSnapshot).not.toHaveBeenCalled();
    });

    it("deferProfileCacheWork does not call storeVerificationRecord when stats are incomplete", async () => {
      const materialized = { ...makeMaterializedProfile(), statsComplete: false };

      await deferProfileCacheWork("testuser", materialized);

      expect(mockStoreVerificationRecord).not.toHaveBeenCalled();
      expect(mockTrackBadgeGenerated).toHaveBeenCalledWith("testuser");
    });
  });
});

// ---------------------------------------------------------------------------
// redactImpactForVisitor (#1067 FE-M1)
// ---------------------------------------------------------------------------
//
// The share page (apps/web/app/u/[handle]/page.tsx) crosses `impact` into a
// "use client" component tree. Whatever crosses that boundary is serialized
// into the RSC payload a visitor's browser downloads, regardless of whether
// any component actually renders it. Confidence/confidencePenalties are
// owner-only (CLAUDE.md), so a non-owner request must never receive them —
// not just have them hidden from display.
describe("redactImpactForVisitor", () => {
  it("strips confidence and confidencePenalties from the result", () => {
    const impact = makeImpact({
      confidence: 62,
      confidencePenalties: [
        { flag: "low_activity_signal", penalty: 10, reason: "Low recent activity." },
      ],
    });

    const redacted = redactImpactForVisitor(impact);

    expect("confidence" in redacted).toBe(false);
    expect("confidencePenalties" in redacted).toBe(false);
    expect(JSON.stringify(redacted)).not.toContain("confidence");
  });

  it("preserves every other field, including the public headline score", () => {
    const impact = makeImpact({
      handle: "octocat",
      adjustedComposite: 73,
      compositeScore: 70,
      tier: "High",
      archetype: "Builder",
      profileType: "collaborative",
    });

    const redacted = redactImpactForVisitor(impact);

    expect(redacted).toEqual({
      handle: "octocat",
      profileType: "collaborative",
      dimensions: impact.dimensions,
      archetype: "Builder",
      compositeScore: 70,
      adjustedComposite: 73,
      tier: "High",
      computedAt: impact.computedAt,
    });
  });

  it("returns a new object rather than mutating the input (snapshot/HMAC record safety)", () => {
    const impact = makeImpact({ confidence: 91 });

    const redacted = redactImpactForVisitor(impact);

    expect(redacted).not.toBe(impact);
    expect(impact.confidence).toBe(91);
    expect(impact.confidencePenalties).toEqual([]);
  });
});
