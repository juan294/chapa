// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";
import { useAnimatedUnmount } from "./useAnimatedUnmount";

describe("useAnimatedUnmount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shouldRender is true when isOpen is true", () => {
    const { result } = renderHook(() => useAnimatedUnmount(true));
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isAnimatingOut).toBe(false);
  });

  it("shouldRender stays true during exit animation", () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useAnimatedUnmount(isOpen, 200),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: false });
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isAnimatingOut).toBe(true);
  });

  it("shouldRender becomes false after duration elapses", () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useAnimatedUnmount(isOpen, 200),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: false });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.shouldRender).toBe(false);
    expect(result.current.isAnimatingOut).toBe(false);
  });

  it("re-opening during exit cancels the unmount", () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useAnimatedUnmount(isOpen, 200),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: false }); // start closing
    act(() => {
      vi.advanceTimersByTime(100);
    }); // halfway through
    rerender({ isOpen: true }); // re-open before exit completes
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isAnimatingOut).toBe(false);
    act(() => {
      vi.advanceTimersByTime(200);
    }); // timer would have fired
    expect(result.current.shouldRender).toBe(true); // still open
  });
});
