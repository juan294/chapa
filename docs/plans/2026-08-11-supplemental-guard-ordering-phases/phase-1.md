# Phase 1 — Compose-after-guard restructure + versioned baseline key

> Fixes #1060 and #1061. Must land before phases 2-4. **Not** batch-eligible.
> Files: `apps/web/lib/github/client.ts`, `apps/web/lib/github/stats-integrity.ts`,
> `apps/web/lib/github/client.test.ts`, `apps/web/lib/github/stats-integrity.test.ts`

## 1. TDD order

Per CLAUDE.local.md, no implementation code before a failing test. Write §5's tests
first — specifically 5.1 and 5.2, which fail against `develop` today and are the
executable definition of both issues.

## 2. Target structure of `_fetchAndCache`

Replaces `client.ts:172-437` (`_serveStaleAndReCache` is absorbed and deleted).

```
BASELINE_KEY = `stats:stale:v2:${lowerHandle}`   # GitHub-derived ONLY (D2)

async function _fetchAndCache(handle, lowerHandle, cacheKey, token, options):

    baseline = await cacheGet<StatsData>(BASELINE_KEY)      # GitHub-derived or null
    primary  = await fetchStats(handle, token)              # GitHub-derived, unscoped

    # Overlays are NOT GitHub-token-scoped, so they are loaded on every path and
    # never participate in a guard decision. (D5: also loaded when primary is null.)
    overlays = await _loadOverlays(handle, lowerHandle, options.readOnly)

    if primary == null:                                     # total fetch failure
        if baseline == null: return null
        warn(`[cache] serving stale data for ${lowerHandle} (API unavailable)`)
        composed = _compose(baseline, overlays)
        if not options.readOnly: await cacheSet(cacheKey, composed, CACHE_TTL)
        return composed                                     # BASELINE_KEY untouched

    primary.fetchScope = _classifyScope(token)              # ONLY assignment site

    rejected = false

    # Guard 1 — degraded GitHub fetch (#1002/#1045). Both operands GitHub-derived.
    if isDegradedPrFetch(primary, baseline):
        warn(...)
        fireAndForget(captureServerEvent("github_degraded_pr_fetch", {
            handle: lowerHandle,
            freshPrsMergedCount: primary.prsMergedCount,
            stalePrsMergedCount: baseline.prsMergedCount,
            freshCommitsTotal:   primary.commitsTotal,
            fetchScope:          primary.fetchScope,        # D3 telemetry fix
        }))
        rejected = true

    # Guard 2 — scope downgrade (#1004/#1046/#1050).
    # Re-read cacheKey to catch a concurrent better-scoped write (see client.ts:390-410).
    existingComposed = options.readOnly ? null : await cacheGet<StatsData>(cacheKey)
    bestKnownRank = max(scopeRank(existingComposed?.fetchScope),
                        scopeRank(baseline?.fetchScope))
    if scopeRank(primary.fetchScope) < bestKnownRank:
        rejected = true

    base     = (rejected and baseline != null) ? baseline : primary
    composed = _compose(base, overlays)

    if options.readOnly: return composed

    await cacheSet(cacheKey, composed, CACHE_TTL)           # always the composed value
    if base is primary:                                     # accepted as new baseline
        await cacheSet(BASELINE_KEY, primary, STALE_TTL)    # GitHub-derived ONLY
    fireAndForget(() => dbUpsertUser(handle))
    return composed
```

### Helpers

```
_loadOverlays(handle, lowerHandle, readOnly) -> {bitbucket, codeberg, gitlab,
                                                 supplemental, linkedPlatforms,
                                                 linkedPlatformLogins}
    # readOnly short-circuits the three platform fetches to null, as today
    #   (client.ts:207-217)
    # supplemental: Redis `supplemental:<lower>` -> dbGetSupplemental fallback ->
    #   fire-and-forget rehydrate unless readOnly  (lift client.ts:242-256 verbatim)
    # linkedPlatforms / logins: lift client.ts:264-298 verbatim

_compose(githubDerived, overlays) -> StatsData
    s = githubDerived
    if overlays.bitbucket: s = mergeStats(s, overlays.bitbucket, {markAsSupplemental:false})
    if overlays.codeberg:  s = mergeStats(s, overlays.codeberg,  {markAsSupplemental:false})
    if overlays.gitlab:    s = mergeStats(s, overlays.gitlab,    {markAsSupplemental:false})
    if overlays.supplemental: s = mergeStats(s, overlays.supplemental.stats)
    return _attachLinkedPlatforms(s, overlays)

_classifyScope(token) -> "authenticated" | "public"
    # lift client.ts:342-346 verbatim, including the OAUTH_GRANTS_PRIVATE_REPO_ACCESS
    # derivation and its explanatory comment block (client.ts:300-341)
```

