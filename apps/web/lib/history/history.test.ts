import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSnapshot } from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Mock Supabase DB layer (sole data store — Phase 5)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: vi.fn(() => Promise.resolve(true)),
  dbGetSnapshots: vi.fn(() => Promise.resolve([])),
  dbGetLatestSnapshot: vi.fn(() => Promise.resolve(null)),
  dbGetSnapshotCount: vi.fn(() => Promise.resolve(0)),
}));

import {
  getSnapshots,
  getLatestSnapshot,
  getSnapshotCount,
} from "./history";
import {
  dbGetSnapshots,
  dbGetLatestSnapshot,
  dbGetSnapshotCount,
} from "@/lib/db/snapshots";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getSnapshots — reads from Supabase
// ---------------------------------------------------------------------------

describe("getSnapshots", () => {
  it("delegates to dbGetSnapshots and returns results", async () => {
    const s1 = makeSnapshot({ date: "2025-06-14" });
    const s2 = makeSnapshot({ date: "2025-06-15" });
    vi.mocked(dbGetSnapshots).mockResolvedValue([s1, s2]);

    const result = await getSnapshots("TestUser", "2025-06-14", "2025-06-15");

    expect(result).toEqual([s1, s2]);
    expect(dbGetSnapshots).toHaveBeenCalledWith("TestUser", "2025-06-14", "2025-06-15");
  });

  it("returns empty array when Supabase returns empty", async () => {
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    const result = await getSnapshots("TestUser", "2025-06-14", "2025-06-15");

    expect(result).toEqual([]);
  });

  it("passes undefined for omitted date range params", async () => {
    vi.mocked(dbGetSnapshots).mockResolvedValue([]);

    await getSnapshots("TestUser");

    expect(dbGetSnapshots).toHaveBeenCalledWith("TestUser", undefined, undefined);
  });
});

// ---------------------------------------------------------------------------
// getLatestSnapshot — reads from Supabase
// ---------------------------------------------------------------------------

describe("getLatestSnapshot", () => {
  it("delegates to dbGetLatestSnapshot and returns result", async () => {
    const latest = makeSnapshot({ date: "2025-06-15" });
    vi.mocked(dbGetLatestSnapshot).mockResolvedValue(latest);

    const result = await getLatestSnapshot("TestUser");

    expect(result).toEqual(latest);
    expect(dbGetLatestSnapshot).toHaveBeenCalledWith("TestUser");
  });

  it("returns null when no snapshots exist", async () => {
    vi.mocked(dbGetLatestSnapshot).mockResolvedValue(null);

    const result = await getLatestSnapshot("TestUser");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSnapshotCount — reads from Supabase
// ---------------------------------------------------------------------------

describe("getSnapshotCount", () => {
  it("delegates to dbGetSnapshotCount and returns result", async () => {
    vi.mocked(dbGetSnapshotCount).mockResolvedValue(42);

    const result = await getSnapshotCount("TestUser");

    expect(result).toBe(42);
    expect(dbGetSnapshotCount).toHaveBeenCalledWith("TestUser");
  });

  it("returns 0 when Supabase returns 0", async () => {
    vi.mocked(dbGetSnapshotCount).mockResolvedValue(0);

    const result = await getSnapshotCount("TestUser");

    expect(result).toBe(0);
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
});
