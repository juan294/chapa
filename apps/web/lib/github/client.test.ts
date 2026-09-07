import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatsData } from "@chapa/shared";
import { getStats, _resetInflight } from "./client";
import { fetchStats } from "./stats";
import { getGithubToken } from "@/lib/env";
import { readSourceAuthorization, type SourceAuthorization } from "@/lib/platform/source-authorization";
import { refreshSourceLink } from "@/lib/platform/source-refresh";
import { dbGetSupplemental } from "@/lib/db/supplemental";
import { dbUpsertUser } from "@/lib/db/users";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { fetchBitbucketIfLinked } from "@/lib/bitbucket/client";
import { fetchCodebergIfLinked } from "@/lib/codeberg/client";
import { fetchGitlabIfLinked } from "@/lib/gitlab/client";
import { makeStats } from "../test-helpers/fixtures";

vi.mock("./stats", () => ({ fetchStats: vi.fn() }));
vi.mock("@/lib/env", () => ({ getGithubToken: vi.fn(), getNextauthSecret: () => "legacy-context-fixture-secret" }));
vi.mock("@/lib/platform/source-authorization", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/platform/source-authorization")>(), readSourceAuthorization: vi.fn(),
}));
vi.mock("@/lib/platform/source-refresh", () => ({ refreshSourceLink: vi.fn() }));
vi.mock("@/lib/platform/source-collectors", () => ({ selectSourceEvidence: vi.fn() }));
vi.mock("@/lib/db/supplemental", () => ({ dbGetSupplemental: vi.fn() }));
vi.mock("@/lib/db/users", () => ({ dbUpsertUser: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }));
vi.mock("@/lib/bitbucket/client", () => ({ fetchBitbucketIfLinked: vi.fn() }));
vi.mock("@/lib/codeberg/client", () => ({ fetchCodebergIfLinked: vi.fn() }));
vi.mock("@/lib/gitlab/client", () => ({ fetchGitlabIfLinked: vi.fn() }));
const referenceTime = "2026-09-05T12:00:00.000Z";
const options = { referenceTime };
const fetchers = { bitbucket: fetchBitbucketIfLinked, codeberg: fetchCodebergIfLinked, gitlab: fetchGitlabIfLinked };
function authorization(platform: "bitbucket" | "codeberg" | "gitlab"): Extract<SourceAuthorization, { status: "authorized" }> {
  return { status: "authorized", consentVersion: "legacy-unpublished", link: {
    id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform,
    remoteLogin: `remote-${platform}`, tokens: { accessToken: `${platform}-token`, refreshToken: null, expiresAt: null },
  } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks(); _resetInflight();
  vi.mocked(getGithubToken).mockReturnValue("server-token");
  vi.mocked(fetchStats).mockResolvedValue(makeStats({ handle: "alice" }));
  vi.mocked(readSourceAuthorization).mockResolvedValue({ status: "unlinked" });
  vi.mocked(refreshSourceLink).mockImplementation(async value => value);
  vi.mocked(dbGetSupplemental).mockResolvedValue(null);
  Object.values(fetchers).forEach(fetcher => vi.mocked(fetcher).mockResolvedValue(null));
});

describe("read-only callers", () => {
  // `/api/profile/:handle` and the remote MCP tools read with `readOnly`. They
  // may be served the record the live path wrote under their own binding; they
  // may never fetch, write, refresh a grant, or register anything.
  const readOnly = { ...options, readOnly: true };
  const forbidden = [fetchStats, refreshSourceLink, dbGetSupplemental, cacheSet, dbUpsertUser, ...Object.values(fetchers)];
  async function warmedBy(token: string | undefined): Promise<{ entry: unknown; stats: StatsData }> {
    const stats = (await getStats("alice", token, options))!;
    const entry = vi.mocked(cacheSet).mock.calls.find(([key]) => key === "stats:v3:alice")![1];
    _resetInflight(); for (const fn of forbidden) vi.mocked(fn).mockClear();
    return { entry, stats };
  }
  it("serves the record the server token wrote, with no fetch and no write", async () => {
    const { entry, stats } = await warmedBy(undefined);
    vi.mocked(cacheGet).mockResolvedValue(entry);
    const result = await getStats("Alice", undefined, readOnly);
    expect(result).toEqual(stats); expect(result).not.toBe(stats);
    expect(cacheGet).toHaveBeenCalledWith("stats:v3:alice");
    for (const fn of forbidden) expect(fn).not.toHaveBeenCalled();
  });
  it("misses honestly on an empty cache, without a fetch or a write", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    expect(await getStats("alice", undefined, readOnly)).toBeNull();
    expect(cacheGet).toHaveBeenCalledWith("stats:v3:alice");
    for (const fn of forbidden) expect(fn).not.toHaveBeenCalled();
  });
  it("refuses a record another grant wrote rather than fetching in its place", async () => {
    const { entry } = await warmedBy("pat");
    vi.mocked(cacheGet).mockResolvedValue(entry);
    expect(await getStats("alice", undefined, readOnly)).toBeNull();
    for (const fn of forbidden) expect(fn).not.toHaveBeenCalled();
  });
  it("refuses an unbound record, which is what the retired handle-only key held", async () => {
    vi.mocked(cacheGet).mockResolvedValue(makeStats({ commitsTotal: 900 }));
    expect(await getStats("alice", undefined, readOnly)).toBeNull();
    for (const fn of forbidden) expect(fn).not.toHaveBeenCalled();
  });
  it("withholds a hit whose grants changed while it was being read, as the live path does", async () => {
    const { entry } = await warmedBy(undefined);
    vi.mocked(cacheGet).mockResolvedValue(entry);
    let reads = 0;
    vi.mocked(readSourceAuthorization).mockImplementation(async (_owner, provider) => ++reads > 3 && provider === "gitlab" ? authorization("gitlab") : { status: "unlinked" });
    expect(await getStats("alice", undefined, readOnly)).toBeNull();
    for (const fn of forbidden) expect(fn).not.toHaveBeenCalled();
  });
});

