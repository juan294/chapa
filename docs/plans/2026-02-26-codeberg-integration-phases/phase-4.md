# Phase 4: Merge Pipeline

> Parent: [Codeberg Integration Plan](../2026-02-26-codeberg-integration.md)
> Depends on: Phase 3
> Estimated new files: 0
> Estimated modified files: 1

## Goal

Wire Codeberg data fetching into the `getStats()` pipeline so that linked Codeberg accounts automatically contribute to the badge. Follow the exact pattern of `_fetchBitbucketIfLinked()`.

## Changes

### 1. Add `_fetchCodebergIfLinked()` to `apps/web/lib/github/client.ts`

**New imports at top of file:**

```typescript
import { isCodebergEnabled } from "@/lib/feature-flags";
import { refreshCodebergToken } from "@/lib/auth/codeberg";
import { isTokenExpired } from "@/lib/auth/bitbucket"; // Reuse — same logic
import { fetchCodebergStats } from "@/lib/codeberg/stats";
```

**New function (after `_fetchBitbucketIfLinked`):**

```typescript
/** Fetch Codeberg stats from cache or live API. Returns null if not linked/disabled. */
async function _fetchCodebergIfLinked(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  const cbCacheKey = `stats:v2:codeberg:${lowerHandle}`;

  // Check Codeberg cache first
  const cached = await cacheGet<StatsData>(cbCacheKey);
  if (cached) return cached;

  // Check feature flag
  const enabled = await isCodebergEnabled();
  if (!enabled) return null;

  // Check if user has linked Codeberg
  const linked = await dbGetLinkedPlatform(handle, "codeberg");
  if (!linked) return null;

  let { accessToken } = linked.tokens;
  const { refreshToken, expiresAt } = linked.tokens;

  // Refresh token if expired (only if refresh_token exists)
  if (isTokenExpired(expiresAt)) {
    if (!refreshToken) {
      // No refresh token and token expired — can't recover
      // If expiresAt is null, token may be long-lived — try anyway
      if (expiresAt !== null) {
        void dbDeleteLinkedPlatform(handle, "codeberg");
        return null;
      }
      // expiresAt is null → token might be long-lived, proceed with current token
    } else {
      const clientId = process.env.CODEBERG_CLIENT_ID?.trim() ?? "";
      const clientSecret = process.env.CODEBERG_CLIENT_SECRET?.trim() ?? "";
      const refreshed = await refreshCodebergToken(refreshToken, clientId, clientSecret);

      if (!refreshed) {
        void dbDeleteLinkedPlatform(handle, "codeberg");
        return null;
      }

      accessToken = refreshed.access_token;
      void dbUpdatePlatformTokens(
        handle,
        "codeberg",
        refreshed.access_token,
        refreshed.refresh_token ?? null,
        refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000)
          : null,
      );
    }
  }

  // Fetch Codeberg stats
  const cbStats = await fetchCodebergStats(
    linked.remoteLogin,
    accessToken,
    { displayName: linked.remoteLogin, avatarUrl: "" },
  );

  if (cbStats) {
    await cacheSet(cbCacheKey, cbStats, CACHE_TTL);
  }

  return cbStats;
}
```

**Modify `_fetchAndCache()` to call `_fetchCodebergIfLinked` and merge:**

At `client.ts:88-105` (after Bitbucket merge, before supplemental merge), add:

```typescript
  // Fetch Codeberg data (from cache or live)
  const cbStats = await _fetchCodebergIfLinked(handle, lowerHandle);

  // Merge Codeberg into current stats
  if (cbStats) {
    stats = mergeStats(stats, cbStats, { markAsSupplemental: false });
  }

  // ... existing supplemental merge ...

  // Set linkedPlatforms after all merges
  const linkedPlatforms: string[] = [];
  if (bbStats) linkedPlatforms.push("bitbucket");
  if (cbStats) linkedPlatforms.push("codeberg");
  if (linkedPlatforms.length > 0) {
    stats = { ...stats, linkedPlatforms };
  }
```

This replaces the current hardcoded `linkedPlatforms: ["bitbucket"]` assignment at line 104.

### 2. Update tests in `apps/web/lib/github/client.test.ts`

Add test cases:

```
describe("getStats — Codeberg merge")
  - merges Codeberg stats when linked and enabled
  - skips Codeberg when feature flag disabled
  - skips Codeberg when not linked
  - serves cached Codeberg stats
  - refreshes expired Codeberg token
  - unlinks Codeberg when refresh fails
  - handles long-lived token (no expiry, no refresh_token)
  - sets linkedPlatforms to ["codeberg"] when only Codeberg linked
  - sets linkedPlatforms to ["bitbucket", "codeberg"] when both linked
  - handles Codeberg fetch failure gracefully (returns GitHub-only)
```

## Cache Key Summary (after this phase)

```
stats:v2:merged:{handle}      — Final merged stats (GitHub + Bitbucket + Codeberg + supplemental)
stats:v2:bitbucket:{handle}   — Bitbucket-only stats
stats:v2:codeberg:{handle}    — Codeberg-only stats
stats:stale:{handle}          — Stale fallback for merged
supplemental:{handle}         — EMU supplemental data
```

## Token Expiry Handling

Codeberg/Forgejo OAuth tokens may or may not include `expires_in` and `refresh_token`. The `_fetchCodebergIfLinked()` function handles all cases:

| Token state | `expiresAt` | `refreshToken` | Behavior |
|-------------|------------|----------------|----------|
| Long-lived | `null` | `null` | Proceed with current token (never triggers refresh) |
| Long-lived + refresh | `null` | present | Proceed with current token |
| Expiring + refresh | future Date | present | `isTokenExpired()` → refresh if within 5-min buffer |
| Expired + refresh | past Date | present | Refresh token. On failure → unlink |
| Expired, no refresh | past Date | `null` | Unlink platform (can't recover) |

## Success Criteria

### Automated
- [x] `pnpm run typecheck` passes
- [x] `pnpm run test -- client` passes (new Codeberg merge tests + existing tests green)
- [x] `pnpm run lint` passes

### Manual
- [ ] With Codeberg linked and `NEXT_PUBLIC_CODEBERG_ENABLED=true`:
  - `/u/{handle}/badge.svg` includes merged Codeberg data
  - Cache keys `stats:v2:codeberg:{handle}` and `stats:v2:merged:{handle}` are populated
  - Unlinking Codeberg and refreshing shows GitHub-only data
