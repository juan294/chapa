import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FRESH_SECONDS,
  RETENTION_SECONDS,
  buildStatsCacheKey,
  statsCacheBinding,
  readCachedStats,
  writeCachedStats,
  STATS_NOT_FOUND_TTL_SECONDS,
  buildStatsNotFoundKey,
  readStatsNotFound,
  writeStatsNotFound,
} from "./stats-cache";
import { githubUserNotFound } from "@/lib/github/not-found";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { getNextauthSecret } from "@/lib/env";
import { makeStats } from "../test-helpers/fixtures";

vi.mock("@/lib/cache/redis", () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }));
vi.mock("@/lib/env", () => ({ getNextauthSecret: vi.fn() }));

const binding = { accessContextId: "access-context-a", links: "unlinked|unlinked|unlinked" };
const referenceDate = "2026-09-05";
const capturedAt = "2026-09-05T00:00:00.000Z";

/** An envelope shaped exactly as `writeCachedStats` produces it, for tests
 * that need to hand-craft a `cacheGet` return value. */
function envelope(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    authorizationBinding: "b1",
    referenceDate,
    capturedAt,
    freshUntil: new Date(Date.parse(capturedAt) + FRESH_SECONDS * 1000).toISOString(),
    stats: makeStats({ handle: "alice", prsMergedCount: 7 }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getNextauthSecret).mockReturnValue("stats-cache-fixture-secret");
});

describe("buildStatsCacheKey", () => {
  it("is one key per handle, case-insensitive, so a single cacheDel invalidates it", () => {
    expect(buildStatsCacheKey("Alice")).toBe("stats:v3:alice");
    expect(buildStatsCacheKey("alice")).toBe(buildStatsCacheKey("ALICE"));
  });
});

describe("statsCacheBinding", () => {
  it("is stable for the same access context and links", () => {
    expect(statsCacheBinding(binding)).toBe(statsCacheBinding({ ...binding }));
  });

  it.each([
    ["access context", { accessContextId: "access-context-b" }],
    ["linked grant versions", { links: "authorized:v2|unlinked|unlinked" }],
  ])("changes when the %s changes", (_label, override) => {
    expect(statsCacheBinding({ ...binding, ...override })).not.toBe(statsCacheBinding(binding));
  });

  // The scoring day left the binding (badge-source-outage-resilience,
  // 2026-09-22): it now lives only in the envelope's own `referenceDate`, so
  // the same grant's binding is stable across a UTC-day rollover and an
  // exactly-bound record from yesterday can still be matched and served as
  // stale.
  it("no longer takes a reference date at all — the same binding covers every scoring day", () => {
    expect(binding).not.toHaveProperty("referenceDate");
  });

  it("never exposes the access context ID itself", () => {
    expect(statsCacheBinding(binding)).not.toContain(binding.accessContextId);
  });

  it("returns null rather than an unbound key when the signing secret is absent", () => {
    vi.mocked(getNextauthSecret).mockReturnValue(undefined);
    expect(statsCacheBinding(binding)).toBeNull();
  });
});

describe("readCachedStats", () => {
  it("is fresh for a same-binding, same-day entry read within the fresh window", async () => {
    const stats = makeStats({ handle: "alice", prsMergedCount: 7 });
    vi.mocked(cacheGet).mockResolvedValue(envelope({ authorizationBinding: "b1", stats }));

    const result = await readCachedStats("Alice", "b1", referenceDate, new Date(capturedAt));

    expect(result).toEqual({ status: "fresh", stats, capturedAt });
    expect(cacheGet).toHaveBeenCalledWith("stats:v3:alice");
  });

  it("clones the returned stats so a caller can never mutate the cached value", async () => {
    const stats = makeStats({ handle: "alice", prsMergedCount: 7 });
    vi.mocked(cacheGet).mockResolvedValue(envelope({ authorizationBinding: "b1", stats }));

    const result = await readCachedStats("alice", "b1", referenceDate, new Date(capturedAt));

    expect(result.status).toBe("fresh");
    if (result.status !== "fresh") throw new Error("expected fresh");
    expect(result.stats).toEqual(stats);
    expect(result.stats).not.toBe(stats);
  });

  it("is stale once past the fresh window but still inside the retention window", async () => {
    vi.mocked(cacheGet).mockResolvedValue(envelope({ authorizationBinding: "b1" }));
    const justPastFresh = new Date(Date.parse(capturedAt) + FRESH_SECONDS * 1000 + 1000);

    expect(await readCachedStats("alice", "b1", referenceDate, justPastFresh)).toMatchObject({ status: "stale", capturedAt });
  });

  it("is stale for a different (later) scoring day, within retention", async () => {
    vi.mocked(cacheGet).mockResolvedValue(envelope({ authorizationBinding: "b1" }));
    const nextDay = new Date(Date.parse(capturedAt) + 24 * 60 * 60 * 1000);

    expect(await readCachedStats("alice", "b1", "2026-09-06", nextDay)).toMatchObject({ status: "stale" });
  });

  it("is a miss once past the retention window", async () => {
    vi.mocked(cacheGet).mockResolvedValue(envelope({ authorizationBinding: "b1" }));
    const justPastRetention = new Date(Date.parse(capturedAt) + RETENTION_SECONDS * 1000 + 1000);

    expect(await readCachedStats("alice", "b1", referenceDate, justPastRetention)).toEqual({ status: "miss" });
  });

  it("is a miss exactly at the retention boundary check — still eligible one second before", async () => {
    vi.mocked(cacheGet).mockResolvedValue(envelope({ authorizationBinding: "b1" }));
    const justInsideRetention = new Date(Date.parse(capturedAt) + RETENTION_SECONDS * 1000 - 1000);

    expect(await readCachedStats("alice", "b1", referenceDate, justInsideRetention)).toMatchObject({ status: "stale" });
  });

  it("refuses a foreign binding even well within the retention window", async () => {
    vi.mocked(cacheGet).mockResolvedValue(envelope({ authorizationBinding: "b1" }));

    expect(await readCachedStats("alice", "b2", referenceDate, new Date(capturedAt))).toEqual({ status: "miss" });
  });

  it("refuses an unbound record, which is what the retired handle-only key held", async () => {
    vi.mocked(cacheGet).mockResolvedValue(makeStats({ prsMergedCount: 999 }));
    expect(await readCachedStats("alice", "b1", referenceDate)).toEqual({ status: "miss" });
  });

  it("refuses an old unversioned `{ binding, referenceDate, stats }` row as a miss, never an implicit upgrade", async () => {
    vi.mocked(cacheGet).mockResolvedValue({ binding: "b1", referenceDate, stats: makeStats() });
    expect(await readCachedStats("alice", "b1", referenceDate)).toEqual({ status: "miss" });
  });

  it.each([
    ["missing schemaVersion", { schemaVersion: undefined }],
    ["wrong schemaVersion", { schemaVersion: 1 }],
    ["invalid capturedAt", { capturedAt: "not-a-date" }],
    ["invalid freshUntil", { freshUntil: "not-a-date" }],
    ["missing referenceDate", { referenceDate: undefined }],
  ])("is a miss for %s", async (_label, override) => {
    vi.mocked(cacheGet).mockResolvedValue(envelope({ authorizationBinding: "b1", ...override }));
    expect(await readCachedStats("alice", "b1", referenceDate, new Date(capturedAt))).toEqual({ status: "miss" });
  });

  it("misses on an empty or unavailable cache", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    expect(await readCachedStats("alice", "b1", referenceDate)).toEqual({ status: "miss" });
  });
});

