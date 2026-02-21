// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";

function dispatchKeyDown(
  key: string,
  opts: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  } = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

describe("useKeyboardShortcuts", () => {
  const onShortcut = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onShortcut.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("lifecycle", () => {
    it("attaches a keydown listener on mount", () => {
      const addSpy = vi.spyOn(document, "addEventListener");
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      addSpy.mockRestore();
    });

    it("removes the keydown listener on unmount", () => {
      const removeSpy = vi.spyOn(document, "removeEventListener");
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      unmount();
      expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      removeSpy.mockRestore();
    });

    it("does not attach listener when disabled", () => {
      const addSpy = vi.spyOn(document, "addEventListener");
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
          enabled: false,
        }),
      );
      expect(addSpy).not.toHaveBeenCalledWith("keydown", expect.any(Function));
      addSpy.mockRestore();
    });
  });

  describe("modifier combos", () => {
    it("matches Cmd+1 to go-home", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("1", { metaKey: true }));
      expect(onShortcut).toHaveBeenCalledWith("go-home");
    });

    it("matches Ctrl+1 to go-home", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("1", { ctrlKey: true }));
      expect(onShortcut).toHaveBeenCalledWith("go-home");
    });

    it("matches Shift+Cmd+C to copy-embed in share scope", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["share"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("c", { metaKey: true, shiftKey: true }));
      expect(onShortcut).toHaveBeenCalledWith("copy-embed");
    });
  });

  describe("plain key shortcuts", () => {
    it("matches ? to open-cheatsheet", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("?"));
      expect(onShortcut).toHaveBeenCalledWith("open-cheatsheet");
    });

    it("matches / to focus-command-bar", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("/"));
      expect(onShortcut).toHaveBeenCalledWith("focus-command-bar");
    });
  });

  describe("g-sequences", () => {
    it("matches g then h to go-home", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("g"));
      act(() => dispatchKeyDown("h"));
      expect(onShortcut).toHaveBeenCalledWith("go-home");
    });

    it("matches g then p to go-profile", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("g"));
      act(() => dispatchKeyDown("p"));
      expect(onShortcut).toHaveBeenCalledWith("go-profile");
    });

    it("expires g-sequence after 500ms timeout", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("g"));
      act(() => vi.advanceTimersByTime(501));
      act(() => dispatchKeyDown("h"));
      // Should not match because sequence expired
      expect(onShortcut).not.toHaveBeenCalled();
    });

    it("does not start g-sequence when input is focused", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );

      // Focus an input
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      act(() => dispatchKeyDown("g"));
      act(() => dispatchKeyDown("h"));
      expect(onShortcut).not.toHaveBeenCalled();
    });
  });

  describe("input focus behavior", () => {
    it("skips plain-key shortcuts when input is focused", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      act(() => dispatchKeyDown("/"));
      expect(onShortcut).not.toHaveBeenCalled();
    });

    it("allows modifier shortcuts when input is focused", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      act(() => dispatchKeyDown("1", { metaKey: true }));
      expect(onShortcut).toHaveBeenCalledWith("go-home");
    });

    it("skips plain-key shortcuts when textarea is focused", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );

      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      act(() => dispatchKeyDown("?"));
      expect(onShortcut).not.toHaveBeenCalled();
    });
  });

  describe("scope filtering", () => {
    it("does not match shortcuts outside active scopes", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("c", { metaKey: true, shiftKey: true }));
      // copy-embed is share scope, not navigation
      expect(onShortcut).not.toHaveBeenCalled();
    });

    it("matches shortcuts in multiple active scopes", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation", "share"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("c", { metaKey: true, shiftKey: true }));
      expect(onShortcut).toHaveBeenCalledWith("copy-embed");
    });
  });

  describe("no match", () => {
    it("does not call onShortcut for unregistered keys", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );
      act(() => dispatchKeyDown("x", { metaKey: true }));
      expect(onShortcut).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("clears pending sequence timeout on unmount", () => {
      const clearSpy = vi.spyOn(globalThis, "clearTimeout");
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          activeScopes: ["navigation"],
          onShortcut,
        }),
      );

      // Start a g-sequence
      act(() => dispatchKeyDown("g"));

      unmount();
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
