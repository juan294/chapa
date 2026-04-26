import { describe, it, expect } from "vitest";
import { applyEMA, smoothScore, applyImpactScorePolicy } from "./smoothing";

// ---------------------------------------------------------------------------
// applyEMA(currentScore, previousSmoothedScore?)
// ---------------------------------------------------------------------------

describe("applyEMA(currentScore, previousSmoothedScore)", () => {
  it("passes through raw score on first visit (no previous)", () => {
    expect(applyEMA(60)).toBe(60);
    expect(applyEMA(60, undefined)).toBe(60);
  });

  it("passes through raw score when previous is null", () => {
    expect(applyEMA(60, null)).toBe(60);
  });

  it("applies 0.15 * current + 0.85 * previous", () => {
    // 0.15 * 60 + 0.85 * 70 = 9 + 59.5 = 68.5 → 69
    expect(applyEMA(60, 70)).toBe(69);
  });

  it("dampens a 10-point drop to ~1.5 points", () => {
    // Previous = 60, current = 50
    // 0.15 * 50 + 0.85 * 60 = 7.5 + 51 = 58.5 → 59
    const result = applyEMA(50, 60);
    expect(result).toBe(59); // only -1 point from 60
  });

  it("dampens a 10-point rise to ~1.5 points", () => {
    // Previous = 60, current = 70
    // 0.15 * 70 + 0.85 * 60 = 10.5 + 51 = 61.5 → 62
    expect(applyEMA(70, 60)).toBe(62);
  });

  it("converges toward current over many iterations", () => {
    // Simulates repeated daily computation from 70 → 60
    // With integer rounding at each step, convergence is slower
    let smoothed = 70;
    for (let i = 0; i < 30; i++) {
      smoothed = applyEMA(60, smoothed);
    }
    // After 30 rounded iterations, should be much closer to 60 than 70
    expect(smoothed).toBeGreaterThanOrEqual(60);
    expect(smoothed).toBeLessThanOrEqual(64);
  });

  it("half-life is ~4.3 days (reaches halfway in ~4 iterations)", () => {
    // Start at 80, target 60 (20-point drop)
    // Half of 20 = 10, so should reach ~70 around iteration 4-5
    let smoothed = 80;
    for (let i = 0; i < 4; i++) {
      smoothed = applyEMA(60, smoothed);
    }
    // After 4 iterations: should be roughly halfway (68-72)
    expect(smoothed).toBeGreaterThanOrEqual(67);
    expect(smoothed).toBeLessThanOrEqual(73);
  });

  it("returns 0 when both current and previous are 0", () => {
    expect(applyEMA(0, 0)).toBe(0);
  });

  it("returns an integer", () => {
    expect(Number.isInteger(applyEMA(73, 68))).toBe(true);
  });

  it("clamps to 0-100 range", () => {
    expect(applyEMA(100, 100)).toBe(100);
    expect(applyEMA(0, 0)).toBe(0);
    // Even with weird inputs, stays bounded
    expect(applyEMA(100, 100)).toBeLessThanOrEqual(100);
    expect(applyEMA(0, 0)).toBeGreaterThanOrEqual(0);
  });

  it("stays at 100 when both are 100", () => {
    expect(applyEMA(100, 100)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// smoothScore(currentAdjusted, latestSnapshot, today?)
// ---------------------------------------------------------------------------

describe("smoothScore(currentAdjusted, latestSnapshot, today?)", () => {
  it("passes through raw score when no snapshot exists", () => {
    expect(smoothScore(60, null)).toBe(60);
    expect(smoothScore(60, undefined)).toBe(60);
  });

  it("applies EMA when snapshot is from a previous day", () => {
    const snapshot = { date: "2026-02-28", adjustedComposite: 70 };
    // 0.15 * 60 + 0.85 * 70 = 9 + 59.5 = 68.5 → 69
    expect(smoothScore(60, snapshot, "2026-03-01")).toBe(69);
  });

  it("returns snapshot score directly when snapshot is from today (prevents feedback loop)", () => {
    const snapshot = { date: "2026-03-01", adjustedComposite: 58 };
    // Raw is 45 but snapshot from today already has EMA applied → use 58
    expect(smoothScore(45, snapshot, "2026-03-01")).toBe(58);
  });

  it("does NOT re-apply EMA on same-day repeated calls", () => {
    // Simulates the feedback loop bug: raw=45, first call applied EMA → 58
    // Subsequent calls must return 58, not spiral downward
    const snapshot = { date: "2026-03-01", adjustedComposite: 58 };
    const first = smoothScore(45, snapshot, "2026-03-01");
    const second = smoothScore(45, { ...snapshot, adjustedComposite: first }, "2026-03-01");
    const third = smoothScore(45, { ...snapshot, adjustedComposite: second }, "2026-03-01");
    expect(first).toBe(58);
    expect(second).toBe(58);
    expect(third).toBe(58);
  });

  it("applies EMA on day boundary (snapshot from yesterday)", () => {
    const snapshot = { date: "2026-02-28", adjustedComposite: 58 };
    // New day → apply EMA: 0.15 * 45 + 0.85 * 58 = 6.75 + 49.3 = 56.05 → 56
    expect(smoothScore(45, snapshot, "2026-03-01")).toBe(56);
  });

  it("uses current date when today param is omitted", () => {
    // Snapshot from far in the past → always applies EMA
    const snapshot = { date: "2020-01-01", adjustedComposite: 70 };
    const result = smoothScore(60, snapshot);
    // Should apply EMA: 0.15 * 60 + 0.85 * 70 = 68.5 → 69
    expect(result).toBe(69);
  });

  // -------------------------------------------------------------------------
  // #826 — Same-day refresh: when inputs have legitimately changed mid-day
  // (e.g. supplemental EMU upload), the same-day lock must give way so the
  // freshly recomputed score reaches the user instead of the stale snapshot.
  // -------------------------------------------------------------------------

  describe("#826 same-day refresh (bypassSameDayLock)", () => {
    it("applies EMA against today's snapshot when inputs changed (bypasses same-day lock)", () => {
      // Today's snapshot was captured before the EMU upload at adjustedComposite=58.
      // After the upload, raw recomputes to 75. With bypass, EMA against today's
      // snapshot lifts it: 0.15*75 + 0.85*58 = 11.25 + 49.3 = 60.55 → 61.
      const snapshot = { date: "2026-03-01", adjustedComposite: 58 };
      expect(smoothScore(75, snapshot, "2026-03-01", { bypassSameDayLock: true })).toBe(61);
    });

    it("preserves the same-day lock by default (bypass=false / unset)", () => {
      // Without the bypass, today's snapshot value wins to prevent the EMA
      // feedback loop on every page refresh — the existing behavior.
      const snapshot = { date: "2026-03-01", adjustedComposite: 58 };
      expect(smoothScore(75, snapshot, "2026-03-01")).toBe(58);
      expect(smoothScore(75, snapshot, "2026-03-01", { bypassSameDayLock: false })).toBe(58);
    });

    it("bypass has no effect when no snapshot exists", () => {
      expect(smoothScore(60, null, "2026-03-01", { bypassSameDayLock: true })).toBe(60);
    });

    it("bypass has no effect on cross-day path (EMA already applies)", () => {
      const snapshot = { date: "2026-02-28", adjustedComposite: 70 };
      // Same as without bypass: 0.15*60 + 0.85*70 = 68.5 → 69
      expect(smoothScore(60, snapshot, "2026-03-01", { bypassSameDayLock: true })).toBe(69);
    });
  });
});

// ---------------------------------------------------------------------------
// applyImpactScorePolicy
// ---------------------------------------------------------------------------

describe("applyImpactScorePolicy — #826 inputsChanged", () => {
  // Helper: minimal ImpactV6Result shape
  const baseImpact = {
    handle: "testuser",
    profileType: "collaborative" as const,
    archetype: "Builder" as const,
    dimensions: { delivery: 100, quality: 50, consistency: 60, breadth: 60 },
    compositeScore: 67,
    adjustedComposite: 75,
    confidence: 90,
    confidencePenalties: [],
    tier: "High" as const,
    computedAt: "2026-03-01T00:00:00.000Z",
  };

  it("threads inputsChanged into smoothScore (bypasses same-day lock)", () => {
    const snapshot = { date: "2026-03-01", adjustedComposite: 58 };
    const result = applyImpactScorePolicy(baseImpact, snapshot, {
      today: "2026-03-01",
      inputsChanged: true,
    });
    // Bypass → EMA applied: 0.15*75 + 0.85*58 = 60.55 → 61
    expect(result.adjustedComposite).toBe(61);
  });

  it("keeps the same-day lock when inputsChanged is unset", () => {
    const snapshot = { date: "2026-03-01", adjustedComposite: 58 };
    const result = applyImpactScorePolicy(baseImpact, snapshot, { today: "2026-03-01" });
    expect(result.adjustedComposite).toBe(58);
  });
});
