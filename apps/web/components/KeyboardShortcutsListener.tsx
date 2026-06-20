// Sibling keyboard listener — does NOT wrap children.
// Replaces the former KeyboardShortcutsProvider which wrapped the entire app tree
// as a "use client" boundary. This component renders only the shortcut listener
// and cheat sheet overlay. Context is shared via a module-level store so consumers
// (SharePageShortcuts, StudioClient) can register page shortcuts without being
// wrapped in a provider.
"use client";

import {
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "@/lib/keyboard/use-keyboard-shortcuts";
import { type ShortcutScope } from "@/lib/keyboard/shortcuts";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import { createModuleStore } from "@/hooks/createModuleStore";
import dynamic from "next/dynamic";

const ShortcutCheatSheet = dynamic(
  () =>
    import("./ShortcutCheatSheet").then((m) => ({
      default: m.ShortcutCheatSheet,
    })),
  { ssr: false },
);

/* ------------------------------------------------------------------ */
/* Module-level store for cross-component communication               */
/* ------------------------------------------------------------------ */

type PageShortcutHandler = (id: string) => void;

interface KeyboardShortcutsStore {
  registerPageShortcuts: (
    scope: ShortcutScope,
    handler: PageShortcutHandler,
  ) => () => void;
  openCheatSheet: () => void;
}

const _storeState = createModuleStore<KeyboardShortcutsStore | null>(null, {
  serverSnapshot: null,
});

function setStore(store: KeyboardShortcutsStore | null): void {
  _storeState.set(store);
}

/* ------------------------------------------------------------------ */
/* No-op fallback for pre-mount access                                */
/* ------------------------------------------------------------------ */

const NOOP_STORE: KeyboardShortcutsStore = {
  registerPageShortcuts: () => () => {},
  openCheatSheet: () => {},
};

/* ------------------------------------------------------------------ */
/* Public hook — replaces useKeyboardShortcutsContext                  */
/* ------------------------------------------------------------------ */

export interface KeyboardShortcutsContextValue {
  /** Register a page-level shortcut handler for a scope. Returns an unregister function. */
  registerPageShortcuts: (
    scope: ShortcutScope,
    handler: PageShortcutHandler,
  ) => () => void;
  /** Open the cheat sheet programmatically. */
  openCheatSheet: () => void;
}

/**
 * Hook to access keyboard shortcuts registration and cheat sheet control.
 * Requires `KeyboardShortcutsListener` to be mounted as a sibling.
 *
 * Returns a no-op fallback during the first render before the listener's
 * layout effect has published the store. Consumers call `registerPageShortcuts`
 * inside `useEffect`, which runs after layout effects — the real store is
 * always available by that time.
 *
 * Throws if the listener is never mounted (store stays null after hydration).
 */
export function useKeyboardShortcutsContext(): KeyboardShortcutsContextValue {
  const store = _storeState.useStore();

  if (!store) {
    // During SSR or before the listener's layout effect fires, return a no-op.
    // Consumers only access the store inside effects, so the real store will be
    // available by then. If the listener is never mounted, the no-op silently
    // degrades (shortcuts just don't work).
    return NOOP_STORE;
  }

  return store;
}

/* ------------------------------------------------------------------ */
/* KeyboardShortcutsListener component                                */
/* ------------------------------------------------------------------ */

export function KeyboardShortcutsListener() {
  const router = useRouter();
  const { studioEnabled } = useClientFeatureFlags();
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [activeScopes, setActiveScopes] = useState<ShortcutScope[]>([
    "navigation",
  ]);

  // Store page-level handlers keyed by scope (ref for event handler access)
  const pageHandlersRef = useRef<Map<ShortcutScope, PageShortcutHandler>>(
    new Map(),
  );

  const registerPageShortcuts = useCallback(
    (scope: ShortcutScope, handler: PageShortcutHandler) => {
      pageHandlersRef.current.set(scope, handler);
      setActiveScopes((prev) =>
        prev.includes(scope) ? prev : [...prev, scope],
      );
      return () => {
        pageHandlersRef.current.delete(scope);
        setActiveScopes((prev) => prev.filter((s) => s !== scope));
      };
    },
    [],
  );

  const openCheatSheet = useCallback(() => {
    setCheatSheetOpen(true);
  }, []);

  // Publish store in layout effect — fires synchronously after DOM mutations
  // but before sibling useEffect hooks. This ensures consumers that call
  // registerPageShortcuts inside useEffect always see the real store.
  useLayoutEffect(() => {
    setStore({ registerPageShortcuts, openCheatSheet });
    return () => {
      setStore(null);
    };
  }, [registerPageShortcuts, openCheatSheet]);

  const handleShortcut = useCallback(
    (id: string) => {
      // Navigation shortcuts (global)
      switch (id) {
        case "go-home":
          router.push("/");
          return;
        case "go-profile": {
          // Lazy-fetch session to get handle
          fetch("/api/auth/session")
            .then((r) => r.json())
            .then((data) => {
              const login = data?.user?.login;
              if (login) {
                router.push(`/u/${login}`);
              }
            })
            .catch(() => {
              // Silently fail — no profile navigation
            });
          return;
        }
        case "go-studio":
          if (studioEnabled) {
            router.push("/studio");
          }
          return;
        case "open-cheatsheet":
          setCheatSheetOpen((v) => !v);
          return;
        case "focus-command-bar": {
          const input = document.querySelector<HTMLInputElement>(
            'input[aria-label="Terminal command input"]',
          );
          input?.focus();
          return;
        }
      }

      // Delegate to page-level handlers
      for (const [, handler] of pageHandlersRef.current) {
        handler(id);
      }
    },
    [router, studioEnabled],
  );

  useKeyboardShortcuts({
    activeScopes,
    onShortcut: handleShortcut,
    enabled: true,
  });

  return (
    <ShortcutCheatSheet
      open={cheatSheetOpen}
      onClose={() => setCheatSheetOpen(false)}
    />
  );
}
