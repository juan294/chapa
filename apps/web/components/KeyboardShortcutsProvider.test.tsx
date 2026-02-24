// @vitest-environment jsdom
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/* Mocks — must be declared before imports of tested module            */
/* ------------------------------------------------------------------ */

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Capture the onShortcut callback passed to the hook so tests can invoke it
let capturedOnShortcut: ((id: string) => void) | null = null;
let capturedActiveScopes: string[] = [];

vi.mock("@/lib/keyboard/use-keyboard-shortcuts", () => ({
  useKeyboardShortcuts: (opts: {
    activeScopes: string[];
    onShortcut: (id: string) => void;
    enabled: boolean;
  }) => {
    capturedOnShortcut = opts.onShortcut;
    capturedActiveScopes = opts.activeScopes;
  },
}));

vi.mock("@/lib/keyboard/shortcuts", () => ({
  // Provide the type export that the source imports
  ShortcutScope: {},
}));

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabledSync: vi.fn(() => true),
}));

// Mock the dynamic import of ShortcutCheatSheet
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    return function MockShortcutCheatSheet(props: {
      open: boolean;
      onClose: () => void;
    }) {
      return props.open ? (
        <div data-testid="cheat-sheet">
          <button data-testid="cheat-sheet-close" onClick={props.onClose}>
            Close
          </button>
        </div>
      ) : null;
    };
  },
}));

// Spy on global fetch for go-profile test
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

/* ------------------------------------------------------------------ */
/* Import tested module AFTER mocks                                   */
/* ------------------------------------------------------------------ */

