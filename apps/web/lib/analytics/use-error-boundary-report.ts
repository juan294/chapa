"use client";

import { useEffect } from "react";

const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 1000;

/**
 * Redacts content a stack trace or message can carry that isn't needed for
 * debugging and shouldn't leave the browser:
 *  - home-directory segments that embed an OS username (dev-mode stack
 *    frames can read like "/Users/juan/..." or "C:\Users\juan\...")
 *  - query strings on any URL captured in the text (can carry tokens or
 *    other identifying values from a failed fetch call site)
 *
 * This runs client-side, in addition to (not instead of) the server-side
 * `sanitizeUnknown()` that `/api/telemetry`'s client_error branch already
 * applies via `captureServerEvent` (token/secret pattern redaction).
 */
function sanitize(input: string): string {
  return input
    .replace(/\/Users\/[^/\s]+/g, "/Users/[user]")
    .replace(/\/home\/[^/\s]+/g, "/home/[user]")
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "C:\\Users\\[user]")
    .replace(/\?[^\s)'"]+/g, "?[redacted]");
}

/**
 * Module-scoped (per page load) record of error identities already reported
 * to /api/telemetry via this hook. A route error boundary re-renders its
 * fallback on every reset() attempt; if the underlying bug persists, Next.js
 * throws a NEW Error instance each time even though the content is
 * identical, so `error` object identity can't be the dedupe key. Without
 * this guard, a boundary stuck in a persistent render loop would POST once
 * per reset() — and /api/telemetry's client_error branch is IP-rate-limited
 * (#1162), so a loop would burn that shared budget. Keyed by source+identity
 * so two different boundaries are each still reported at least once.
 */
const reportedErrorIds = new Set<string>();

function errorIdentity(error: Error & { digest?: string }): string {
  if (error.digest) return `digest:${error.digest}`;
  const stackHead = (error.stack ?? "").slice(0, 300);
  return `msg:${error.message}::${stackHead}`;
}

/**
 * Reports an error-boundary render error to /api/telemetry, reusing the
 * exact client_error event shape apps/web/app/global-error.tsx originally
 * sent inline (and /api/telemetry already validates, rate-limits, and
 * forwards via captureServerEvent). Fires at most once per distinct error
 * identity for the lifetime of the page — see `reportedErrorIds` above.
 *
 * @param source A per-boundary identifier (e.g. "share-page-error",
 *   "global-error") so a report can be traced back to the boundary that
 *   caught it.
 * @param category Groups boundaries by kind. Route/segment error.tsx
 *   boundaries default to "route_error"; global-error.tsx (which replaces
 *   the root layout on a much rarer, more severe failure) passes
 *   "global_error" explicitly to keep that distinction in telemetry.
 */
export function useErrorBoundaryReport(
  error: Error & { digest?: string },
  source: string,
  category: string = "route_error",
): void {
  useEffect(() => {
    const key = `${source}::${errorIdentity(error)}`;
    if (reportedErrorIds.has(key)) return;
    reportedErrorIds.add(key);

    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "client_error",
        category,
        message: sanitize(error.message).slice(0, MAX_MESSAGE_LENGTH),
        stack: error.stack ? sanitize(error.stack).slice(0, MAX_STACK_LENGTH) : undefined,
        digest: error.digest,
        path: typeof window === "undefined" ? undefined : window.location.pathname,
        source,
      }),
    }).catch(() => undefined);
  }, [error, source, category]);
}
