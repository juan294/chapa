// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInView } from "./use-in-view";

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
let lastCallback: IntersectionObserverCallback | null = null;
let lastOptions: IntersectionObserverInit | undefined;

class MockIntersectionObserver {
  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    lastCallback = callback;
    lastOptions = options;
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
  root = null;
  rootMargin = "";
  thresholds = [] as number[];
  takeRecords = vi.fn().mockReturnValue([]);
}

beforeEach(() => {
  mockObserve.mockClear();
  mockDisconnect.mockClear();
  lastCallback = null;
  lastOptions = undefined;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

describe("useInView", () => {
  it("returns false initially", () => {
    const ref = { current: null };
    const { result } = renderHook(() => useInView(ref));
    expect(result.current).toBe(false);
  });

  it("returns a boolean value", () => {
    const ref = { current: null };
    const { result } = renderHook(() => useInView(ref));
    expect(typeof result.current).toBe("boolean");
  });

  it("observes the element when ref has a current value", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    renderHook(() => useInView(ref));
    expect(mockObserve).toHaveBeenCalledWith(element);
  });

  it("does not observe when ref.current is null", () => {
    const ref = { current: null };
    renderHook(() => useInView(ref));
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it("disconnects observer on unmount", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    const { unmount } = renderHook(() => useInView(ref));
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("passes threshold to IntersectionObserver", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    renderHook(() => useInView(ref, 0.8));
    expect(lastOptions?.threshold).toBe(0.8);
  });

  it("uses default threshold of 0.5", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    renderHook(() => useInView(ref));
    expect(lastOptions?.threshold).toBe(0.5);
  });

  it("returns true when element becomes visible", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    const { result } = renderHook(() => useInView(ref));

    // Simulate the IntersectionObserver callback firing with isIntersecting=true
    act(() => {
      lastCallback!(
        [
          {
            isIntersecting: true,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: 0.6,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            target: element,
            time: 0,
          },
        ],
        {} as IntersectionObserver,
      );
    });

    expect(result.current).toBe(true);
  });

  it("disconnects observer after element becomes visible (one-shot)", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    renderHook(() => useInView(ref));

    // Simulate intersection
    act(() => {
      lastCallback!(
        [
          {
            isIntersecting: true,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: 0.6,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            target: element,
            time: 0,
          },
        ],
        {} as IntersectionObserver,
      );
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("stays false when element is not intersecting", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    const { result } = renderHook(() => useInView(ref));

    act(() => {
      lastCallback!(
        [
          {
            isIntersecting: false,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: 0,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            target: element,
            time: 0,
          },
        ],
        {} as IntersectionObserver,
      );
    });

    expect(result.current).toBe(false);
  });

  it("does not disconnect when element is not intersecting", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    renderHook(() => useInView(ref));

    // Clear disconnect calls from setup
    mockDisconnect.mockClear();

    act(() => {
      lastCallback!(
        [
          {
            isIntersecting: false,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: 0,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            target: element,
            time: 0,
          },
        ],
        {} as IntersectionObserver,
      );
    });

    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it("handles empty entries array gracefully", () => {
    const element = document.createElement("div");
    const ref = { current: element };
    const { result } = renderHook(() => useInView(ref));

    act(() => {
      lastCallback!([], {} as IntersectionObserver);
    });

    // Should stay false — no entry to check
    expect(result.current).toBe(false);
  });
});
