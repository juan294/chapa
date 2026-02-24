# Phase 4: Merge Pipeline — Wire Bitbucket into getStats()

## Goal

Modify the stats orchestration layer (`getStats()`) to check for a linked Bitbucket account, fetch Bitbucket data if available, and merge it with GitHub data. Update cache keys and confidence handling.

## Design

```
getStats(handle, token)
  │
  ├─ 1. Check merged cache: stats:v2:merged:{handle} → RETURN if hit
  │
  ├─ 2. Fetch GitHub stats (existing pipeline, unchanged)
  │     stats:v2:github:{handle}
  │
  ├─ 3. Check if Bitbucket is linked: dbHasLinkedPlatform(handle, "bitbucket")
  │     ├─ Not linked → skip Bitbucket
  │     └─ Linked → fetch Bitbucket stats:
  │           a. Get tokens from DB: dbGetLinkedPlatform(handle, "bitbucket")
  │           b. If token expired: refreshBitbucketToken() → dbUpdatePlatformTokens()
  │           c. If refresh fails: dbDeleteLinkedPlatform() → skip Bitbucket
  │           d. Fetch: fetchBitbucketStats(remoteLogin, accessToken)
  │           e. Cache: stats:v2:bitbucket:{handle}
  │
  ├─ 4. Merge: mergeStats(github, bitbucket) — if Bitbucket data available
  │     Set linkedPlatforms: ["bitbucket"] on result
  │
  ├─ 5. Merge supplemental (EMU) — existing, unchanged
  │
  ├─ 6. Cache merged result: stats:v2:merged:{handle} (was stats:v2:{handle})
  │
  └─ RETURN merged StatsData
```

## Modified Files

### 1. `apps/web/lib/github/client.ts`

Major changes to `getStats()` and `_fetchAndCache()`:

**Cache key migration:**
```typescript
// OLD:
const cacheKey = `stats:v2:${lowerHandle}`;

// NEW:
const mergedKey = `stats:v2:merged:${lowerHandle}`;
const githubKey = `stats:v2:github:${lowerHandle}`;
const bitbucketKey = `stats:v2:bitbucket:${lowerHandle}`;
const staleKey = `stats:stale:${lowerHandle}`;  // unchanged
```

**Backward compatibility:** The old `stats:v2:{handle}` keys still exist in Redis but won't be written to anymore. They expire naturally (6h TTL). No migration needed.

**New import:**
```typescript
import { dbGetLinkedPlatform, dbDeleteLinkedPlatform, dbUpdatePlatformTokens, dbHasLinkedPlatform } from "@/lib/db/user-platforms";
import { refreshBitbucketToken, isTokenExpired } from "@/lib/auth/bitbucket";
import { fetchBitbucketStats } from "@/lib/bitbucket/stats";
import { isBitbucketEnabled } from "@/lib/feature-flags";
```

**Modified `_fetchAndCache()`:**
```typescript
async function _fetchAndCache(
  handle: string,
  lowerHandle: string,
  mergedKey: string,
  token?: string,
): Promise<StatsData | null> {
  const staleKey = `stats:stale:${lowerHandle}`;
  const githubKey = `stats:v2:github:${lowerHandle}`;
  const bitbucketKey = `stats:v2:bitbucket:${lowerHandle}`;

  const stale = await cacheGet<StatsData>(staleKey);

  // 1. Fetch GitHub stats (existing)
  const github = await fetchStats(handle, token);
  if (!github) {
    if (stale) {
      console.warn(`[cache] serving stale data for ${lowerHandle}`);
      return stale;
    }
    return null;
  }
  await cacheSet(githubKey, github, CACHE_TTL);

  // 2. Fetch Bitbucket stats (if linked + feature enabled)
  let bitbucket: StatsData | null = null;
  if (await isBitbucketEnabled()) {
    bitbucket = await _fetchBitbucketIfLinked(lowerHandle, bitbucketKey);
  }

  // 3. Merge GitHub + Bitbucket
  let stats = github;
  if (bitbucket) {
    stats = mergeStats(github, bitbucket);
    stats.linkedPlatforms = ["bitbucket"];
  }

  // 4. Merge supplemental (EMU) — existing, unchanged
  const supplemental = await cacheGet<SupplementalStats>(`supplemental:${lowerHandle}`);
  if (supplemental) {
    stats = mergeStats(stats, supplemental.stats);
  }

  // 5. Cache merged result
  await cacheSet(mergedKey, stats, CACHE_TTL);
  await cacheSet(staleKey, stats, STALE_TTL);

  void dbUpsertUser(handle).catch(() => {});

  return stats;
}
```

**New helper — `_fetchBitbucketIfLinked()`:**
```typescript
async function _fetchBitbucketIfLinked(
  lowerHandle: string,
  cacheKey: string,
): Promise<StatsData | null> {
  // Try cache first
  const cached = await cacheGet<StatsData>(cacheKey);
  if (cached) return cached;

  // Check if Bitbucket is linked
  const linked = await dbGetLinkedPlatform(lowerHandle, "bitbucket");
  if (!linked) return null;

  // Refresh token if expired
  let { accessToken } = linked.tokens;
  if (isTokenExpired(linked.tokens.expiresAt)) {
    const clientId = process.env.BITBUCKET_CLIENT_ID?.trim();
    const clientSecret = process.env.BITBUCKET_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret || !linked.tokens.refreshToken) {
      // Can't refresh — unlink and skip
      await dbDeleteLinkedPlatform(lowerHandle, "bitbucket");
      return null;
    }
    const refreshed = await refreshBitbucketToken(
      linked.tokens.refreshToken, clientId, clientSecret
    );
    if (!refreshed) {
      // Refresh failed (token revoked) — unlink and skip
      await dbDeleteLinkedPlatform(lowerHandle, "bitbucket");
      return null;
    }
    // Update stored tokens
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    await dbUpdatePlatformTokens(
      lowerHandle, "bitbucket",
      refreshed.access_token, refreshed.refresh_token, expiresAt
    );
    accessToken = refreshed.access_token;
  }

  // Fetch Bitbucket data
  const stats = await fetchBitbucketStats(linked.remoteLogin, accessToken);
  if (stats) {
    await cacheSet(cacheKey, stats, CACHE_TTL);
  }
  return stats;
}
```

