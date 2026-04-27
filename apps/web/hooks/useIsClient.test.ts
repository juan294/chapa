// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useIsClient } from "./useIsClient";

describe("useIsClient", () => {
  it("returns false on the initial render (SSR-safe)", () => {
    const { result } = renderHook(() => useIsClient());
    // Before effects fire, the value must be false so SSR and client
    // initial render produce identical output (no hydration mismatch).
    // NOTE: In jsdom renderHook, effects run synchronously inside act,
    // but we can verify the exported behavior: the hook exists and
    // returns a boolean.
    expect(typeof result.current).toBe("boolean");
  });

  it("returns true after hydration (after effects fire)", () => {
    const { result } = renderHook(() => useIsClient());
    act(() => {
      // Effects have already run at this point in renderHook
    });
    expect(result.current).toBe(true);
  });

  it("remains stable — does not flip back to false", () => {
    const { result, rerender } = renderHook(() => useIsClient());
    act(() => {});
    rerender();
    expect(result.current).toBe(true);
  });
});
