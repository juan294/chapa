# Plan: Share Page OAuth Fix

> **Date:** 2026-03-31
> **Research:** `docs/research/2026-03-31-share-page-oauth-fix.md`
> **Branch:** `develop`
> **Issue:** Share page uses `GITHUB_TOKEN` (limited scope) instead of OAuth token → wrong Quality score

---

## Problem

The share page at `/u/[handle]/page.tsx:117` calls `getStats(handle)` **without** an OAuth token to preserve ISR caching. It falls back to `GITHUB_TOKEN` which sees ~10 public PRs (vs 78 with OAuth), flips the profile type from solo→collaborative, and produces Quality=28 instead of Quality=83.

## Root Cause

ISR (Incremental Static Regeneration) requires that page components never call `headers()` or `cookies()` — doing so forces dynamic rendering on every request, eliminating the 80-90% serverless invocation savings. Six test assertions enforce this constraint at `page.test.ts:114-141`.

## Strategy

**Don't break ISR. Warm the cache from the client side.**

The stats cache is keyed by handle only (`stats:v2:merged:<handle>`) — all callers share the same entry. If we warm the cache with OAuth-sourced data, the ISR page serves correct data on subsequent renders.

The fix:
1. When the badge owner visits their share page, the client detects ownership (already done via `useSession()`)
2. Client silently calls the existing `/api/refresh` endpoint (which uses the owner's OAuth token)
3. Refresh endpoint warms the cache with OAuth data AND invalidates the ISR page cache via `revalidatePath`
4. Client calls `router.refresh()` to immediately re-render with fresh data

This uses entirely existing infrastructure — no new API endpoints, no ISR compromise.

## Phases

### Phase 1: Add `revalidatePath` to refresh endpoint
**File:** `apps/web/app/api/refresh/route.ts`

When a refresh succeeds, call `revalidatePath('/u/${handle}')` so the ISR page rebuilds with the freshly cached OAuth data on the next request. This also improves the existing manual refresh button behavior.

→ `docs/plans/2026-03-31-share-page-oauth-fix-phases/phase-1.md`

### Phase 2: Client-side auto-refresh on owner visit
**Files:** `apps/web/hooks/useOwnerCacheWarm.ts` (new), `apps/web/components/SharePageOwnerContent.tsx`

Create a hook that silently calls `/api/refresh` when the badge owner visits their share page. Debounce with `sessionStorage` (once per handle per tab session). After success, call `router.refresh()` to re-render.

→ `docs/plans/2026-03-31-share-page-oauth-fix-phases/phase-2.md`

### Phase 3: Cleanup [batch-eligible]
**File:** `apps/web/app/api/admin/debug-quality/route.ts` (delete)

Remove the temporary debug endpoint created during the debugging session. No file overlap with Phases 1-2.

→ `docs/plans/2026-03-31-share-page-oauth-fix-phases/phase-3.md`

## Dependency Graph

```
Phase 1 → Phase 2
             ↑
Phase 3 ─────┘ [batch-eligible with Phase 2]
```

Phase 3 has no file overlap with Phase 2 and can run in parallel.

## What We Keep (from prior debugging session)

| Change | Status | Rationale |
|--------|--------|-----------|
| Cross-default PR filter in `stats-aggregation.ts` | **Keep** | Correct scoring logic — only appeared broken due to GITHUB_TOKEN scope |
| `MIN_QUALITY_SAMPLE` guard | **Keep** | Safety net for limited-scope tokens |
| `baseRefName` in GraphQL query | **Keep** | Required for cross-default filter |
| SWR reduced from 7d to 1d | **Keep** | Intentional improvement |
| Refresh rate limit at 15/hr | **Keep** | Justified by auto-refresh adding load |

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Auto-refresh burns rate limit | Low | sessionStorage debounce (1x per tab session), server-side 15/hr limit |
| `router.refresh()` causes visible flicker | Low | Only fires once, Next.js does in-place RSC update |
| Refresh fails (rate limited, network) | Medium | Silent failure — ISR data still shown, next session retries |
| Cron warm-cache overwrites with GITHUB_TOKEN data | Medium | Owner's next visit re-warms; 6h cache TTL limits exposure |

## Success Criteria

### Automated
- [ ] `pnpm run test` passes (all existing + new tests)
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] ISR guard tests still pass (`page.test.ts:114-141`)
- [ ] New hook tests cover: owner triggers refresh, visitor does not, sessionStorage debounce, router.refresh on success

### Manual
- [ ] Log in on localhost, visit `/u/<handle>` → network tab shows POST `/api/refresh` → page data updates
- [ ] Visit `/u/<other-handle>` → no refresh call
- [ ] Open same page in new tab → sessionStorage prevents duplicate refresh
- [ ] Refresh with browser devtools sessionStorage cleared → refresh fires again
