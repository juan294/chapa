# Phase 1: Inline Badge SVG + Parallel Data Fetching

> **Impact**: Eliminates ~1.5–2.5s from LCP by removing the second server round-trip
> **Files modified**: `apps/web/app/u/[handle]/page.tsx`
> **Risk**: Low — badge.svg route unchanged, only the share page rendering path changes

## Current Flow (page.tsx)

```
Line 102-104: Promise.all([getStats(), cacheGet(config)])     ← parallel ✓
Line 106:     computeImpactV4(stats)                          ← sync, fast
Line 110:     await getCachedLatestSnapshot(handle)           ← SEQUENTIAL BLOCKER
Line 112-113: applyEMA() + getTier()                          ← sync, fast
Line 178-185: <img src="/u/.../badge.svg">                    ← TRIGGERS SECOND REQUEST
```

Browser then fetches badge.svg route which:
- Calls `getStats()` again (cached, ~50ms)
- Calls `getCachedLatestSnapshot()` (cached, ~50ms)
- Calls `getAvatarBase64()` (network call to GitHub CDN, 0.5–2s)
- Calls `renderBadgeSvg()` (CPU, ~200ms)

## New Flow

```
Step 1 — Promise.all (fully parallel):
  - getStats(handle, token)
  - cacheGet<BadgeConfig>(`config:${handle}`)
  - getCachedLatestSnapshot(handle)            ← MOVED HERE

Step 2 — After stats available (concurrent):
  - computeImpactV4(stats)                     ← sync, instant
  - getAvatarBase64(handle, stats.avatarUrl)   ← async, starts immediately

Step 3 — After impact + avatar ready:
  - applyEMA() + getTier()                     ← sync, instant
  - generateVerificationCode(stats, impact)    ← sync, instant
  - renderBadgeSvg(stats, impact, opts)        ← sync, ~200ms

Step 4 — Render inline SVG:
  - dangerouslySetInnerHTML={{ __html: inlineSvg }}

Step 5 — after() deferred work:
  - storeVerificationRecord()
  - trackBadgeGenerated()
  - notifyFirstBadge()
  - dbInsertSnapshot() + updateSnapshotCache()
```

## Changes

### 1. Add new imports to `page.tsx`

```typescript
// Add these imports:
import { after } from "next/server";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { generateVerificationCode } from "@/lib/verification/hmac";
import { storeVerificationRecord } from "@/lib/verification/store";
import { trackBadgeGenerated } from "@/lib/cache/redis";
import { notifyFirstBadge } from "@/lib/email/notifications";
import { buildSnapshot } from "@/lib/history/snapshot";
import { dbInsertSnapshot } from "@/lib/db/snapshots";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import type { VerificationRecord } from "@/lib/verification/types";
```

### 2. Restructure data fetching (lines 102–114)

Replace the current sequential fetch pattern:

```typescript
// BEFORE (current):
const [stats, savedConfig] = await Promise.all([
  getStats(handle, token),
  cacheGet<BadgeConfig>(`config:${handle}`),
]);
const impact = stats ? computeImpactV4(stats) : null;
if (impact) {
  const latestSnapshot = await getCachedLatestSnapshot(handle);  // BLOCKING
  // ...
}
```

With fully parallelized fetching:

```typescript
// AFTER:
const [stats, savedConfig, latestSnapshot] = await Promise.all([
  getStats(handle, token),
  cacheGet<BadgeConfig>(`config:${handle}`),
  getCachedLatestSnapshot(handle),  // Now parallel with getStats
]);

const impact = stats ? computeImpactV4(stats) : null;

// Start avatar fetch immediately (don't wait for EMA computation)
const avatarPromise = stats?.avatarUrl
  ? getAvatarBase64(handle, stats.avatarUrl)
  : Promise.resolve(undefined);

if (impact) {
  const previousSmoothed = latestSnapshot?.adjustedComposite ?? null;
  impact.adjustedComposite = applyEMA(impact.adjustedComposite, previousSmoothed);
  impact.tier = getTier(impact.adjustedComposite);
}

// Wait for avatar (may already be resolved from cache)
const avatarDataUri = await avatarPromise;

// Generate verification code + render badge SVG
const verification = stats && impact
  ? generateVerificationCode(stats, impact)
  : null;

const inlineSvg = stats && impact
  ? renderBadgeSvg(stats, impact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
    })
  : null;
```

### 3. Replace `<img>` with inline SVG (lines 176–186)