import {
  KeyboardShortcutsProvider,
  useKeyboardShortcutsContext,
} from "./KeyboardShortcutsProvider";
import { isStudioEnabledSync } from "@/lib/feature-flags";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function ContextConsumer({
  onContext,
}: {
  onContext: (ctx: ReturnType<typeof useKeyboardShortcutsContext>) => void;
}) {
  const ctx = useKeyboardShortcutsContext();
  onContext(ctx);
  return <div data-testid="consumer">consumer</div>;
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe("KeyboardShortcutsProvider", () => {
  beforeEach(() => {
    capturedOnShortcut = null;
    capturedActiveScopes = [];
    mockPush.mockClear();
    mockFetch.mockReset();
    document.body.innerHTML = "";
  });

  afterEach(cleanup);

  /* ── Rendering ────────────────────────────────────────────────── */

  describe("rendering", () => {
    it("renders children", () => {
      render(
        <KeyboardShortcutsProvider>
          <div data-testid="child">Hello</div>
        </KeyboardShortcutsProvider>,
      );
      expect(screen.getByTestId("child")).toBeDefined();
      expect(screen.getByTestId("child").textContent).toBe("Hello");
    });

    it("initialises useKeyboardShortcuts with navigation scope", () => {
      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );
      expect(capturedActiveScopes).toContain("navigation");
    });
  });

  /* ── Context availability ─────────────────────────────────────── */

  describe("context availability", () => {
    it("provides registerPageShortcuts and openCheatSheet to children", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <KeyboardShortcutsProvider>
          <ContextConsumer onContext={(c) => (ctx = c)} />
        </KeyboardShortcutsProvider>,
      );
      expect(ctx).not.toBeNull();
      expect(typeof ctx!.registerPageShortcuts).toBe("function");
      expect(typeof ctx!.openCheatSheet).toBe("function");
    });

    it("throws when useKeyboardShortcutsContext is used outside provider", () => {
      function Orphan() {
        useKeyboardShortcutsContext();
        return null;
      }
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<Orphan />)).toThrow(
        "useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider",
      );
      spy.mockRestore();
    });
  });

  /* ── Scope registration ───────────────────────────────────────── */

  describe("scope registration", () => {
    it("registerScope adds the scope to active scopes", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <KeyboardShortcutsProvider>
          <ContextConsumer onContext={(c) => (ctx = c)} />
        </KeyboardShortcutsProvider>,
      );

      const handler = vi.fn();
      act(() => {
        ctx!.registerPageShortcuts("share", handler);
      });

      expect(capturedActiveScopes).toContain("share");
      expect(capturedActiveScopes).toContain("navigation");
    });

    it("unregister function removes the scope from active scopes", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <KeyboardShortcutsProvider>
          <ContextConsumer onContext={(c) => (ctx = c)} />
        </KeyboardShortcutsProvider>,
      );

      const handler = vi.fn();
      let unregister: (() => void) | undefined;
      act(() => {
        unregister = ctx!.registerPageShortcuts("share", handler);
      });

      expect(capturedActiveScopes).toContain("share");

      act(() => {
        unregister!();
      });

      expect(capturedActiveScopes).not.toContain("share");
    });

    it("does not duplicate scope when registering the same scope twice", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <KeyboardShortcutsProvider>
          <ContextConsumer onContext={(c) => (ctx = c)} />
        </KeyboardShortcutsProvider>,
      );

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      act(() => {
        ctx!.registerPageShortcuts("share", handler1);
      });
      act(() => {
        ctx!.registerPageShortcuts("share", handler2);
      });

      const shareCount = capturedActiveScopes.filter(
        (s) => s === "share",
      ).length;
      expect(shareCount).toBe(1);
    });
  });

  /* ── Navigation shortcuts ─────────────────────────────────────── */

  describe("navigation shortcuts", () => {
    it("go-home navigates to /", () => {
      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      act(() => {
        capturedOnShortcut!("go-home");
      });

      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("go-profile fetches session and navigates to /u/:handle", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ user: { login: "testuser" } }),
      });

      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      await act(async () => {
        capturedOnShortcut!("go-profile");
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/session");
      expect(mockPush).toHaveBeenCalledWith("/u/testuser");
    });

    it("go-profile does not navigate when session fetch fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));

      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      await act(async () => {
        capturedOnShortcut!("go-profile");
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("go-profile does not navigate when session has no login", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ user: null }),
      });

      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      await act(async () => {
        capturedOnShortcut!("go-profile");
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("go-studio navigates to /studio when studio is enabled", () => {
      vi.mocked(isStudioEnabledSync).mockReturnValue(true);

      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      act(() => {
        capturedOnShortcut!("go-studio");
      });

      expect(mockPush).toHaveBeenCalledWith("/studio");
    });

    it("go-studio does NOT navigate when studio is disabled", () => {
      vi.mocked(isStudioEnabledSync).mockReturnValue(false);

      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      act(() => {
        capturedOnShortcut!("go-studio");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  /* ── Focus command bar (/) ────────────────────────────────────── */

  describe("focus command bar", () => {
    it("focus-command-bar focuses the terminal input element", () => {
      render(
        <KeyboardShortcutsProvider>
          <input aria-label="Terminal command input" data-testid="cmd-input" />
        </KeyboardShortcutsProvider>,
      );

      const input = screen.getByTestId("cmd-input") as HTMLInputElement;
      expect(document.activeElement).not.toBe(input);

      act(() => {
        capturedOnShortcut!("focus-command-bar");
      });

      expect(document.activeElement).toBe(input);
    });

    it("focus-command-bar does nothing when terminal input is not in DOM", () => {
      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      // Should not throw
      act(() => {
        capturedOnShortcut!("focus-command-bar");
      });
    });
  });

  /* ── Cheat sheet toggle (?) ───────────────────────────────────── */

  describe("cheat sheet toggle", () => {
    it("open-cheatsheet toggles the cheat sheet open", () => {
      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      expect(screen.queryByTestId("cheat-sheet")).toBeNull();

      act(() => {
        capturedOnShortcut!("open-cheatsheet");
      });

      expect(screen.getByTestId("cheat-sheet")).toBeDefined();
    });

    it("open-cheatsheet toggles the cheat sheet closed on second press", () => {
      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      act(() => {
        capturedOnShortcut!("open-cheatsheet");
      });
      expect(screen.getByTestId("cheat-sheet")).toBeDefined();

      act(() => {
        capturedOnShortcut!("open-cheatsheet");
      });
      expect(screen.queryByTestId("cheat-sheet")).toBeNull();
    });

    it("openCheatSheet context method opens the cheat sheet", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <KeyboardShortcutsProvider>
          <ContextConsumer onContext={(c) => (ctx = c)} />
        </KeyboardShortcutsProvider>,
      );

      expect(screen.queryByTestId("cheat-sheet")).toBeNull();

      act(() => {
        ctx!.openCheatSheet();
      });

      expect(screen.getByTestId("cheat-sheet")).toBeDefined();
    });

    it("cheat sheet onClose callback closes the sheet", () => {
      render(
        <KeyboardShortcutsProvider>
          <div />
        </KeyboardShortcutsProvider>,
      );

      act(() => {
        capturedOnShortcut!("open-cheatsheet");
      });
      expect(screen.getByTestId("cheat-sheet")).toBeDefined();

      act(() => {
        screen.getByTestId("cheat-sheet-close").click();
      });

      expect(screen.queryByTestId("cheat-sheet")).toBeNull();
    });
  });

  /* ── Page handler dispatch ────────────────────────────────────── */

  describe("page handler dispatch", () => {
    it("delegates unknown shortcut IDs to registered page handlers", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <KeyboardShortcutsProvider>
          <ContextConsumer onContext={(c) => (ctx = c)} />
        </KeyboardShortcutsProvider>,
      );

      const handler = vi.fn();
      act(() => {
        ctx!.registerPageShortcuts("share", handler);
      });

      act(() => {
        capturedOnShortcut!("copy-embed");
      });

      expect(handler).toHaveBeenCalledWith("copy-embed");
    });

    it("does not dispatch to handler after unregistration", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <KeyboardShortcutsProvider>
          <ContextConsumer onContext={(c) => (ctx = c)} />
        </KeyboardShortcutsProvider>,
      );

      const handler = vi.fn();
      let unregister: (() => void) | undefined;
      act(() => {
        unregister = ctx!.registerPageShortcuts("share", handler);
      });

      act(() => {
        unregister!();
      });

      act(() => {
        capturedOnShortcut!("copy-embed");
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("dispatches to multiple registered page handlers", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <KeyboardShortcutsProvider>
          <ContextConsumer onContext={(c) => (ctx = c)} />
        </KeyboardShortcutsProvider>,
      );

      const shareHandler = vi.fn();
      const studioHandler = vi.fn();
      act(() => {
        ctx!.registerPageShortcuts("share", shareHandler);
        ctx!.registerPageShortcuts("studio", studioHandler);
      });

      act(() => {
        capturedOnShortcut!("some-unknown-id");
      });

      expect(shareHandler).toHaveBeenCalledWith("some-unknown-id");
      expect(studioHandler).toHaveBeenCalledWith("some-unknown-id");
    });

    it("navigation shortcuts are NOT dispatched to page handlers", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <KeyboardShortcutsProvider>
          <ContextConsumer onContext={(c) => (ctx = c)} />
        </KeyboardShortcutsProvider>,
      );

      const handler = vi.fn();
      act(() => {
        ctx!.registerPageShortcuts("share", handler);
      });

      act(() => {
        capturedOnShortcut!("go-home");
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
