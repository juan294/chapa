// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInView } from "./use-in-view";

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
let lastOptions: IntersectionObserverInit | undefined;

class MockIntersectionObserver {
  constructor(
    _callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
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
});
