import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { makeSnapshot } from "@/lib/test-helpers/fixtures";

const { mockReadPublicObservedScore, mockGetCachedLatestSnapshot } = vi.hoisted(() => ({
  mockReadPublicObservedScore: vi.fn(),
  mockGetCachedLatestSnapshot: vi.fn(),
}));

vi.mock("./post-write-score", () => ({
  readPublicObservedScore: mockReadPublicObservedScore,
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: mockGetCachedLatestSnapshot,
}));

import {
  readStoredBadgeProfile,
  storedBadgeRenderInputs,
  snapshotDimensions,
  storedBadgeActivityUnavailable,
} from "./stored-badge-profile";

const V6_SELECTION: ScoringRenderSelection = {
  enabled: false,
  machinePolicy: "v6",
  cacheable: true,
  capturedAt: Date.parse("2026-09-22T10:00:00Z"),
};

const V72_SELECTION: ScoringRenderSelection = {
  ...V6_SELECTION,
  enabled: true,
  machinePolicy: "v7.2",
};

const RECEIPT_MODEL = {
  policyVersion: "v7.2" as const,
  handle: "juan294",
  identity: {
    receiptId: "11111111-1111-1111-1111-111111111111",
    revisionId: "22222222-2222-2222-2222-222222222222",
    revision: 1,
    recordedAt: "2026-09-20T00:00:00.000Z",
    action: "create" as const,
    supersedesRevisionId: null,
    contentHash: "a".repeat(64),
  },
  window: {
    referenceTime: "2026-09-20T00:00:00.000Z",
    referenceDate: "2026-09-20",
    startInclusive: "2025-09-21",
    endExclusive: "2026-09-21",
    calendarDays: 365,
  },
  dimensions: {
    delivery: { kind: "point" as const, value: 70, display: 70 },
    quality: { kind: "point" as const, value: 65, display: 65 },
    consistency: { kind: "point" as const, value: 60, display: 60 },
    breadth: { kind: "point" as const, value: 55, display: 55 },
  },
  composite: { kind: "point" as const, value: 62, display: 62 },
  tier: "High" as const,
  archetype: "Builder" as const,
  craft: null,
  reportCraft: null,
  freshness: "current" as const,
  coverage: [],
  exclusions: [],
  limitations: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readStoredBadgeProfile", () => {
  it("returns null when the selection is not cacheable (unknown policy authority is not a fallback opportunity)", async () => {
    const result = await readStoredBadgeProfile("juan294", { ...V6_SELECTION, cacheable: false });

    expect(result).toBeNull();
    expect(mockReadPublicObservedScore).not.toHaveBeenCalled();
    expect(mockGetCachedLatestSnapshot).not.toHaveBeenCalled();
  });

  it("returns null when neither a current receipt nor a durable snapshot exists", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    const result = await readStoredBadgeProfile("ghost", V6_SELECTION);

    expect(result).toBeNull();
  });

  it("builds a v6 stored profile from the durable snapshot alone when no current receipt exists", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });
    const snapshot = makeSnapshot({ archetype: "Builder", tier: "High", adjustedComposite: 68 });
    mockGetCachedLatestSnapshot.mockResolvedValue(snapshot);

    const result = await readStoredBadgeProfile("juan294", V6_SELECTION);

    expect(result?.kind).toBe("stored");
    expect(result?.policyVersion).toBe("v6");
    expect(result?.handle).toBe("juan294");
    expect(result?.observedAt).toBe(snapshot.capturedAt);
    expect(result?.scoring.policyVersion).toBe("v6");
    expect(result?.scoring.tier).toBe("High");
    expect(result?.scoring.archetype).toBe("Builder");
    expect(result?.scoring.composite).toEqual({ kind: "point", value: 68, display: 68 });
    // Never recomputed from a partial StatsData — copied straight from the snapshot.
    expect(result?.legacyImpact.dimensions).toEqual(snapshotDimensions(snapshot));
    expect(result?.legacyImpact.archetype).toBe("Builder");
  });

  it("marks a v6 stored profile's scoring as stale, never current", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "unavailable" });
    mockGetCachedLatestSnapshot.mockResolvedValue(makeSnapshot());

    const result = await readStoredBadgeProfile("juan294", V6_SELECTION);

    expect(result?.scoring.freshness).toBe("stale");
  });

  it("uses the current v7.2 receipt as the sole scoring authority when one exists, never mixing v7 dimensions with a v6 headline", async () => {
    mockReadPublicObservedScore.mockResolvedValue({
      status: "current",
      projection: { scoring: RECEIPT_MODEL },
    });
    const snapshot = makeSnapshot({ archetype: "Marathoner", tier: "Solid", adjustedComposite: 40 });
    mockGetCachedLatestSnapshot.mockResolvedValue(snapshot);

    const result = await readStoredBadgeProfile("juan294", V72_SELECTION);

    expect(result?.policyVersion).toBe("v7.2");
    expect(result?.scoring.policyVersion).toBe("v7.2");
    // The receipt's own numbers, not the snapshot's legacy aggregate.
    expect(result?.scoring.composite).toEqual({ kind: "point", value: 62, display: 62 });
    expect(result?.scoring.tier).toBe("High");
    expect(result?.scoring.archetype).toBe("Builder");
    // The snapshot still supplies non-scoring context (repo/star counts etc.),
    // never scoring dimensions.
    expect(result?.context.reposContributed).toBe(snapshot.reposContributed);
    // The disclosed date comes from the receipt, the scoring authority.
    expect(result?.observedAt).toBe("2026-09-20T00:00:00.000Z");
  });

  it("forces a current receipt's freshness to stale for the stored projection", async () => {
    mockReadPublicObservedScore.mockResolvedValue({
      status: "current",
      projection: { scoring: { ...RECEIPT_MODEL, freshness: "current" } },
    });
    mockGetCachedLatestSnapshot.mockResolvedValue(makeSnapshot());

    const result = await readStoredBadgeProfile("juan294", V72_SELECTION);

    expect(result?.scoring.freshness).toBe("stale");
  });

  it("keeps the receipt model's own 'unavailable' freshness — a stricter truthful state than stale", async () => {
    mockReadPublicObservedScore.mockResolvedValue({
      status: "current",
      projection: { scoring: { ...RECEIPT_MODEL, freshness: "unavailable" } },
    });
    mockGetCachedLatestSnapshot.mockResolvedValue(makeSnapshot());

    const result = await readStoredBadgeProfile("juan294", V72_SELECTION);

    expect(result?.scoring.freshness).toBe("unavailable");
  });

  it("returns null when a current receipt exists but no durable snapshot backs its context", async () => {
    mockReadPublicObservedScore.mockResolvedValue({
      status: "current",
      projection: { scoring: RECEIPT_MODEL },
    });
    mockGetCachedLatestSnapshot.mockResolvedValue(null);

    const result = await readStoredBadgeProfile("juan294", V72_SELECTION);

    expect(result).toBeNull();
  });

  it("never creates heatmapData — the type has no field for it", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });
    mockGetCachedLatestSnapshot.mockResolvedValue(makeSnapshot());

    const result = await readStoredBadgeProfile("juan294", V6_SELECTION);

    expect(result).not.toHaveProperty("heatmapData");
    expect(result?.context).not.toHaveProperty("heatmapData");
  });

  it("does not fetch a receipt when v7.2 is not enabled (v6 selection)", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });
    mockGetCachedLatestSnapshot.mockResolvedValue(makeSnapshot());

    await readStoredBadgeProfile("juan294", V6_SELECTION);

    expect(mockReadPublicObservedScore).toHaveBeenCalledWith("juan294", V6_SELECTION);
  });
});

