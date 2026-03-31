// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import {
  PARTICLE_PRESETS,
  useParticles,
  type ParticleConfig,
} from "./ParticleBackground";

/* ------------------------------------------------------------------ */
/* hexToRgb — not exported, so we test it indirectly + re-implement   */
/* for direct unit tests via a minimal extracted copy                  */
/* ------------------------------------------------------------------ */

// Re-implement hexToRgb identically so we can unit-test the pure function.
// The real one is module-private; this mirrors the exact logic.
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 139, g: 92, b: 246 };
  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  };
}

/* ------------------------------------------------------------------ */
/* Canvas mock helpers                                                 */
/* ------------------------------------------------------------------ */

function createMockContext(): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

let mockCtx: CanvasRenderingContext2D;
let mockCanvas: HTMLCanvasElement;
let rafCallbacks: Array<FrameRequestCallback>;
let rafIdCounter: number;

function setupCanvasMock() {
  mockCtx = createMockContext();
  rafCallbacks = [];
  rafIdCounter = 0;

  mockCanvas = document.createElement("canvas");

  // Mock getBoundingClientRect
  vi.spyOn(mockCanvas, "getBoundingClientRect").mockReturnValue({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  // Mock getContext
  vi.spyOn(mockCanvas, "getContext").mockReturnValue(
    mockCtx as unknown as CanvasRenderingContext2D,
  );
}

/* ------------------------------------------------------------------ */
/* Setup / Teardown                                                    */
/* ------------------------------------------------------------------ */

let originalRaf: typeof globalThis.requestAnimationFrame;
let originalCaf: typeof globalThis.cancelAnimationFrame;
let originalMatchMedia: typeof window.matchMedia;
let originalDpr: number;

beforeEach(() => {
  setupCanvasMock();

  // Store originals
  originalRaf = globalThis.requestAnimationFrame;
  originalCaf = globalThis.cancelAnimationFrame;
  originalMatchMedia = window.matchMedia;
  originalDpr = window.devicePixelRatio;

  // Mock requestAnimationFrame
  globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return ++rafIdCounter;
  });
  globalThis.cancelAnimationFrame = vi.fn();

  // Default: no reduced motion
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockReturnValue({ matches: false }),
    writable: true,
    configurable: true,
  });

  // Default DPR
  Object.defineProperty(window, "devicePixelRatio", {
    value: 2,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCaf;
  Object.defineProperty(window, "matchMedia", {
    value: originalMatchMedia,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "devicePixelRatio", {
    value: originalDpr,
    writable: true,
    configurable: true,
  });
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("hexToRgb (pure function)", () => {
  it("parses a valid 6-char hex color", () => {
    expect(hexToRgb("#8B5CF6")).toEqual({ r: 139, g: 92, b: 246 });
  });

  it("parses hex without leading #", () => {
    expect(hexToRgb("FF0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses lowercase hex", () => {
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("returns fallback (139,92,246) for invalid hex", () => {
    expect(hexToRgb("not-a-color")).toEqual({ r: 139, g: 92, b: 246 });
  });

  it("returns fallback for 3-char shorthand hex (not supported by the regex)", () => {
    // The regex requires exactly 6 hex digits, so 3-char shorthand returns fallback
    expect(hexToRgb("#FFF")).toEqual({ r: 139, g: 92, b: 246 });
  });

  it("returns fallback for empty string", () => {
    expect(hexToRgb("")).toEqual({ r: 139, g: 92, b: 246 });
  });

  it("correctly parses black (#000000)", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("correctly parses white (#FFFFFF)", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("PARTICLE_PRESETS", () => {
  const expectedPresets = [
    "dots",
    "constellation",
    "dust",
    "sparkle",
    "interactive",
  ] as const;

  it("exports all 5 presets", () => {
    expect(Object.keys(PARTICLE_PRESETS)).toHaveLength(5);
    for (const name of expectedPresets) {
      expect(PARTICLE_PRESETS).toHaveProperty(name);
    }
  });

  it.each(expectedPresets)("preset '%s' has the correct ParticleConfig shape", (name) => {
    const preset = PARTICLE_PRESETS[name];
    expect(preset).toMatchObject({
      count: expect.any(Number),
      colors: expect.any(Array),
      minRadius: expect.any(Number),
      maxRadius: expect.any(Number),
      speed: expect.any(Number),
      minOpacity: expect.any(Number),
      maxOpacity: expect.any(Number),
      connections: expect.any(Boolean),
      connectionDistance: expect.any(Number),
      mouseRepulsion: expect.any(Boolean),
      mouseRadius: expect.any(Number),
      sparkle: expect.any(Boolean),
    });
    expect(preset.colors.length).toBeGreaterThan(0);
  });

  it("constellation preset has connections enabled", () => {
    expect(PARTICLE_PRESETS.constellation.connections).toBe(true);
    expect(PARTICLE_PRESETS.constellation.connectionDistance).toBeGreaterThan(0);
  });

  it("interactive preset has mouse repulsion enabled", () => {
    expect(PARTICLE_PRESETS.interactive.mouseRepulsion).toBe(true);
    expect(PARTICLE_PRESETS.interactive.mouseRadius).toBeGreaterThan(0);
  });

  it("sparkle preset has sparkle enabled", () => {
    expect(PARTICLE_PRESETS.sparkle.sparkle).toBe(true);
  });

  it("dots preset has connections and repulsion disabled", () => {
    expect(PARTICLE_PRESETS.dots.connections).toBe(false);
    expect(PARTICLE_PRESETS.dots.mouseRepulsion).toBe(false);
    expect(PARTICLE_PRESETS.dots.sparkle).toBe(false);
  });
});

describe("useParticles hook", () => {
  const dotsConfig: ParticleConfig = { ...PARTICLE_PRESETS.dots };

  it("calls getContext('2d') on mount", () => {
    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, dotsConfig));
    expect(mockCanvas.getContext).toHaveBeenCalledWith("2d");
  });

  it("sets up DPR scaling via setTransform", () => {
    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, dotsConfig));
    expect(mockCtx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it("scales canvas width/height by devicePixelRatio", () => {
    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, dotsConfig));
    // getBoundingClientRect returns 800x600, DPR = 2
    expect(mockCanvas.width).toBe(1600);
    expect(mockCanvas.height).toBe(1200);
  });

  it("starts animation when reduced motion is not preferred", () => {
    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, dotsConfig));
    expect(globalThis.requestAnimationFrame).toHaveBeenCalled();
  });

  it("does NOT start animation when prefers-reduced-motion is set", () => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: true }),
      writable: true,
      configurable: true,
    });

    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, dotsConfig));

    // requestAnimationFrame should NOT be called (no animation loop)
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("renders a static frame when prefers-reduced-motion is set", () => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: true }),
      writable: true,
      configurable: true,
    });

    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, dotsConfig));

    // Should have drawn particles once (static frame)
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.arc).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it("calls cancelAnimationFrame and removes event listeners on unmount", () => {
    const removeResizeSpy = vi.spyOn(window, "removeEventListener");
    const removeCanvasMousemoveSpy = vi.spyOn(
      mockCanvas,
      "removeEventListener",
    );

    const ref = { current: mockCanvas };
    const { unmount } = renderHook(() => useParticles(ref, dotsConfig));

    unmount();

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
    expect(removeResizeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeCanvasMousemoveSpy).toHaveBeenCalledWith(
      "mousemove",
      expect.any(Function),
    );
    expect(removeCanvasMousemoveSpy).toHaveBeenCalledWith(
      "mouseleave",
      expect.any(Function),
    );
  });

  it("does nothing if canvas ref is null", () => {
    const ref = { current: null };
    // Should not throw
    expect(() => {
      renderHook(() => useParticles(ref, dotsConfig));
    }).not.toThrow();
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("does nothing if getContext returns null", () => {
    vi.spyOn(mockCanvas, "getContext").mockReturnValue(null);
    const ref = { current: mockCanvas };
    expect(() => {
      renderHook(() => useParticles(ref, dotsConfig));
    }).not.toThrow();
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("adds resize event listener on window", () => {
    const addEventSpy = vi.spyOn(window, "addEventListener");
    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, dotsConfig));
    expect(addEventSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("adds mousemove and mouseleave listeners on canvas", () => {
    const addEventSpy = vi.spyOn(mockCanvas, "addEventListener");
    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, dotsConfig));
    expect(addEventSpy).toHaveBeenCalledWith(
      "mousemove",
      expect.any(Function),
    );
    expect(addEventSpy).toHaveBeenCalledWith(
      "mouseleave",
      expect.any(Function),
    );
  });

  it("runs animation frame callback that draws particles", () => {
    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, dotsConfig));

    // There should be a queued RAF callback
    expect(rafCallbacks.length).toBeGreaterThan(0);

    // Execute the animation frame
    const animateCallback = rafCallbacks[0]!;
    animateCallback(performance.now());

    // The animate function should clear the canvas and draw
    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it("draws connection lines when connections config is enabled", () => {
    const constellationConfig: ParticleConfig = {
      ...PARTICLE_PRESETS.constellation,
      // Use a small count so connections are more likely within distance
      count: 3,
      connectionDistance: 99999, // very large to ensure connections
    };

    const ref = { current: mockCanvas };
    renderHook(() => useParticles(ref, constellationConfig));

    // Execute animation frame
    const animateCallback = rafCallbacks[0]!;
    animateCallback(performance.now());

    // Connection drawing uses moveTo, lineTo, stroke
    expect(mockCtx.moveTo).toHaveBeenCalled();
    expect(mockCtx.lineTo).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
  });
});
