# Phase 4 — Heal poisoned data (repair pass)

**Depends on:** Phases 1, 2, 3 (so rebuilt data is protected). **Batch:** `[batch-eligible]` with Phase 5.
**Files:** `scripts/heal-poisoned-stats.ts` (new, gitignored-tools style like `delete-user`), `package.json` script entry (+ a small pure `isPoisonedSnapshot`/`isPoisonedStats` predicate in `stats-integrity.ts` reused by the script and Phase 3, with tests).

## Intent
Purge the corrupt data already written for affected users (acutely juan294) so scores snap back after deploy, and remove the permanent-history corruption.

## Changes

### 4a. Poison predicate (pure, reusable)
`stats-integrity.ts`:
```
export function isPoisonedStats(s: { prsMergedCount:number; commitsTotal:number; issuesClosedCount:number }): boolean {
  return s.prsMergedCount === 0 && (s.commitsTotal > 0 || s.issuesClosedCount > 0)
}
```
(Same shape used by Phase 3's `statsLookComplete` — single source of truth.)

### 4b. Repair script `scripts/heal-poisoned-stats.ts`
Mirror the `delete-user` tool ergonomics: dry-run → review → `--apply`.
```
for each handle (from arg list, or scan snapshot rows / a provided handle):
  redis:
    mergedStats = get stats:v2:merged:<h>;  staleStats = get stats:stale:<h>
    if isPoisonedStats(mergedStats) -> del stats:v2:merged:<h>
    if isPoisonedStats(staleStats)  -> del stats:stale:<h>
    del snapshot:v2:latest:<h>   // force rebuild from DB/fresh
  supabase metrics_snapshots:
    find rows where prs_merged_count = 0 AND commits_total > <threshold e.g. 100>
    --apply: delete those rows (permanent-history corruption) OR mark for recompute
  report per-handle: what was purged
```
Healing completes when the user's next **authenticated** visit (or `/api/refresh`) repopulates good, Phase-2-protected data. The script does NOT itself fetch with a user token (server token can't see private PRs); it clears the poison so the next good fetch sticks. Document this in the script header.

### 4c. Run for juan294
After Phases 1–3 are on `develop` and deployed: dry-run, review, `--apply` for `juan294`, then confirm via `/api/profile/juan294`.

## Success criteria
**Automated**
- `isPoisonedStats` unit tests (poison shape true; genuine-zero and healthy false).
- script dry-run on a fixture prints the correct purge set without mutating.

**Manual**
- `--apply juan294` purges the poisoned `stats:stale:juan294` (verify `GET` returns nil) and corrupt snapshot rows.
- After an authenticated refetch, `stats:stale:juan294.prsMergedCount` > 0, Delivery ≈ 100, score ≈ 76.
- No poisoned rows remain: `metrics_snapshots WHERE prs_merged_count=0 AND commits_total>100` returns 0 for repaired handles.

## Safety
- Production data mutation — requires explicit user authorization to run `--apply` (per Production Safety). Dry-run is safe. Never runs in CI.
