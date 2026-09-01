# Research: how a saved Studio config reaches (or does not reach) the public badge

**Date:** 2026-09-01
**Question:** Studio `/save` reports "Preview configuration saved. Your public badge and share page are unchanged." and the saved config appears not to reach `/u/:handle/badge.svg` in production. Trace the save path, the invalidation, the render path, the cache layers, the success copy and the existing test coverage.
**Scope:** documentary. This file records what exists and what was measured. It proposes nothing.

---

## 1. Production evidence (measured 2026-09-01, 20:20–20:26 UTC)

Production deployment: `dpl_J1yURiYhcm6HAMx17Pi9cKwG1NMU`, commit `ec836a18` (v2.29.1), region `iad1`. `develop` and `main` point at the same commit (`git log main..develop` is empty).

### 1.1 The durable write succeeded

Supabase `studio_configs` row for `juan294`:

| column | value |
|---|---|
| `config` | `{"border":"gradient-rotating","cardStyle":"frost","background":"solid","scoreEffect":"holographic","colorPalette":"indigo","tierTreatment":"enhanced","heatmapAnimation":"ripple"}` |
| `updated_at` | `2026-09-01 20:04:44.884392+00` |
| `revision` | `9` |

Vercel runtime logs for the deployment show three `PUT /api/studio/config 200` at 20:04:10, 20:04:15 and 20:04:44 UTC. No `error` or `warning` level log lines exist for the deployment between 19:40 and 20:26 UTC, so no `[fire-and-forget]` failure was logged (`apps/web/lib/async/fire-and-forget.ts:5-7` logs at `console.error`).

### 1.2 The origin (Chapa's Redis SVG cache) now serves revision 9

A request with a never-before-seen query string bypasses Vercel's edge cache and reaches the function:

```
GET /u/juan294/badge.svg?probe=<epoch>
x-vercel-cache: MISS
server-timing: cache;desc="hit";dur=199, total;dur=199
```

`cache;desc="hit"` is the badge route's own Redis hit marker (`apps/web/app/u/[handle]/badge.svg/route.ts:472-475`). The returned SVG contains every marker of the revision-9 config:

| config key | value | marker in SVG | count |
|---|---|---|---|
| `colorPalette` | `indigo` | `#9BAAFF` accent (`lib/render/theme.ts:94-97`) / `rgba(155, 170, 255, …)` | 20 / 107 |
| `colorPalette` | `indigo` | ground `#090C1D` | 6 |
| `border` | `gradient-rotating` | `id="badge-border-gradient"` + `#F59E0B` stop (`lib/render/badge-effects.ts:48,79-82`) | 1 def + 1 use |
| `cardStyle` | `frost` | `id="badge-card-sheen"` + `#E0F2FE` stops (`badge-effects.ts:281,303`) | 1 def + 1 use |
| `scoreEffect` | `holographic` | `id="badge-score-paint"` + `#F472B6` stops (`badge-effects.ts:153,237-246`) | 1 def + 1 use |
| default jade accent | — | `#1BD093` | 0 |

The same holds for `?lang=en` (also `x-vercel-cache: MISS`, 20 indigo markers).

### 1.3 The canonical URL is served by Vercel's edge from before the save

```
GET /u/juan294/badge.svg          (no query string — the README embed URL)
x-vercel-cache: HIT
age: 2254
cache-control: public
server-timing: cache;desc="hit";dur=201, total;dur=201
x-vercel-id: cdg1::iad1::…
```

`age: 2254` at 20:24 UTC means the edge copy was stored at ~19:46 UTC, eighteen minutes before the first save. The runtime log corroborates it: `GET /u/juan294/badge.svg 200 [static] cache=HIT` at 19:46:23, and every canonical-URL request since has been an edge HIT (20:06:34, 20:13:44, 20:23:56), including the one at 20:06:34 that corresponds to the user's GitHub README screenshot (taken 22:05:53 local, UTC+2).

That edge copy's content:

| marker | count |
|---|---|
| indigo accent `#9BAAFF` | 18 |
| `badge-border-gradient` | 0 |
| `badge-card-sheen` | 0 |
| `badge-score-paint` | 0 |
| jade accent `#1BD093` | 0 |

So the edge holds a render of an earlier config revision (indigo palette, default border / card / score), not revision 9.

The `Server-Timing` header on the edge HIT is the one that was captured with the cached body at 19:46; it does not describe the current request.

### 1.4 Cache layers between a save and a README

