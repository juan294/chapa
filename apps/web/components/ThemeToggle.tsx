"use client";

import { useTheme } from "next-themes";
import { useIsClient } from "@/hooks/useIsClient";
import { useTranslation } from "@/lib/i18n";

// #1211 — the token layer themes the page through `color-scheme`, which has
// three states: follow the OS, force light, force dark. The control is one
// button that cycles through them; its label names the mode the next press
// selects, so a screen-reader user hears the outcome, not the current state.
const MODES = ["system", "light", "dark"] as const;
type Mode = (typeof MODES)[number];

const NEXT_MODE_LABEL: Record<Mode, string> = {
  system: "aria.themeToggleLight",
  light: "aria.themeToggleDark",
  dark: "aria.themeToggleSystem",
};

function iconClass(active: boolean): string {
  return `absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-200 ${
    active ? "opacity-100 scale-100" : "opacity-0 scale-75"
  }`;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useIsClient();
  const { t } = useTranslation();

  if (!hydrated) {
    return <div className="h-11 w-11" aria-hidden="true" />;
  }

  // An unset or unrecognized value means no explicit choice has been made,
  // which is exactly what "system" represents.
  const mode: Mode = MODES.includes(theme as Mode) ? (theme as Mode) : "system";
  const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length]!;

  return (
    <button
      onClick={() => setTheme(next)}
      data-theme-mode={mode}
      className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg text-terminal-dim transition-colors hover:text-amber"
      aria-label={t(NEXT_MODE_LABEL[mode]) as string}
    >
      <span className={iconClass(mode === "system")}>
        {/* auto: a display, meaning "whatever this device prefers" */}
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
          <rect x="2" y="4" width="20" height="13" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </span>
      <span className={iconClass(mode === "light")}>
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
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </span>
      <span className={iconClass(mode === "dark")}>
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
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      </span>
    </button>
  );
}
