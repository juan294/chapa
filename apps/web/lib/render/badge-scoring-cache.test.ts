import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), set: vi.fn(), del: vi.fn(), manifest: vi.fn() }));
vi.mock("@/lib/scoring-render-selection", () => ({
  readScoringRenderSelection: mocks.read,
  sameScoringRenderSelection: (a: { machinePolicy: string; cacheable: boolean }, b: { machinePolicy: string; cacheable: boolean }) => a.cacheable && b.cacheable && a.machinePolicy === b.machinePolicy,
}));
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbObservedReceiptManifest: mocks.manifest }));
vi.mock("@/lib/cache/redis", () => ({ cacheSet: mocks.set, cacheDel: mocks.del, cacheGet: vi.fn() }));
import { buildBadgeSvgCacheKey, buildBadgeSvgRenderLockKey, buildOgImageCacheKey, buildOgImageCacheVersion, writeBadgeSvgCache } from "./badge-svg-cache";
const selection = { enabled: true, machinePolicy: "v7.2" as const, cacheable: true, capturedAt: 1 };
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue(selection); mocks.set.mockResolvedValue(true); mocks.del.mockResolvedValue(true); mocks.manifest.mockResolvedValue({ status: "missing" }); });
describe("scoring image cache identity and publication", () => {
  it("separates both policies across SVG, PNG, stale days, locks and URL versions", () => {
    for (const date of ["2026-09-08", "2026-09-07"]) for (const locale of ["en", "es"] as const) {
      for (const build of [buildBadgeSvgCacheKey, buildBadgeSvgRenderLockKey, buildOgImageCacheKey]) {
        expect(build("owner", date, locale, "v7.2")).not.toBe(build("owner", date, locale, "v6"));
        expect(build("owner", date, locale, "v6")).toContain(":v6:");
      }
      expect(buildOgImageCacheVersion(date, 2, "v7.2")).not.toBe(buildOgImageCacheVersion(date, 2, "v6"));
    }
  });
  it("does not publish a render whose captured flag is already obsolete", async () => {
    mocks.read.mockResolvedValue({ ...selection, enabled: false, machinePolicy: "v6" });
    expect(await writeBadgeSvgCache("key", "<svg/>", "owner", { scoringSelection: selection })).toBe(false);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("deletes a render if the flag changes while Redis is writing", async () => {
    mocks.read.mockResolvedValueOnce(selection).mockResolvedValueOnce({ ...selection, enabled: false, machinePolicy: "v6" });
    expect(await writeBadgeSvgCache("key", "<svg/>", "owner", { scoringSelection: selection })).toBe(false);
    expect(mocks.del).toHaveBeenCalledWith("key");
    expect(mocks.read).toHaveBeenCalledWith({ force: true });
  });
  it("keeps the rollback fence attached to a write that finishes after its deadline", async () => {
    vi.useFakeTimers();
    try {
      let finish!: (value: boolean) => void;
      mocks.set.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve; }));
      const publication = writeBadgeSvgCache("late-key", "<svg/>", "owner", { scoringSelection: selection });
      await vi.advanceTimersByTimeAsync(501);
      expect(await publication).toBe(false);
      mocks.read.mockResolvedValue({ ...selection, enabled: false, machinePolicy: "v6" });
      finish(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.del).toHaveBeenCalledWith("late-key");
    } finally { vi.useRealTimers(); }
  });

  it("removes old receipt bytes if a report publishes a newer revision during the write", async () => {
    const identity = { revisionId: "revision-a", contentHash: "hash-a" };
    mocks.manifest.mockResolvedValueOnce({ status: "found", manifest: { ...identity, isCurrent: true } })
      .mockResolvedValueOnce({ status: "found", manifest: { revisionId: "revision-b", contentHash: "hash-b", isCurrent: true } });
    expect(await writeBadgeSvgCache("key", "<svg>A</svg>", "owner", { scoringSelection: selection, receiptIdentity: identity })).toBe(false);
    expect(mocks.del).toHaveBeenCalledWith("key");
  });

  it("does not cache a no-receipt fallback after first publication or failed manifest lookup", async () => {
    for (const current of [{ status: "found", manifest: { revisionId: "new", contentHash: "new", isCurrent: true } }, { status: "unavailable" }]) {
      mocks.manifest.mockResolvedValue(current);
      expect(await writeBadgeSvgCache("key", "<svg>fallback</svg>", "owner", { scoringSelection: selection, receiptIdentity: null })).toBe(false);
    }
    expect(mocks.set).not.toHaveBeenCalled();
  });

});