| layer | keyed by | TTL / policy | cleared by a Studio save? | evidence |
|---|---|---|---|---|
| Redis SVG cache | `badge:v2:<handle>:jade-v1:<date>:<locale>` (`lib/render/badge-svg-cache.ts:79-85`) | 24h + 0–2h per-handle jitter (`:35-36`, `:174-175`) | yes, via `invalidateBadgeSvgCacheForHandle` launched with `fireAndForget` (`app/api/studio/config/route.ts:152-154`) | §1.2: now serves revision 9 |
| Vercel edge (CDN) | full URL incl. query string, per PoP (`cdg1` above) | `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` set by the route (`badge.svg/route.ts:102-111`) | no — nothing in the repo purges or tags the CDN (no `Cache-Tag`, `Vercel-CDN-Cache-Control`, or purge API call anywhere under `apps/web`) | §1.3: serves the 19:46 copy |
| GitHub camo proxy | image URL | GitHub-controlled | no | not measured here |

Vercel strips `s-maxage`/`stale-while-revalidate` from the client-facing header, which is why the response shows only `cache-control: public`.

---

## 2. The save path — `PUT /api/studio/config`

`apps/web/app/api/studio/config/route.ts`

1. Feature flag check `isStudioEnabled()` (`:88-90`), session via `requireRequestSession` (`:92-93`).
2. Body parsed (`:96-101`), `stripRetiredBadgeConfigKeys` then `isValidBadgeConfig` (`:107-110`).
3. Rate limit 30/hour/user (`:113-119`).
4. Durable write, serialized per lowercase login within the instance: `serializeStudioConfigWrite(normalizedLogin, () => dbUpsertStudioConfig(normalizedLogin, config))` (`:121-124`; helper `:16-38`).
5. `dbUpsertStudioConfig` (`apps/web/lib/db/studio.ts:98-143`) upserts `{handle, config, updated_at}` with `onConflict: "handle"`; a `23505` is treated as success (`:128`). The `revision` column is bumped by the migration-035 trigger, not by this code (module header `:19-24`; `dbGetStudioConfig` validates it at `:194-200`).
6. Failure mapping: `constraint` → 400 (`:126-131`), `unavailable` → 503 (`:133-138`), other → 500 (`:140-145`).
7. Invalidation, **not awaited**:
   ```ts
   fireAndForget(() =>
     invalidateBadgeSvgCacheForHandle(normalizedLogin, toDateString(new Date())),
   );
   return NextResponse.json({ success: true });
   ```
   (`:152-156`). The comment above it (`:147-151`) says: "Fire-and-forget: a failed invalidation leaves a stale badge until the day rolls over, which is the same self-healing risk the platform link/unlink path already accepts, and is not worth failing a save over."

`fireAndForget` (`apps/web/lib/async/fire-and-forget.ts:3-14`) is synchronous: `void fn().catch(onError)` inside a `try`. It registers nothing with the runtime. Default `onError` is `console.error("[fire-and-forget]", error)`.

`invalidateBadgeSvgCacheForHandle` (`apps/web/lib/render/badge-svg-cache.ts:194-203`) runs `Promise.all(SUPPORTED_LOCALES.map(locale => cacheDel(buildBadgeSvgCacheKey(handle, date, locale))))`. `cacheDel` (`apps/web/lib/cache/redis.ts:147-156`) returns silently when Redis is unconfigured and logs + swallows on error.

The route does not call `revalidatePath`, `after()`, or any CDN purge.

### 2.1 How the sibling write paths launch the same invalidation

| path | mechanism | file:line |
|---|---|---|
| Studio save | `fireAndForget` | `app/api/studio/config/route.ts:152` |
| Platform link (OAuth callback) | `await Promise.all([invalidatePlatformReadModels(...), markStatsDirty(handle)])` then `revalidateSharePage` | `lib/auth/platform-oauth.ts:349-354` |
| Platform unlink | `await Promise.all([invalidation, markStatsDirty(handle)])` / `await invalidation` then `revalidateSharePage` | `lib/auth/platform-oauth.ts:406-414` |
| `/api/refresh` | awaited `invalidateProfileReadModels(handle, {badgeSvg, snapshot, history})` then `revalidatePath` | `app/api/refresh/route.ts:136,150` |
| `/api/recalculate` | awaited, same flags, then `revalidatePath` | `app/api/recalculate/route.ts:91,103` |
| `/api/insights` | inside `after(async () => { await invalidateProfileReadModels(...); revalidatePath(...) })` | `app/api/insights/route.ts:103-113` |
| `/api/supplemental`, `/api/admin/bulk-recalculate` | awaited `invalidateProfileReadModels` with `badgeSvg: true` | `app/api/supplemental/route.ts:124`, `app/api/admin/bulk-recalculate/route.ts:160,166` |

`invalidateProfileReadModels` (`apps/web/lib/profile/post-write-invalidation.ts:25-67`) deletes the per-locale badge keys sequentially through `runInvalidationStep`, which swallows errors (`:17-23`). `platform-oauth.ts:70-75` wraps `invalidateBadgeSvgCacheForHandle` in a local helper and awaits it.

