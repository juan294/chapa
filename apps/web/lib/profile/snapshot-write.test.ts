import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSnapshot } from "../test-helpers/fixtures";
import { reconcileSnapshotWrite } from "./snapshot-write";

const mockDbInsertSnapshot = vi.fn();
const mockDbReplaceSnapshot = vi.fn();
const mockUpdateSnapshotCache = vi.fn();
const mockIsRedisConfigured = vi.fn();
const mockCaptureOperationalAlert = vi.fn();

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: (...args: unknown[]) => mockDbInsertSnapshot(...args),
  dbReplaceSnapshot: (...args: unknown[]) => mockDbReplaceSnapshot(...args),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  updateSnapshotCache: (...args: unknown[]) => mockUpdateSnapshotCache(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  isRedisConfigured: (...args: unknown[]) => mockIsRedisConfigured(...args),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureOperationalAlert: (...args: unknown[]) =>
    mockCaptureOperationalAlert(...args),
}));

const snapshot = makeSnapshot({ date: "2026-04-17", adjustedComposite: 88 });

describe("reconcileSnapshotWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsertSnapshot.mockResolvedValue("inserted");
    mockDbReplaceSnapshot.mockResolvedValue(true);
    mockUpdateSnapshotCache.mockResolvedValue(true);
    mockIsRedisConfigured.mockReturnValue(true);
    mockCaptureOperationalAlert.mockResolvedValue(undefined);
  });

  it("reports a fully-consistent write when insert + cache both succeed", async () => {
    const result = await reconcileSnapshotWrite("testuser", snapshot, {
      mode: "insert",
    });

    expect(mockDbInsertSnapshot).toHaveBeenCalledWith("testuser", snapshot);
    expect(mockUpdateSnapshotCache).toHaveBeenCalledWith("testuser", snapshot);
    expect(result).toEqual({
      persisted: true,
      cacheUpdated: true,
      reconciliationRequired: false,
      writeOutcome: "inserted",
    });
    expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
  });

  it("uses dbReplaceSnapshot for replace mode", async () => {
    const result = await reconcileSnapshotWrite("testuser", snapshot, {
      mode: "replace",
    });

    expect(mockDbReplaceSnapshot).toHaveBeenCalledWith("testuser", snapshot);
    expect(mockDbInsertSnapshot).not.toHaveBeenCalled();
    expect(result.persisted).toBe(true);
    expect(result.reconciliationRequired).toBe(false);
    expect(result.writeOutcome).toBe("inserted");
  });

  it("emits a reconciliation alert when the durable write succeeds but the cache update fails", async () => {
    mockUpdateSnapshotCache.mockResolvedValue(false);

    const result = await reconcileSnapshotWrite("testuser", snapshot, {
      mode: "replace",
    });

    // (c) — the return value clearly signals the partial-failure state.
    expect(result).toEqual({
      persisted: true,
      cacheUpdated: false,
      reconciliationRequired: true,
      writeOutcome: "inserted",
    });

    // (b) — a structured reconciliation event is captured with enough context
    // to identify the handle and which write succeeded vs failed.
    expect(mockCaptureOperationalAlert).toHaveBeenCalledTimes(1);
    const alert = mockCaptureOperationalAlert.mock.calls[0]![0];
    expect(alert.signal).toBe("profile_snapshot_write_reconciliation");
    expect(alert.severity).toBe("P2");
    expect(alert.properties).toMatchObject({
      handle: "testuser",
      mode: "replace",
      date: "2026-04-17",
      durableWrite: "ok",
      cacheWrite: "failed",
    });
  });

  it("does NOT alert when the cache write fails only because Redis is not configured (no divergence)", async () => {
    mockUpdateSnapshotCache.mockResolvedValue(false);
    mockIsRedisConfigured.mockReturnValue(false);

    const result = await reconcileSnapshotWrite("testuser", snapshot, {
      mode: "insert",
    });

    // Reads fall back to Supabase when there is no cache layer, so the stores
    // have not diverged — nothing to reconcile.
    expect(result).toEqual({
      persisted: true,
      cacheUpdated: false,
      reconciliationRequired: false,
      writeOutcome: "inserted",
    });
    expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // #1015/#1016 — tri-state write outcome branches
  // ---------------------------------------------------------------------------

  it("inserted+cache-ok: reports a clean write with no alert", async () => {
    mockDbInsertSnapshot.mockResolvedValue("inserted");
    mockUpdateSnapshotCache.mockResolvedValue(true);

    const result = await reconcileSnapshotWrite("testuser", snapshot, {
      mode: "insert",
    });

    expect(result.persisted).toBe(true);
    expect(result.writeOutcome).toBe("inserted");
    expect(result.cacheUpdated).toBe(true);
    expect(result.reconciliationRequired).toBe(false);
    expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
  });

  it("duplicate+cache-refresh-attempted: still attempts the cache mirror, and never alerts even if that refresh fails (avoids flooding on repeat CDN-miss hits)", async () => {
    mockDbInsertSnapshot.mockResolvedValue("duplicate");
    mockUpdateSnapshotCache.mockResolvedValue(false);

    const result = await reconcileSnapshotWrite("testuser", snapshot, {
      mode: "insert",
    });

    // The opportunistic cache refresh was attempted...
    expect(mockUpdateSnapshotCache).toHaveBeenCalledWith("testuser", snapshot);
    // ...but a benign duplicate never escalates, even when that refresh fails.
    expect(result).toEqual({
      persisted: true,
      cacheUpdated: false,
      reconciliationRequired: false,
      writeOutcome: "duplicate",
    });
    expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
  });

  it("duplicate+cache-ok: reports a clean write with no alert", async () => {
    mockDbInsertSnapshot.mockResolvedValue("duplicate");
    mockUpdateSnapshotCache.mockResolvedValue(true);

    const result = await reconcileSnapshotWrite("testuser", snapshot, {
      mode: "insert",
    });

    expect(result.persisted).toBe(true);
    expect(result.writeOutcome).toBe("duplicate");
    expect(result.cacheUpdated).toBe(true);
    expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
  });

  it("failed: does not attempt the cache write and does not alert at this layer (escalation is the caller's job, see #1009)", async () => {
    mockDbInsertSnapshot.mockResolvedValue("failed");

    const result = await reconcileSnapshotWrite("testuser", snapshot, {
      mode: "insert",
    });

    // Durable write failed and the cache was left untouched, so the two stores
    // never diverged. The DB layer already logged the failure.
    expect(result).toEqual({
      persisted: false,
      cacheUpdated: false,
      reconciliationRequired: false,
      writeOutcome: "failed",
    });
    expect(mockUpdateSnapshotCache).not.toHaveBeenCalled();
    expect(mockCaptureOperationalAlert).not.toHaveBeenCalled();
  });

  it("replace mode reports 'failed' (not 'duplicate') on a genuine write error — replace has no duplicate concept", async () => {
    mockDbReplaceSnapshot.mockResolvedValue(false);

    const result = await reconcileSnapshotWrite("testuser", snapshot, {
      mode: "replace",
    });

    expect(result.writeOutcome).toBe("failed");
    expect(result.persisted).toBe(false);
    expect(mockUpdateSnapshotCache).not.toHaveBeenCalled();
  });
});
