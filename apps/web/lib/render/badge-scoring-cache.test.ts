import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ set: vi.fn(), del: vi.fn(), manifest: vi.fn() }));
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbObservedReceiptManifest: mocks.manifest }));
vi.mock("@/lib/cache/redis", () => ({ cacheSet: mocks.set, cacheDel: mocks.del, cacheGet: vi.fn() }));
import { buildBadgeSvgCacheKey, buildBadgeSvgRenderLockKey, buildOgImageCacheKey, buildOgImageCacheVersion, writeBadgeSvgCache } from "./badge-svg-cache";
beforeEach(() => { vi.clearAllMocks(); mocks.set.mockResolvedValue(true); mocks.del.mockResolvedValue(true); mocks.manifest.mockResolvedValue({ status: "missing" }); });

// #1335 phase 5 — the v6/v7.2 selection this suite used to fence keys and
// writes against is retired: there is one policy (`SCORING_POLICY`) now, and
// the key format keeps its literal `v7.2` segment unchanged (plan step 5.2).
describe("scoring image cache identity and publication", () => {
  it("keys always carry the current v7.2 policy literal, separated by day and locale", () => {
    for (const date of ["2026-09-08", "2026-09-07"]) for (const locale of ["en", "es"] as const) {
      expect(buildBadgeSvgCacheKey("owner", date, locale)).toContain(":v7.2:");
      expect(buildOgImageCacheKey("owner", date, locale)).toContain(":v7.2:");
      expect(buildBadgeSvgRenderLockKey("owner", date, locale)).toContain(":v7.2:");
      expect(buildOgImageCacheVersion(date, 2)).toContain("v7.2");
    }
  });

  it("does not publish a render whose receipt was replaced mid-write", async () => {
    const identity = { revisionId: "revision-a", contentHash: "hash-a" };
    mocks.manifest.mockResolvedValueOnce({ status: "found", manifest: { ...identity, isCurrent: true } })
      .mockResolvedValueOnce({ status: "found", manifest: { revisionId: "revision-b", contentHash: "hash-b", isCurrent: true } });
    expect(await writeBadgeSvgCache("key", "<svg>A</svg>", "owner", { receiptIdentity: identity })).toBe(false);
    expect(mocks.del).toHaveBeenCalledWith("key");
  });

  it("keeps the rollback fence attached to a write that finishes after its deadline", async () => {
    vi.useFakeTimers();
    try {
      const identity = { revisionId: "revision-a", contentHash: "hash-a" };
      mocks.manifest.mockResolvedValue({ status: "found", manifest: { ...identity, isCurrent: true } });
      let finish!: (value: boolean) => void;
      mocks.set.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve; }));
      const publication = writeBadgeSvgCache("late-key", "<svg/>", "owner", { receiptIdentity: identity });
      await vi.advanceTimersByTimeAsync(501);
      expect(await publication).toBe(false);
      // A newer revision published while the deferred write was still in
      // flight — the fence must still catch it and roll the write back.
      mocks.manifest.mockResolvedValue({ status: "found", manifest: { revisionId: "revision-b", contentHash: "hash-b", isCurrent: true } });
      finish(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.del).toHaveBeenCalledWith("late-key");
    } finally { vi.useRealTimers(); }
  });

  it("does not cache a no-receipt fallback after first publication or failed manifest lookup", async () => {
    for (const current of [{ status: "found", manifest: { revisionId: "new", contentHash: "new", isCurrent: true } }, { status: "unavailable" }]) {
      mocks.manifest.mockResolvedValue(current);
      expect(await writeBadgeSvgCache("key", "<svg>fallback</svg>", "owner", { receiptIdentity: null })).toBe(false);
    }
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