No `waitUntil` from `@vercel/functions` is imported anywhere in the repo. Four files import `after` from `next/server`: `app/api/insights/route.ts:1`, `app/u/[handle]/badge.svg/route.ts:1`, `app/u/[handle]/page.tsx:2`, `lib/analytics/schedule-server-event.ts:1`.

### 2.2 What the repo says about post-response work on Vercel

- `docs/plans/2026-07-03-reliability-hardening-phases/phase-4.md:52-57`: "a serverless freeze after the response flushes can truncate it → lost lifetime history" (about a durable write inside `after()`).
- `docs/accepted-risks.md:274-277` ("Post-response side effects in badge route"): `after()` side effects are absorbed by `Promise.allSettled` with "no retry and no alert".
- `docs/decisions/2026-06-20-deployment-stack.md:49`: `after()` support is cited as a reason to host on Vercel.
- No file in `docs/decisions/`, `.claude/rules/` or `CLAUDE.md` states when to use `fireAndForget` versus `after()`.

---

## 3. The render path — where the config is read

`resolveBadgeConfig(handle)` (`apps/web/lib/render/badge-config.ts:25-32`) calls `dbGetStudioConfig(handle)` and returns the saved config on `status === "found"`, otherwise `DEFAULT_BADGE_CONFIG`; any throw also yields the default. Its doc comment (`:19-23`) states it is "deliberately called on the RENDER path only, never before a cache lookup … Freshness comes from invalidation instead."

Four sites call it, and `lib/render/badge-config.test.ts:52-71` asserts each source file contains `resolveBadgeConfig` and a `config[:,]` argument:

| site | call | cache behaviour |
|---|---|---|
| badge route | `finalizeMaterializedBadge` → `resolveBadgeConfig(handle)` (`badge.svg/route.ts:311`), render with `disableAnimation: true` (`:314-326`) | primary read `readBadgeSvgCacheWithStatus(svgCacheKey)` (`:469-475`) returns on hit before any config read; on miss the write happens in `after()` via `persistFinalizedBadgeCache` (`:677-692`) |
| share page | `renderBadgeSvg(..., { config: await resolveBadgeConfig(handle), ... })` (`app/u/[handle]/page.tsx:255-265`) | `readBadgeSvgCache(svgCacheKey)` first (`:217`); renders inline only when `!cachedSvg` (`:240`); writes the cache in `after()` (`:288-306`). Page is implicitly dynamic (awaits `searchParams` `:110` and `headers()` `:213`); its `<img>` points at `badge.svg?v=<stats.fetchedAt>&lang=<locale>` (`:324-330`) |
| OG image | `resolveBadgeConfig(handle)` (`app/u/[handle]/og-image/route.ts:99`) | its own key `og-image:v3:<handle>:<date>:<locale>` (`:52`), 48h TTL; never touches the SVG key |
| warm-cache cron | `resolveBadgeConfig(handle)` (`app/api/cron/warm-cache/route.ts:498`) | `existingSvg = await readBadgeSvgCache(svgCacheKey)` (`:480`); renders and writes **only when `existingSvg === null`** (`:482-512`); warms `DEFAULT_LOCALE` only (`:478`) |

The Redis SVG cache key is `badge:${CACHE_VERSION}:${handle}:${BADGE_RENDER_VARIANT}:${date}:${locale}` with `CACHE_VERSION = "v2"` (`lib/cache/version.ts`) and `BADGE_RENDER_VARIANT = "jade-v1"` (`badge-svg-cache.ts:21`). It carries nothing about the config or its revision. `docs/decisions/2026-08-30-one-badge-artifact.md:118-130` records why: putting the revision in the key would put a Supabase round-trip in front of the 800ms cache-hit budget, so "the mechanism is invalidation, not keying".

The Studio page itself reads config through `loadStudioConfig(session.login)` (`app/studio/page.tsx:121`), not `resolveBadgeConfig`, and `BadgePreviewCard.tsx` renders `renderBadgeSvg` in the browser (`:61-72`) with no cache involvement.

---

## 4. The success copy

`apps/web/lib/i18n/dictionaries/en.ts:1122`:

```
success: 'Preview configuration saved. Your public badge and share page are unchanged.',
```

`apps/web/lib/i18n/dictionaries/es.ts:1111`:

```
success: 'Configuración de vista previa guardada. Tu Chapa pública y tu página compartida no cambian.',
```

Consumed at `apps/web/app/studio/StudioClient.tsx:388` (`handleSave`, `:344-402`) when the PUT returns `res.ok` and no newer local edit exists; asserted verbatim in `StudioClient.render.test.tsx:1187` and `:1217`.