`mergeStats` preserves the left operand's `fetchScope` (`merge.ts:47`), so
`composed.fetchScope` is always `base.fetchScope` with no post-hoc mutation.

## 3. `stats-integrity.ts` changes

No signature or logic change. Documentation only — the contract the code already
relies on becomes explicit:

- Rename the params `fresh` → `freshGithubDerived`, `lastGood` → `lastGoodGithubDerived`.
- Replace the `@param fresh` line at `stats-integrity.ts:50` — currently
  *"The just-fetched (possibly merged) stats about to be cached"* — with a statement
  that both operands MUST be GitHub-derived (pre-composition), and why: linked-platform
  and EMU counts are not token-scoped, so including them lets a non-GitHub source mask
  GitHub scope blindness (#1061).

## 4. Deletions

- `_serveStaleAndReCache` (`client.ts:172-181`) — both call sites are absorbed.
- The `stats.fetchScope = …` mutation (`client.ts:343`) moves to `_classifyScope`,
  applied to `primary` before composition.

## 5. Tests

New cases in `apps/web/lib/github/client.test.ts`. The existing sequential
`mockCacheGet` chains must be extended — the read order changes to
`cacheKey → BASELINE_KEY → supplemental → [cacheKey re-read]`.

**5.1 — #1060 regression (fails on `develop` today).**
Supplemental present AND the fetch is scope-downgraded. Setup: session token
(→ `public`); `BASELINE_KEY` holds `authenticated` GitHub-derived stats with
`prsMergedCount: 40`; supplemental holds `prsMergedCount: 32, commitsTotal: 453`.
Assert the value written to `stats:v2:merged:` and the value returned both carry
`hasSupplementalData: true` and `prsMergedCount: 72` — i.e. the protected baseline
*plus* the current supplemental, not the baseline alone.

**5.2 — #1061 regression (fails on `develop` today).**
Blinded GitHub fetch with a supplemental large enough to clear the 0.5 ratio.
Setup: `primary.prsMergedCount: 0` with `commitsTotal > 0`; supplemental
`prsMergedCount: 50`; baseline `authenticated`, `prsMergedCount: 80`. Assert
`isDegradedPrFetch` fires — `BASELINE_KEY` is NOT overwritten and
`github_degraded_pr_fetch` is emitted — proving the guard saw `0`, not `50`.

**5.3** — same as 5.2 with no supplemental: unchanged behaviour.

**5.4** — baseline key holds GitHub-derived data only: with both a linked platform and
a supplemental present on an accepted fetch, assert the object written to
`BASELINE_KEY` has no `hasSupplementalData`, no `linkedPlatforms`, and counts equal to
`primary` alone — while `stats:v2:merged:` has all of it.

**5.5** — total-fetch-failure path re-composes (D5): `fetchStats` → null, baseline
present, supplemental present. Assert the returned value includes the supplemental and
that `BASELINE_KEY` is not written.

**5.6** — D4 contract change: on a pure scope downgrade the caller receives the
composed better-scoped value. **Updates existing test `client.test.ts:294`**, whose
current assertion `expect(result!.fetchScope).toBe("public")` encodes the old
behaviour.

**5.7** — `readOnly: true` with supplemental + downgrade: composed value returned, no
`cacheSet` to either key.

**5.8** — no baseline (new user) with supplemental present: writes through to both
keys; composed value to `cacheKey`, GitHub-derived to `BASELINE_KEY`.

**Existing tests requiring mechanical update:** every case referencing
`"stats:stale:test-user"` moves to `"stats:stale:v2:test-user"`, and
`client.test.ts:790-795` (`"caches the merged result (not just primary)"`) must be
split — the merged key keeps `commitsTotal: 80`, the baseline key now expects `50`.

## 6. Success criteria

**Automated**
- 5.1 and 5.2 fail on `develop` before implementation and pass after.
- Full suite, `typecheck`, `lint`, `check:circular` green.
- `stats-integrity.ts` coverage floor (90/85/90/90) held.

**Manual**
- On a preview deploy, inspect `stats:stale:v2:<handle>` for a handle with an EMU
  record and confirm it carries no supplemental contribution.
