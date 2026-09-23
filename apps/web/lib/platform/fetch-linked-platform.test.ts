import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLinkedPlatformStats, type FetchLinkedPlatformConfig } from "./fetch-linked-platform";
import { readSourceAuthorization, type SourceAuthorization } from "./source-authorization";
import { refreshSourceLink } from "./source-refresh";
import { cacheMGet, cacheSet } from "@/lib/cache/redis";
import { makeStats } from "../test-helpers/fixtures";

vi.mock("./source-authorization", async importOriginal => ({
  ...await importOriginal<typeof import("./source-authorization")>(), readSourceAuthorization: vi.fn(),
}));
vi.mock("./source-refresh", () => ({ refreshSourceLink: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ cacheMGet: vi.fn(), cacheSet: vi.fn() }));
const linked: Extract<SourceAuthorization, { status: "authorized" }> = { status: "authorized", subjectVersion: "legacy-unpublished",
  link: { id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "gitlab", remoteLogin: "linked-alice",
    tokens: { accessToken: "current-token", refreshToken: "refresh-token", expiresAt: null } } };
function config(): FetchLinkedPlatformConfig {
  return { platform: "gitlab", lowerHandle: "Alice", fetchStats: vi.fn().mockResolvedValue(makeStats({ commitsTotal: 5 })) };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readSourceAuthorization).mockResolvedValue(structuredClone(linked));
  vi.mocked(refreshSourceLink).mockImplementation(async authorization => authorization);
});
afterEach(() => vi.useRealTimers());

describe("current linked-source legacy boundary", () => {
  it("returns a read-only miss without authorization, refresh, collection or cache I/O", async () => {
    const input = { ...config(), readOnly: true };
    expect(await fetchLinkedPlatformStats(input)).toBeNull();
    expect(readSourceAuthorization).not.toHaveBeenCalled();
    expect(refreshSourceLink).not.toHaveBeenCalled();
    expect(input.fetchStats).not.toHaveBeenCalled();
    expect(cacheMGet).not.toHaveBeenCalled(); expect(cacheSet).not.toHaveBeenCalled();
  });
  it.each(["disabled", "unlinked", "unavailable"] as const)("does not bypass current %s state with old cached stats", async status => {
    vi.mocked(readSourceAuthorization).mockResolvedValue({ status });
    vi.mocked(cacheMGet).mockResolvedValue([makeStats({ commitsTotal: 900 }), null]);
    const input = config();
    expect(await fetchLinkedPlatformStats(input)).toBeNull();
    expect(refreshSourceLink).not.toHaveBeenCalled(); expect(input.fetchStats).not.toHaveBeenCalled();
    expect(cacheMGet).not.toHaveBeenCalled(); expect(cacheSet).not.toHaveBeenCalled();
  });
  it("uses the refreshed current credential, returns detached stats and never stores an unbound cache row", async () => {
    const updated = { ...structuredClone(linked), link: { ...linked.link!, updatedAt: "2026-09-05T12:00:00.000002Z",
      tokens: { ...linked.link!.tokens, accessToken: "fresh-token" } } };
    vi.mocked(refreshSourceLink).mockResolvedValue(updated);
    vi.mocked(readSourceAuthorization).mockResolvedValue(updated).mockResolvedValueOnce(linked);
    const stats = makeStats({ commitsTotal: 0, prsMergedCount: 0 });
    const input = { ...config(), fetchStats: vi.fn().mockResolvedValue(stats) };
    const result = await fetchLinkedPlatformStats(input);
    expect(readSourceAuthorization).toHaveBeenCalledWith("alice", "gitlab", false);
    expect(input.fetchStats).toHaveBeenCalledWith(updated.link, "fresh-token");
    expect(result).toEqual(stats); expect(result).not.toBe(stats);
    result!.commitsTotal = 99; expect(stats.commitsTotal).toBe(0);
    expect(cacheMGet).not.toHaveBeenCalled(); expect(cacheSet).not.toHaveBeenCalled();
  });
  it("does not collect when token refresh loses current linkage", async () => {
    vi.mocked(refreshSourceLink).mockResolvedValue({ status: "unavailable" });
    const input = config();
    expect(await fetchLinkedPlatformStats(input)).toBeNull(); expect(input.fetchStats).not.toHaveBeenCalled();
  });
  it("does not collect when the row changes between refresh and its current-link check", async () => {
    vi.mocked(readSourceAuthorization).mockResolvedValueOnce(linked).mockResolvedValue({ ...linked, link: { ...linked.link!, updatedAt: "2026-09-05T12:00:00.000002Z" } });
    const input = config();
    expect(await fetchLinkedPlatformStats(input)).toBeNull(); expect(input.fetchStats).not.toHaveBeenCalled();
  });
  it.each(["disabled", "unlinked", "unavailable"] as const)("withholds fetched stats when the source becomes %s", async status => {
    const input = { ...config(), fetchStats: vi.fn().mockImplementation(async () => {
      vi.mocked(readSourceAuthorization).mockResolvedValue({ status }); return makeStats();
    }) };
    expect(await fetchLinkedPlatformStats(input)).toBeNull(); expect(input.fetchStats).toHaveBeenCalledTimes(1);
    expect(cacheSet).not.toHaveBeenCalled();
  });
  it("withholds fetched stats when a replacement link is created during collection", async () => {
    const input = { ...config(), fetchStats: vi.fn().mockImplementation(async () => {
      vi.mocked(readSourceAuthorization).mockResolvedValue({ ...linked, link: { ...linked.link!, id: "22222222-2222-4222-8222-222222222222" } });
      return makeStats();
    }) };
    expect(await fetchLinkedPlatformStats(input)).toBeNull();
  });
  it.each([null, new Error("private upstream error")])("fails closed for null or failed source collection", async outcome => {
    const input = { ...config(), fetchStats: vi.fn().mockImplementation(async () => { if (outcome instanceof Error) throw outcome; return outcome; }) };
    expect(await fetchLinkedPlatformStats(input)).toBeNull(); expect(cacheSet).not.toHaveBeenCalled();
  });
  it("bounds a hung source request and performs no delayed cache write", async () => {
    vi.useFakeTimers();
    const input = { ...config(), fetchStats: vi.fn(() => new Promise<ReturnType<typeof makeStats>>(resolve => setTimeout(() => resolve(makeStats()), 9000))) };
    const pending = fetchLinkedPlatformStats(input);
    await vi.advanceTimersByTimeAsync(8001); expect(await pending).toBeNull();
    await vi.advanceTimersByTimeAsync(1000); expect(cacheSet).not.toHaveBeenCalled();
  });
});
