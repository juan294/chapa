import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSnapshot } from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("./redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbGetLatestSnapshot: vi.fn(),
}));

import { cacheGet, cacheSet, cacheDel } from "./redis";
import { dbGetLatestSnapshot } from "@/lib/db/snapshots";
import {
  getCachedLatestSnapshot,
  updateSnapshotCache,
  invalidateSnapshotCache,
} from "./snapshot-cache";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getCachedLatestSnapshot
// ---------------------------------------------------------------------------

describe("getCachedLatestSnapshot", () => {
  it("returns cached snapshot on cache hit (no DB call)", async () => {
    const snapshot = makeSnapshot();
    vi.mocked(cacheGet).mockResolvedValueOnce(snapshot);

    const result = await getCachedLatestSnapshot("TestUser");

    expect(result).toEqual(snapshot);
    expect(cacheGet).toHaveBeenCalledWith("snapshot:latest:testuser");
    expect(dbGetLatestSnapshot).not.toHaveBeenCalled();
  });

  it("fetches from DB on cache miss and caches the result", async () => {
    const snapshot = makeSnapshot();
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    vi.mocked(dbGetLatestSnapshot).mockResolvedValueOnce(snapshot);
    vi.mocked(cacheSet).mockResolvedValueOnce(true);

    const result = await getCachedLatestSnapshot("testuser");

    expect(result).toEqual(snapshot);
    expect(dbGetLatestSnapshot).toHaveBeenCalledWith("testuser");
    expect(cacheSet).toHaveBeenCalledWith(
      "snapshot:latest:testuser",
      snapshot,
      86400,
    );
  });

  it("returns null when both cache and DB have no data", async () => {
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    vi.mocked(dbGetLatestSnapshot).mockResolvedValueOnce(null);

    const result = await getCachedLatestSnapshot("testuser");

    expect(result).toBeNull();
    // Should not cache a null result
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("lowercases the handle for the cache key", async () => {
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    vi.mocked(dbGetLatestSnapshot).mockResolvedValueOnce(null);

    await getCachedLatestSnapshot("UPPERCASE");

    expect(cacheGet).toHaveBeenCalledWith("snapshot:latest:uppercase");
    expect(dbGetLatestSnapshot).toHaveBeenCalledWith("UPPERCASE");
  });

  it("falls back to DB when Redis fails (fail-open)", async () => {
    const snapshot = makeSnapshot();
    vi.mocked(cacheGet).mockRejectedValueOnce(new Error("Connection refused"));
    vi.mocked(dbGetLatestSnapshot).mockResolvedValueOnce(snapshot);
    vi.mocked(cacheSet).mockResolvedValueOnce(true);

    const result = await getCachedLatestSnapshot("testuser");

    expect(result).toEqual(snapshot);
    expect(dbGetLatestSnapshot).toHaveBeenCalledWith("testuser");
  });

  it("returns null when both Redis and DB fail", async () => {
    vi.mocked(cacheGet).mockRejectedValueOnce(new Error("Redis down"));
    vi.mocked(dbGetLatestSnapshot).mockResolvedValueOnce(null);

    const result = await getCachedLatestSnapshot("testuser");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateSnapshotCache
// ---------------------------------------------------------------------------

describe("updateSnapshotCache", () => {
  it("updates the cache with the new snapshot", async () => {
    const snapshot = makeSnapshot();
    vi.mocked(cacheSet).mockResolvedValueOnce(true);

    await updateSnapshotCache("TestUser", snapshot);

    expect(cacheSet).toHaveBeenCalledWith(
      "snapshot:latest:testuser",
      snapshot,
      86400,
    );
  });

  it("lowercases the handle for the cache key", async () => {
    const snapshot = makeSnapshot();
    vi.mocked(cacheSet).mockResolvedValueOnce(true);

    await updateSnapshotCache("UPPERCASE", snapshot);

    expect(cacheSet).toHaveBeenCalledWith(
      "snapshot:latest:uppercase",
      snapshot,
      86400,
    );
  });

  it("does not throw when Redis fails (fire-and-forget safe)", async () => {
    vi.mocked(cacheSet).mockRejectedValueOnce(
      new Error("Connection refused"),
    );

    await expect(
      updateSnapshotCache("testuser", makeSnapshot()),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// invalidateSnapshotCache
// ---------------------------------------------------------------------------

describe("invalidateSnapshotCache", () => {
  it("deletes the snapshot cache key", async () => {
    vi.mocked(cacheDel).mockResolvedValueOnce(undefined);
    await invalidateSnapshotCache("testuser");
    expect(cacheDel).toHaveBeenCalledWith("snapshot:latest:testuser");
  });

  it("lowercases handle", async () => {
    vi.mocked(cacheDel).mockResolvedValueOnce(undefined);
    await invalidateSnapshotCache("TestUser");
    expect(cacheDel).toHaveBeenCalledWith("snapshot:latest:testuser");
  });

  it("does not throw on Redis failure", async () => {
    vi.mocked(cacheDel).mockRejectedValueOnce(new Error("Redis down"));
    await expect(
      invalidateSnapshotCache("testuser"),
    ).resolves.toBeUndefined();
  });
});
