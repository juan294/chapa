# Phase 4: Auth And Stats-Fetch Hardening

## Status

Completed on 2026-04-17 after centralizing request/header session parsing behind shared helpers, moving the admin agents route onto the shared admin guard, and making `getStats()` auth-aware without letting public callers downgrade an authenticated inflight fetch.

## Goal

Remove repeated session parsing patterns and fix request deduplication so authenticated and unauthenticated stats fetches no longer collapse into the same inflight request.

## Batch Eligibility

[batch-eligible]

This phase can run in parallel with Phase 5 after Phase 3 is complete.

## Files Expected

- New or modified: session helper for server components and routes
- Modified: `apps/web/components/Navbar.tsx`
- Modified: `apps/web/app/studio/page.tsx`
- Modified: `apps/web/app/admin/page.tsx`
- Modified: `apps/web/app/api/auth/session/route.ts`
- Modified: `apps/web/app/api/studio/config/route.ts`
- Modified: `apps/web/app/api/admin/agents/run/route.ts`
- Modified: `apps/web/lib/github/client.ts`
- Modified tests around session helpers and `getStats()`

## Implementation Sketch

### 1. Introduce request/session helpers

```text
getOptionalServerSessionFromHeaders(headers)
getOptionalRequestSession(request)
requireRequestSession(request)
```

Replace inline patterns that currently re-read `NEXTAUTH_SECRET`, parse cookies, and shape session payloads independently.

### 2. Make `getStats()` dedupe auth-aware

Current behavior:

```text
inflightKey = handle.toLowerCase()
```

Target behavior:

```text
inflightKey = [
  handle.toLowerCase(),
  token ? "authenticated" : "public"
].join(":")
```

If needed, use a more nuanced key:

```text
public
session
explicit-server-token
```

The goal is to avoid letting a public request suppress a privileged fetch.

### 3. Update tests for mixed-auth concurrency

Add a regression case:

```text
call getStats("user") and getStats("user", "token") concurrently
assert separate inflight buckets or privileged path preservation
```

## Automated Success Criteria

- Repeated session parsing logic is reduced behind shared helpers.
- `getStats()` mixed-auth concurrency is covered by tests.
- Public and authenticated fetch paths no longer share the same inflight key.

## Manual Success Criteria

- Logged-in badge/studio flows still work.
- Public badge/share requests still work without auth.

## Verification

- `pnpm run typecheck`
- `pnpm run test`
- Targeted tests for `apps/web/lib/github/client.test.ts` plus affected auth/session tests

## Risks

- If the helper abstraction is too route-specific, it will not actually remove duplication. Keep the helper small and request/session-focused.
- Changing inflight dedupe can increase duplicate network work slightly; correctness is more important than maximizing dedupe across unlike auth contexts.

## Stop Condition

Stop when session access is centralized and mixed-auth `getStats()` behavior is explicitly correct.
