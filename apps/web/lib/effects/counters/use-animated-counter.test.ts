// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
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

  afterEach(() => {
    cleanup();
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
    expect(easings.linear!(0)).toBe(0);
    expect(easings.linear!(0.5)).toBe(0.5);
    expect(easings.linear!(1)).toBe(1);
  });

  it("easeOut starts at 0 and ends at 1", () => {
    expect(easings.easeOut!(0)).toBe(0);
    expect(easings.easeOut!(1)).toBe(1);
  });

  it("easeInOut starts at 0 and ends at 1", () => {
    expect(easings.easeInOut!(0)).toBe(0);
    expect(easings.easeInOut!(1)).toBe(1);
  });

  it("spring starts at 0 and ends at 1", () => {
    expect(easings.spring!(0)).toBe(0);
    expect(easings.spring!(1)).toBe(1);
  });

  it("all easings return values between 0 and ~1 for midpoint", () => {
    for (const [, fn] of Object.entries(easings)) {
      const mid = fn(0.5);
      // Spring can overshoot slightly, so allow range
      expect(mid).toBeGreaterThanOrEqual(-0.1);
      expect(mid).toBeLessThanOrEqual(1.5);
    }
  });

  it("easeOut is faster than linear at midpoint", () => {
    // Cubic ease-out should be ahead of linear at t=0.5
    expect(easings.easeOut!(0.5)).toBeGreaterThan(0.5);
  });

  it("easeInOut is at ~0.5 at midpoint", () => {
    const mid = easings.easeInOut!(0.5);
    expect(mid).toBeCloseTo(0.5, 1);
  });

  it("easeInOut first half is below 0.5", () => {
    expect(easings.easeInOut!(0.25)).toBeLessThan(0.5);
  });

  it("easeInOut second half is above 0.5", () => {
    expect(easings.easeInOut!(0.75)).toBeGreaterThan(0.5);
  });

  it("spring overshoots slightly near t=0.4", () => {
    const val = easings.spring!(0.4);
    // Spring should be close to 1 but may overshoot
    expect(val).toBeGreaterThan(0.5);
  });
});

