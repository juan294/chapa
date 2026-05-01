/**
 * #800 — materializeProfile must run getStats concurrently with the
 * craft / snapshot / dirty cache lookups. The cache lookups only need
 * the handle, so blocking them behind getStats adds an extra RTT to
 * every share-page / badge.svg cache miss.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { materializeProfile } from "./materialize-profile";
import { makeFullStats } from "../test-helpers/fixtures";

const mockGetStats = vi.fn();
const mockGetCachedCraftScore = vi.fn();
const mockGetCachedLatestSnapshot = vi.fn();
const mockIsStatsDirty = vi.fn();

vi.mock("@/lib/github/client", () => ({
  getStats: (...args: unknown[]) => mockGetStats(...args),
}));
vi.mock("@/lib/cache/craft-cache", () => ({
  getCachedCraftScore: (...args: unknown[]) => mockGetCachedCraftScore(...args),
}));
vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: (...args: unknown[]) =>
    mockGetCachedLatestSnapshot(...args),
}));
vi.mock("@/lib/cache/dirty-stats", () => ({
  isStatsDirty: (...args: unknown[]) => mockIsStatsDirty(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("materializeProfile parallelism (#800)", () => {
  it("starts the cache lookups before getStats resolves", async () => {
    const callOrder: string[] = [];

    let resolveStats: (v: unknown) => void = () => {};
    mockGetStats.mockImplementation(() => {
      callOrder.push("getStats:start");
      return new Promise((resolve) => {
        resolveStats = (v) => {
          callOrder.push("getStats:end");
          resolve(v);
        };
      });
    });
    mockGetCachedCraftScore.mockImplementation(async () => {
      callOrder.push("craft:start");
      await new Promise((r) => setTimeout(r, 0));
      callOrder.push("craft:end");
      return null;
    });
    mockGetCachedLatestSnapshot.mockImplementation(async () => {
      callOrder.push("snapshot:start");
      await new Promise((r) => setTimeout(r, 0));
      callOrder.push("snapshot:end");
      return null;
    });
    mockIsStatsDirty.mockImplementation(async () => {
      callOrder.push("dirty:start");
      await new Promise((r) => setTimeout(r, 0));
      callOrder.push("dirty:end");
      return false;
    });

    const promise = materializeProfile("octocat");
    // Yield once so all synchronously-started promises can record their start.
    await new Promise((r) => setTimeout(r, 0));

    // The cache lookups must have started before getStats resolved.
    expect(callOrder).toContain("craft:start");
    expect(callOrder).toContain("snapshot:start");
    expect(callOrder).toContain("dirty:start");
    expect(callOrder).not.toContain("getStats:end");

    resolveStats(makeFullStats());
    await promise;
  });

  it("returns null when getStats fails, even if cache lookups succeed", async () => {
    mockGetStats.mockResolvedValue(null);
    mockGetCachedCraftScore.mockResolvedValue(null);
    mockGetCachedLatestSnapshot.mockResolvedValue(null);
    mockIsStatsDirty.mockResolvedValue(false);

    const result = await materializeProfile("nope");
    expect(result).toBeNull();
  });

  it("survives cache lookup rejections (fail open to defaults)", async () => {
    mockGetStats.mockResolvedValue(makeFullStats());
    mockGetCachedCraftScore.mockRejectedValue(new Error("redis"));
    mockGetCachedLatestSnapshot.mockRejectedValue(new Error("redis"));
    mockIsStatsDirty.mockRejectedValue(new Error("redis"));

    const result = await materializeProfile("octocat");
    expect(result).not.toBeNull();
    expect(result!.craftResult).toBeNull();
    expect(result!.latestSnapshot).toBeNull();
    expect(result!.inputsChanged).toBe(false);
  });
});
