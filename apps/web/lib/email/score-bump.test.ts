import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the module under test.
// ---------------------------------------------------------------------------

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://chapa.thecreativetoken.com",
}));

const mockDbGetUserEmail = vi.fn();

vi.mock("@/lib/db/users", () => ({
  dbGetUserEmail: (...args: unknown[]) => mockDbGetUserEmail(...args),
}));

const mockDbGetFeatureFlag = vi.fn();

vi.mock("@/lib/db/feature-flags", () => ({
  dbGetFeatureFlag: (...args: unknown[]) => mockDbGetFeatureFlag(...args),
}));

import { notifyScoreBump } from "./score-bump";
import { _resetClient } from "./resend";
import type { SnapshotDiff } from "@/lib/history/diff";
import type { SignificantChange } from "@/lib/history/significant-change";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDiff(overrides: Partial<SnapshotDiff> = {}): SnapshotDiff {
  return {
    direction: "improving",
    daysBetween: 1,
    compositeScore: 8,
    adjustedComposite: 8,
    confidence: 2,
    dimensions: { building: 5, guarding: 2, consistency: 1, breadth: 0 },
    stats: {
      commitsTotal: 10,
      prsMergedCount: 3,
      prsMergedWeight: 5,
      reviewsSubmittedCount: 2,
      issuesClosedCount: 1,
      reposContributed: 1,
      activeDays: 5,
      linesAdded: 500,
      linesDeleted: 100,
      totalStars: 2,
      totalForks: 0,
      totalWatchers: 1,
      topRepoShare: -0.05,
    },
    archetype: null,
    tier: null,
    profileType: null,
    penaltyChanges: null,
    ...overrides,
  };
}

function makeSignificance(
  reason: SignificantChange["reason"],
  allReasons?: SignificantChange["allReasons"],
): SignificantChange {
  return {
    significant: true,
    reason,
    allReasons: allReasons ?? [reason],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetClient();

  vi.stubEnv("RESEND_API_KEY", "re_test_123");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");

  // DB feature flag: score_notifications enabled by default
  mockDbGetFeatureFlag.mockResolvedValue({ key: "score_notifications", enabled: true });

  mockCacheGet.mockResolvedValue(null); // No dedup marker
  mockCacheSet.mockResolvedValue(true);
  mockSend.mockResolvedValue({ data: { id: "msg_123" }, error: null });
  mockDbGetUserEmail.mockResolvedValue({
    email: "dev@example.com",
    emailNotifications: true,
  });
});

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

describe("feature flag guard", () => {
  it("skips when score_notifications flag is disabled in DB", async () => {
    mockDbGetFeatureFlag.mockResolvedValue({ key: "score_notifications", enabled: false });

    await notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump"));

    expect(mockDbGetFeatureFlag).toHaveBeenCalledWith("score_notifications");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when score_notifications flag is not found in DB", async () => {
    mockDbGetFeatureFlag.mockResolvedValue(null);

    await notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump"));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when DB is unavailable (fail-closed for notifications)", async () => {
    mockDbGetFeatureFlag.mockRejectedValue(new Error("DB unavailable"));

    await notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump"));

    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// User email checks
// ---------------------------------------------------------------------------

describe("user email checks", () => {
  it("skips when user has no email", async () => {
    mockDbGetUserEmail.mockResolvedValue(null);

    await notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump"));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when user has opted out of notifications", async () => {
    mockDbGetUserEmail.mockResolvedValue({
      email: "dev@example.com",
      emailNotifications: false,
    });

    await notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump"));

    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("deduplication", () => {
  it("skips when Redis dedup marker exists (already notified recently)", async () => {
    mockCacheGet.mockResolvedValueOnce(true);

    await notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump"));

    expect(mockCacheGet).toHaveBeenCalledWith("score-bump:testuser");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sets dedup marker with 7-day TTL after successful send", async () => {
    await notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump"));

    expect(mockCacheSet).toHaveBeenCalledWith(
      "score-bump:testuser",
      true,
      604_800, // 7 days in seconds
    );
  });

  it("does not set marker when send fails", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limited" },
    });

    await notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump"));

    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("lowercases handle for dedup key", async () => {
    await notifyScoreBump("TestUser", makeDiff(), makeSignificance("score_bump"));

    expect(mockCacheGet).toHaveBeenCalledWith("score-bump:testuser");
  });
});

// ---------------------------------------------------------------------------
// Email content — score bump
// ---------------------------------------------------------------------------

describe("email content — score bump", () => {
  it("sends to user email with score bump subject", async () => {
    const diff = makeDiff({ adjustedComposite: 8 });

    await notifyScoreBump("testuser", diff, makeSignificance("score_bump"));

    const call = mockSend.mock.calls[0]![0];
    expect(call.to).toEqual(["dev@example.com"]);
    expect(call.subject).toContain("+8");
    expect(call.subject).toContain("testuser");
  });

  it("includes share URL and score delta in body", async () => {
    await notifyScoreBump("testuser", makeDiff({ adjustedComposite: 8 }), makeSignificance("score_bump"));

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).toContain("https://chapa.thecreativetoken.com/u/testuser");
    expect(call.html).toContain("+8");
    expect(call.text).toContain("https://chapa.thecreativetoken.com/u/testuser");
  });
});

// ---------------------------------------------------------------------------
// Email content — tier change
// ---------------------------------------------------------------------------

describe("email content — tier change", () => {
  it("uses tier change subject when tier changed", async () => {
    const diff = makeDiff({
      tier: { from: "Solid", to: "High" },
      adjustedComposite: 10,
    });

    await notifyScoreBump("testuser", diff, makeSignificance("tier_change"));

    const call = mockSend.mock.calls[0]![0];
    expect(call.subject).toContain("Solid");
    expect(call.subject).toContain("High");
    expect(call.html).toContain("Solid");
    expect(call.html).toContain("High");
  });
});

// ---------------------------------------------------------------------------
// Email content — archetype change
// ---------------------------------------------------------------------------

describe("email content — archetype change", () => {
  it("uses archetype change subject when archetype changed", async () => {
    const diff = makeDiff({
      archetype: { from: "Balanced", to: "Builder" },
      adjustedComposite: 3,
    });

    await notifyScoreBump(
      "testuser",
      diff,
      makeSignificance("archetype_change"),
    );

    const call = mockSend.mock.calls[0]![0];
    expect(call.subject).toContain("Balanced");
    expect(call.subject).toContain("Builder");
    expect(call.html).toContain("Balanced");
    expect(call.html).toContain("Builder");
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

describe("graceful degradation", () => {
  it("does not throw when Resend is unavailable", async () => {
    _resetClient();
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(
      notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump")),
    ).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not throw when send fails", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Service unavailable" },
    });

    await expect(
      notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump")),
    ).resolves.toBeUndefined();
  });

  it("does not throw when dbGetUserEmail fails", async () => {
    mockDbGetUserEmail.mockRejectedValue(new Error("DB down"));

    await expect(
      notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump")),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unsubscribe link
// ---------------------------------------------------------------------------

describe("unsubscribe link", () => {
  it("includes unsubscribe link in email body", async () => {
    await notifyScoreBump("testuser", makeDiff(), makeSignificance("score_bump"));

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).toContain("/api/notifications/unsubscribe");
    expect(call.text).toContain("/api/notifications/unsubscribe");
  });
});
