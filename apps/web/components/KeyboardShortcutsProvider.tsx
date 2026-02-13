"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "@/lib/keyboard/use-keyboard-shortcuts";
import { type ShortcutScope } from "@/lib/keyboard/shortcuts";
import dynamic from "next/dynamic";

const ShortcutCheatSheet = dynamic(
  () =>
    import("./ShortcutCheatSheet").then((m) => ({
      default: m.ShortcutCheatSheet,
    })),
  { ssr: false },
);

type PageShortcutHandler = (id: string) => void;

interface KeyboardShortcutsContextValue {
  /** Register a page-level shortcut handler for a scope. Returns an unregister function. */
  registerPageShortcuts: (
    scope: ShortcutScope,
    handler: PageShortcutHandler,
  ) => () => void;
  /** Open the cheat sheet programmatically. */
  openCheatSheet: () => void;
}

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcutsContext() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) {
    throw new Error(
      "useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider",
    );
  }
  return ctx;
}

interface Props {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({ children }: Props) {
  const router = useRouter();
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
          router.push("/studio");
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
    [router],
  );

  useKeyboardShortcuts({
    activeScopes,
    onShortcut: handleShortcut,
    enabled: true,
  });

  const contextValue: KeyboardShortcutsContextValue = {
    registerPageShortcuts,
    openCheatSheet,
  };

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
      <ShortcutCheatSheet
        open={cheatSheetOpen}
        onClose={() => setCheatSheetOpen(false)}
      />
    </KeyboardShortcutsContext.Provider>
  );
}