describe("useAnimatedCounter advanced", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
  });

  it("animate triggers animation state", () => {
    const { result } = renderHook(() => useAnimatedCounter(100));
    act(() => {
      result.current.animate();
    });
    // After calling animate, isAnimating should be true (before any frames run)
    expect(result.current.isAnimating).toBe(true);
  });

  it("starts animation on mount when startOnMount is true", () => {
    const rafCalls: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(global, "requestAnimationFrame").mockImplementation((cb) => {
      rafCalls.push(cb);
      return rafCalls.length;
    });
    renderHook(() =>
      useAnimatedCounter(50, 2000, "easeOut", true),
    );
    // requestAnimationFrame should have been called for the initial animation
    expect(rafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it("animation completes and sets final value when progress reaches 1", () => {
    let frameCallback: FrameRequestCallback | null = null;
    const rafSpy = vi.spyOn(global, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallback = cb;
      return 1;
    });
    const cancelSpy = vi.spyOn(global, "cancelAnimationFrame").mockImplementation(() => {});
    const perfSpy = vi.spyOn(performance, "now");

    const { result } = renderHook(() => useAnimatedCounter(100, 1000, "linear"));

    // Start animation
    const startTime = 1000;
    perfSpy.mockReturnValue(startTime);
    act(() => {
      result.current.animate();
    });
    expect(result.current.isAnimating).toBe(true);

    // Simulate intermediate frame (50% progress)
    perfSpy.mockReturnValue(startTime + 500);
    expect(frameCallback).not.toBeNull();
    act(() => {
      frameCallback!(startTime + 500);
    });
    expect(result.current.value).toBe(50); // linear easing at 50%
    expect(result.current.isAnimating).toBe(true);

    // Simulate final frame (100% progress)
    perfSpy.mockReturnValue(startTime + 1000);
    act(() => {
      frameCallback!(startTime + 1000);
    });
    expect(result.current.value).toBe(100);
    expect(result.current.isAnimating).toBe(false);

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    perfSpy.mockRestore();
  });

  it("animation beyond duration clamps progress to 1", () => {
    let frameCallback: FrameRequestCallback | null = null;
    const rafSpy = vi.spyOn(global, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallback = cb;
      return 1;
    });
    const cancelSpy = vi.spyOn(global, "cancelAnimationFrame").mockImplementation(() => {});
    const perfSpy = vi.spyOn(performance, "now");

    const { result } = renderHook(() => useAnimatedCounter(80, 500, "linear"));

    const startTime = 2000;
    perfSpy.mockReturnValue(startTime);
    act(() => {
      result.current.animate();
    });

    // Simulate frame well past the duration
    perfSpy.mockReturnValue(startTime + 2000);
    act(() => {
      frameCallback!(startTime + 2000);
    });
    expect(result.current.value).toBe(80);
    expect(result.current.isAnimating).toBe(false);

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    perfSpy.mockRestore();
  });

  it("cleans up animation frame on unmount during animation", () => {
    let frameCallback: FrameRequestCallback | null = null;
    const rafSpy = vi.spyOn(global, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallback = cb;
      return 42;
    });
    const cancelSpy = vi.spyOn(global, "cancelAnimationFrame").mockImplementation(() => {});
    const perfSpy = vi.spyOn(performance, "now").mockReturnValue(1000);

    const { result, unmount } = renderHook(() => useAnimatedCounter(100, 1000, "linear"));

    // Start animation
    act(() => {
      result.current.animate();
    });
    expect(result.current.isAnimating).toBe(true);

    // Unmount while animation is in progress — should call cancelAnimationFrame
    unmount();
    expect(cancelSpy).toHaveBeenCalled();

    // Suppress lint: frameCallback exists but unused after unmount
    void frameCallback;

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    perfSpy.mockRestore();
  });

  it("startOnMount cleanup cancels animation frame on unmount", () => {
    const cancelSpy = vi.spyOn(global, "cancelAnimationFrame").mockImplementation(() => {});
    const rafSpy = vi.spyOn(global, "requestAnimationFrame").mockImplementation(() => {
      return 99;
    });

    const { unmount } = renderHook(() =>
      useAnimatedCounter(50, 1000, "easeOut", true),
    );

    // Unmount — should trigger cleanup of the startOnMount requestAnimationFrame
    unmount();
    expect(cancelSpy).toHaveBeenCalled();

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });

  it("falls back to easeOut for unknown easing name", () => {
    let frameCallback: FrameRequestCallback | null = null;
    const rafSpy = vi.spyOn(global, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallback = cb;
      return 1;
    });
    const cancelSpy = vi.spyOn(global, "cancelAnimationFrame").mockImplementation(() => {});
    const perfSpy = vi.spyOn(performance, "now");

    // Use a non-existent easing name
    const { result } = renderHook(() => useAnimatedCounter(100, 1000, "nonExistentEasing"));

    const startTime = 5000;
    perfSpy.mockReturnValue(startTime);
    act(() => {
      result.current.animate();
    });

    // At t=0.5 with easeOut: 1 - (1 - 0.5)^3 = 1 - 0.125 = 0.875 => Math.round(0.875 * 100) = 88
    perfSpy.mockReturnValue(startTime + 500);
    act(() => {
      frameCallback!(startTime + 500);
    });

    // easeOut at 50% gives 0.875 => 88 (same as if we explicitly used easeOut)
    expect(result.current.value).toBe(88);

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    perfSpy.mockRestore();
  });

  it("non-startOnMount cleanup returns cancelAnimationFrame for rafRef", () => {
    const cancelSpy = vi.spyOn(global, "cancelAnimationFrame").mockImplementation(() => {});
    const rafSpy = vi.spyOn(global, "requestAnimationFrame").mockImplementation(() => 1);

    const { unmount } = renderHook(() =>
      useAnimatedCounter(50, 1000, "easeOut", false),
    );

    // Unmount — the else branch in the useEffect cleanup should call cancelAnimationFrame(rafRef.current)
    unmount();
    expect(cancelSpy).toHaveBeenCalled();

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });
});
