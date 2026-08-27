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
  TERMINAL_COMMAND_INPUT_ID: "terminal-command-input",
}));

vi.mock("@/lib/feature-flags-sync", () => ({
  isStudioEnabledSync: vi.fn(() => true),
  isWebmcpEnabledSync: vi.fn(() => false),
  isInsightsEnabledSync: vi.fn(() => false),
  isBitbucketEnabledSync: vi.fn(() => false),
  isCodebergEnabledSync: vi.fn(() => false),
  isGitlabEnabledSync: vi.fn(() => false),
}));

// Mock the dynamic import of ShortcutCheatSheet.
// `vi.fn` (not a plain factory) so the loader argument can be captured and
// resolved — otherwise the `.then()` mapper in the component is never executed
// by any test and a wrong export name would break the cheat sheet silently.
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: vi.fn(() => {
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
  }),
}));

// Spy on global fetch for go-profile test
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// go-profile shares `useSession`'s fetchSession()/instrumentation (#1184
// FE-L6) instead of a bespoke fetch — spy on trackEvent so tests can assert
// that instrumentation actually fires, and use the real `@/hooks/useSession`
// module (not mocked) so the shared cache is genuinely exercised.
const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }));
vi.mock("@/lib/analytics/posthog", () => ({
  trackEvent: mockTrackEvent,
}));

/* ------------------------------------------------------------------ */
/* Import tested module AFTER mocks                                   */
/* ------------------------------------------------------------------ */

import {
  KeyboardShortcutsListener,
  useKeyboardShortcutsContext,
} from "./KeyboardShortcutsListener";
import { isStudioEnabledSync } from "@/lib/feature-flags-sync";
import { fetchSession, clearSessionCache } from "@/hooks/useSession";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { resolveDynamicLoader } from "@/lib/test-helpers/dynamic-mock";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * A consumer that reads context inside useEffect (the real usage pattern).
 * The store is published in the listener's useLayoutEffect, which fires
 * before sibling useEffect hooks.
 *
 * Note: onContext may be called multiple times if the store value changes
 * (e.g., first with no-op fallback, then with real store). The last call
 * wins, which is the real store.
 */
