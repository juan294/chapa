---
phase: 10A
release: v2.10.0
issues: ["#798", "#791"]
batch_eligible: false
depends_on: []
effort: M
---

# Phase 10A — Owner-only dynamic split (`#798`, `#791`)

## Goal

`/u/[handle]` is the largest measured public route at 746KB First Load JS.
Most visits are anonymous, but the always-mounted client subtree statically
imports `ImpactDashboard` (owner-only) plus the studio preview chunk.
Split the owner path behind `next/dynamic` so anonymous visitors don't pay
for it. Also eliminate the second `/api/refresh` call that owners trigger
on first visit (`#791`).

## Current state

`apps/web/components/SharePageOwnerContent.tsx:1-211`:
- Statically imports `ImpactDashboard` from `components/dashboard/ImpactDashboard.tsx`
- Mounts unconditionally on the share page
- Calls `useOwnerCacheWarm()` which posts to `/api/refresh` whenever
  ownership resolves — even on first SSR-render hydration where data is
  already fresh

## Pseudocode

```tsx
// apps/web/components/SharePageOwnerContent.tsx
import dynamic from "next/dynamic";

const ImpactDashboard = dynamic(
  () => import("@/components/dashboard/ImpactDashboard").then(m => m.ImpactDashboard),
  { ssr: false, loading: () => <ImpactDashboardSkeleton /> },
);

// Hide the dashboard render block entirely behind the session-resolved owner check
// (visitors get a CTA-only path, never load the dashboard chunk)
{isOwner ? <ImpactDashboard ... /> : <VisitorCTA ... />}
```

```tsx
// apps/web/hooks/useOwnerCacheWarm.ts (#791 fix)
// Skip refresh if SSR payload is < 30 minutes old AND the user
// has not triggered a manual action this session.
const ssrAgeMs = Date.now() - new Date(ssrTimestamp).getTime();
if (ssrAgeMs < 30 * 60 * 1000) return;
```

The SSR timestamp must be passed from the server through to
`SharePageOwnerContent` (already available — it's part of `materializeProfile`'s
output as `computedAt`).

## Files

- Modified: `apps/web/components/SharePageOwnerContent.tsx`
- Modified: `apps/web/components/SharePageOwnerContent.test.tsx`
- Modified: `apps/web/hooks/useOwnerCacheWarm.ts`
- Modified: `apps/web/hooks/useOwnerCacheWarm.test.ts`
- Modified: `apps/web/app/u/[handle]/page.tsx` — pass `computedAt` prop
- New: `apps/web/components/ImpactDashboardSkeleton.tsx` — small placeholder
  while the chunk loads

## Acceptance criteria

### Automated
- [ ] Bundle stats show `/u/[handle]` First Load JS reduced by ≥80KB
      (target ~660KB; we will hit 450KB only after Phase 10B too)
- [ ] `pnpm run test` and `pnpm run test:e2e` pass
- [ ] Test added: anonymous visitor mount asserts `ImpactDashboard` chunk
      is NOT in the loaded modules
- [ ] Test added: `useOwnerCacheWarm` does not POST `/api/refresh` when
      `computedAt` is within 30 minutes

### Manual
- Vercel preview: visit a profile in incognito (anonymous) — Network tab
  should show no `ImpactDashboard*.js` chunk loaded
- Visit own profile (authenticated, fresh SSR) — no automatic
  `/api/refresh` POST
- Visit own profile after manual back/forward navigation 31 minutes later
  — `/api/refresh` IS posted (cache-warm intent preserved)

## Closing the issues

```bash
gh issue close 798 --comment "Fixed in <sha>. ImpactDashboard now dynamic-imported behind the owner session check; anonymous visitors skip the chunk entirely."
gh issue close 791 --comment "Fixed in <sha>. useOwnerCacheWarm skips refresh when SSR payload is <30min old."
```
