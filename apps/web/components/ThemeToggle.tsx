"use client";

import { useTheme } from "next-themes";
import { useIsClient } from "@/hooks/useIsClient";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useIsClient();

  if (!hydrated) {
    return <div className="h-11 w-11" aria-hidden="true" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg text-terminal-dim transition-colors hover:text-amber"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span
        className={`absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-200 ${
          isDark ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
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
      <span
        className={`flex items-center justify-center transition-[opacity,transform] duration-200 ${
          isDark ? "opacity-0 scale-75" : "opacity-100 scale-100"
        }`}
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
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      </span>
    </button>
  );
}
