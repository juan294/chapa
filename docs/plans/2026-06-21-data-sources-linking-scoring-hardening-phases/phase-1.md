# Phase 1: Server-Side Link-State Freshness Contract

Parent plan: `docs/plans/2026-06-21-data-sources-linking-scoring-hardening.md`

## Goal

Make successful platform link/unlink operations mark score inputs as changed and clear the cache entries that can hide the new link state.

## Scope

Files expected to change:

- `apps/web/lib/auth/platform-oauth.ts`
- `apps/web/lib/auth/platform-oauth.test.ts`
- Platform route tests under:
  - `apps/web/app/api/auth/bitbucket/`
  - `apps/web/app/api/auth/codeberg/`
  - `apps/web/app/api/auth/gitlab/`

## Implementation Notes

1. Import `markStatsDirty` from `@/lib/cache/dirty-stats`.
2. Replace the fire-and-forget platform cache deletes in callback/disconnect with awaited cache invalidation.
3. On successful link callback:
   - delete `stats:v2:merged:{handle}`
   - delete `stats:v2:{platform}:{handle}`
   - delete `stats:v2:{platform}:{handle}:neg`
   - invalidate same-day badge SVG cache
   - call `markStatsDirty(handle)`
4. On disconnect:
   - call `dbDeleteLinkedPlatform(handle, platform)`
   - delete `stats:v2:merged:{handle}`
   - delete `stats:v2:{platform}:{handle}`
   - delete `stats:v2:{platform}:{handle}:neg`
   - delete `supplemental:{handle}`
   - invalidate same-day badge SVG cache
   - call `markStatsDirty(handle)` only when delete returned `true`
   - return `{ success }`

## Pseudocode

```ts
const lowerHandle = handle.toLowerCase();
await Promise.all([
  cacheDel(`stats:v2:merged:${lowerHandle}`),
  cacheDel(`stats:v2:${config.platform}:${lowerHandle}`),
  cacheDel(`stats:v2:${config.platform}:${lowerHandle}:neg`),
]);
invalidateBadgeSvgCache(handle);
await markStatsDirty(handle);
```

## Automated Verification

Run:

```bash
pnpm exec vitest run apps/web/lib/auth/platform-oauth.test.ts apps/web/app/api/auth/bitbucket/callback/route.test.ts apps/web/app/api/auth/bitbucket/disconnect/route.test.ts apps/web/app/api/auth/codeberg/callback/route.test.ts apps/web/app/api/auth/codeberg/disconnect/route.test.ts apps/web/app/api/auth/gitlab/callback/route.test.ts apps/web/app/api/auth/gitlab/disconnect/route.test.ts
```

Expected:

- Shared callback success test observes dirty marker write.
- Shared callback failure tests observe no dirty marker write.
- Shared disconnect success test observes dirty marker write.
- Shared disconnect DB-failure test observes no dirty marker write.
- Negative platform cache key is deleted on callback and disconnect.

## Manual Verification

Manual OAuth callback verification can wait for Phase 4.

