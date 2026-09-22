/**
 * #800 — materializeProfile must run readStats concurrently with the
 * craft / snapshot / dirty cache lookups. The cache lookups only need
 * the handle, so blocking them behind readStats adds an extra RTT to
 * every share-page / badge.svg cache miss.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { materializeProfile } from "./materialize-profile";
import { expectFound } from "@/lib/test-helpers/found";
import { makeFullStats } from "../test-helpers/fixtures";

const mockReadStats = vi.fn();
const mockGetCachedCraftScore = vi.fn();
const mockGetCachedLatestSnapshot = vi.fn();
const mockIsStatsDirty = vi.fn();

vi.mock("@/lib/github/client", () => ({
  readStats: (...args: unknown[]) => mockReadStats(...args),
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
  it("starts the cache lookups before readStats resolves", async () => {
    const callOrder: string[] = [];

    let resolveStats: (v: unknown) => void = () => {};
    mockReadStats.mockImplementation(() => {
      callOrder.push("readStats:start");
      return new Promise((resolve) => {
        resolveStats = (v) => {
          callOrder.push("readStats:end");
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

    // The cache lookups must have started before readStats resolved.
    expect(callOrder).toContain("craft:start");
    expect(callOrder).toContain("snapshot:start");
    expect(callOrder).toContain("dirty:start");
    expect(callOrder).not.toContain("readStats:end");

    resolveStats({ status: "current", stats: makeFullStats(), capturedAt: new Date().toISOString() });
    await promise;
  });

  it("returns null when readStats fails, even if cache lookups succeed", async () => {
    mockReadStats.mockResolvedValue({ status: "unavailable" });
    mockGetCachedCraftScore.mockResolvedValue(null);
    mockGetCachedLatestSnapshot.mockResolvedValue(null);
    mockIsStatsDirty.mockResolvedValue(false);

    const result = await materializeProfile("nope");
    expect(result).toBeNull();
  });

  it("survives cache lookup rejections (fail open to defaults)", async () => {
    mockReadStats.mockResolvedValue({ status: "current", stats: makeFullStats(), capturedAt: new Date().toISOString() });
    mockGetCachedCraftScore.mockRejectedValue(new Error("redis"));
    mockGetCachedLatestSnapshot.mockRejectedValue(new Error("redis"));
    mockIsStatsDirty.mockRejectedValue(new Error("redis"));

    const result = expectFound(await materializeProfile("octocat"));
    expect(result.craftResult).toBeNull();
    expect(result.latestSnapshot).toBeNull();
    expect(result.inputsChanged).toBe(false);
  });
});
