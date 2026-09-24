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

const mockDbGetUserEmail = vi.fn();

vi.mock("@/lib/db/users", () => ({
  dbGetUserEmail: (...args: unknown[]) => mockDbGetUserEmail(...args),
}));

const mockDbGetFeatureFlag = vi.fn();

vi.mock("@/lib/db/feature-flags", () => ({
  dbGetFeatureFlag: (...args: unknown[]) => mockDbGetFeatureFlag(...args),
}));

import { _resetClient } from "./resend";

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

describe("observed revision notifications", () => {
  it("uses current canonical observations and refuses cross-policy claims", async () => {
    const { notifyObservedScoreChange } = await import("./score-bump");
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const { scoringObservation, compareScoringObservations } = await import("@/lib/history/scoring-observations");
    const { model } = await scoringConsistencyFixture({ boundary: true });
    const current = scoringObservation(model)!;
    const previous = { ...current, composite: { exact: 46, display: 46 } };
    await notifyObservedScoreChange("alice", compareScoringObservations(previous, { ...current, policyVersion: "v7" }));
    expect(mockSend).not.toHaveBeenCalled();
    await notifyObservedScoreChange("alice", compareScoringObservations(previous, current));
    expect(mockSend.mock.calls[0]![0].text).toContain("69.99");
    expect(mockSend.mock.calls[0]![0].text).toContain("v7.2");
    expect(mockSend.mock.calls[0]![0].text).toContain(model.identity!.revisionId);
    expect(mockSend.mock.calls[0]![0].text).not.toContain("Builder");
  });

  it("skips when score_notifications flag is disabled in DB", async () => {
    mockDbGetFeatureFlag.mockResolvedValue({ key: "score_notifications", enabled: false });
    const { notifyObservedScoreChange } = await import("./score-bump");
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const { scoringObservation, compareScoringObservations } = await import("@/lib/history/scoring-observations");
    const { model } = await scoringConsistencyFixture({ boundary: true });
    const current = scoringObservation(model)!;
    const previous = { ...current, composite: { exact: 46, display: 46 } };

    const result = await notifyObservedScoreChange("alice", compareScoringObservations(previous, current));

    expect(result).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when the user has no email or opted out", async () => {
    mockDbGetUserEmail.mockResolvedValue({ email: "dev@example.com", emailNotifications: false });
    const { notifyObservedScoreChange } = await import("./score-bump");
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const { scoringObservation, compareScoringObservations } = await import("@/lib/history/scoring-observations");
    const { model } = await scoringConsistencyFixture({ boundary: true });
    const current = scoringObservation(model)!;
    const previous = { ...current, composite: { exact: 46, display: 46 } };

    const result = await notifyObservedScoreChange("alice", compareScoringObservations(previous, current));

    expect(result).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("respects the dedup marker", async () => {
    mockCacheGet.mockResolvedValue(true);
    const { notifyObservedScoreChange } = await import("./score-bump");
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const { scoringObservation, compareScoringObservations } = await import("@/lib/history/scoring-observations");
    const { model } = await scoringConsistencyFixture({ boundary: true });
    const current = scoringObservation(model)!;
    const previous = { ...current, composite: { exact: 46, display: 46 } };

    const result = await notifyObservedScoreChange("alice", compareScoringObservations(previous, current));

    expect(result).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not throw and returns false when send fails", async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "Rate limited" } });
    const { notifyObservedScoreChange } = await import("./score-bump");
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const { scoringObservation, compareScoringObservations } = await import("@/lib/history/scoring-observations");
    const { model } = await scoringConsistencyFixture({ boundary: true });
    const current = scoringObservation(model)!;
    const previous = { ...current, composite: { exact: 46, display: 46 } };

    const result = await notifyObservedScoreChange("alice", compareScoringObservations(previous, current));

    expect(result).toBe(false);
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("skips a non-comparable comparison", async () => {
    const { notifyObservedScoreChange } = await import("./score-bump");
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const { scoringObservation, compareScoringObservations } = await import("@/lib/history/scoring-observations");
    const { model } = await scoringConsistencyFixture({ boundary: true });
    const current = scoringObservation(model)!;

    const result = await notifyObservedScoreChange("alice", compareScoringObservations(current, { ...current, policyVersion: "v7" }));

    expect(result).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