describe("uncached v6 compatibility during the receipt migration", () => {
  it.each([0, 1, 5])("accepts %i observed PRs and refuses a larger unbound cache record", async prsMergedCount => {
    // A bare StatsData is what the pre-S08 handle-only key held. It carries no
    // binding, so the read must reject it and collect live instead.
    vi.mocked(fetchStats).mockResolvedValue(makeStats({ handle: "alice", prsMergedCount }));
    vi.mocked(cacheGet).mockResolvedValue(makeStats({ prsMergedCount: 999 }));
    expect((await getStats("alice", undefined, options))!.prsMergedCount).toBe(prsMergedCount);
    expect(cacheGet).toHaveBeenCalledWith("stats:v3:alice"); expect(dbUpsertUser).not.toHaveBeenCalled();
    expect(cacheSet).toHaveBeenCalledWith("stats:v3:alice", expect.objectContaining({
      binding: expect.any(String), referenceDate: "2026-09-05", stats: expect.objectContaining({ prsMergedCount }),
    }), 21_600);
  });
  it("captures the server credential before asynchronous source checks and forwards one reference", async () => {
    vi.mocked(readSourceAuthorization).mockImplementation(async () => { vi.mocked(getGithubToken).mockReturnValue("rotated-token"); return { status: "unlinked" }; });
    expect(await getStats("Alice", undefined, options)).not.toBeNull();
    expect(fetchStats).toHaveBeenCalledWith("alice", undefined, { resolvedCredential: { token: "server-token" }, referenceTime });
  });
  it("keeps explicit anonymous collection anonymous instead of falling back to a configured token", async () => {
    expect(await getStats("alice", "", options)).not.toBeNull();
    expect(fetchStats).toHaveBeenCalledWith("alice", undefined, { resolvedCredential: { token: null }, referenceTime });
  });
  it("does not serve an unbound stale record when current GitHub collection fails", async () => {
    vi.mocked(fetchStats).mockResolvedValue(null); vi.mocked(cacheGet).mockResolvedValue(makeStats());
    expect(await getStats("alice", undefined, options)).toBeNull();
    expect(cacheSet).not.toHaveBeenCalled(); expect(dbGetSupplemental).not.toHaveBeenCalled(); expect(dbUpsertUser).not.toHaveBeenCalled();
  });
  it("checks source availability before collection", async () => {
    vi.mocked(readSourceAuthorization).mockResolvedValue({ status: "unavailable" });
    expect(await getStats("alice", undefined, options)).toBeNull(); expect(fetchStats).not.toHaveBeenCalled();
  });
  it.each(["bitbucket", "codeberg", "gitlab"] as const)("retains current %s linkage and composes only after the primary check", async platform => {
    const linked = authorization(platform);
    vi.mocked(readSourceAuthorization).mockImplementation(async (_owner, provider) => provider === platform ? linked : { status: "unlinked" });
    const primary = makeStats({ handle: "alice", commitsTotal: 2, prsMergedCount: 0 });
    const overlay = makeStats({ handle: `remote-${platform}`, commitsTotal: 3, prsMergedCount: 0 });
    vi.mocked(fetchStats).mockResolvedValue(primary);
    vi.mocked(fetchers[platform]).mockImplementation(async () => { expect(fetchStats).toHaveBeenCalledTimes(1); return overlay; });
    const result = await getStats("alice", undefined, options);
    expect(result!.handle).toBe("alice"); expect(result!.commitsTotal).toBe(5);
    expect(result!.linkedPlatforms).toEqual([platform]); expect(result!.linkedPlatformLogins).toEqual({ [platform]: `remote-${platform}` });
    expect(primary.commitsTotal).toBe(2); expect(overlay.commitsTotal).toBe(3);
    expect(result!.hasSupplementalData).toBe(false);
  });
  it.each(["bitbucket", "codeberg", "gitlab"] as const)("does not silently drop connected inaccessible %s", async platform => {
    vi.mocked(readSourceAuthorization).mockImplementation(async (_owner, provider) => provider === platform ? authorization(platform) : { status: "unlinked" });
    expect(await getStats("alice", undefined, options)).toBeNull();
    expect(dbGetSupplemental).not.toHaveBeenCalled();
  });
  it("withholds a result if a source is linked while primary collection was pending", async () => {
    vi.mocked(fetchStats).mockImplementation(async () => {
      vi.mocked(readSourceAuthorization).mockImplementation(async (_owner, provider) => provider === "gitlab" ? authorization("gitlab") : { status: "unlinked" });
      return makeStats();
    });
    expect(await getStats("alice", undefined, options)).toBeNull(); expect(fetchGitlabIfLinked).not.toHaveBeenCalled();
  });
  it("composes durable supplemental after current-source checks without contaminating primary data", async () => {
    const primary = makeStats({ handle: "alice", commitsTotal: 0, prsMergedCount: 0 });
    vi.mocked(fetchStats).mockResolvedValue(primary);
    vi.mocked(dbGetSupplemental).mockResolvedValue({ targetHandle: "alice", sourceHandle: "emu", stats: makeStats({ commitsTotal: 20, prsMergedCount: 0 }), uploadedAt: referenceTime });
    const result = await getStats("alice", undefined, options);
    expect(result!.commitsTotal).toBe(20); expect(result!.hasSupplementalData).toBe(true); expect(primary.commitsTotal).toBe(0);
    // The composed value is what callers receive, so it is what gets cached.
    expect(cacheSet).toHaveBeenCalledWith("stats:v3:alice", expect.objectContaining({
      stats: expect.objectContaining({ commitsTotal: 20, hasSupplementalData: true }),
    }), 21_600);
  });
  it("deduplicates only the same exact principal/window and returns separate objects", async () => {
    const started = deferred<void>(); const finish = deferred<StatsData>();
    vi.mocked(fetchStats).mockImplementation(async () => { started.resolve(); return finish.promise; });
    const first = getStats("alice", "pat", options); const second = getStats("ALICE", "pat", options);
    await started.promise; finish.resolve(makeStats({ handle: "alice" }));
    const [a, b] = await Promise.all([first, second]);
    expect(fetchStats).toHaveBeenCalledTimes(1); expect(a).toEqual(b); expect(a).not.toBe(b);
    a!.commitsTotal = 1000; expect(b!.commitsTotal).not.toBe(1000);
    await getStats("alice", "pat", options); expect(fetchStats).toHaveBeenCalledTimes(2);
  });
  it("does not share concurrent work across PATs, and does share it across instants on one scoring day", async () => {
    // The binding is deliberately day-scoped, not instant-scoped. Two renders
    // of one handle a second apart score the identical 365-day window, and
    // binding to the instant is what made both this map and the cache dead
    // weight: every production caller omits referenceTime, so every call
    // produced a unique key and paid its own ~10s GitHub fetch.
    const started = deferred<void>(); const finish = deferred<StatsData>(); let count = 0;
    vi.mocked(fetchStats).mockImplementation(async () => { if (++count === 2) started.resolve(); return finish.promise; });
    const pending = [getStats("alice", "pat-a", options), getStats("alice", "pat-b", options), getStats("alice", "pat-a", { referenceTime: "2026-09-05T12:00:01.000Z" })];
    await started.promise; finish.resolve(makeStats({ handle: "alice" })); await Promise.all(pending);
    expect(fetchStats).toHaveBeenCalledTimes(2);
  });
  it("does not share concurrent work across scoring days", async () => {
    const started = deferred<void>(); const finish = deferred<StatsData>(); let count = 0;
    vi.mocked(fetchStats).mockImplementation(async () => { if (++count === 2) started.resolve(); return finish.promise; });
    const pending = [getStats("alice", "pat-a", options), getStats("alice", "pat-a", { referenceTime: "2026-09-06T12:00:00.000Z" })];
    await started.promise; finish.resolve(makeStats({ handle: "alice" })); await Promise.all(pending);
    expect(fetchStats).toHaveBeenCalledTimes(2);
  });
});
