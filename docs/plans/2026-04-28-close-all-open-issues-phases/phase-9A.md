---
phase: 9A
release: v2.9.0
issues: ["#707"]
batch_eligible: true
effort: M
---

# Phase 9A — `withErrorCapture` everywhere (`#707`)

## Goal

Wire the existing `withErrorCapture(route, handler)` wrapper into all 44
API routes. Replace direct `captureServerError(...)` calls with the wrapper
where the route-handler shape allows. Result: every unhandled 5xx in any
route automatically captures to PostHog and triggers the active-alerts
classification.

## Current state (verified 2026-04-28)

- `withErrorCapture` is defined at `apps/web/lib/analytics/server-errors.ts:275`
- 0 routes currently use the wrapper
- 7 routes call `captureServerError` directly
- 37 routes have NO error capture path

## Pseudocode change per route

```ts
// Before:
export async function GET(req: NextRequest) { ... }

// After:
import { withErrorCapture } from "@/lib/analytics/server-errors";
export const GET = withErrorCapture(
  "/api/<route-path>",
  async (req: NextRequest) => { ... }
);
```

For routes already calling `captureServerError` in a try/catch, REMOVE the
manual try/catch and let the wrapper handle 500s. Keep manual capture only
where the route catches a non-500 case (e.g., 4xx with structured detail).

## Files

44 `route.ts` files under `apps/web/app/api/`.

Notable cases that need extra care:
- `app/api/cron/warm-cache/route.ts` — already calls `captureServerError`
  on per-handle failures. Keep that. Add wrapper only at the top level.
- `app/api/webhooks/resend/route.ts` — has structured 4xx returns; wrapper
  is still safe (only fires on thrown errors).
- `app/api/health/route.ts` — must NEVER 500 (would alert P1). Add wrapper
  but verify health probe failure paths still return 200/503 explicitly.
- Auth callback routes — these throw redirect responses, not errors.
  `withErrorCapture` already handles `NextResponse | Response`.

## Acceptance criteria

### Automated
- [ ] `find apps/web/app/api -name 'route.ts' | xargs grep -L "withErrorCapture" | wc -l` returns `0`
- [ ] `pnpm run typecheck && pnpm run test && pnpm run lint` all pass
- [ ] No route's existing `route.test.ts` regresses
- [ ] Add a new test `apps/web/lib/analytics/server-errors.coverage.test.ts`
      that walks the route tree and asserts every `route.ts` exports a
      wrapped `withErrorCapture(...)` handler

### Manual
- Manual smoke: trigger a deliberate throw in a route locally (`throw new Error("test")`)
  and verify a `server_error` event appears in the PostHog dev project

## Closing the issue

```bash
gh issue close 707 --comment "Fixed in <sha>. All 44 API routes now use \`withErrorCapture\` wrapper; coverage test enforces no regression."
```
