# Phase 1: honest stop classification and diagnostics

Parent plan: `../2026-09-23-universal-v72-reliable-collection.md`. Depends on nothing. It is `[batch-eligible]` with phase 2, because the two phases share no files.

## Goal

A collector stop caused by its own budget or deadline is recorded as `pagination_incomplete`, never as `source_error`. Every failure also produces a structured diagnostic that names the provider, the operation, the HTTP status and the stop kind. With this change alone, the next production run for juan294 either issues a receipt or leaves an exact, readable cause.

## Files

| File | Change |
|---|---|
| `apps/web/lib/platform/evidence-diagnostics.ts` (new) | `StopKind`, the `SourceDiagnostic` type, `classifyFetchFailure()`, and `emitSourceDiagnostics()` |
| `apps/web/lib/platform/evidence-diagnostics.test.ts` (new) | classification matrix |
| `apps/web/lib/github/evidence.ts` (+`.test.ts`) | abort and budget stops become `pagination_incomplete`; return `diagnostics[]` |
| `apps/web/lib/bitbucket/evidence.ts` (+`.test.ts`) | same, plus a per-branch diagnostic for each of the 11 `source_error` sites (research §3.2) |
| `apps/web/lib/gitlab/evidence.ts` (+`.test.ts`) | same |
| `apps/web/lib/codeberg/evidence.ts` (+`.test.ts`) | same |
| `apps/web/lib/platform/source-collectors.ts` (+`.test.ts`) | carry diagnostics out; the 8 s `/user` pre-check failure becomes a diagnostic, not a silent null |
| `apps/web/lib/analytics/server-events.ts` (or the file that defines the server event names) | new event `evidence_source_stop` |

There is no SQL change. Diagnostics are never written into observations, because the 045 allowlist rejects them. They go to telemetry now, and to job rows in phase 3.

## Steps

### 1.1 Red: reproduce the production failure

In `lib/github/evidence.test.ts`:

```text
given fetch mock: profile ok; repositories ok; merged search pages ok;
      per-PR files fetch never resolves until the AbortSignal fires (fake timers, timeoutMs=50)
when fetchGitHubEvidence(handle, window, token, { timeoutMs: 50 })
then coverage.reasonCodes contains "pagination_incomplete"
 and coverage.reasonCodes does NOT contain "source_error"
 and diagnostics includes { provider:"github", operation:"files", stopKind:"deadline" }
```

Add the same shape for the budget (`maxRequests: 3`), with `stopKind:"budget"`, and one for each of Bitbucket, GitLab and Codeberg. Also add control tests showing that a real HTTP 500, a GraphQL `errors` array and an invalid cursor still produce `source_error`, with `stopKind` `http` / `graphql` / `protocol`.

### 1.2 Green: shared classifier

```ts
type StopKind = "budget" | "deadline" | "rate_limited" | "http" | "graphql" | "network" | "protocol" | "parse" | "not_accessible";
interface SourceDiagnostic { provider; operation: string; stopKind: StopKind; httpStatus: number | null; retryAfterSeconds: number | null; }

classifyFetchFailure(error, signal): StopKind
  if signal.aborted and signal.reason is TimeoutError  -> "deadline"
  if error is TypeError/network                          -> "network"
  else                                                   -> "parse"

reasonFor(stopKind):
  budget | deadline | rate_limited        -> "pagination_incomplete"
  not_accessible                          -> "not_accessible"
  http | graphql | network | protocol | parse -> "source_error"
```

- `rate_limited` covers HTTP 429, a GitHub 403 with `x-ratelimit-remaining: 0`, and a GraphQL `RATE_LIMITED` error type. It captures `retry-after` / `x-ratelimit-reset` into `retryAfterSeconds`.
- Every collector's `request()` routes its failures through this classifier. The existing mapping at `github/evidence.ts:75,82,84,85`, `bitbucket:67,72,74,75`, `gitlab:85,91,93` and `codeberg:62,67,69` is replaced.

### 1.3 Diagnostics for structural branches

Each structural `errors.add("source_error")` site also pushes a diagnostic with `stopKind:"protocol"` or `"parse"` and a stable `operation` name. For Bitbucket these are sites 90, 92, 98-105, 142, 179, 186, 195, 203, 210, 212, 237-249 and 273.

Test: one fixture per Bitbucket branch. Each asserts the exact `{operation, stopKind}` pair. This matrix is how the phase 7 telemetry is read back.

### 1.4 Surface diagnostics

- `collectSource` returns `{ result, diagnostics }`.
- `source-coordinator.ts` calls `emitSourceDiagnostics(owner, diagnostics)`. That is `scheduleServerEvent("evidence_source_stop", {provider, operation, stopKind, httpStatus})` for every diagnostic. Nothing is emitted for a clean run.
- The `/user` pre-check at `source-collectors.ts:20-21` emits `{operation:"preflight_user", stopKind}` instead of returning a bare null.

Test: a coordinator test asserts one `evidence_source_stop` event per diagnostic and none for clean runs. The event schema test asserts that no URL, body or token field exists.

### 1.5 Known Bitbucket hazard (fixed here, with a test)

`artifactRevision` for comments includes `updated_on` (`bitbucket/evidence.ts:214`). When an edited comment is seen in two collections, the immutable-identity guard in `packages/shared/src/scoring-aggregation-v7.ts:149-150` throws. Phase 3 merges events across slices, so this must be stable first.

- Change: build the revision from `comment id + created_on`.
- Test: two runs with different `updated_on` produce identical events.

## Success criteria

**Automated**
- Every red test in 1.1 now passes.
- The control tests still yield `source_error`.
- The `evidence_source_stop` schema test passes.
- The global verification list in the parent plan passes.

**Manual**
- None. Production confirmation is phase 7, step 7.4.
