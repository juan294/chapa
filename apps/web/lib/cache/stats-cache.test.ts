import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STATS_CACHE_TTL_SECONDS,
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

const binding = { accessContextId: "access-context-a", links: "unlinked|unlinked|unlinked", referenceDate: "2026-09-05" };

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
  it("is stable for the same access context, links and scoring day", () => {
    expect(statsCacheBinding(binding)).toBe(statsCacheBinding({ ...binding }));
  });

  it.each([
    ["access context", { accessContextId: "access-context-b" }],
    ["linked grant versions", { links: "authorized:v2|unlinked|unlinked" }],
    ["scoring day", { referenceDate: "2026-09-06" }],
  ])("changes when the %s changes", (_label, override) => {
    expect(statsCacheBinding({ ...binding, ...override })).not.toBe(statsCacheBinding(binding));
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
  it("serves an entry written by the same binding on the same scoring day", async () => {
    const stats = makeStats({ handle: "alice", prsMergedCount: 7 });
    vi.mocked(cacheGet).mockResolvedValue({ binding: "b1", referenceDate: "2026-09-05", stats });
    expect(await readCachedStats("Alice", "b1", "2026-09-05")).toEqual(stats);
    expect(cacheGet).toHaveBeenCalledWith("stats:v3:alice");
  });

  it.each([
    ["a different grant", "b2", "2026-09-05"],
    ["a different scoring day", "b1", "2026-09-06"],
  ])("refuses an entry from %s", async (_label, requested, referenceDate) => {
    vi.mocked(cacheGet).mockResolvedValue({ binding: "b1", referenceDate: "2026-09-05", stats: makeStats() });
    expect(await readCachedStats("alice", requested, referenceDate)).toBeNull();
  });

  it("refuses an unbound record, which is what the retired handle-only key held", async () => {
    vi.mocked(cacheGet).mockResolvedValue(makeStats({ prsMergedCount: 999 }));
    expect(await readCachedStats("alice", "b1", "2026-09-05")).toBeNull();
  });

  it("misses on an empty or unavailable cache", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    expect(await readCachedStats("alice", "b1", "2026-09-05")).toBeNull();
  });
});

describe("writeCachedStats", () => {
  it("stores the binding beside the value at the six-hour TTL", async () => {
    const stats = makeStats({ handle: "alice" });
    await writeCachedStats("Alice", "b1", "2026-09-05", stats);
    expect(cacheSet).toHaveBeenCalledWith(
      "stats:v3:alice",
      { binding: "b1", referenceDate: "2026-09-05", stats },
      STATS_CACHE_TTL_SECONDS,
    );
    expect(STATS_CACHE_TTL_SECONDS).toBe(21_600);
  });

  it("round-trips through a read at the same binding", async () => {
    const stats = makeStats({ handle: "alice", commitsTotal: 42 });
    await writeCachedStats("alice", "b1", "2026-09-05", stats);
    vi.mocked(cacheGet).mockResolvedValue(vi.mocked(cacheSet).mock.calls[0]![1]);
    expect(await readCachedStats("alice", "b1", "2026-09-05")).toEqual(stats);
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