```tsx
// BEFORE:
<div className="rounded-2xl border border-stroke bg-card p-4 shadow-lg shadow-amber/5">
  <img
    src={`/u/${encodeURIComponent(handle)}/badge.svg?v=${encodeURIComponent(badgeCacheBuster)}`}
    alt={`Chapa badge for ${handle}`}
    width={1200}
    height={630}
    fetchPriority="high"
    className="w-full rounded-xl"
  />
</div>

// AFTER:
<div className="rounded-2xl border border-stroke bg-card p-4 shadow-lg shadow-amber/5">
  {inlineSvg ? (
    <div
      role="img"
      aria-label={`Chapa badge for ${handle}`}
      className="w-full rounded-xl overflow-hidden"
      dangerouslySetInnerHTML={{ __html: inlineSvg }}
    />
  ) : (
    /* Fallback: if SVG render failed, still load via <img> */
    <img
      src={`/u/${encodeURIComponent(handle)}/badge.svg?v=${encodeURIComponent(badgeCacheBuster)}`}
      alt={`Chapa badge for ${handle}`}
      width={1200}
      height={630}
      fetchPriority="high"
      className="w-full rounded-xl"
    />
  )}
</div>
```

Note: `role="img"` + `aria-label` maintains accessibility parity with the `<img>` element.

### 4. Add `after()` for deferred work

Add after the inline SVG computation, before the return statement:

```typescript
// Deferred work (runs after response is sent to browser)
if (stats && impact && !useInteractivePreview) {
  after(() => {
    const ops: Promise<void>[] = [];

    if (verification) {
      const record: VerificationRecord = {
        handle: stats.handle.toLowerCase(),
        displayName: stats.displayName,
        adjustedComposite: impact.adjustedComposite,
        confidence: impact.confidence,
        tier: impact.tier,
        archetype: impact.archetype,
        dimensions: impact.dimensions,
        commitsTotal: stats.commitsTotal,
        prsMergedCount: stats.prsMergedCount,
        reviewsSubmittedCount: stats.reviewsSubmittedCount,
        generatedAt: verification.date,
        profileType: impact.profileType,
      };
      ops.push(storeVerificationRecord(verification.hash, record));
    }

    ops.push(trackBadgeGenerated(handle));
    ops.push(notifyFirstBadge(handle, impact));
    const snapshot = buildSnapshot(stats, impact);
    ops.push(
      dbInsertSnapshot(handle, snapshot).then((inserted) => {
        if (inserted) updateSnapshotCache(handle, snapshot);
      }),
    );

    return Promise.allSettled(ops);
  });
}
```

### 5. Remove unused `badgeCacheBuster` (if no longer needed)

The `badgeCacheBuster` variable (line 120) is only used in the `<img>` `src`. After this change, it's only used in the fallback path. Keep it for the fallback but it will rarely be exercised.

## What Stays the Same

- **Badge.svg route** (`apps/web/app/u/[handle]/badge.svg/route.ts`) — completely unchanged. External embeds (GitHub READMEs, etc.) still work.
- **Interactive preview path** (`ShareBadgePreviewLazy`) — only the default `<img>` path changes. Custom config users see the interactive preview as before.
- **`generateMetadata()`** — no changes to OG metadata or social cards.
- **All other page sections** — toolbar, breakdown, embed snippets, visitor CTA unchanged.

## Tests

### New test: `apps/web/app/u/[handle]/page.test.tsx`

Test that the share page calls `renderBadgeSvg()` during SSR and includes the SVG in the response:

1. **Test: inline SVG rendered when stats and impact available**
   - Mock `getStats` to return valid stats
   - Mock `computeImpactV4` to return valid impact
   - Mock `getAvatarBase64` to return a base64 string
   - Mock `renderBadgeSvg` to return a known SVG string
   - Render the page and assert the SVG string is present in the output
   - Assert no `<img>` tag with badge.svg src exists

2. **Test: fallback to `<img>` when SVG render returns null**
   - Mock `renderBadgeSvg` to throw or return empty
   - Assert `<img>` fallback is rendered

3. **Test: snapshot fetched in parallel (not sequential)**
   - Mock all three async functions with timers
   - Assert `getCachedLatestSnapshot` is called before `getStats` resolves
   - (Or: assert all three are called in the same tick via `Promise.all`)

4. **Test: after() work runs for verification and tracking**
   - Mock `after()` to execute callback immediately
   - Assert `storeVerificationRecord`, `trackBadgeGenerated`, `notifyFirstBadge`, `dbInsertSnapshot` are called

## Verification

```bash
# Automated
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test 2>&1

# Manual: check inline SVG is in HTML
curl -s https://chapa.thecreativetoken.com/u/juan294 | grep -c '<svg xmlns'
# Should output 1+ (the inlined badge SVG)

# Manual: check badge.svg route still works
curl -s -o /dev/null -w "%{http_code}" https://chapa.thecreativetoken.com/u/juan294/badge.svg
# Should output 200
```
