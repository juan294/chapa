# Plan: keep the public badge usable when a linked source is unavailable

**Date:** 2026-09-22
**Incident:** production `v3.0.0` (`a60e8871c63fb5a5d9208484c7c2b45e5302b02e`) returned the localized load-error SVG for `/u/juan294/badge.svg` while `/api/profile/juan294` still had a durable public score.
**Release shape:** patch release through the normal `develop` to `main` flow. Implementation and local qualification do not authorize a push, release, production repair, linked-account mutation, or rollback.

## Problem, as measured in production

The badge endpoint returned HTTP 200 and valid SVG bytes, but the SVG was the error artifact:

```text
@juan294
Could not load data. Try again later.
```

The direct profile API remained healthy because it can serve a committed receipt or durable metrics snapshot. The badge route requires a live `MaterializedProfile`, so one unavailable linked source turns the whole render into the generic fallback.

The confirmed path is:

1. `getStats` reads and refreshes all linked-source authorizations before it reads `stats:v3` (`apps/web/lib/github/client.ts:43-56`).
2. The expired Bitbucket link reaches `refreshSourceLink`; a durable refresh claim already exists, so the claim RPC returns `busy` (`apps/web/lib/platform/source-refresh.ts:14-31`, `supabase/migrations/046_platform_token_refresh_attempts.sql:35-42`).
3. The refresh boundary intentionally maps that ambiguous outcome to `unavailable`; it must not replay the provider request (`apps/web/lib/platform/source-refresh.ts:10-12`).
4. `getStats` returns `null` before its cache read (`apps/web/lib/github/client.ts:56-85`).
5. `materializeProfile` carries the unavailable result as `null` (`apps/web/lib/profile/materialize-profile.ts:106-125`, `:205-236`).
6. The badge route returns the 60-second load-error SVG (`apps/web/app/u/[handle]/badge.svg/route.ts:689-703`).
7. The release badge probe accepts any HTTP 200 SVG wrapper, so this error artifact passed production verification (`apps/web/e2e/helpers/deployment-probes.ts:33-42`).

The database refresh barrier is correct. It represents an unknown provider outcome, has no timeout takeover, and can be cleared safely only by an explicit replacement grant. This plan does not alter migrations 046 or 048, delete a claim, retry an ambiguous refresh, or drop Bitbucket from a newly computed aggregate.

## Decision

Implement two bounded last-known-good paths and one release-proof correction:

1. **Exact-bound aggregate fallback.** Keep the complete composed `StatsData` beyond its six-hour fresh period in a versioned Redis envelope. Read it before attempting refresh. When refresh or collection fails, serve it only if the GitHub access context and every linked-source authorization still match exactly. Carry `freshness: "stale"` through materialization so it cannot create a snapshot, verification record, or long-lived SVG.
2. **Durable stored-badge fallback.** If no exact-bound aggregate exists, project the committed receipt or metrics snapshot into a badge-only, explicitly stale structure. Render the stored score and dimensions with an unavailable-activity disclosure. Never fabricate heatmap activity, silently recompute from partial sources, or pass this structure through normal profile side effects.
3. **Machine-readable badge state.** Mark normal, stale, and fallback SVG roots so the release probe can reject a 200 error artifact without relying on localized copy.

This gives the full badge when a safe complete aggregate exists, and a truthful reduced badge when only the durable public score exists. The generic localized error SVG remains the final outcome for a real cold handle with no committed profile.

### Rejected alternatives

| alternative | reason rejected |
|---|---|
| Delete or time out the durable refresh claim | A rotating refresh token may already have been consumed. Retrying an unknown outcome can corrupt the grant. |
| Ignore the failed linked source and compute GitHub-only | A connected source would silently disappear and the score could drop. `client.ts:90-98` deliberately forbids this. |
| Reuse the retired `stats:v2` cache | It is handle-only and not bound to the current credentials or link versions. |
| Return the current generic SVG with a longer TTL | It hides the outage but still publishes no badge. |
| Use only a last-rendered SVG alias | It cannot repair today's cold `stats:v3` transition and cannot disclose which scoring revision it contains. It also leaves the profile/read model inconsistency unresolved. |

## Required invariants

- Current source authorization remains the authority. A fallback never crosses a flag change, disconnect, reconnect, link UUID/version change, GitHub access-context change, or missing signing secret.
- A connected but inaccessible source never disappears from a newly computed aggregate.
- Stale aggregate data is renderable but never publishable as fresh: `statsComplete` is false, v6 HMAC issuance is disabled, snapshot persistence is blocked, and the normal daily SVG cache is not written.
- A stored badge fallback is a distinct type, not a forged `MaterializedProfile`, so it cannot accidentally reach `runPublicProfileSideEffects`.
- GitHub `NOT_FOUND` remains a 404. Provider/storage unavailability remains distinct and may use a last-known-good fallback.
- `readOnly` callers perform no refresh, external collection, writes, or inflight joining.
- The public SVG visibly and accessibly states when live sources are unavailable and names the stored snapshot/receipt date.
- No Supabase migration is needed. The refresh-barrier schema and RPC behavior remain byte-for-byte unchanged.

