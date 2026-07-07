# Phase 3 — Persist-boundary integrity gate (snapshot + verification)

**Depends on:** Phase 1. **Batch:** `[batch-eligible]` with Phase 2 (disjoint files).
**Files:** `apps/web/lib/profile/materialize-profile.ts`, `apps/web/lib/profile/public-profile.ts` (+ tests). Read-only consumers of Phase-1 helpers; does not modify `client.ts` or `stats-integrity.ts`.

## Intent
Even though Phase 1 stops a degraded fetch from producing stats, defense-in-depth: the permanent snapshot history and the HMAC verification record must never be built from an incomplete payload. This covers the case where stats are served from an OLD stale entry that predates the fix, or any residual incompleteness.

## Changes

### 3a. Carry a completeness signal
`materialize-profile.ts`: after `getStats`, derive `statsComplete` for the resolved stats:
```
// stats are "complete" for persistence when merged-PR data is internally coherent:
// not the corrupt "0 PRs but real commit/issue activity" shape.
function statsLookComplete(stats): boolean {
  if (stats.prsMergedCount > 0) return true
  // 0 PRs is only trustworthy when there's no other heavy activity (genuine new/empty acct)
  return stats.commitsTotal === 0 && stats.issuesClosedCount === 0
}
```
Expose on `MaterializedProfile` as `statsComplete: boolean`. (This is a cheap value-plausibility check on the *served* stats, independent of the fetch path — catches a served-from-old-poisoned-stale case.)

### 3b. Gate snapshot persistence
`public-profile.ts` `persistProfileSnapshot`: early-return (no insert/replace) when `!materialized.statsComplete`:
```
if (!materialized.statsComplete) {
  captureServerEvent("snapshot_skipped_incomplete_stats", { handle, prsMergedCount, commitsTotal })
  return false
}
```

### 3c. Gate verification record
`public-profile.ts` `deferProfileCacheWork` / `getPublicProfileVerification`: skip building + `storeVerificationRecord` when `!statsComplete` (don't attest a corrupt score). The badge still renders (served number), but no new verifiable record is minted from bad data.

## Pseudocode
```
served stats from old poisoned stale: prsMergedCount:0, commitsTotal:15585, issues:5104
statsLookComplete -> false  (0 PRs but heavy commits/issues)
persistProfileSnapshot -> skip (no corrupt permanent row)
verification -> skip (no attested corrupt record)
badge -> still renders (last value), telemetry fires
```

## Success criteria
**Automated**
- `persistProfileSnapshot` returns false + writes nothing when stats are the corrupt shape (0 PRs, heavy commits/issues).
- genuine new user (0 PRs, 0 commits, 0 issues) DOES persist a snapshot (not treated as corrupt).
- healthy stats (prsMergedCount>0) persist + attest normally.
- verification record not stored for incomplete stats.
- typecheck/lint/circular/full suite green; `public-profile.test.ts` + `materialize-profile.test.ts` updated.

**Manual**
- Confirm no new corrupt snapshot rows appear for a handle whose live fetch is degraded (query Supabase `metrics_snapshots` for `prs_merged_count = 0 AND commits_total > 1000` after a deploy day).
