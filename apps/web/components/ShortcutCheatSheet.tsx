"use client";

import { useEffect, useRef, useCallback } from "react";
import { SHORTCUTS, groupByScope } from "@/lib/keyboard/shortcuts";

const SCOPE_LABELS: Record<string, string> = {
  navigation: "Navigation",
  share: "Share Page",
  studio: "Studio",
};

interface ShortcutCheatSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutCheatSheet({ open, onClose }: ShortcutCheatSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape (capture phase to avoid conflicts with other handlers)
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [open, onClose]);

  // Focus trap
  const handleFocusTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;

    const focusable = Array.from(
      panelRef.current.querySelectorAll(
        'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
      ),
    ) as HTMLElement[];

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // Auto-focus close button + attach focus trap
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const closeBtn = panelRef.current.querySelector<HTMLButtonElement>("button");
    closeBtn?.focus();

    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [open, handleFocusTrap]);

  if (!open) return null;

  const groups = groupByScope(SHORTCUTS);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="relative w-full max-w-lg rounded-2xl border border-stroke bg-card p-6 shadow-xl shadow-amber/5 animate-scale-in"
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-heading text-sm tracking-widest uppercase text-amber">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-amber/10 hover:text-text-primary"
            aria-label="Close keyboard shortcuts"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcut groups */}
        <div className="space-y-5">
          {Object.entries(groups).map(([scope, shortcuts]) => (
            <div key={scope}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
                {SCOPE_LABELS[scope] ?? scope}
              </h3>
              <div className="space-y-1.5">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5"
                  >
                    <span className="text-sm text-text-primary">
                      {shortcut.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-stroke bg-dark-card px-1.5 text-xs font-heading text-text-secondary"
                        >
                          {k}
                        </kbd>
                      ))}
                      {shortcut.altKeys && (
                        <>
                          <span className="mx-1 text-xs text-terminal-dim">
                            /
                          </span>
                          {shortcut.altKeys.map((k, i) => (
                            <kbd
                              key={`alt-${i}`}
                              className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-stroke bg-dark-card px-1.5 text-xs font-heading text-text-secondary"
                            >
                              {k}
                            </kbd>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <p className="mt-5 text-center text-xs text-terminal-dim">
          Press{" "}
          <kbd className="rounded border border-stroke bg-dark-card px-1 text-xs font-heading text-text-secondary">
            ?
          </kbd>{" "}
          to toggle this panel
        </p>
      </div>
    </div>
  );
}