### 2. `apps/web/lib/impact/utils.ts`

Update confidence to handle `platform_linked` informational flag:

```typescript
// In computeConfidence(), after the supplemental_unverified check:

// Platform-linked data: informational only (0 penalty)
// Distinguished from supplemental_unverified (which is for unverifiable CLI uploads)
if (stats.linkedPlatforms && stats.linkedPlatforms.length > 0 && !stats.hasSupplementalData) {
  penalties.push({
    flag: "platform_linked",
    penalty: 0,
    reason: CONFIDENCE_REASONS.platform_linked,
  });
  // No score deduction — data is server-verified via OAuth
}
```

**Adjust existing supplemental_unverified logic:**
When data comes from both a linked platform AND supplemental upload, only the supplemental upload gets the -5 penalty (the platform data is verified). The current code already handles this because `hasSupplementalData` is set by `mergeStats()` only when EMU data is merged.

However, we need to ensure that merging Bitbucket data (via the new pipeline) does NOT set `hasSupplementalData: true`. This is handled by the merge in Phase 4: we call `mergeStats(github, bitbucket)` but then set `linkedPlatforms` instead. The `hasSupplementalData` flag is only set when EMU supplemental is merged (existing behavior, unchanged).

**Wait — `mergeStats()` always sets `hasSupplementalData: true`.** We need a small fix:

### 3. `apps/web/lib/github/merge.ts`

Add an optional parameter to control the `hasSupplementalData` flag:

```typescript
// Change signature:
export function mergeStats(
  primary: StatsData,
  supplemental: StatsData,
  options?: { markAsSupplemental?: boolean },
): StatsData {
  // ... existing merge logic unchanged ...
  return {
    // ... all existing fields ...
    hasSupplementalData: options?.markAsSupplemental ?? true,  // default true for backward compat
  };
}
```

Then in `client.ts`:
```typescript
// Bitbucket merge — NOT supplemental (verified platform data)
stats = mergeStats(github, bitbucket, { markAsSupplemental: false });

// EMU merge — IS supplemental (unverified upload)
stats = mergeStats(stats, supplemental.stats); // default true
```

### 4. `apps/web/lib/github/client.test.ts`

Update existing tests and add new ones:

```
describe("getStats — with Bitbucket linked")
  - fetches and merges Bitbucket data when platform is linked
  - skips Bitbucket when feature flag is disabled
  - skips Bitbucket when not linked
  - uses cached Bitbucket data when available
  - refreshes expired token before fetching
  - unlinks platform when refresh fails (token revoked)
  - sets linkedPlatforms: ["bitbucket"] on merged result
  - does NOT set hasSupplementalData when only Bitbucket is merged
  - sets hasSupplementalData when EMU is also merged
  - uses merged cache key (stats:v2:merged:{handle})

describe("cache key migration")
  - reads from stats:v2:merged:{handle} (new key)
  - does not read from stats:v2:{handle} (old key)
```

### 5. `apps/web/lib/github/merge.test.ts`

Add test for new options parameter:

```
describe("mergeStats — markAsSupplemental option")
  - sets hasSupplementalData: true by default (backward compat)
  - sets hasSupplementalData: false when markAsSupplemental: false
  - sets hasSupplementalData: true when markAsSupplemental: true
```

## Cache Invalidation

When a user links/unlinks Bitbucket (Phase 2 routes), these keys are invalidated:
```
cacheDel(`stats:v2:merged:${handle}`)    // force re-merge
cacheDel(`stats:v2:bitbucket:${handle}`) // clear Bitbucket-specific cache
```

The GitHub cache (`stats:v2:github:{handle}`) is NOT invalidated — GitHub data doesn't change when Bitbucket is linked.

## Automated Verification

```bash
pnpm run typecheck 2>&1; pnpm run test -- --run apps/web/lib/github/client.test.ts apps/web/lib/github/merge.test.ts apps/web/lib/impact/utils.test.ts 2>&1; pnpm run lint 2>&1
```

## Success Criteria

- [x] `getStats()` fetches + merges Bitbucket data when platform is linked
- [x] Bitbucket data is cached separately (`stats:v2:bitbucket:{handle}`)
- [x] Merged data is cached at `stats:v2:merged:{handle}`
- [x] Token refresh happens transparently when token is expired
- [x] Platform is unlinked when refresh token is revoked
- [x] `linkedPlatforms: ["bitbucket"]` is set on merged data
- [x] `hasSupplementalData` is NOT set for Bitbucket-only merges
- [x] `platform_linked` confidence flag has 0 penalty (implemented in Phase 1)
- [x] All existing tests still pass (backward compatibility)
- [x] All new tests pass, typecheck clean
