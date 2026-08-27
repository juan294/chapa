"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CopyStatus = "idle" | "copied" | "failed";

export interface UseCopyToClipboardResult {
  status: CopyStatus;
  /** Writes `text` to the clipboard. Resolves `true` on success, `false` on rejection — never throws. */
  copy: (text: string) => Promise<boolean>;
  /** Clears the status back to "idle" immediately and cancels any pending auto-reset. */
  reset: () => void;
}

/**
 * Shared clipboard-copy state machine (idle -> copied|failed -> idle).
 *
 * Extracted (#1165 / UX-M4) so every embed/share copy affordance on the
 * share page — `CopyButton` (which previously had no `.catch()` at all, an
 * unhandled rejection on failure), `SharePageShortcuts`' `e` keyboard
 * shortcut (which swallowed a rejection silently, no feedback either way),
 * and `BadgeToolbar`'s "Copy link" (the one existing caller that already
 * surfaced a toast on failure) — share ONE failure semantic: a rejected
 * `navigator.clipboard.writeText()` always surfaces a visible "failed"
 * status, never a silent no-op.
 */
export function useCopyToClipboard(resetDelayMs = 2000): UseCopyToClipboardResult {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingReset = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearPendingReset();
    setStatus("idle");
  }, [clearPendingReset]);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      clearPendingReset();
      try {
        await navigator.clipboard.writeText(text);
        setStatus("copied");
        timeoutRef.current = setTimeout(() => setStatus("idle"), resetDelayMs);
        return true;
      } catch {
        setStatus("failed");
        timeoutRef.current = setTimeout(() => setStatus("idle"), resetDelayMs);
        return false;
      }
    },
    [clearPendingReset, resetDelayMs],
  );

  useEffect(() => clearPendingReset, [clearPendingReset]);

  return { status, copy, reset };
}
