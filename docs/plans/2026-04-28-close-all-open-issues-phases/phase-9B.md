---
phase: 9B
release: v2.9.0
issues: ["#712"]
batch_eligible: true
effort: M
---

# Phase 9B — Structured logger (`#712`)

## Goal

Add `lib/log.ts` emitting JSON lines so production logs are correlatable
across a request chain via `requestId`. Replace ad-hoc `console.log` /
`console.error` in API routes and shared libs with structured calls.

## Pseudocode

```ts
// apps/web/lib/log.ts
type Level = "debug" | "info" | "warn" | "error";

interface LogContext {
  route?: string;
  requestId?: string;
  handle?: string;
  [k: string]: unknown;
}

export function log(
  level: Level,
  msg: string,
  context: LogContext = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...context,
  });
  // Always go through stdout/stderr so Vercel captures it
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function getRequestId(req: Request): string {
  // Vercel sets x-vercel-id; fall back to a generated id for local dev
  return req.headers.get("x-vercel-id") ?? crypto.randomUUID();
}
```

## Integration with `withErrorCapture` (Phase 9A)

`withErrorCapture` should thread `requestId` into the captureServerError
payload:

```ts
// in lib/analytics/server-errors.ts withErrorCapture
const requestId = getRequestId(req);
try {
  return await handler(req, ctx);
} catch (err) {
  void captureServerError({ route, statusCode: 500, error: err, requestId });
  throw err;
}
```

`captureServerError` adds `requestId` to its PostHog `properties` payload.

## Migration scope

For v2.9.0:
- All API routes using `console.error` migrate to `log("error", ..., { route, requestId })`
- Cron routes already log via `captureServerEvent` — leave those, add `log("info", ...)` for non-event progress lines
- Library code (`lib/`) keeps `console.error` for now — will migrate progressively

## Files

- New: `apps/web/lib/log.ts` (~40 LOC)
- New: `apps/web/lib/log.test.ts`
- Modified: `apps/web/lib/analytics/server-errors.ts` (thread requestId)
- Modified: 7 route files currently using `captureServerError` directly to
  pass `requestId`
- Modified: ~15 routes currently using `console.error` for structured logs

## Acceptance criteria

### Automated
- [x] `lib/log.ts` exists with `log()` and `getRequestId()` exports
- [x] `pnpm run test apps/web/lib/log.test.ts` passes
- [x] `pnpm run typecheck && pnpm run test && pnpm run lint` all pass
- [x] `grep -r "console.log\|console.error" apps/web/app/api/` returns no
      matches in handler bodies (only allowed inside `withErrorCapture`
      wrapper or in catch blocks that explicitly want stderr)

### Manual
- Hit a route locally; verify the JSON log line includes `requestId` and `route`
- Cause a 500; verify PostHog event has matching `requestId`

## Closing the issue

```bash
gh issue close 712 --comment "Fixed in <sha>. Structured JSON logger at lib/log.ts; requestId threaded via withErrorCapture into PostHog server_error payload."
```
