"use client";

import { useState } from "react";

interface ErrorBannerProps {
  message: string;
}

/**
 * Dismissible amber-themed error banner for OAuth failures.
 *
 * Rendered by the server component (page.tsx) only when an error
 * query parameter is present. Dismiss state is client-side only.
 */
export function ErrorBanner({ message }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed top-[73px] left-0 right-0 z-40 flex items-center justify-center gap-2 sm:gap-3 border-b border-amber/30 bg-amber/10 px-4 sm:px-6 py-3 text-xs sm:text-sm text-amber backdrop-blur-sm"
    >
      {/* Warning icon */}
      <svg
        className="h-4 w-4 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      <span>{message}</span>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-2 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full p-1 text-amber/70 transition-colors hover:bg-amber/10 hover:text-amber"
        aria-label="Dismiss error"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