describe("storedBadgeRenderInputs", () => {
  it("builds renderBadgeSvg inputs with an empty heatmap — never zero-filled per-day activity", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });
    const snapshot = makeSnapshot({ reposContributed: 9, totalStars: 42 });
    mockGetCachedLatestSnapshot.mockResolvedValue(snapshot);
    const stored = await readStoredBadgeProfile("juan294", V6_SELECTION);

    const inputs = storedBadgeRenderInputs(stored!);

    expect(inputs.stats.handle).toBe("juan294");
    expect(inputs.stats.heatmapData).toEqual([]);
    expect(inputs.stats.reposContributed).toBe(9);
    expect(inputs.stats.totalStars).toBe(42);
    expect(inputs.stats.avatarUrl).toBeUndefined();
    expect(inputs.stats.displayName).toBeUndefined();
    expect(inputs.impact).toBe(stored!.legacyImpact);
  });
});

describe("storedBadgeActivityUnavailable", () => {
  it("interpolates the caller's translator with the observed date, truncated to YYYY-MM-DD", () => {
    const t = (key: string) => (key === "badge.activityUnavailable"
      ? "Last successful snapshot: {date}. Live sources are temporarily unavailable."
      : key);

    const result = storedBadgeActivityUnavailable(t, "2026-09-20T14:32:00.000Z");

    expect(result).toBe("Last successful snapshot: 2026-09-20. Live sources are temporarily unavailable.");
  });
});
