# Plan: a saved Studio config reaches the public badge (hotfix v2.29.2)

**Date:** 2026-09-01
**Research:** `docs/research/2026-09-01-studio-save-badge-propagation.md`
**Release shape:** patch release `v2.29.2`, `develop` → `main` merge-commit PR per `docs/release/release-playbook.md`. There is no separate hotfix path; an ordinary release is the hotfix.

## Problem, as measured in production

A Studio `/save` writes the config durably (Supabase `studio_configs`, revision 9 at 20:04:44 UTC), but the badge people actually see did not change:

| layer | state after the save | why |
|---|---|---|
| Supabase | revision 9 | the durable write is awaited |
| Redis SVG cache (origin) | revision 9, eventually | invalidation is launched with `fireAndForget` after the response; it completed this time, and cannot be relied on to |
| Vercel edge cache (canonical URL) | a render from **before** the save, `age: 2254`, `x-vercel-cache: HIT` | the route sets `s-maxage=21600, stale-while-revalidate=86400` and nothing purges the edge |
| GitHub image proxy / browsers | whatever the edge served | client-facing header is bare `cache-control: public` (Vercel strips `s-maxage`) |

Two smaller defects ride along: the success copy still says "Your public badge and share page are unchanged" (pre-#1191 text, `en.ts:1122`, `es.ts:1111`), and nothing in the test suite exercises the save → badge chain (route tests never mock or assert the invalidation; the E2E journey fetches the badge only *before* the save).

## Decision (confirmed with the owner)

**Tag purge on save, with split cache headers.** The edge keeps its 6-hour TTL, so the rate-limit protection it provides is unchanged. Each badge response is tagged per handle, and the one shared invalidation helper purges that tag alongside the Redis keys. Browsers and GitHub's proxy get an explicit `max-age=300` so they recheck every five minutes instead of caching heuristically.

Rejected alternative: shortening the edge TTL to ~5 minutes. Simpler, but leaves a save invisible on the README for up to the TTL, and gives up most of the edge's protective value for every badge, not just the ones that changed.

## Design

### Badge response headers (`app/u/[handle]/badge.svg/route.ts`)

```
Cache-Control:            public, max-age=300                                  ← browsers, GitHub camo
Vercel-CDN-Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400  ← Vercel edge (unchanged policy)
Vercel-Cache-Tag:         badge-<handle lowercased>
```

Vercel's CDN honours `Vercel-CDN-Cache-Control` over `Cache-Control` and strips both `Vercel-*` headers before the response leaves the edge (Vercel docs: "Cache-Control headers", "Purge"). The degraded fallbacks split the same way (`DEADLINE_FALLBACK_HEADERS`: edge `s-maxage=60, swr=300`, client `max-age=60`; load-error fallback: edge `s-maxage=300, swr=600`, client `max-age=60`). The 400 and 500 responses stay uncached and untagged.

### One invalidation, two layers (`lib/render/badge-svg-cache.ts`)

`invalidateBadgeSvgCacheForHandle(handle, date)` keeps its name and callers, and now:

1. deletes the per-locale Redis keys (as today), and
2. purges the edge tag through a new `lib/cache/edge-cache.ts`, which wraps `dangerouslyDeleteByTag` from `@vercel/functions` (v3.9.5, Apache-2.0, on the licence allowlist). Foreground revalidation is the right mode here: one tag maps to one handle's badge, so there is no stampede to fear, and the next viewer must see the new badge rather than trigger a background refresh for the viewer after them.

It returns `{ redis: boolean; edge: "purged" | "skipped" | "failed" }` so callers can tell the user the truth. `edge` is `"skipped"` when `getVercelEnv()` is undefined (local dev, unit tests, CI): there is no edge cache to purge there. A `"failed"` purge is logged and emitted as a `badge_edge_purge_failed` server event; it never throws.

`lib/profile/post-write-invalidation.ts` stops deleting badge keys itself and delegates its `badgeSvg` branch to the shared helper, so refresh, recalculate, insights, supplemental and bulk-recalculate purge the edge too. Platform link/unlink already go through the helper.

### The Studio save awaits it (`app/api/studio/config/route.ts`)

```
const dbResult = await serializeStudioConfigWrite(...)        // unchanged
...
const invalidation = await invalidateBadgeSvgCacheForHandle(normalizedLogin, today)
   (wrapped: a throw → { redis: false, edge: "failed" }, never a failed save)
return NextResponse.json({ success: true, badgeRefreshed: invalidation.redis && invalidation.edge !== "failed" })
```

This matches every sibling write path, which all await their invalidation (`platform-oauth.ts:349-354`, `refresh/route.ts:136`, `recalculate/route.ts:91`). The added latency is two Redis DELs and one Vercel API call, each bounded by its own timeout.

### Copy tells the truth (`lib/i18n/dictionaries/{en,es}.ts`, `StudioClient.tsx`)

| key | en | es |
|---|---|---|
| `studio.save.success` | `Configuration saved. Your public badge and share page now show it.` | `Configuración guardada. Tu Chapa pública y tu página compartida ya la muestran.` |
| `studio.save.successDeferred` (new) | `Configuration saved. Your public badge may take a few hours to update.` | `Configuración guardada. Tu Chapa pública puede tardar unas horas en actualizarse.` |

`StudioClient.handleSave` reads `badgeRefreshed` from the response body and picks the line (warning tone for the deferred case). A response without the field (an older server during a rolling deploy) is treated as `true`.

### Proof, not prose

- `badge-svg-cache.test.ts`: helper deletes every locale key **and** purges `badge-<handle>`; a failed purge is reported, not thrown.
- `edge-cache.test.ts`: `"skipped"` without `VERCEL_ENV`; `"purged"` on success; `"failed"` on throw/timeout with the event captured.
- `studio/config/route.test.ts`: the response is **not** sent until the invalidation promise resolves (deferred-promise test); `badgeRefreshed` mirrors the result; a throwing invalidation still yields 200.
- `badge.svg/route.test.ts`: the three headers on a cache hit and a fresh render; tag lowercased; fallback header splits.
- `e2e/journey.spec.ts`: after the save, fetch `/u/<handle>/badge.svg?after-save=<ts>` and assert the body contains `badge-bg-aurora`, `badge-card-sheen` and `badge-score-paint` (the fixture's non-default choices), and assert they were absent before the save.
- Manual, against the preview deployment of the PR: save in Studio, then `curl -sI https://<preview>/u/<handle>/badge.svg` shows `x-vercel-cache: MISS` on the first hit and the new markers in the body; a second request is a `HIT` with the same body.

### Risk register

| risk | check | fallback |
|---|---|---|
| `dangerouslyDeleteByTag` needs credentials the function does not have | the manual preview check above; a `badge_edge_purge_failed` event on the preview | wire the REST endpoint `POST /v1/edge-cache/invalidate-by-tags` behind a `VERCEL_API_TOKEN` env var, read through `lib/env.ts` |
| `Vercel-Cache-Tag` not honoured on a route handler response | same preview check | same |
| E2E header specs run locally and assert `s-maxage` on `cache-control` | phase 1 updates them | — |
| Redeploy purges the whole edge cache | expected; it is also what clears today's stale copy | — |

## Phases

| # | name | depends on | batch |
|---|---|---|---|
| 1 | Edge purge + shared invalidation + tagged badge headers | — | — |
| 2 | Studio save awaits, reports, and says so; E2E proves it | 1 (return type of the helper) | — |
| 3 | Docs, ADR, CHANGELOG, version, release | 1, 2 | — |

Phases 1 and 2 touch disjoint files, but 2 consumes the return type 1 defines, so they run in order. No phase is `[batch-eligible]`.

Phase files: `docs/plans/2026-09-01-studio-save-badge-hotfix-phases/phase-{1,2,3}.md`.

## Out of scope, filed as follow-ups (not in the hotfix)

- The OG image route caches its PNG under its own key for 48h and with the same 6h edge policy; a Studio save does not invalidate it. Same fix shape (tag `og-<handle>`, purge from the helper), separate change.
- `scripts/recalculate-handles.ts:184` carries a stale copy of `BADGE_RENDER_VARIANT` (`warm-amber-v3`).
- `badge-svg-cache.ts:70-78` doc comment says `DEFAULT_LOCALE` is `'es'`; it is `'en'`.
- A rule for when to use `fireAndForget` vs `after()` vs awaiting on Vercel does not exist anywhere in `docs/` or `.claude/rules/`.

## Success criteria

**Automated** (all must be green locally before push, then in CI):
`pnpm run test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:circular`, `pnpm run check:licenses`, `pnpm run check:write-registration`, `pnpm run test:e2e -- --grep @release-required`, plus the journey spec against local Supabase.

**Manual** (on the PR's preview deployment, before Gate 2 of the release):
1. Save a non-default config in Studio; the log line reads the new success copy.
2. `curl -sI <preview>/u/<handle>/badge.svg` → `x-vercel-cache: MISS`, then `HIT`; the body carries the saved config's markers.
3. `cache-control` on the client response reads `public, max-age=300`.
4. No `badge_edge_purge_failed` event for the handle in PostHog / server logs.
