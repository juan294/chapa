import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFullStats, makeSnapshot } from "../test-helpers/fixtures";
import {
  materializeImpactState,
  type MaterializedProfile,
} from "./materialize-profile";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "./orchestrated-profile";

const mockMaterializeProfile = vi.fn();
const mockDbInsertSnapshot = vi.fn();
const mockDbReplaceSnapshot = vi.fn();
const mockUpdateSnapshotCache = vi.fn();
const mockCaptureServerEvent =
  vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve());

vi.mock("./materialize-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./materialize-profile")>();
  return {
    ...actual,
    materializeProfile: (...args: unknown[]) => mockMaterializeProfile(...args),
  };
});

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: (...args: unknown[]) => mockDbInsertSnapshot(...args),
  dbReplaceSnapshot: (...args: unknown[]) => mockDbReplaceSnapshot(...args),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  updateSnapshotCache: (...args: unknown[]) => mockUpdateSnapshotCache(...args),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
}));

function makeMaterializedProfile(): MaterializedProfile {
  const stats = makeFullStats({ handle: "testuser" });
  const impactState = materializeImpactState(stats, {
    latestSnapshot: makeSnapshot({
      date: "2026-04-16",
      adjustedComposite: 91,
    }),
    today: "2026-04-17",
  });

  return {
    stats,
    ...impactState,
  };
}

describe("materializeOrchestratedProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the shared materializer with the public display policy", async () => {
    const materialized = makeMaterializedProfile();
    mockMaterializeProfile.mockResolvedValue(materialized);

    const result = await materializeOrchestratedProfile("testuser", {
      token: "oauth-token",
      today: "2026-04-17",
    });

    expect(mockMaterializeProfile).toHaveBeenCalledWith("testuser", {
      token: "oauth-token",
      today: "2026-04-17",
      policy: "public-display",
    });
    expect(result).toBe(materialized);
  });

  it("#930: forwards ignoreSnapshot so admin recalculates bypass the same-day EMA lock", async () => {
    const materialized = makeMaterializedProfile();
    mockMaterializeProfile.mockResolvedValue(materialized);

    await materializeOrchestratedProfile("testuser", { ignoreSnapshot: true });

    expect(mockMaterializeProfile).toHaveBeenCalledWith("testuser", {
      token: undefined,
      today: undefined,
      policy: "public-display",
      ignoreSnapshot: true,
    });
  });
});

describe("persistOrchestratedSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsertSnapshot.mockResolvedValue("inserted");
    mockDbReplaceSnapshot.mockResolvedValue(true);
    mockUpdateSnapshotCache.mockResolvedValue(true);
  });

  it("inserts and caches the canonical snapshot for warm-cache flows", async () => {
    const materialized = makeMaterializedProfile();

    const persisted = await persistOrchestratedSnapshot("testuser", materialized, {
      mode: "insert",
    });

    expect(persisted).toBe(true);
    expect(mockDbInsertSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
    expect(mockUpdateSnapshotCache).toHaveBeenCalledWith("testuser", materialized.snapshot);
  });

  it("replaces and caches the canonical snapshot for explicit refresh flows", async () => {
    const materialized = makeMaterializedProfile();

    const persisted = await persistOrchestratedSnapshot("testuser", materialized, {
      mode: "replace",
    });

    expect(persisted).toBe(true);
    expect(mockDbReplaceSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
    expect(mockUpdateSnapshotCache).toHaveBeenCalledWith("testuser", materialized.snapshot);
  });

  it("keeps same-day public reads stable after a replaced orchestration snapshot (#1001)", () => {
    const stats = makeFullStats({ handle: "testuser" });
    const replaced = materializeImpactState(stats, {
      latestSnapshot: makeSnapshot({
        date: "2026-04-16",
        adjustedComposite: 91,
      }),
      today: "2026-04-17",
    });

    const sameDayPublicRead = materializeImpactState(stats, {
      latestSnapshot: replaced.snapshot,
      today: "2026-04-17",
    });

    // #1001 — the fresh headline is stable across same-day re-reads...
    expect(sameDayPublicRead.displayImpact.adjustedComposite).toBe(
      replaced.displayImpact.adjustedComposite,
    );
    // ...and the persisted trend snapshot stays locked to its smoothed value
    // (the same-day lock prevents the stored series from spiralling).
    expect(sameDayPublicRead.snapshot.adjustedComposite).toBe(
      replaced.snapshot.adjustedComposite,
    );
  });

  // ---------------------------------------------------------------------------
  // #1076 — the orchestrated writer (warm-cache, /api/refresh, /api/recalculate,
  // /api/admin/bulk-recalculate) must refuse to persist incomplete/poisoned
  // stats, mirroring the badge path's existing #1003 gate in
  // lib/profile/public-profile.ts's persistProfileSnapshot.
  // ---------------------------------------------------------------------------

  it("#1076: returns false and writes nothing when stats are incomplete (corrupt shape)", async () => {
    const materialized = { ...makeMaterializedProfile(), statsComplete: false };

    const persisted = await persistOrchestratedSnapshot("testuser", materialized, {
      mode: "insert",
    });

    expect(persisted).toBe(false);
    expect(mockDbInsertSnapshot).not.toHaveBeenCalled();
    expect(mockDbReplaceSnapshot).not.toHaveBeenCalled();
    expect(mockUpdateSnapshotCache).not.toHaveBeenCalled();
  });

  it("#1076: emits snapshot_skipped_incomplete_stats telemetry when stats are incomplete", async () => {
    const materialized = { ...makeMaterializedProfile(), statsComplete: false };

    await persistOrchestratedSnapshot("testuser", materialized, { mode: "replace" });

    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      "snapshot_skipped_incomplete_stats",
      expect.objectContaining({
        handle: "testuser",
        prsMergedCount: materialized.stats.prsMergedCount,
        commitsTotal: materialized.stats.commitsTotal,
      }),
    );
  });

  it("#1076: still persists normally when stats are complete (no regression)", async () => {
    const materialized = { ...makeMaterializedProfile(), statsComplete: true };

    const persisted = await persistOrchestratedSnapshot("testuser", materialized, {
      mode: "insert",
    });

    expect(persisted).toBe(true);
    expect(mockDbInsertSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
