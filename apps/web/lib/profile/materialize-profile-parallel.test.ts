/**
 * #800 — materializeProfile must run readStats concurrently with the craft
 * cache lookup and the receipt read. #1335 phase 5 ("delete v6") dropped the
 * snapshot/dirty-marker cache lookups this suite used to also verify
 * concurrency for — there is no EMA/snapshot machinery left to read.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { materializeProfile } from "./materialize-profile";
import { expectFound } from "@/lib/test-helpers/found";
import { makeFullStats } from "../test-helpers/fixtures";

const mockReadStats = vi.fn();
const mockGetCachedCraftScore = vi.fn();
const mockReadRenderableReceipt = vi.fn();

vi.mock("@/lib/github/client", () => ({
  readStats: (...args: unknown[]) => mockReadStats(...args),
}));
vi.mock("@/lib/cache/craft-cache", () => ({
  getCachedCraftScore: (...args: unknown[]) => mockGetCachedCraftScore(...args),
}));
vi.mock("./score-model", () => ({
  readRenderableReceipt: (...args: unknown[]) => mockReadRenderableReceipt(...args),
  scoreModelFrom: vi.fn(() => undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockReadRenderableReceipt.mockResolvedValue(null);
});

describe("materializeProfile parallelism (#800)", () => {
  it("starts the craft cache lookup and the receipt read before readStats resolves", async () => {
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
    mockReadRenderableReceipt.mockImplementation(async () => {
      callOrder.push("receipt:start");
      await new Promise((r) => setTimeout(r, 0));
      callOrder.push("receipt:end");
      return null;
    });

    const promise = materializeProfile("octocat");
    // Yield once so all synchronously-started promises can record their start.
    await new Promise((r) => setTimeout(r, 0));

    // The craft cache lookup and the receipt read must have started before
    // readStats resolved.
    expect(callOrder).toContain("craft:start");
    expect(callOrder).toContain("receipt:start");
    expect(callOrder).not.toContain("readStats:end");

    resolveStats({ status: "current", stats: makeFullStats(), capturedAt: new Date().toISOString() });
    await promise;
  });

  it("returns null when readStats fails, even if the craft cache lookup succeeds", async () => {
    mockReadStats.mockResolvedValue({ status: "unavailable" });
    mockGetCachedCraftScore.mockResolvedValue(null);

    const result = await materializeProfile("nope");
    expect(result).toBeNull();
  });

  it("survives a craft cache lookup rejection (fails open to null)", async () => {
    mockReadStats.mockResolvedValue({ status: "current", stats: makeFullStats(), capturedAt: new Date().toISOString() });
    mockGetCachedCraftScore.mockRejectedValue(new Error("redis"));

    const result = expectFound(await materializeProfile("octocat"));
    expect(result.craftResult).toBeNull();
  });

  it("survives a receipt read rejection (fails open to no scoring model)", async () => {
    mockReadStats.mockResolvedValue({ status: "current", stats: makeFullStats(), capturedAt: new Date().toISOString() });
    mockGetCachedCraftScore.mockResolvedValue(null);
    mockReadRenderableReceipt.mockRejectedValue(new Error("db down"));

    const result = expectFound(await materializeProfile("octocat"));
    expect(result.scoring).toBeUndefined();
  });
});
