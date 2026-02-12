"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  matchShortcut,
  isInputFocused,
  isSequenceStarter,
  type ShortcutScope,
} from "./shortcuts";

interface UseKeyboardShortcutsOptions {
  /** Which scopes are currently active. */
  activeScopes: ShortcutScope[];
  /** Called when a shortcut is matched. */
  onShortcut: (id: string) => void;
  /** Whether the system is enabled. Defaults to true. */
  enabled?: boolean;
}

/**
 * React hook that listens for keyboard shortcuts.
 *
 * Manages a single `keydown` listener on `document` and handles
 * g-sequence state with a 500ms timeout.
 */
export function useKeyboardShortcuts({
  activeScopes,
  onShortcut,
  enabled = true,
}: UseKeyboardShortcutsOptions): void {
  const pendingKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable callback ref to avoid re-attaching listeners
  const onShortcutRef = useRef(onShortcut);
  useEffect(() => {
    onShortcutRef.current = onShortcut;
  }, [onShortcut]);

  const activeScopesRef = useRef(activeScopes);
  useEffect(() => {
    activeScopesRef.current = activeScopes;
  }, [activeScopes]);

  const clearPending = useCallback(() => {
    pendingKeyRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      // Skip when typing in inputs (plain keys and sequences only)
      const inInput = isInputFocused();

      const matched = matchShortcut(
        event,
        pendingKeyRef.current,
        activeScopesRef.current,
      );

      if (matched) {
        event.preventDefault();
        clearPending();
        onShortcutRef.current(matched);
        return;
      }

      // If we had a pending key and nothing matched, clear it
      if (pendingKeyRef.current) {
        clearPending();
        // Don't return — fall through to check if this key starts a new sequence
      }

      // Check for sequence starter (e.g. "g") — only when not in an input
      if (!inInput && isSequenceStarter(event)) {
        pendingKeyRef.current = event.key;
        timeoutRef.current = setTimeout(() => {
          pendingKeyRef.current = null;
          timeoutRef.current = null;
        }, 500);
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearPending();
    };
  }, [enabled, clearPending]);
}
