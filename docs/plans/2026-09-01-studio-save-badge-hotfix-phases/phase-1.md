# Phase 1 — Edge purge, shared invalidation, tagged badge headers

Parent plan: `../2026-09-01-studio-save-badge-hotfix.md`. Depends on nothing. Not batch-eligible (phase 2 consumes the return type defined here).

## Goal

Every path that invalidates a handle's badge clears **both** cache layers, and every badge response is tagged so the edge layer can be cleared. Behaviour for the default badge is otherwise unchanged.

## Files

| file | change |
|---|---|
| `apps/web/package.json` | add `"@vercel/functions": "^3.9.5"` to `dependencies` (Apache-2.0, on the allowlist) |
| `apps/web/lib/cache/edge-cache.ts` | **new** — tag builder + purge wrapper |
| `apps/web/lib/cache/edge-cache.test.ts` | **new** |
| `apps/web/lib/render/badge-svg-cache.ts` | `invalidateBadgeSvgCacheForHandle` purges the tag and returns a result |
| `apps/web/lib/render/badge-svg-cache.test.ts` | extend the `#1191` describe block |
| `apps/web/lib/profile/post-write-invalidation.ts` | `badgeSvg` branch delegates to the shared helper |
| `apps/web/lib/profile/post-write-invalidation.test.ts` | assert delegation |
| `apps/web/app/u/[handle]/badge.svg/route.ts` | split headers + tag |
| `apps/web/app/u/[handle]/badge.svg/route.test.ts` | header assertions |
| `apps/web/e2e/badge-endpoint.spec.ts`, `apps/web/e2e/integration.spec.ts` | header assertions |

## Steps

### 1.1 `lib/cache/edge-cache.ts` (new)

```ts
import { dangerouslyDeleteByTag } from "@vercel/functions";
import { getVercelEnv } from "@/lib/env";
import { withTimeout } from "@/lib/async/with-timeout";
import { captureServerEvent } from "@/lib/analytics/server-errors";

export type EdgePurgeOutcome = "purged" | "skipped" | "failed";
export const EDGE_PURGE_DEADLINE_MS = 1_500;

/** One tag per handle. Lowercased the same way buildBadgeSvgCacheKey lowercases. */
export function badgeEdgeCacheTag(handle: string): string {
  return `badge-${handle.toLowerCase()}`;
}

/**
 * Purge every edge-cached response carrying `tag`, with foreground revalidation
 * on the next request. Outside Vercel there is no edge cache: "skipped".
 * Never throws — a purge that fails is reported so the caller can say so.
 */
export async function purgeEdgeCacheTag(tag: string): Promise<EdgePurgeOutcome> {
  if (!getVercelEnv()) return "skipped";
  try {
    await withTimeout(dangerouslyDeleteByTag(tag), EDGE_PURGE_DEADLINE_MS, "edge cache purge");
    return "purged";
  } catch (error) {
    console.error("[edge-cache] purge failed:", tag, error instanceof Error ? error.message : error);
    void captureServerEvent("badge_edge_purge_failed", { tag, message: ... });
    return "failed";
  }
}
```

Check `captureServerEvent`'s signature at `lib/analytics/server-errors.ts:167` and match it. No `process.env` access here — `getVercelEnv` is the allowlisted reader (`no-process-env` lint rule).

Tests (`edge-cache.test.ts`), mocking `@vercel/functions`, `@/lib/env`, `@/lib/analytics/server-errors`:
- `getVercelEnv` → `undefined` ⇒ `"skipped"`, `dangerouslyDeleteByTag` not called.
- resolves ⇒ `"purged"`, called with the exact tag.
- rejects ⇒ `"failed"`, event captured with the tag, no throw.
- never resolves ⇒ `"failed"` after the deadline (use fake timers).
- `badgeEdgeCacheTag("MixedCase")` === `"badge-mixedcase"`.

### 1.2 `lib/render/badge-svg-cache.ts`

```ts
export interface BadgeInvalidationResult { redis: boolean; edge: EdgePurgeOutcome }

export async function invalidateBadgeSvgCacheForHandle(handle, date): Promise<BadgeInvalidationResult> {
  const [redisSettled, edge] = await Promise.all([
    Promise.allSettled(SUPPORTED_LOCALES.map(locale => cacheDel(buildBadgeSvgCacheKey(handle, date, locale)))),
    purgeEdgeCacheTag(badgeEdgeCacheTag(handle)),
  ]);
  return { redis: redisSettled.every(r => r.status === "fulfilled"), edge };
}
```

`cacheDel` already swallows Redis errors (`lib/cache/redis.ts:147-156`), so `redis` is `false` only if something outside it throws; keep the `allSettled` anyway so one locale cannot hide another. Update the doc comment (`:183-193`) to name both layers and the two triggers plus the five `invalidateProfileReadModels` callers. While there, correct the `DEFAULT_LOCALE` remark at `:70-78` (it is `'en'`).

