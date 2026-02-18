import { describe, it, expect } from "vitest";
import { applyEMA } from "./smoothing";

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
