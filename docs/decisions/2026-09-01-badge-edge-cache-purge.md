# Badge invalidation purges the Vercel edge cache, not just Redis

- **Date**: 2026-09-01
- **Status**: Accepted
- **Issue**: #1191 hotfix, v2.29.2
- **Research**: `docs/research/2026-09-01-studio-save-badge-propagation.md`

## Context

Measured in production 2026-09-01, 20:20–20:26 UTC, on deployment `dpl_J1yURiYhcm6HAMx17Pi9cKwG1NMU`
(commit `ec836a18`, v2.29.1). Three `PUT /api/studio/config 200` for `juan294`
at 20:04:10, 20:04:15 and 20:04:44 UTC; Supabase `studio_configs.revision`
reached 9 with no `error`/`warning` log lines for the deployment in that
window — the durable write and the fire-and-forget invalidation both
succeeded.

Two different answers came back from two different badge requests taken
seconds apart:

- `GET /u/juan294/badge.svg?probe=<epoch>` (a never-before-seen query string,
  so it bypasses Vercel's edge and reaches the function): `x-vercel-cache:
  MISS`, and the body carries every marker of revision 9 (the indigo palette
  accent, the border/card/score effect gradient IDs).
- `GET /u/juan294/badge.svg` (no query string — the actual README embed URL):
  `x-vercel-cache: HIT`, `age: 2254`, `cache-control: public`. Age 2254 at
  20:24 UTC puts the cached copy at ~19:46 UTC, eighteen minutes before the
  first save. Its body carries none of the revision-9 markers.

So Chapa's own Redis SVG cache was correct. Vercel's edge cache — a second,
independent cache layer keyed by the full URL per PoP, populated by the
route's `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`
— was not cleared by anything in the repo. No file under `apps/web` set a
`Cache-Tag`, a `Vercel-CDN-Cache-Control` header, or called a purge API.
`age: 2254` also explains the client-visible `cache-control: public` with no
`s-maxage`: Vercel strips both `s-maxage` and `stale-while-revalidate` from
`Cache-Control` before the response leaves the edge, so the client was never
carrying a real caching signal — only Vercel's internal one, invisible and
unpurged.

The existing ADR (`docs/decisions/2026-08-30-one-badge-artifact.md`) chose
invalidation over cache-keying specifically to keep the cache-hit path a
single Redis read, and named the accepted risk as "an invalidation that fails
leaves a stale badge until the day rolls over — self-healing and cheap." That
risk analysis covered only the layer it was written against. A second,
independent cache with its own six-hour TTL and no invalidation path at all
is not the same risk.

## Decision

**Tag purge on save, with split cache headers.** The edge keeps its 6-hour
TTL — the rate-limit protection it provides for every unmodified badge is
unchanged. Only a handle whose badge actually changed gets purged.

- Every badge response carries a per-handle `Vercel-Cache-Tag:
  badge-<handle lowercased>` (`badgeEdgeCacheTag`, `lib/cache/edge-cache.ts`).
- The response splits `Cache-Control` (what browsers and GitHub's camo proxy
  see: `public, max-age=300` — a short, explicit, honest signal) from
  `Vercel-CDN-Cache-Control` (what Vercel's edge honours: the unchanged
  `s-maxage=21600, stale-while-revalidate=86400` policy). Vercel strips both
  `Vercel-*` headers before the response leaves the edge.
- `invalidateBadgeSvgCacheForHandle` (`lib/render/badge-svg-cache.ts`) — the
  one shared helper every invalidation trigger already called — now also
  purges that tag via `purgeEdgeCacheTag`, which wraps `dangerouslyDeleteByTag`
  from `@vercel/functions` (v3.9.5, Apache-2.0). Foreground revalidation, not
  the eventually-consistent `invalidateByTag`: one tag maps to one handle's
  badge, so there is no stampede to fear, and the point of the purge is that
  the very next viewer must see the new badge, not a viewer after that.
- The Studio save (`app/api/studio/config/route.ts`) awaits the invalidation
  instead of launching it with `fireAndForget`, and returns `badgeRefreshed`
  in its response so the client can say what actually happened instead of
  claiming success unconditionally.
- `lib/profile/post-write-invalidation.ts`'s `badgeSvg` branch delegates to
  the same shared helper, so refresh, recalculate, insights, supplemental and
  bulk-recalculate purge the edge too, with no per-caller opt-in.

## Rejected

- **Shortening the edge TTL** (e.g. to ~5 minutes) instead of purging.
  Simpler, but every badge — not just the ones a Studio save actually
  changed — loses most of the edge's protective value, and a save is still
  invisible on the README for up to the shortened TTL rather than instantly.
- **Putting the config revision in the badge cache key.** Already rejected in
  `docs/decisions/2026-08-30-one-badge-artifact.md` and still true here: it
  would put a Supabase round-trip in front of the 800ms cache-hit SLO budget
  for every request, not just the ones following a save.

## Consequences

- The Studio save response gains a `badgeRefreshed: boolean` field; the
  success copy (`studio.save.success` / new `studio.save.successDeferred`)
  now tells the truth about whether the public badge already reflects the
  save, instead of unconditionally claiming it does.
- A redeploy still purges the entire edge cache (a Vercel platform behavior,
  unrelated to this change) — that already cleared the 2026-09-01 19:46 UTC
  stale copy once v2.29.2 shipped, independent of the tag purge.
- Outside a Vercel deployment (local dev, unit tests, CI) `purgeEdgeCacheTag`
  returns `"skipped"` without calling the SDK — there is no edge cache there.
  A failed purge is reported (`"failed"`, a `badge_edge_purge_failed` server
  event) and logged, never thrown — a purge failure must not fail the
  underlying save or refresh.
- The OG image route (`og-image:v3:<handle>:<date>:<locale>`, 48h TTL, its
  own 6h edge policy) is not covered by this change — a Studio save does not
  invalidate it. Same fix shape (a `og-<handle>` tag purged from the same
  helper), filed as a follow-up rather than folded into this hotfix.

## Rule going forward

A cache invalidation triggered by a user-visible action (a save, a refresh, a
link/unlink) is **awaited**, never `fireAndForget`. `fireAndForget` stays
appropriate for telemetry and opportunistic cache *fills* — work whose
outcome nobody is waiting to see reflected. The Studio save's own history is
the case study: `fireAndForget` here meant the invalidation "ran after the
response," which on Vercel means "maybe ran at all" — nothing in the platform
guarantees post-response work completes before the function instance is
reclaimed, unlike `after()`, which the platform does guarantee runs to
completion.
