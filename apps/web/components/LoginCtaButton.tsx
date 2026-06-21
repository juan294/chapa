"use client";

import { useState, type MouseEvent } from "react";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

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
  sm: { wrapper: "pl-6 pr-5 py-3 text-sm", icon: "w-4 h-4" },
  lg: { wrapper: "pl-8 pr-7 py-3.5 text-base", icon: "w-5 h-5" },
};

/**
 * Primary GitHub OAuth login CTA with an in-flight pending state (#770).
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
    <a
      href="/api/auth/login"
      onClick={handleClick}
      aria-busy={pending}
      aria-disabled={pending}
      tabIndex={pending ? -1 : undefined}
      className={`group inline-flex items-center gap-2.5 rounded-lg bg-amber font-semibold text-white transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 ${styles.wrapper} ${pending ? "cursor-wait opacity-90" : ""}`}
    >
      <span aria-live="polite" className="sr-only">
        {pending ? pendingLabel : ""}
      </span>
      {pending ? (
        <SpinnerIcon className={`${styles.icon} animate-spin motion-reduce:animate-none`} />
      ) : (
        <GitHubIcon className={styles.icon} />
      )}
      {pending ? pendingLabel : label}
      {!pending && (
        <ArrowRightIcon className={`${styles.icon} transition-transform group-hover:translate-x-1`} />
      )}
    </a>
  );
}