History:
- Introduced by `fd1290db` "fix(studio): prevent stale cross-instance saves" (2026-08-26), replacing `'Configuration saved.'`. Released in v2.23.0 (`4f6265c3`); `CHANGELOG.md:456` describes it as "save copy now identifies the preview-only boundary".
- `03de872b` "feat(badge): the saved Studio config now reaches the badge people embed" (2026-08-30, #1191 step 3) changed the behaviour — "saving a config invalidates the rendered badge" — across 14 files and touched neither dictionary. `git blame` still attributes `en.ts:1122` to `fd1290db`.
- `405e2a91` "docs: a saved Studio config now does reach the public badge (#1191)" corrected the same stale claim in `CLAUDE.md` only.
- Still carrying the pre-#1191 claim: `docs/user-manual.md:274` ("it does not change the public SVG badge") and `docs/user-manual.md:679` (QA checklist quoting the message). `README.md:96` was already corrected to "A saved Studio configuration changes the public SVG badge and share page and invalidates the badge cache."

---

## 5. Test coverage of the save → badge chain

- `apps/web/app/api/studio/config/route.test.ts` and `route.contract.test.ts`: neither references `invalidateBadgeSvgCacheForHandle` or `@/lib/render/badge-svg-cache`. Both mock `@/lib/cache/redis` as `{ rateLimit: mockRateLimit }` only (`route.test.ts:32-34`, `route.contract.test.ts:17-19`). `badge-svg-cache.ts:7` imports `cacheDel` from that module, so under these tests `cacheDel` is `undefined`; the resulting TypeError is raised inside the `fireAndForget` callback and absorbed by its default `console.error` handler. The tests pass.
- `apps/web/lib/render/badge-svg-cache.test.ts` and `apps/web/lib/auth/platform-oauth.test.ts` cover `invalidateBadgeSvgCacheForHandle` itself and the platform-oauth caller.
- `apps/web/lib/render/badge-config.test.ts:52-71` asserts the four render sites reference `resolveBadgeConfig` (string match on source).
- `apps/web/app/u/[handle]/badge.svg/route.test.ts:103-123` mocks `next/server`'s `after` and flushes the callbacks; `app/api/insights/route.test.ts:87-93` runs `after` inline.
- E2E `apps/web/e2e/journey.spec.ts`: fetches the badge once **before** the save (`:92-97`, asserts 200 + `<svg`), saves via `fetch("/api/studio/config", { method: "PUT" })` in the browser (`:100`, helper `:273-292`), visits the share page and asserts handle text + "Markdown|HTML" (`:103-109`), then asserts the Supabase row matches the saved config (`:147-148`). It never fetches the badge after the save and never inspects the SVG body for config markers.

---

## 6. Related facts

- `scripts/recalculate-handles.ts:184` carries its own copy `BADGE_RENDER_VARIANT = "warm-amber-v3"` and deletes badge keys over the raw Redis REST API (`:372-375`); `badge-svg-cache.ts:21` is `"jade-v1"`.
- `badge-svg-cache.ts:70-78` doc comment says `DEFAULT_LOCALE` is `'es'`; `lib/i18n/types.ts:15` sets it to `'en'` (#1201).
- `apps/web/vercel.json` schedules `warm-cache` at `0 * * * *` (hourly). Because the cron writes only when the Redis slot is empty (`warm-cache/route.ts:482`), it does not replace an existing Redis entry.
- `docs/release/release-playbook.md` has no hotfix or patch-release section; the release topology is `develop` → `main` merge commit then tag (`:10`), with two approval gates (`:16-22`). Rollback lives in `docs/runbooks/rollback.md`.
- Studio route tests and the ADR both describe the failure mode of a lost invalidation as "stale until the day rolls over" (`route.ts:149-150`, ADR `:132-134`). Neither mentions the Vercel edge layer; the edge TTL is documented separately in `CLAUDE.md:186-187`, `docs/decisions/2026-06-20-deployment-stack.md:52-55`, and `docs/research/2026-03-08-score-stasis-solution-space.md:225-232` ("CDN-cached badges persist for up to 6 hours").

---

## 7. Files read in full for this document

- `apps/web/app/api/studio/config/route.ts`
- `apps/web/lib/async/fire-and-forget.ts`
- `apps/web/lib/render/badge-config.ts`
- `apps/web/lib/render/badge-svg-cache.ts`
- `apps/web/app/u/[handle]/badge.svg/route.ts`
- `apps/web/lib/db/studio.ts`
- `apps/web/lib/render/badge-effects.ts`
- `apps/web/lib/profile/post-write-invalidation.ts`
- `apps/web/e2e/journey.spec.ts` (lines 1–160, 273–292, 466–476)
- `apps/web/app/u/[handle]/page.tsx` (lines 205–345)
- `apps/web/app/api/cron/warm-cache/route.ts` (lines 463–517)
- `docs/decisions/2026-08-30-one-badge-artifact.md` (lines 99–138)
