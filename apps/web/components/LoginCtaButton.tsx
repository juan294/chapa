"use client";

import { useState, type MouseEvent } from "react";

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      data-spinner
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

type Size = "sm" | "lg";

const SIZE_STYLES: Record<Size, { wrapper: string; icon: string }> = {
  sm: { wrapper: "px-5 py-3 text-sm", icon: "w-4 h-4" },
  lg: { wrapper: "px-6 py-3.5 text-base", icon: "w-5 h-5" },
};

/**
 * Primary login CTA with an in-flight pending state (#770).
 *
 * Rendered as a command, `/login │ <label> ↵`, deliberately without a GitHub
 * mark: GitHub is one of four supported platforms and one of two things the
 * OAuth step buys (identity plus a higher API budget), so the entry point
 * must not read as a GitHub-only product.
 *
 * The login is a full-page redirect to `/api/auth/login`, so navigation
 * happens via the native anchor. On click we flip to a spinner + pending
 * label and block further clicks so the user gets immediate feedback while
 * the OAuth redirect is in flight.
 */
export function LoginCtaButton({
  label,
  pendingLabel,
  size = "sm",
}: {
  label: string;
  pendingLabel: string;
  size?: Size;
}) {
  const [pending, setPending] = useState(false);
  const styles = SIZE_STYLES[size];

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (pending) {
      // Already navigating — swallow repeat clicks.
      e.preventDefault();
      return;
    }
    setPending(true);
    // Do NOT preventDefault on the first click: let the browser perform the
    // native redirect to the OAuth endpoint.
  };

  return (
    // Intentional native <a> for a server-redirect API route (GitHub OAuth),
    // not a client-side page navigation. The #1023 top-level app/[locale]
    // dynamic segment makes this lint rule's page-path heuristic
    // false-positive on any /api/* href (see
    // docs/decisions/2026-07-15-i18n-middleware-carve-out.md).
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/api/auth/login"
      onClick={handleClick}
      aria-busy={pending}
      aria-disabled={pending}
      tabIndex={pending ? -1 : undefined}
      className={`group inline-flex items-center gap-3 rounded-[3px] border border-action bg-action font-heading text-action-text shadow-card transition-all hover:bg-action-hover hover:shadow-card-hover ${styles.wrapper} ${pending ? "cursor-wait opacity-90" : ""}`}
    >
      <span aria-live="polite" className="sr-only">
        {pending ? pendingLabel : ""}
      </span>
      <span className="font-normal">/login</span>
      <span aria-hidden="true" className="h-5 w-px bg-current opacity-40" />
      <span className="font-bold">{pending ? pendingLabel : label}</span>
      {pending ? (
        <SpinnerIcon className={`${styles.icon} animate-spin motion-reduce:animate-none`} />
      ) : (
        <span aria-hidden="true" className="text-lg leading-none transition-transform group-hover:translate-x-0.5">↵</span>
      )}
    </a>
  );
}
