import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockReadPublicObservedScore, mockReadStats } = vi.hoisted(() => ({
  mockReadPublicObservedScore: vi.fn(),
  mockReadStats: vi.fn(),
}));

vi.mock("./post-write-score", () => ({
  readPublicObservedScore: mockReadPublicObservedScore,
}));

vi.mock("@/lib/github/client", () => ({
  readStats: mockReadStats,
}));

import {
  readStoredBadgeProfile,
  storedBadgeRenderInputs,
  storedBadgeActivityUnavailable,
} from "./stored-badge-profile";

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

const STALE_STATS = {
  handle: "juan294",
  commitsTotal: 100,
  activeDays: 40,
  prsMergedCount: 10,
  prsMergedWeight: 10,
  reviewsSubmittedCount: 5,
  issuesClosedCount: 2,
  linesAdded: 1000,
  linesDeleted: 200,
  reposContributed: 9,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 3,
  totalStars: 42,
  totalForks: 3,
  totalWatchers: 1,
  heatmapData: [{ date: "2026-09-19", count: 2 }],
  fetchedAt: "2026-09-19T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readStoredBadgeProfile", () => {
  it("returns null when there is no current receipt", async () => {
    mockReadPublicObservedScore.mockResolvedValue({ status: "missing" });

    const result = await readStoredBadgeProfile("ghost");

    expect(result).toBeNull();
    expect(mockReadStats).not.toHaveBeenCalled();
  });

  it("uses the current v7.2 receipt as the sole scoring authority", async () => {
    mockReadPublicObservedScore.mockResolvedValue({
      status: "current",
      projection: { scoring: RECEIPT_MODEL },
    });
    mockReadStats.mockResolvedValue({ status: "stale", stats: STALE_STATS, capturedAt: "2026-09-19T00:00:00.000Z" });

    const result = await readStoredBadgeProfile("juan294");

    expect(result?.kind).toBe("stored");
    expect(result?.scoring.policyVersion).toBe("v7.2");
    expect(result?.scoring.composite).toEqual({ kind: "point", value: 62, display: 62 });
    expect(result?.scoring.tier).toBe("High");
    expect(result?.scoring.archetype).toBe("Builder");
    expect(result?.stats?.reposContributed).toBe(9);
    expect(result?.observedAt).toBe("2026-09-20T00:00:00.000Z");
    expect(mockReadStats).toHaveBeenCalledWith("juan294", undefined, { readOnly: true });
  });

  it("forces the receipt's own current freshness to stale for the stored projection", async () => {
    mockReadPublicObservedScore.mockResolvedValue({
      status: "current",
      projection: { scoring: { ...RECEIPT_MODEL, freshness: "current" } },
    });
    mockReadStats.mockResolvedValue({ status: "unavailable" });

    const result = await readStoredBadgeProfile("juan294");

    expect(result?.scoring.freshness).toBe("stale");
  });

  it("keeps the receipt model's own 'unavailable' freshness — a stricter truthful state than stale", async () => {
    mockReadPublicObservedScore.mockResolvedValue({
      status: "current",
      projection: { scoring: { ...RECEIPT_MODEL, freshness: "unavailable" } },
    });
    mockReadStats.mockResolvedValue({ status: "unavailable" });

    const result = await readStoredBadgeProfile("juan294");

    expect(result?.scoring.freshness).toBe("unavailable");
  });

  it("still returns a profile when a current receipt exists but no stats envelope backs it — never refuses the fallback", async () => {
    mockReadPublicObservedScore.mockResolvedValue({
      status: "current",
      projection: { scoring: RECEIPT_MODEL },
    });
    mockReadStats.mockResolvedValue({ status: "unavailable" });

    const result = await readStoredBadgeProfile("juan294");

    expect(result).not.toBeNull();
    expect(result?.stats).toBeNull();
  });
});

describe("storedBadgeRenderInputs", () => {
  it("builds renderBadgeSvg inputs with an empty heatmap — never zero-filled per-day activity", () => {
    const stored = { kind: "stored" as const, handle: "juan294", observedAt: "2026-09-20T00:00:00.000Z", scoring: RECEIPT_MODEL, stats: STALE_STATS };

    const inputs = storedBadgeRenderInputs(stored);

    expect(inputs.stats.handle).toBe("juan294");
    expect(inputs.stats.heatmapData).toEqual([]);
    expect(inputs.stats.reposContributed).toBe(9);
    expect(inputs.stats.totalStars).toBe(42);
    expect(inputs.countsAvailable).toBe(true);
  });

  it("renders counts as unavailable, never as a fabricated zero, when no stats envelope exists", () => {
    const stored = { kind: "stored" as const, handle: "juan294", observedAt: "2026-09-20T00:00:00.000Z", scoring: RECEIPT_MODEL, stats: null };

    const inputs = storedBadgeRenderInputs(stored);

    expect(inputs.countsAvailable).toBe(false);
    expect(inputs.stats.heatmapData).toEqual([]);
    expect(inputs.stats.handle).toBe("juan294");
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