function EffectContextConsumer({
  onContext,
}: {
  onContext: (ctx: ReturnType<typeof useKeyboardShortcutsContext>) => void;
}) {
  const ctx = useKeyboardShortcutsContext();

  useEffect(() => {
    onContext(ctx);
  }, [ctx, onContext]);

  return <div data-testid="consumer">consumer</div>;
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe("KeyboardShortcutsListener", () => {
  beforeEach(() => {
    capturedOnShortcut = null;
    capturedActiveScopes = [];
    mockPush.mockClear();
    mockFetch.mockReset();
    mockTrackEvent.mockClear();
    // go-profile now goes through the shared `useSession` module-level
    // promise cache — reset it so each test's fetch mock is actually
    // exercised instead of a previous test's cached result being reused.
    clearSessionCache();
    document.body.innerHTML = "";
  });

  afterEach(cleanup);

  /* ── Rendering ────────────────────────────────────────────────── */

  describe("rendering", () => {
    it("renders without wrapping children (no children prop)", () => {
      render(<KeyboardShortcutsListener />);
      // The component renders only the cheat sheet (hidden by default) — no children
      expect(screen.queryByTestId("child")).toBeNull();
    });

    it("initialises useKeyboardShortcuts with navigation scope", () => {
      render(<KeyboardShortcutsListener />);
      expect(capturedActiveScopes).toContain("navigation");
    });

    it("does not accept a children prop", () => {
      // TypeScript should prevent passing children, but verify at runtime
      // that the component signature has no children
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Listener = KeyboardShortcutsListener as any;
      render(
        <Listener>
          <div data-testid="should-not-render">child</div>
        </Listener>,
      );
      // Even if children are passed, they should not be rendered
      expect(screen.queryByTestId("should-not-render")).toBeNull();
    });
  });

  /* ── Context availability ─────────────────────────────────────── */

  describe("context availability", () => {
    it("provides registerPageShortcuts and openCheatSheet via useKeyboardShortcutsContext", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <>
          <KeyboardShortcutsListener />
          <EffectContextConsumer onContext={(c) => (ctx = c)} />
        </>,
      );
      expect(ctx).not.toBeNull();
      expect(typeof ctx!.registerPageShortcuts).toBe("function");
      expect(typeof ctx!.openCheatSheet).toBe("function");
    });

    it("returns no-op fallback when KeyboardShortcutsListener is not mounted", () => {
      // Without the Listener, the hook returns a no-op fallback (does not throw).
      // This is a graceful degradation — shortcuts just don't work.
      function OrphanConsumer() {
        const ctx = useKeyboardShortcutsContext();
        // The no-op registerPageShortcuts returns a no-op unregister function
        const unregister = ctx.registerPageShortcuts("share", vi.fn());
        expect(typeof unregister).toBe("function");
        // The no-op openCheatSheet does nothing
        ctx.openCheatSheet();
        return <div data-testid="orphan">orphan</div>;
      }
      render(<OrphanConsumer />);
      expect(screen.getByTestId("orphan")).toBeDefined();
    });
  });

  /* ── Scope registration ───────────────────────────────────────── */

  describe("scope registration", () => {
    it("registerScope adds the scope to active scopes", () => {
      let ctx: ReturnType<typeof useKeyboardShortcutsContext> | null = null;
      render(
        <>
          <KeyboardShortcutsListener />
          <EffectContextConsumer onContext={(c) => (ctx = c)} />
        </>,
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
        <>
          <KeyboardShortcutsListener />
          <EffectContextConsumer onContext={(c) => (ctx = c)} />
        </>,
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
        <>
          <KeyboardShortcutsListener />
          <EffectContextConsumer onContext={(c) => (ctx = c)} />
        </>,
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
      render(<KeyboardShortcutsListener />);

      act(() => {
        capturedOnShortcut!("go-home");
      });

      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("go-profile fetches session and navigates to /u/:handle", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { login: "testuser" } }),
      });

      render(<KeyboardShortcutsListener />);

      await act(async () => {
        capturedOnShortcut!("go-profile");
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/session");
      expect(mockPush).toHaveBeenCalledWith("/u/testuser");
    });

    it("go-profile does not navigate when session fetch fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));

      render(<KeyboardShortcutsListener />);

      await act(async () => {
        capturedOnShortcut!("go-profile");
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("go-profile does not navigate when session has no login", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: null }),
      });

      render(<KeyboardShortcutsListener />);

      await act(async () => {
        capturedOnShortcut!("go-profile");
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    // #1184 (FE-L6) — go-profile previously called `fetch("/api/auth/session")`
    // directly, bypassing `useSession`'s module-level cache AND its
    // `client_api_error` instrumentation, so a 429 from the fail-closed rate
    // limiter silently did nothing observable. It must now go through the
    // shared `fetchSession()` export.
    it("go-profile surfaces a client_api_error via the shared fetchSession() instrumentation on a non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

      render(<KeyboardShortcutsListener />);

      await act(async () => {
        capturedOnShortcut!("go-profile");
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        "client_api_error",
        expect.objectContaining({
          route: "/api/auth/session",
          status: 429,
          source: "useSession",
        }),
      );
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("go-profile reuses the shared useSession() cache instead of issuing its own fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { login: "cacheduser" } }),
      });
      // Prime the shared cache exactly as a mounted useSession() consumer would.
      await fetchSession();
      mockFetch.mockClear();

      render(<KeyboardShortcutsListener />);

      await act(async () => {
        capturedOnShortcut!("go-profile");
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/u/cacheduser");
    });

    it("go-studio navigates to /studio when studio is enabled", () => {
      vi.mocked(isStudioEnabledSync).mockReturnValue(true);

      render(<KeyboardShortcutsListener />);

      act(() => {
        capturedOnShortcut!("go-studio");
      });

      expect(mockPush).toHaveBeenCalledWith("/studio");
    });

    it("go-studio does NOT navigate when studio is disabled", () => {
      vi.mocked(isStudioEnabledSync).mockReturnValue(false);

      render(<KeyboardShortcutsListener />);

      act(() => {
        capturedOnShortcut!("go-studio");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  /* ── Focus command bar (/) ────────────────────────────────────── */

  describe("focus command bar", () => {
    it("focus-command-bar focuses the terminal input element", () => {
      // Render the input separately (as a sibling, not as a child)
      render(
        <>
          <KeyboardShortcutsListener />
          <input id="terminal-command-input" aria-label="Terminal command input" data-testid="cmd-input" />
        </>,
      );

      const input = screen.getByTestId("cmd-input") as HTMLInputElement;
      expect(document.activeElement).not.toBe(input);

      act(() => {
        capturedOnShortcut!("focus-command-bar");
      });

      expect(document.activeElement).toBe(input);
    });

    it("focus-command-bar does nothing when terminal input is not in DOM", () => {
      render(<KeyboardShortcutsListener />);

      // Should not throw
      act(() => {
        capturedOnShortcut!("focus-command-bar");
      });
    });
  });

  /* ── Cheat sheet toggle (?) ───────────────────────────────────── */

  describe("cheat sheet toggle", () => {
    it("open-cheatsheet toggles the cheat sheet open", () => {
      render(<KeyboardShortcutsListener />);

      expect(screen.queryByTestId("cheat-sheet")).toBeNull();

      act(() => {
        capturedOnShortcut!("open-cheatsheet");
      });

      expect(screen.getByTestId("cheat-sheet")).toBeDefined();
    });

    it("open-cheatsheet toggles the cheat sheet closed on second press", () => {
      render(<KeyboardShortcutsListener />);

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
        <>
          <KeyboardShortcutsListener />
          <EffectContextConsumer onContext={(c) => (ctx = c)} />
        </>,
      );

      expect(screen.queryByTestId("cheat-sheet")).toBeNull();

      act(() => {
        ctx!.openCheatSheet();
      });

      expect(screen.getByTestId("cheat-sheet")).toBeDefined();
    });

    it("cheat sheet onClose callback closes the sheet", () => {
      render(<KeyboardShortcutsListener />);

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
        <>
          <KeyboardShortcutsListener />
          <EffectContextConsumer onContext={(c) => (ctx = c)} />
        </>,
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
        <>
          <KeyboardShortcutsListener />
          <EffectContextConsumer onContext={(c) => (ctx = c)} />
        </>,
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
        <>
          <KeyboardShortcutsListener />
          <EffectContextConsumer onContext={(c) => (ctx = c)} />
        </>,
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
        <>
          <KeyboardShortcutsListener />
          <EffectContextConsumer onContext={(c) => (ctx = c)} />
        </>,
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
  /* ---------------------------------------------------------------- */
  /* #1006 — next/dynamic loader coverage                              */
  /* ---------------------------------------------------------------- */

  describe("deferred ShortcutCheatSheet loader", () => {
    it("resolves the dynamic loader to the ShortcutCheatSheet export", async () => {
      // The component maps the module through
      // `.then((m) => ({ default: m.ShortcutCheatSheet }))`. Nothing else in
      // this suite executes that mapper, so a wrong export name would ship a
      // broken cheat sheet with every test still green.
      const { ShortcutCheatSheet } = await import("./ShortcutCheatSheet");

      const resolved = await resolveDynamicLoader<typeof ShortcutCheatSheet>(
        dynamic,
      );

      expect(resolved).toBe(ShortcutCheatSheet);
    });
  });
});
