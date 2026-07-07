# Phase 2 — Scope-aware, non-downgrading cache writes

**Depends on:** Phase 1. **Batch:** `[batch-eligible]` with Phase 3 (disjoint files).
**Files:** `apps/web/lib/github/client.ts`, `packages/shared/src/types.ts` (add `fetchScope`), `apps/web/lib/github/stats-integrity.ts` (consume Phase-1 helpers), `packages/shared/src/stats-aggregation.ts` (`STATS_OPTIONAL_KEYS` add `fetchScope`) (+ tests).

## Intent
A degraded or lower-scope fetch must never downgrade a better stored value. `stats:stale` is sacred: only complete, authenticated-or-equal payloads ever touch it.

## Changes

### 2a. Tag scope on the fetch
`types.ts` `StatsData`: add optional `fetchScope?: "authenticated" | "public"` (optional ⇒ not persisted by the explicit-field-list snapshot/verification builders; add to `STATS_OPTIONAL_KEYS` so `mergeStats`/`normalizeStats` preserve it).

`client.ts` `_fetchAndCache`: `const scope = token ? "authenticated" : "public"`; set `stats.fetchScope = scope` after building.

### 2b. Non-downgrading write rule
Replace the current #1002 guard block + unconditional `cacheSet(cacheKey)/cacheSet(staleKey)` with a single decision:
```
const existingMerged = await cacheGet<StatsData>(cacheKey)   // already read stale earlier
function scopeRank(s) { return s === "authenticated" ? 2 : 1 }
const isDowngrade = existingMerged
  && scopeRank(stats.fetchScope) < scopeRank(existingMerged.fetchScope ?? "public")

// merged (6h): skip write if this fetch would downgrade a present better-scope entry
if (!options.readOnly && !isDowngrade) await cacheSet(cacheKey, stats, CACHE_TTL)

// stale (7d): write ONLY when complete AND not a downgrade vs existing stale scope
const staleDowngrade = stale && scopeRank(stats.fetchScope) < scopeRank(stale.fetchScope ?? "public")
if (!options.readOnly && !staleDowngrade) await cacheSet(staleKey, stats, STALE_TTL)
```
(Degraded fetches never reach this point — Phase 1 returns null before build. So the only gate remaining here is the scope-downgrade rule.)

### 2c. Subsume #1002
`isDegradedPrFetch` is no longer the primary defense (Phase 1's source rejection is). Keep it as a belt-and-suspenders check against a stale entry regressing, OR remove it and its call site if the contract test (Phase 5) proves it redundant. Decision recorded in the phase's implementation notes; default: **keep** the function, drop the client.ts call site if redundant, to avoid churn in its tests.

## Pseudocode: cron (public) after user (authenticated) already cached
```
existingMerged.fetchScope = "authenticated"  (from user visit, prsMergedCount:904)
cron fetch: scope="public", stats.prsMergedCount = <public count, maybe low>
isDowngrade = rank(public=1) < rank(authenticated=2) = true
-> skip cacheSet(cacheKey) AND cacheSet(staleKey)
-> authenticated 904 data preserved  (closes the 2026-03-31 seam)
```

## Success criteria
**Automated**
- public fetch does NOT overwrite an authenticated `stats:v2:merged` entry (assert `cacheSet` not called with cacheKey).
- public fetch does NOT overwrite an authenticated `stats:stale` entry.
- authenticated fetch DOES overwrite a public entry (upgrade allowed).
- first fetch (no existing entry) writes normally regardless of scope.
- `mergeStats`/`normalizeStats` preserve `fetchScope`.
- typecheck/lint/circular/full suite green; existing `client.test.ts` degraded-path tests updated for the new rule.

**Manual**
- In Redis, confirm `stats:stale:<handle>.fetchScope` is `authenticated` after an owner visit and stays so across a cron cycle.