## Design

### 1. Versioned fresh/stale stats envelope

`apps/web/lib/cache/stats-cache.ts` currently stores `{ binding, referenceDate, stats }` for six hours (`:40-104`). Replace the value contract with a strict versioned envelope while retaining one key per handle for invalidation:

```ts
type CachedStatsEnvelopeV2 = {
  schemaVersion: 2;
  authorizationBinding: string;
  referenceDate: string;
  capturedAt: string;
  freshUntil: string;
  stats: StatsData;
};

type CachedStatsRead =
  | { status: "fresh"; stats: StatsData; capturedAt: string }
  | { status: "stale"; stats: StatsData; capturedAt: string }
  | { status: "miss" };
```

The authorization HMAC covers the GitHub access context and exact linked-source states, but not the scoring date. `referenceDate` remains in the envelope. A same-date record is fresh until six hours after capture. A matching record remains eligible as stale for at most seven days. Old/unversioned envelopes fail closed instead of being upgraded implicitly.

`getStats` gains a detailed internal result while preserving its compatibility export for callers that only need `StatsData | GitHubUserNotFound | null`:

```ts
type StatsRead =
  | { status: "current" | "stale"; stats: StatsData; capturedAt: string }
  | { status: "not_found"; value: GitHubUserNotFound }
  | { status: "unavailable" };

async function readStats(...) : Promise<StatsRead> { ... }
export async function getStats(...) { return unwrap(await readStats(...)); }
```

Live flow pseudocode:

```text
rawAuthorization = read every source without refresh
if any raw authorization is unavailable -> unavailable
binding = HMAC(GitHub access context + exact raw authorization states)
cached = read exact-bound envelope
if cached is fresh and authorization is still exact -> current
if readOnly -> return exact-bound stale or miss; do nothing else

refreshedAuthorization = refresh authorized expired links
if refresh fails -> return cached stale only after exact raw authorization recheck
rebind after a successful refresh
collect GitHub + every authorized linked source
if any collection fails -> return a matching stale envelope only after exact current recheck
write a new current envelope only after the final exact-current recheck
```

The existing all-source and current-authorization checks at `apps/web/lib/github/client.ts:87-103` stay intact.

### 2. Freshness through profile materialization

`loadDisplayInputs` in `apps/web/lib/profile/materialize-profile.ts:106-125` consumes the detailed stats result and adds `statsFreshness` / `statsCapturedAt` to the internal profile state.

For a stale aggregate:

- compute the same display from the complete previous aggregate;
- set `statsComplete: false` regardless of structural validity;
- project `ScoreViewModel.freshness = "stale"` for v6;
- retain any already committed v7.2 receipt as its own authority;
- skip v6 verification and durable side effects through the existing completeness gates (`apps/web/lib/profile/persist-guard.ts:14-29`, `apps/web/lib/profile/public-profile.ts:55-77`).

`persistFinalizedBadgeCache` and both `configCacheable` calculations in the badge route must require current freshness, not merely `freshness !== "unavailable"` (`apps/web/app/u/[handle]/badge.svg/route.ts:236-268`, `:358-370`). The stale response uses the existing 60-second client/edge policy.

### 3. Stored badge-only projection

Create `apps/web/lib/profile/stored-badge-profile.ts`. It reads the same durable authorities already used by the profile API:

- `readPublicObservedScore` for a current v7.2 receipt (`apps/web/lib/profile/post-write-score.ts:7-18`);
- `getCachedLatestSnapshot` for the legacy durable fallback (`apps/web/app/api/profile/[handle]/route.ts:62-115`).

It returns a discriminated `StoredBadgeProfile`, never `MaterializedProfile`:

```ts
type StoredBadgeProfile = {
  kind: "stored";
  handle: string;
  observedAt: string;
  scoring: ScoreViewModel & { freshness: "stale" };
  legacyImpact: ImpactV6Result;
  statsContext: Pick<StatsData, /* durable snapshot fields only */>;
  activity: { status: "unavailable" };
};
```

For v7.2, numbers come only from the committed receipt model. For v6, dimensions, headline, tier, and archetype come directly from the stored snapshot; do not recompute the score from a partial `StatsData`. Snapshot rows deliberately omit heatmap, avatar, and display name (`packages/shared/src/types.ts:198-235`), so the badge renders the handle, stored counts, score/dimensions, and an explicit unavailable-activity state.

At the existing `!materialized` branch (`apps/web/app/u/[handle]/badge.svg/route.ts:689-703`):

```text
stored = readStoredBadgeProfile(handle, captured scoring selection)
if stored exists:
  renderStoredBadge(stored, localized disclosure)
  return 200, max-age=60, no normal SVG write, no after() side effects
else:
  return the existing localized load-error SVG
```

