// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCopyToClipboard } from "./useCopyToClipboard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockClipboardWrite(impl: () => Promise<void>) {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn(impl) },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.status).toBe("idle");
  });

  it("writes the given text to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hello world");
    });

    expect(writeText).toHaveBeenCalledWith("hello world");
  });

  it("transitions to 'copied' on a successful write and resolves true", async () => {
    mockClipboardWrite(() => Promise.resolve());
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("text");
    });

    expect(ok).toBe(true);
    expect(result.current.status).toBe("copied");
  });

  it("reverts to 'idle' after the reset delay following a successful copy", async () => {
    mockClipboardWrite(() => Promise.resolve());
    const { result } = renderHook(() => useCopyToClipboard(2000));

    await act(async () => {
      await result.current.copy("text");
    });
    expect(result.current.status).toBe("copied");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.status).toBe("idle");
  });

  // #1165 (UX-M4) — a rejected clipboard write must surface a visible
  // failure state instead of silently doing nothing (CopyButton had no
  // catch at all; SharePageShortcuts swallowed the rejection with no
  // feedback either way). This is the state machine every copy affordance
  // on the share page shares.
  it("transitions to 'failed' when the clipboard write rejects, and resolves false", async () => {
    mockClipboardWrite(() => Promise.reject(new Error("Clipboard blocked")));
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("text");
    });

    expect(ok).toBe(false);
    expect(result.current.status).toBe("failed");
  });

  it("never throws out of copy() even when the clipboard write rejects", async () => {
    mockClipboardWrite(() => Promise.reject(new Error("Clipboard blocked")));
    const { result } = renderHook(() => useCopyToClipboard());

    await expect(
      act(async () => {
        await result.current.copy("text");
      }),
    ).resolves.not.toThrow();
  });

  it("reverts to 'idle' after the reset delay following a failed copy", async () => {
    mockClipboardWrite(() => Promise.reject(new Error("nope")));
    const { result } = renderHook(() => useCopyToClipboard(2000));

    await act(async () => {
      await result.current.copy("text");
    });
    expect(result.current.status).toBe("failed");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.status).toBe("idle");
  });

  it("cancels a pending reset when a new copy starts before it fires", async () => {
    mockClipboardWrite(() => Promise.resolve());
    const { result } = renderHook(() => useCopyToClipboard(2000));

    await act(async () => {
      await result.current.copy("first");
    });

    // Advance partway through the first reset window, then start a second
    // copy — the first timer must not fire and stomp the second copy's status.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await act(async () => {
      await result.current.copy("second");
    });
    expect(result.current.status).toBe("copied");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Only 1000ms have elapsed since the SECOND copy — if the stale timer
    // from the first copy had fired, this would already be "idle".
    expect(result.current.status).toBe("copied");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.status).toBe("idle");
  });

  it("reset() clears the status back to idle immediately and cancels any pending timeout", async () => {
    mockClipboardWrite(() => Promise.resolve());
    const { result } = renderHook(() => useCopyToClipboard(2000));

    await act(async () => {
      await result.current.copy("text");
    });
    expect(result.current.status).toBe("copied");

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe("idle");

    // The original timer must have been cancelled — advancing past its
    // original deadline must not cause any further state change/error.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.status).toBe("idle");
  });
});
