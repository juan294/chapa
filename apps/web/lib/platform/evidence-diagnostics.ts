import "server-only";
import type { EvidenceReasonCode } from "@chapa/shared";
import { scheduleServerEvent } from "@/lib/analytics/schedule-server-event";

/**
 * Honest stop classification for evidence collectors (#1335 phase 1). A
 * collector stop caused by its own budget or deadline must never be recorded
 * as `source_error` -- only a provider-reported or structural failure is. See
 * `docs/plans/2026-09-23-universal-v72-reliable-collection.md`.
 */
export type SourceProvider = "github" | "bitbucket" | "gitlab" | "codeberg";

export type StopKind =
  | "budget"
  | "deadline"
  | "rate_limited"
  | "http"
  | "graphql"
  | "network"
  | "protocol"
  | "parse"
  | "not_accessible";

/** Private collection diagnostic. Never a URL, request/response body or token
 * -- only provider, a stable operation name, the stop kind and an HTTP status.
 */
export interface SourceDiagnostic {
  readonly provider: SourceProvider;
  readonly operation: string;
  readonly stopKind: StopKind;
  readonly httpStatus: number | null;
  readonly retryAfterSeconds: number | null;
}

/** Classifies a thrown fetch failure that never produced an HTTP response
 * (aborted mid-flight, or a network/parse exception). Budget, rate-limit and
 * HTTP-status stops classify themselves inline at the call site; this only
 * covers the exception path of a collector's `request()`.
 */
export function classifyFetchFailure(error: unknown, signal: AbortSignal): StopKind {
  if (signal.aborted) {
    const reason = signal.reason;
    if (reason instanceof DOMException && reason.name === "TimeoutError") return "deadline";
    if (error instanceof DOMException && error.name === "TimeoutError") return "deadline";
    // Aborted for any other reason (deadline is the only current abort source).
    return "deadline";
  }
  if (error instanceof TypeError) return "network";
  return "parse";
}

/** Maps a stop kind to the evidence reason code that already governs
 * issuance semantics. A budget/deadline/rate-limit stop is honest
 * incompleteness, never the collector's own fault.
 */
export function reasonFor(stopKind: StopKind): EvidenceReasonCode {
  switch (stopKind) {
    case "budget":
    case "deadline":
    case "rate_limited":
      return "pagination_incomplete";
    case "not_accessible":
      return "not_accessible";
    case "http":
    case "graphql":
    case "network":
    case "protocol":
    case "parse":
      return "source_error";
  }
}

/** A collector's own budget or deadline, checked before attempting a
 * request. Budget takes priority when both apply: an already-exhausted
 * budget is reported as such even if the deadline has also passed.
 */
export function budgetOrDeadlineStop(requestCount: number, maxRequests: number, signal: AbortSignal): "budget" | "deadline" | null {
  if (requestCount >= maxRequests) return "budget";
  if (signal.aborted) return "deadline";
  return null;
}

/** True for HTTP 429, or a GitHub-style 403 with an exhausted rate-limit
 * header. Generic across providers: a provider that never sets these headers
 * simply never matches, and falls through to its ordinary status handling.
 */
export function isRateLimitedResponse(status: number, headers: Headers | undefined | null): boolean {
  if (status === 429) return true;
  return status === 403 && headers?.get("x-ratelimit-remaining") === "0";
}

/** Classifies a non-ok HTTP response: rate-limited first (it can otherwise
 * overlap with a provider's own not-accessible status, e.g. GitHub's 403),
 * then a provider-specific not-accessible status, then any other status.
 */
export function classifyHttpStatus(status: number, headers: Headers | undefined | null, notAccessibleStatuses: readonly number[]): "rate_limited" | "not_accessible" | "http" {
  if (isRateLimitedResponse(status, headers)) return "rate_limited";
  if (notAccessibleStatuses.includes(status)) return "not_accessible";
  return "http";
}

/** A GraphQL error entry shape wide enough to cover every provider observed
 * here (github/queries.ts:14-30 documents the same three fields for the
 * legacy v6 client; defined again here rather than imported because that
 * module is v6 code phase 5 deletes).
 */
interface GraphqlErrorShape {
  readonly type?: string;
  readonly code?: string;
  readonly extensions?: { readonly type?: string };
}
function isRateLimitedGraphqlErrorEntry(entry: GraphqlErrorShape): boolean {
  return entry.type === "RATE_LIMITED" || entry.code === "RATE_LIMITED" || entry.extensions?.type === "RATE_LIMITED";
}
/** True for a GraphQL `errors` array reporting a `RATE_LIMITED` error, in
 * any of the shapes providers use: a top-level `type`, a top-level `code`,
 * or `extensions.type`.
 */
export function isGraphqlRateLimited(errors: unknown): boolean {
  return Array.isArray(errors) && errors.some((entry) => (
    entry !== null && typeof entry === "object" && !Array.isArray(entry) && isRateLimitedGraphqlErrorEntry(entry as GraphqlErrorShape)
  ));
}

/** Reads `retry-after` first (seconds, per-request), then a GitHub-style
 * `x-ratelimit-reset` (an epoch second) converted to a remaining duration.
 */
export function retryAfterSeconds(headers: Headers | undefined | null): number | null {
  if (!headers) return null;
  const retryAfter = headers.get("retry-after");
  if (retryAfter !== null && /^\d+$/.test(retryAfter)) return Number(retryAfter);
  const reset = headers.get("x-ratelimit-reset");
  if (reset !== null && /^\d+$/.test(reset)) {
    const seconds = Number(reset) - Math.floor(Date.now() / 1000);
    return seconds > 0 ? seconds : 0;
  }
  return null;
}

/** A per-collection-run recorder: pushes a diagnostic and returns the mapped
 * reason code in one call, so a collector's `request()` can write
 * `error: diagnostics.record(operation, stopKind)` at every stop site.
 * Keeps at most one diagnostic per (operation, stopKind) pair -- a page loop
 * that hits the same stop on every row would otherwise push up to one
 * diagnostic (and one PostHog event) per row. `record()` still returns the
 * mapped reason code on every call, whether or not it added a diagnostic.
 */
export function createDiagnosticRecorder(provider: SourceProvider) {
  const diagnostics: SourceDiagnostic[] = [];
  const seen = new Set<string>();
  return {
    diagnostics,
    record(operation: string, stopKind: StopKind, httpStatus: number | null = null, retryAfter: number | null = null): EvidenceReasonCode {
      const key = `${operation}:${stopKind}`;
      if (!seen.has(key)) {
        seen.add(key);
        diagnostics.push({ provider, operation, stopKind, httpStatus, retryAfterSeconds: retryAfter });
      }
      return reasonFor(stopKind);
    },
  };
}

/** Emits one `evidence_source_stop` telemetry event per diagnostic. Nothing
 * is emitted for a clean run (an empty diagnostics list).
 */
export function emitSourceDiagnostics(owner: string, diagnostics: readonly SourceDiagnostic[]): void {
  for (const diagnostic of diagnostics) {
    scheduleServerEvent("evidence_source_stop", {
      handle: owner,
      provider: diagnostic.provider,
      operation: diagnostic.operation,
      stopKind: diagnostic.stopKind,
      httpStatus: diagnostic.httpStatus,
      retryAfterSeconds: diagnostic.retryAfterSeconds,
    });
  }
}
