import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSnapshot } from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Mock Supabase DB layer (sole data store — Phase 5)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: vi.fn(() => Promise.resolve(true)),
  dbGetSnapshots: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: vi.fn(() => Promise.resolve(null)),
  updateSnapshotCache: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(() => Promise.resolve(null)),
  cacheSet: vi.fn(() => Promise.resolve(true)),
  cacheDel: vi.fn(() => Promise.resolve()),
}));

import {
  getSnapshots,
  getLatestSnapshot,
  invalidateHistoryCache,
} from "./history";
import { dbGetSnapshots } from "@/lib/db/snapshots";
import { getCachedLatestSnapshot } from "@/lib/cache/snapshot-cache";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache/redis";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getSnapshots — Redis cache layer over Supabase
// ---------------------------------------------------------------------------

describe("getSnapshots", () => {
  it("returns cached data on cache hit (no Supabase call)", async () => {
    const s1 = makeSnapshot({ date: "2025-06-14" });
    const s2 = makeSnapshot({ date: "2025-06-15" });
    vi.mocked(cacheGet).mockResolvedValue([s1, s2]);

    const result = await getSnapshots("TestUser");

    expect(result).toEqual([s1, s2]);
    expect(cacheGet).toHaveBeenCalledWith("history:testuser");
    expect(dbGetSnapshots).not.toHaveBeenCalled();
  });

  it("fetches from Supabase on cache miss and stores in cache", async () => {
    const s1 = makeSnapshot({ date: "2025-06-14" });
    const s2 = makeSnapshot({ date: "2025-06-15" });
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbGetSnapshots).mockResolvedValue([s1, s2]);

    const result = await getSnapshots("TestUser");

    expect(result).toEqual([s1, s2]);
    expect(dbGetSnapshots).toHaveBeenCalledWith("TestUser", undefined, undefined);
    expect(cacheSet).toHaveBeenCalledWith("history:testuser", [s1, s2], 3600);
  });

  it("includes from/to in cache key when provided", async () => {
    const s1 = makeSnapshot({ date: "2025-06-01" });
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbGetSnapshots).mockResolvedValue([s1]);

    await getSnapshots("TestUser", "2025-06-01", "2025-06-15");

    expect(cacheGet).toHaveBeenCalledWith("history:testuser:2025-06-01:2025-06-15");
    expect(dbGetSnapshots).toHaveBeenCalledWith("TestUser", "2025-06-01", "2025-06-15");
    expect(cacheSet).toHaveBeenCalledWith("history:testuser:2025-06-01:2025-06-15", [s1], 3600);
  });

  it("includes only from in cache key when to is omitted", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    await getSnapshots("TestUser", "2025-06-01");

    expect(cacheGet).toHaveBeenCalledWith("history:testuser:2025-06-01");
  });

  it("normalizes handle to lowercase in cache key", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    await getSnapshots("MixedCase");

    expect(cacheGet).toHaveBeenCalledWith("history:mixedcase");
  });

  it("falls back to Supabase when Redis fails (fail-open)", async () => {
    const s1 = makeSnapshot({ date: "2025-06-14" });
    vi.mocked(cacheGet).mockRejectedValue(new Error("Redis down"));
    vi.mocked(dbGetSnapshots).mockResolvedValue([s1]);

    const result = await getSnapshots("TestUser");

    expect(result).toEqual([s1]);
    expect(dbGetSnapshots).toHaveBeenCalledWith("TestUser", undefined, undefined);
  });

  it("does not cache empty results", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    await getSnapshots("TestUser");

    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("does not block on cache write failure", async () => {
    const s1 = makeSnapshot({ date: "2025-06-14" });
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbGetSnapshots).mockResolvedValue([s1]);
    vi.mocked(cacheSet).mockRejectedValue(new Error("Redis write failed"));

    // Should not throw even though cacheSet rejects
    const result = await getSnapshots("TestUser");

    expect(result).toEqual([s1]);
  });

  it("passes from/to params to dbGetSnapshots", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    await getSnapshots("TestUser", "2025-06-14", "2025-06-15");

    expect(dbGetSnapshots).toHaveBeenCalledWith("TestUser", "2025-06-14", "2025-06-15");
  });

  it("returns empty array when Supabase returns empty", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    const result = await getSnapshots("TestUser", "2025-06-14", "2025-06-15");

    expect(result).toEqual([]);
  });

  it("passes undefined for omitted date range params", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    await getSnapshots("TestUser");

    expect(dbGetSnapshots).toHaveBeenCalledWith("TestUser", undefined, undefined);
  });
});

// ---------------------------------------------------------------------------
// invalidateHistoryCache
// ---------------------------------------------------------------------------

describe("invalidateHistoryCache", () => {
  it("deletes the base cache key for the handle", async () => {
    await invalidateHistoryCache("TestUser");

    expect(cacheDel).toHaveBeenCalledWith("history:testuser");
  });

  it("normalizes handle to lowercase", async () => {
    await invalidateHistoryCache("MixedCase");

    expect(cacheDel).toHaveBeenCalledWith("history:mixedcase");
  });

  it("does not throw when cacheDel fails", async () => {
    vi.mocked(cacheDel).mockRejectedValue(new Error("Redis down"));

    // Should not throw
    await invalidateHistoryCache("TestUser");
  });
});

// ---------------------------------------------------------------------------
// getLatestSnapshot — reads from Supabase
// ---------------------------------------------------------------------------

describe("getLatestSnapshot", () => {
  it("delegates to getCachedLatestSnapshot and returns result", async () => {
    const latest = makeSnapshot({ date: "2025-06-15" });
    vi.mocked(getCachedLatestSnapshot).mockResolvedValue(latest);

    const result = await getLatestSnapshot("TestUser");

    expect(result).toEqual(latest);
    expect(getCachedLatestSnapshot).toHaveBeenCalledWith("TestUser");
  });

  it("returns null when no snapshots exist", async () => {
    vi.mocked(getCachedLatestSnapshot).mockResolvedValue(null);

    const result = await getLatestSnapshot("TestUser");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Verify no Redis exports remain (recordSnapshot, pruneSnapshots removed)
// ---------------------------------------------------------------------------

describe("module exports", () => {
  it("does not export recordSnapshot (removed in Phase 5)", async () => {
    const mod = await import("./history");
    expect(mod).not.toHaveProperty("recordSnapshot");
  });

  it("does not export pruneSnapshots (removed in Phase 5)", async () => {
    const mod = await import("./history");
    expect(mod).not.toHaveProperty("pruneSnapshots");
  });

  it("exports invalidateHistoryCache", async () => {
    const mod = await import("./history");
    expect(mod).toHaveProperty("invalidateHistoryCache");
    expect(typeof mod.invalidateHistoryCache).toBe("function");
  });
});
