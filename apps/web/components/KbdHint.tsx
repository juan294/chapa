"use client";

import { useMemo } from "react";

interface KbdHintProps {
  /** Display keys, e.g. ["⌘", "1"] or ["⇧", "⌘", "C"] */
  keys: string[];
  className?: string;
}

/** Map Mac symbols to Windows/Linux equivalents. */
const MOD_MAP: Record<string, string> = {
  "⌘": "Ctrl",
  "⇧": "Shift",
};

function useIsMac(): boolean {
  return useMemo(() => {
    if (typeof navigator === "undefined") return true;
    return /mac/i.test(navigator.platform);
  }, []);
}

/**
 * Inline keyboard shortcut hint pill — desktop-only, decorative.
 * Renders small <kbd> elements showing the shortcut next to a button/label.
 */
export function KbdHint({ keys, className = "" }: KbdHintProps) {
  const isMac = useIsMac();

  const displayKeys = useMemo(() => {
    if (isMac) return keys;
    return keys.map((k) => MOD_MAP[k] ?? k);
  }, [keys, isMac]);

  return (
    <span
      aria-hidden="true"
      className={`hidden md:inline-flex items-center gap-0.5 ${className}`}
    >
      {displayKeys.map((key, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center rounded border border-stroke bg-dark-card px-1 py-0.5 font-heading text-[10px] leading-none text-terminal-dim"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
