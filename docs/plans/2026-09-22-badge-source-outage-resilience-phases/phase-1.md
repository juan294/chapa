# Phase 1 — Exact-bound fresh/stale aggregate cache

Parent plan: `../2026-09-22-badge-source-outage-resilience.md`. Depends on nothing. Not batch-eligible because phase 2 consumes the freshness contract established here.

## Goal

When a complete aggregate was previously collected under the exact current GitHub and linked-source authorizations, a later refresh/collection failure serves that known-good aggregate as explicitly stale. No connected source disappears, no ambiguous provider request is retried, and stale data cannot become a new durable/public artifact.

## Files

| file | change |
|---|---|
| `apps/web/lib/cache/stats-cache.ts` | versioned envelope, split authorization/date semantics, fresh/stale read result, seven-day bounded retention |
| `apps/web/lib/cache/stats-cache.test.ts` | envelope validation, time boundaries, exact binding, legacy-row rejection |
| `apps/web/lib/github/client.ts` | read raw authorization and exact-bound cache before refresh; detailed current/stale/unavailable result |
| `apps/web/lib/github/client.test.ts` | busy-refresh regression, stale fallback rejection matrix, read-only invariants |
| `apps/web/lib/github/client.integrity.contract.test.ts` | real-cache seam regression for complete stale aggregate |
| `apps/web/lib/profile/materialize-profile.ts` | carry stats freshness/capture time; stale is structurally renderable but incomplete for publication |
| `apps/web/lib/profile/materialize-profile.test.ts` | stale materialization, true-unavailable, no persistence eligibility |
| `apps/web/lib/profile/score-view-model.ts` | allow legacy projection to carry explicit freshness |
| `apps/web/lib/profile/score-view-model.test.ts` | current/stale v6 projection contract |
| `apps/web/lib/profile/public-profile.test.ts` | stale aggregate mints no v6 verification and persists no snapshot |
| `docs/decisions/2026-08-30-scoring-cache-seam-flag-combinations.md` | update the cache/read-only table and degraded-read explanation |

No SQL or migration file changes.

## Steps

### 1.1 Red: encode the production failure at the stats seam

In `client.test.ts`, construct:

```text
Bitbucket authorization = authorized, exact link L1, expired token
Codeberg/GitLab = authorized or unlinked fixtures
refreshSourceLink(Bitbucket L1) = unavailable (the public result of a busy claim)
GitHub access context = server token A
```

Add failing tests for:

- matching fresh aggregate: returned before refresh; no provider/GitHub call;
- matching stale aggregate: returned only after the exact authorization recheck;
- no aggregate: remains unavailable/null and never computes GitHub-only;
- changed link UUID/version, disabled flag, disconnect, or access context: stale rejected;
- successful refresh changes the binding, so the old stale envelope is rejected;
- read-only stale hit performs no refresh, HTTP collection, write, or inflight join.

Keep existing tests that reject unavailable authorization and inaccessible linked sources. They are safety guards, not expectations to weaken.

### 1.2 Version the cache envelope

Pseudocode for `stats-cache.ts`:

```ts
const FRESH_SECONDS = 6 * 60 * 60;
const RETENTION_SECONDS = 7 * 24 * 60 * 60;

type CachedStatsEnvelopeV2 = {
  schemaVersion: 2;
  authorizationBinding: string;
  referenceDate: string;
  capturedAt: string;
  freshUntil: string;
  stats: StatsData;
};

readCachedStats(handle, authorizationBinding, now):
  parse exact schema
  reject foreign binding or invalid timestamps
  return fresh when now <= freshUntil and date is current
  return stale when now-capturedAt <= retention
  otherwise miss
```

Requirements:

- HMAC domain/version changes because `referenceDate` leaves the authorization binding.
- Missing `NEXTAUTH_SECRET` still disables caching.
- Old `{ binding, referenceDate, stats }` values are misses.
- Clone data at the boundary; no caller mutates the cached object.
- Keep `stats:v3:<handle>` as the single invalidation key unless implementation evidence shows a key bump is safer. If bumped, update every invalidation assertion in the same phase.

### 1.3 Reorder collection without weakening authorization

Split the current `initial` operation into `rawAuthorization` and `readyAuthorization`:

```text
raw = readSourceAuthorization for all linked providers
if raw contains unavailable -> unavailable
binding = build from raw + GitHub access context
cached = exact-bound read
if fresh and raw still exact -> current
if readOnly -> stale-or-unavailable, with no writes

ready = refresh each raw authorized link
if refresh fails -> stale only when raw is still exact
if refresh succeeds -> rebuild binding from ready
collect every source, preserving the all-or-nothing rule
on collection failure -> stale only when the matching authorization remains exact
on success -> write current envelope after final exact-current check
```

Do not change `refreshSourceLink`, the durable-claim RPC, or the rule that an authorized linked fetch returning null fails the aggregate.

### 1.4 Carry freshness to publication gates

Add `statsFreshness: "current" | "stale"` and `statsCapturedAt` to materialized state.

```ts
statsComplete = statsFreshness === "current" && statsLookComplete(stats);
scoring = legacyViewModel(displayImpact, { freshness: statsFreshness });
```

The stale aggregate may compute/render the same score from the complete historical `StatsData`, but:

- `getPublicProfileVerification` returns null through `statsComplete=false`;
- `persistProfileSnapshot` refuses the write through `guardStatsComplete`;
- receipt/v7 numbers continue to come from committed receipt authority;
- no new public verification or daily history is minted from stale data.

### 1.5 Update the decision record

Update the read-only/live rows in the scoring/cache seam table. State:

- fresh vs stale retention;
- exact authorization binding;
- no live work for read-only;
- stale render is not snapshot/verification eligible;
- all invalidation still targets one handle key.

## Verification

Run sequentially:

```sh
pnpm exec vitest run apps/web/lib/cache/stats-cache.test.ts --no-file-parallelism
pnpm exec vitest run apps/web/lib/github/client.test.ts --no-file-parallelism
pnpm exec vitest run apps/web/lib/github/client.integrity.contract.test.ts --no-file-parallelism
pnpm exec vitest run apps/web/lib/profile/materialize-profile.test.ts apps/web/lib/profile/score-view-model.test.ts apps/web/lib/profile/public-profile.test.ts --no-file-parallelism
pnpm run typecheck
pnpm run lint
pnpm run check:circular
```

The integrity contract must use disposable local Redis/test services. Never point it at production credentials or data.

## Done when

- The busy-refresh regression is green with exact-bound stale data.
- The same regression remains unavailable with no trusted aggregate.
- Every authorization-change matrix case rejects the fallback.
- Stale data is renderable but fails all publication/verification gates.
- Refresh-barrier tests and SQL are unchanged and green.
- Commit is local on the isolated implementation branch; no push or deploy.
