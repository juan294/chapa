// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimatedCounter, easings } from "./use-animated-counter";

// jsdom doesn't provide matchMedia — stub it globally for all tests
function stubMatchMedia(prefersReducedMotion = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: prefersReducedMotion,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }),
  );
}

describe("useAnimatedCounter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubMatchMedia(false);
  });

  it("returns the target value immediately when startOnMount is false", () => {
    const { result } = renderHook(() => useAnimatedCounter(42));
    expect(result.current.value).toBe(42);
  });

  it("returns 0 initially when startOnMount is true", () => {
    const { result } = renderHook(() =>
      useAnimatedCounter(100, 2000, "easeOut", true),
    );
    // Before animation frames run, value starts at 0
    expect(result.current.value).toBe(0);
  });

  it("returns an animate function", () => {
    const { result } = renderHook(() => useAnimatedCounter(50));
    expect(typeof result.current.animate).toBe("function");
  });

  it("returns isAnimating boolean", () => {
    const { result } = renderHook(() => useAnimatedCounter(50));
    expect(typeof result.current.isAnimating).toBe("boolean");
  });

  it("isAnimating is false when not animating", () => {
    const { result } = renderHook(() => useAnimatedCounter(50));
    expect(result.current.isAnimating).toBe(false);
  });

  it("sets value to target immediately when prefers-reduced-motion is enabled", () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => useAnimatedCounter(75));

    // Trigger animate — should jump directly to target
    act(() => {
      result.current.animate();
    });

    expect(result.current.value).toBe(75);
  });
});

describe("easings", () => {
  it("exports easing functions", () => {
    expect(typeof easings.linear).toBe("function");
    expect(typeof easings.easeOut).toBe("function");
    expect(typeof easings.easeInOut).toBe("function");
    expect(typeof easings.spring).toBe("function");
  });

  it("linear returns input unchanged", () => {
    expect(easings.linear(0)).toBe(0);
    expect(easings.linear(0.5)).toBe(0.5);
    expect(easings.linear(1)).toBe(1);
  });

  it("easeOut starts at 0 and ends at 1", () => {
    expect(easings.easeOut(0)).toBe(0);
    expect(easings.easeOut(1)).toBe(1);
  });

  it("easeInOut starts at 0 and ends at 1", () => {
    expect(easings.easeInOut(0)).toBe(0);
    expect(easings.easeInOut(1)).toBe(1);
  });

  it("spring starts at 0 and ends at 1", () => {
    expect(easings.spring(0)).toBe(0);
    expect(easings.spring(1)).toBe(1);
  });

  it("all easings return values between 0 and ~1 for midpoint", () => {
    for (const [, fn] of Object.entries(easings)) {
      const mid = fn(0.5);
      // Spring can overshoot slightly, so allow range
      expect(mid).toBeGreaterThanOrEqual(-0.1);
      expect(mid).toBeLessThanOrEqual(1.5);
    }
  });
});
