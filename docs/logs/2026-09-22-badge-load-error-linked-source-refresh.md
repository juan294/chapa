# 2026-09-22: Badge load-error SVG from an ambiguous linked-source refresh

## What was observed

Production `v3.0.0` (commit `a60e8871c63fb5a5d9208484c7c2b45e5302b02e`) served
the generic localized load-error SVG for `GET /u/juan294/badge.svg`:

```text
@juan294
Could not load data. Try again later.
```

The response was a valid HTTP 200 SVG, so it passed the release-required
badge probe unnoticed. `GET /api/profile/juan294` remained healthy over the
same window: it can serve a committed v7.2 receipt or a durable metrics
snapshot directly, while the badge route required a live
`MaterializedProfile` and had no path to fall back to that same durable
public score.

## Trigger

One linked Bitbucket source's token refresh reached an ambiguous, durably
claimed "busy" outcome inside the refresh-claim barrier
(`apps/web/lib/platform/source-refresh.ts`,
`supabase/migrations/046_platform_token_refresh_attempts.sql`). The refresh
boundary correctly mapped that ambiguous result to `unavailable` rather than
retry it. No claim ID, token, or other credential material is recorded here
or anywhere in tracked evidence for this incident.

Before this fix, `getStats` read and refreshed every linked source's
authorization together, before ever consulting the cache. One ambiguous
refresh therefore turned a handle with a perfectly good aggregate collected
minutes earlier into a hard `null`, which the badge route rendered as the
generic fallback artifact.

## Why the refresh-claim barrier is unchanged

The barrier represents an unknown provider outcome. It has no timeout
takeover and can be cleared safely only by an explicit replacement grant,
because a rotating refresh token may already have been consumed by the
ambiguous attempt, so retrying it blind risks corrupting the grant. This
incident does not alter the claim-barrier migrations or RPC behavior, delete
a claim, retry an ambiguous refresh, or drop the affected source from a
newly computed aggregate.

## Fix shipped

Two bounded last-known-good paths, plus a release-probe correction that
closes the verification gap this incident exposed:

1. **Exact-bound fresh/stale stats envelope**
   (`apps/web/lib/cache/stats-cache.ts`, `apps/web/lib/github/client.ts`).
   The composed `StatsData` aggregate is kept beyond its six-hour fresh
   window in a versioned Redis envelope, retained up to seven days. The
   authorization binding covers the GitHub access context and the exact
   linked-source states, but not the scoring day, so a same-grant record
   written yesterday still matches today and can be served as explicitly
   stale. A `stale` read requires an exact recheck against the caller's
   current raw (or, after a successful refresh, post-refresh) authorization
   state before it is served; any credential, link version, flag, or
   disconnect/reconnect change makes the old entry an unrelated miss rather
   than a wrongly served stale read. A `stale` result can never be persisted
   as a snapshot, minted as a verification record, or written to the normal
   24-hour SVG cache, because `statsComplete` is unconditionally false for
   it.

2. **Durable stored-badge fallback**
   (`apps/web/lib/profile/stored-badge-profile.ts`). When no exact-bound
   aggregate exists at all, the badge route projects the same committed
   v7.2 receipt or metrics snapshot the profile API already serves into a
   distinct, badge-only `StoredBadgeProfile`, never a forged
   `MaterializedProfile`, so it cannot reach the normal snapshot/verification
   side effects. It renders the stored score and dimensions with an explicit,
   visible and accessible "live sources unavailable, last successful
   snapshot on {date}" disclosure in place of a fabricated heatmap. The
   generic localized load-error SVG remains the outcome only for a real cold
   handle with no committed profile at all.

3. **Machine-readable badge state**
   (`apps/web/lib/render/BadgeSvg.tsx`,
   `apps/web/app/u/[handle]/badge.svg/route.ts`). Every rendered badge root
   now carries `data-chapa-state="rendered"` and
   `data-chapa-freshness="current"` or `"stale"`; the generic fallback root
   carries `data-chapa-state="fallback"` and a stable, locale-independent
   `data-chapa-reason`. Machine state is never derived from English or
   Spanish copy, so a translation edit can never change what a probe checks.

## Release-probe gap and its correction

`assertBadgeSvg` (`apps/web/e2e/helpers/deployment-probes.ts`) checked only
HTTP 200, the SVG content type, and `<svg>...</svg>` wrapper bytes, which is
exactly what the load-error artifact also satisfies. The check is now a pure,
exported `assertRenderableBadgeBody(body)` that additionally requires
`data-chapa-state="rendered"` and rejects `data-chapa-state="fallback"`,
without keying on localized text. `assertBadgeSvg` calls it after the
existing checks. A rendered/stale badge still passes the generic
release-required scenario, since a truthfully disclosed stale badge is still
an available product artifact; only the incident-specific production
recovery proof (below) requires `data-chapa-freshness="current"`.

## Operational status: not yet fully resolved

Shipping this fix restores a usable public badge (full or stored-fallback)
for the affected account, but it does not resolve the underlying stuck
Bitbucket grant. The refresh claim on that link remains ambiguous and will
keep forcing the `stale` or stored-badge path for that handle until the
grant is explicitly disconnected and reconnected. Promotion is not declared
fully healthy for the affected account until `/u/juan294/badge.svg` renders
`data-chapa-state="rendered"` and `data-chapa-freshness="current"`. That
disconnect/reconnect action is an account mutation and requires its own
separate explicit authorization; it is not implied by shipping this patch.

## Authorization boundaries

Implementation and local qualification of this patch authorize none of the
following on their own: pushing the branch, opening or merging a release PR,
promoting to production, the account disconnect/reconnect described above,
or a rollback. Each remains a separate, explicit authorization gate per
`docs/release/release-playbook.md` and `docs/runbooks/rollback.md`.