The 404 sentinel branch remains ahead of this fallback.

### 4. Explicit degraded rendering

Extend `BadgeSvg` options with a stored/stale disclosure rather than filling `heatmapData` with zeroes:

```ts
degraded?: {
  reason: "live_sources_unavailable";
  observedAt: string;
  activityAvailable: false;
}
```

When present, replace the heatmap claim with localized copy equivalent to “Last successful snapshot: YYYY-MM-DD. Live sources are temporarily unavailable.” Include the same fact in the SVG accessible description. The badge root carries:

```xml
data-chapa-state="rendered"
data-chapa-freshness="current|stale"
```

The generic fallback root carries `data-chapa-state="fallback"` and a stable reason (`invalid-handle`, `not-found`, `load-error`, or `render-error`). Machine state is not derived from English or Spanish copy.

### 5. Release-proof hardening

`assertBadgeSvg` currently checks only HTTP 200, content type, and SVG wrappers (`apps/web/e2e/helpers/deployment-probes.ts:33-42`). Extract a pure body assertion and require:

```text
data-chapa-state="rendered"
not data-chapa-state="fallback"
```

Add a focused unit test file for normal, stale-rendered, English fallback, and Spanish fallback bodies. The release-required integration continues to call the same helper (`apps/web/e2e/release-required.spec.ts:94-97`).

The patch-release production checklist additionally probes the originally affected canonical badge and requires `data-chapa-state="rendered"`, absence of load-error markers, and the expected exact production SHA. A degraded stored badge may restore the endpoint, but promotion is not declared fully healthy until the affected account has a current linked grant and renders `data-chapa-freshness="current"`.

## Phase structure

| # | phase | depends on | batch |
|---|---|---|---|
| 1 | Exact-bound fresh/stale aggregate cache | — | — |
| 2 | Stored badge fallback and explicit degraded rendering | 1 (freshness contract and route behavior) | — |
| 3 | Release-probe hardening, docs, and exact-candidate qualification | 1, 2 | — |

No phase is `[batch-eligible]`: phase 2 consumes phase 1's freshness contract, and phase 3 asserts the machine-readable output introduced by phase 2.

Phase files:

- `docs/plans/2026-09-22-badge-source-outage-resilience-phases/phase-1.md`
- `docs/plans/2026-09-22-badge-source-outage-resilience-phases/phase-2.md`
- `docs/plans/2026-09-22-badge-source-outage-resilience-phases/phase-3.md`

## Risk register

| risk | executable check | fallback |
|---|---|---|
| Stale cache crosses a credential or link change | client/cache tests vary access context, flags, link UUID, version, disconnect, and reconnect | return unavailable; never render the stale aggregate |
| Stale data is persisted or verified as new | materialization and route tests assert `statsComplete=false`, no verification, no snapshot write, no normal SVG cache write | serve the stored badge-only projection or generic fallback |
| Stored snapshot is presented as current activity | renderer tests require visible/accessible stale date and unavailable activity; no synthetic heatmap | generic fallback if a truthful stored projection cannot be built |
| v7.2 receipt and legacy snapshot disagree | stored projection uses receipt numbers whenever a current receipt exists; snapshot supplies only non-scoring context | return unavailable on policy/identity ambiguity |
| A 200 fallback passes release proof again | pure probe tests reject machine fallback state in both locales | block release; production rollback still needs separate authorization |
| Existing cache rows have the old shape | strict `schemaVersion` parser treats them as misses | stored badge fallback covers known profiles while the new cache warms |

## Success criteria

### Automated

- Red tests reproduce an expired Bitbucket link with `refreshSourceLink -> unavailable`, both with and without a matching last-known-good aggregate.
- Exact-bound stale data renders but cannot be persisted, verified, or written to the normal SVG cache.
- A changed grant, link, flag, or GitHub access context rejects the stale aggregate.
- A cold cache plus durable profile renders an explicitly stale badge, not `badge.loadError`.
- A real cold handle without durable state retains the existing localized load-error SVG.
- GitHub `NOT_FOUND` retains its 404 behavior.
- Release-probe tests reject machine fallback SVGs in English and Spanish and accept current/stale rendered badges.
- Targeted tests, typecheck, lint, circular-dependency check, contract seam, and full schema2 local qualification pass sequentially.

### Manual / later authorized production proof

1. Resolve the currently ambiguous Bitbucket grant through explicit disconnect/reconnect before claiming full recovery. Do not clear the claim directly.
2. Verify `/api/version` reports the exact authorized `main` commit and production environment.
3. Run the four default release-required production scenarios against the actual deployment.
4. Fetch `/u/juan294/badge.svg`; require HTTP 200, `data-chapa-state="rendered"`, `data-chapa-freshness="current"`, `@juan294`, and no localized load-error text.
5. Verify health dependencies remain `ok` and record the failed release, repair release, deployment IDs, and rollback reference.

Rollback or any production/account mutation remains a separate explicit authorization gate.