Tests: extend `describe("invalidateBadgeSvgCacheForHandle (#1191)")` (`badge-svg-cache.test.ts:281`), mocking `@/lib/cache/edge-cache`:
- still deletes one key per locale (existing tests pass unchanged apart from the return value);
- calls `purgeEdgeCacheTag("badge-octocat")` exactly once;
- returns `{ redis: true, edge: "purged" }` / `{ redis: true, edge: "failed" }` as the mock dictates;
- a Redis `cacheDel` rejection yields `redis: false` and still purges the edge.

### 1.3 `lib/profile/post-write-invalidation.ts`

Replace the `badgeSvg` loop (`:43-54`) with:

```ts
if (options.badgeSvg) {
  await runInvalidationStep(async () => {
    await invalidateBadgeSvgCacheForHandle(normalizedHandle, toDateString(new Date()));
  });
}
```

Drop the now-unused imports (`buildBadgeSvgCacheKey`, `SUPPORTED_LOCALES`) — the `no dead code` rule. `madge` (`pnpm run check:circular`) must stay green: `post-write-invalidation` → `badge-svg-cache` → `edge-cache` → `env`/`server-errors` introduces no cycle (verify `server-errors.ts` does not import from `lib/profile`).

Test: in `post-write-invalidation.test.ts`, mock `@/lib/render/badge-svg-cache` and assert `badgeSvg: true` calls `invalidateBadgeSvgCacheForHandle(handle, <today>)` once and `badgeSvg: false` never does. Remove any assertion that enumerated per-locale `cacheDel` calls for badge keys.

### 1.4 `app/u/[handle]/badge.svg/route.ts`

Add one builder and use it for the three cached response shapes:

```ts
import { badgeEdgeCacheTag } from "@/lib/cache/edge-cache";

const BADGE_EDGE_POLICY   = "public, s-maxage=21600, stale-while-revalidate=86400";
const BADGE_CLIENT_POLICY = "public, max-age=300";

function badgeCacheHeaders(handle: string, edgePolicy = BADGE_EDGE_POLICY, clientPolicy = BADGE_CLIENT_POLICY) {
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": clientPolicy,
    "Vercel-CDN-Cache-Control": edgePolicy,
    "Vercel-Cache-Tag": badgeEdgeCacheTag(handle),
    "Content-Security-Policy": "frame-ancestors *",
    "X-Frame-Options": "ALLOWALL",
  };
}
```

- `CACHE_HEADERS` (`:102-111`) → `badgeCacheHeaders(handle)` at every use (`:473`, `:562`, `:575`, `:694`). `handle` is in scope in `GET`; the constant must become a per-request value.
- `DEADLINE_FALLBACK_HEADERS` (`:81-84`) → `badgeCacheHeaders(handle, "public, s-maxage=60, stale-while-revalidate=300", "public, max-age=60")`.
- Load-error fallback (`:648-651`) → `badgeCacheHeaders(handle, "public, s-maxage=300, stale-while-revalidate=600", "public, max-age=60")`.
- The 400 (`:450-460`) and 500 (`:702-706`) responses: unchanged, no tag.

Keep the comment block explaining why the two `frame-ancestors` headers are set on the Response (#270), and add three lines: why the policies are split (Vercel strips `s-maxage` from `Cache-Control` before the client sees it, so browsers and GitHub's image proxy were caching heuristically), and that the tag is what `invalidateBadgeSvgCacheForHandle` purges.

Tests (`badge.svg/route.test.ts`): the existing assertions at `:405-406` and `:980-985` change to the new header names/values. Add: cache-hit and fresh-render responses carry `Vercel-Cache-Tag: badge-<lowercased handle>` and `Vercel-CDN-Cache-Control` equal to the edge policy; `Cache-Control` equals `public, max-age=300`; the 400 response has no `Vercel-Cache-Tag`.

### 1.5 E2E header specs (run locally through `webServer`)

`badge-endpoint.spec.ts:33-35` and `integration.spec.ts:72-75` assert `s-maxage` / `stale-while-revalidate` on `cache-control`. Change them to assert `cache-control` contains `public` and `max-age`. Do **not** assert the `Vercel-*` headers in E2E: they are present against the local server but stripped by the platform when `PLAYWRIGHT_BASE_URL` points at a deployment.

## Verification

```
pnpm install
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run check:circular
pnpm run check:licenses
```

Then, on this phase's preview deployment (push the branch, open a draft PR into `develop`):

```
curl -sI https://<preview>/u/<handle>/badge.svg | grep -i 'cache-control\|x-vercel-cache'
```

must show `cache-control: public, max-age=300`. The purge itself is exercised end-to-end in phase 2.

## Done when

- All automated checks green.
- Preview shows the split client header.
- Commit message: `fix(badge): purge the Vercel edge cache when a badge is invalidated` with `Refs #1191` and the issue number opened for this incident.