describe("writeCachedStats", () => {
  it("stores a versioned envelope with capture/fresh-until timestamps, at the seven-day retention TTL", async () => {
    const stats = makeStats({ handle: "alice" });
    await writeCachedStats("Alice", "b1", referenceDate, stats, new Date(capturedAt));

    expect(cacheSet).toHaveBeenCalledWith(
      "stats:v3:alice",
      {
        schemaVersion: 2,
        authorizationBinding: "b1",
        referenceDate,
        capturedAt,
        freshUntil: new Date(Date.parse(capturedAt) + FRESH_SECONDS * 1000).toISOString(),
        stats,
      },
      RETENTION_SECONDS,
    );
    expect(RETENTION_SECONDS).toBe(604_800);
    expect(FRESH_SECONDS).toBe(21_600);
  });

  it("clones the stored stats so a later caller mutation cannot corrupt the cache entry", async () => {
    const stats = makeStats({ handle: "alice", commitsTotal: 1 });
    await writeCachedStats("alice", "b1", referenceDate, stats, new Date(capturedAt));
    const stored = vi.mocked(cacheSet).mock.calls[0]![1] as { stats: typeof stats };

    stats.commitsTotal = 999;

    expect(stored.stats).not.toBe(stats);
    expect(stored.stats.commitsTotal).toBe(1);
  });

  it("round-trips through a read at the same binding as fresh", async () => {
    const stats = makeStats({ handle: "alice", commitsTotal: 42 });
    await writeCachedStats("alice", "b1", referenceDate, stats, new Date(capturedAt));
    vi.mocked(cacheGet).mockResolvedValue(vi.mocked(cacheSet).mock.calls[0]![1]);

    expect(await readCachedStats("alice", "b1", referenceDate, new Date(capturedAt))).toEqual({
      status: "fresh",
      stats,
      capturedAt,
    });
  });

  it("round-trips as stale once the write is well past its fresh window but still within retention", async () => {
    const stats = makeStats({ handle: "alice", commitsTotal: 42 });
    await writeCachedStats("alice", "b1", referenceDate, stats, new Date(capturedAt));
    vi.mocked(cacheGet).mockResolvedValue(vi.mocked(cacheSet).mock.calls[0]![1]);
    const muchLater = new Date(Date.parse(capturedAt) + 3 * 24 * 60 * 60 * 1000);

    expect(await readCachedStats("alice", "b1", referenceDate, muchLater)).toEqual({
      status: "stale",
      stats,
      capturedAt,
    });
  });
});

// LE-8-2 — a handle GitHub has said nobody owns. Kept beside the stats cache
// because it is the same seam, but never under the stats key: `stats:v3:`
// holds stats only.
describe("not-found marker", () => {
  it("lives under its own key, case-insensitive, with a short TTL", async () => {
    expect(buildStatsNotFoundKey("Ghost")).toBe("stats:notfound:ghost");
    expect(buildStatsNotFoundKey("ghost")).not.toBe(buildStatsCacheKey("ghost"));

    await writeStatsNotFound("Ghost");

    expect(cacheSet).toHaveBeenCalledWith("stats:notfound:ghost", expect.objectContaining({ kind: "github_user_not_found" }), STATS_NOT_FOUND_TTL_SECONDS);
    expect(STATS_NOT_FOUND_TTL_SECONDS).toBeLessThanOrEqual(600);
  });

  it("reads true only for the sentinel shape, so a stray value cannot 404 a real user", async () => {
    vi.mocked(cacheGet).mockResolvedValue(githubUserNotFound("ghost"));
    expect(await readStatsNotFound("ghost")).toBe(true);

    vi.mocked(cacheGet).mockResolvedValue(makeStats());
    expect(await readStatsNotFound("ghost")).toBe(false);

    vi.mocked(cacheGet).mockResolvedValue(null);
    expect(await readStatsNotFound("ghost")).toBe(false);
  });
});
