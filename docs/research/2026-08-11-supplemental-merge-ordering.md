# Research: supplemental EMU merge ordering vs. the scope-downgrade guard

> Date: 2026-08-11 · Branch: `develop` · Issues: #1060, #1061
> Scope: `apps/web/lib/github/client.ts` and everything that feeds or consumes it.
> This document describes **what exists**. It proposes no changes.

---

## 1. Executive map of `_fetchAndCache`

`apps/web/lib/github/client.ts:183-437` is a single function that composes four data
sources and then applies two integrity guards. The order of operations, by line:

| Step | Lines | What happens |
|---|---|---|
| 1 | `193` | Read `stats:stale:<handle>` into `stale` — **before** the fetch |
| 2 | `196` | `fetchStats(handle, token)` → `primary` |
| 3 | `197-204` | If `primary` is null → `_serveStaleAndReCache(cacheKey, stale, readOnly)` and return |
| 4 | `207-221` | Fetch Bitbucket / Codeberg / GitLab via `Promise.allSettled` (skipped when `readOnly`) |
| 5 | `224-236` | Merge each linked platform with `markAsSupplemental: false` |
| 6 | `242-256` | Read supplemental: Redis `supplemental:<handle>`, else `dbGetSupplemental`, else null |
| 7 | **`257-259`** | **`stats = mergeStats(stats, supplemental.stats)`** — EMU data enters `stats` |
| 8 | `264-298` | Attach `linkedPlatforms` / `linkedPlatformLogins` |
| 9 | **`342-346`** | **`stats.fetchScope` assigned** (the only assignment in the codebase) |
| 10 | **`359-377`** | **`isDegradedPrFetch(stats, stale)`** → if true, `_serveStaleAndReCache` and return |
| 11 | `379-381` | If `readOnly`, return `stats` without writing |
| 12 | **`411-423`** | **Non-downgrading primary-key write rule** |
| 13 | `427-431` | Non-downgrading `stats:stale` write rule |
| 14 | `434` | `dbUpsertUser` fire-and-forget |

The supplemental merge (step 7) precedes both guards (steps 10 and 12) and the
`fetchScope` assignment (step 9).

---

## 2. Where `fetchScope` comes from

`fetchScope` is assigned in exactly one place in the entire repository —
`apps/web/lib/github/client.ts:343`:

```ts
const usedPrivateInclusiveServerToken = !token && Boolean(getGithubToken());
stats.fetchScope =
  (token && OAUTH_GRANTS_PRIVATE_REPO_ACCESS) || usedPrivateInclusiveServerToken
    ? "authenticated"
    : "public";
```
— `apps/web/lib/github/client.ts:342-346`

Verified by grep across `apps/web` and `packages`: the only other occurrences are
reads (`stats-integrity.ts:77`, `client.ts:413-428`), the type declaration
(`packages/shared/src/types.ts:41`), the pass-through in `mergeStats`
(`apps/web/lib/github/merge.ts:47`), a test fixture
(`apps/web/lib/test-helpers/fixtures.ts:61`), and field-name lists in
`packages/shared/src/stats-schema.ts:39` and
`packages/shared/src/stats-aggregation.ts:257`. `fetchStats` never sets it.

The type is optional:

```ts
fetchScope?: "authenticated" | "public"; // token scope of the fetch that produced this data — used to prevent a lower-scope fetch from downgrading a better-scoped cached entry (#1004)
```
— `packages/shared/src/types.ts:41`

`scopeRank` treats an absent value as the weakest scope:

```ts
function scopeRank(scope: StatsData["fetchScope"]): number {
  return scope === "authenticated" ? 2 : 1;
}
```
— `apps/web/lib/github/client.ts:42-44`

The governing constant:

```ts
export const OAUTH_SCOPES = "read:user user:email";
```
— `apps/web/lib/auth/github.ts:40`

```ts
export const OAUTH_GRANTS_PRIVATE_REPO_ACCESS = OAUTH_SCOPES.split(" ").includes("repo");
```
— `apps/web/lib/auth/github.ts:56`

Today `OAUTH_GRANTS_PRIVATE_REPO_ACCESS` is `false`, so **any call that passes a
session token is tagged `"public"`**, and any call that passes no token (with a
server `GITHUB_TOKEN` configured) is tagged `"authenticated"`.

---

## 3. Every non-test caller and the scope it produces

Search: `grep -rn "getStats(\|materializeProfile(\|materializeImpactState("` over
`apps/web`, `scripts`, `packages`, excluding `*.test.*`.

`getStats` is called from exactly two non-test sites — `materialize-profile.ts:132`
and three direct callers below. Everything else routes through `materializeProfile`.

| Call site | Token passed | Resulting `fetchScope` | `readOnly` | Auth model |
|---|---|---|---|---|
| `apps/web/app/u/[handle]/badge.svg/route.ts:300` → `materializePublicProfile(handle, {...})` | none | `authenticated` | varies | public |
| `apps/web/app/u/[handle]/page.tsx:145` → `materializePublicProfile(handle, { readOnly })` | none | `authenticated` | varies | public |
| `apps/web/app/u/[handle]/og-image/route.ts:74` → `materializePublicProfile(handle)` | none | `authenticated` | no | public |
| `apps/web/app/api/cron/warm-cache/route.ts:303` → `materializeOrchestratedProfile(handle)` | none | `authenticated` | no | `CRON_SECRET` bearer |
| `apps/web/app/api/admin/bulk-recalculate/route.ts:137` → `materializeOrchestratedProfile(handle, { ignoreSnapshot: true })` | none | `authenticated` | no | `ADMIN_SECRET` bearer |
| **`apps/web/app/api/refresh/route.ts:70-72`** → `materializeOrchestratedProfile(handle, { token })` | **session OAuth** | **`public`** | no | session cookie, owner-only |
| `apps/web/app/api/recalculate/route.ts:56-57` → `materializeOrchestratedProfile(handle, { token: auth.token })` | session OAuth **or undefined** | `public` or `authenticated` | no | bearer (CLI/PAT) or session |
| `apps/web/app/api/generate/route.ts:48` → `getStats(handle, token)` | session OAuth | `public` | no | session cookie |
| `apps/web/app/studio/page.tsx:79` → `getStats(session.login, token)` | session OAuth | `public` | no | session cookie |

Token-resolution chains, verbatim:

```ts
const token = await getSessionGitHubToken(session);       // apps/web/app/api/refresh/route.ts:62
const materialized = await materializeOrchestratedProfile(handle, {
  token,                                                   // apps/web/app/api/refresh/route.ts:70-71
```

```ts
const materialized = await materializeOrchestratedProfile(handle);   // apps/web/app/api/cron/warm-cache/route.ts:303
```

For `/api/recalculate`, `auth.token` is documented as session-only:

> `The token field is only populated from session cookies (the user's GitHub OAuth token) — CLI tokens are not GitHub tokens.`
> — `apps/web/lib/auth/resolve-request-auth.ts:14-15`

So a CLI-token-authenticated recalculate passes `token: undefined` and lands in the
`authenticated` branch; a cookie-authenticated one passes a session token and lands
in `public`.

**The three orchestration wrappers** all forward `token` unchanged:
- `materializePublicProfile` — `apps/web/lib/profile/public-profile.ts:21-31`
- `materializeOrchestratedProfile` — `apps/web/lib/profile/orchestrated-profile.ts:12-27`
- `materializeProfile` → `getStats(handle, options.token, { readOnly: options.readOnly })` — `apps/web/lib/profile/materialize-profile.ts:132`

---

## 4. The two guards, as written

### 4.1 `isDegradedPrFetch` — `client.ts:359`

```ts
if (isDegradedPrFetch(stats, stale)) {
```
— `apps/web/lib/github/client.ts:359`

`stats` at this point is the post-supplemental object from step 7. The predicate
keys entirely on `fresh.prsMergedCount`:

```ts
if (lastGood.prsMergedCount <= 0) return false;                              // :64
const hasOtherActivity = fresh.commitsTotal > 0 || fresh.issuesClosedCount > 0;
if (!hasOtherActivity) return false;                                        // :68-69
if (fresh.prsMergedCount === 0) return true;                                // :72
const isLowerScoped =
  fresh.fetchScope === "public" && lastGood.fetchScope === "authenticated"; // :76-77
return (
  isLowerScoped &&
  fresh.prsMergedCount < lastGood.prsMergedCount * SCOPE_SHORTFALL_RATIO    // :79-82
);
```
— `apps/web/lib/github/stats-integrity.ts:64-82`, with `SCOPE_SHORTFALL_RATIO = 0.5` at `:10`

Its docstring states the input contract:

> `@param fresh    The just-fetched (possibly merged) stats about to be cached.`
> — `apps/web/lib/github/stats-integrity.ts:50`

and the invariant it claims:

> `The guard is strictly good→bad: a fetch that *improves* on a poisoned baseline always writes through, so the next authenticated fetch heals the data and it sticks.`
> — `apps/web/lib/github/stats-integrity.ts:46-48`

`mergeStats` sums the field the predicate reads:

```ts
prsMergedCount: primary.prsMergedCount + supplemental.prsMergedCount,
```
— `apps/web/lib/github/merge.ts:50`

### 4.2 The non-downgrading write rule — `client.ts:411-431`

```ts
const existingMerged = await cacheGet<StatsData>(cacheKey);
const bestKnownScopeRank = Math.max(
  scopeRank(existingMerged?.fetchScope),
  scopeRank(stale?.fetchScope),
);
const mergedIsDowngrade = scopeRank(stats.fetchScope) < bestKnownScopeRank;
if (!mergedIsDowngrade) {
  await cacheSet(cacheKey, stats, CACHE_TTL);
} else if (stale != null) {
  // Serve-and-cache the better-scoped last-known-good rather than leaving the
  // primary key empty, which would re-fetch (and re-reject) on every hit.
  await cacheSet(cacheKey, stale, CACHE_TTL);
}
```
— `apps/web/lib/github/client.ts:411-423`

```ts
const staleIsDowngrade =
  stale != null && scopeRank(stats.fetchScope) < scopeRank(stale.fetchScope);
if (!staleIsDowngrade) {
  await cacheSet(staleKey, stats, STALE_TTL);
}
```
— `apps/web/lib/github/client.ts:427-431`

On the downgrade branch the value written to the primary key is `stale` — the object
read at `client.ts:193`, before any merging. `stale` is whatever was last written to
`stats:stale:<handle>`; it is not re-composed with the supplemental record read at
step 6.

### 4.3 `_serveStaleAndReCache`

```ts
async function _serveStaleAndReCache(
  cacheKey: string,
  stale: StatsData,
  readOnly: boolean | undefined,
): Promise<StatsData> {
  if (!readOnly) {
    await cacheSet(cacheKey, stale, CACHE_TTL);
  }
  return stale;
}
```
— `apps/web/lib/github/client.ts:172-181`

Returns `stale` verbatim. Called from two sites: `client.ts:201` (total fetch
failure) and `client.ts:376` (degraded-PR branch).

TTLs: `CACHE_TTL = 21600` (6h) at `client.ts:19`, `STALE_TTL = 604800` (7d) at
`client.ts:20`, `SUPPLEMENTAL_TTL = 86400` (24h) at `client.ts:21`.

---

## 5. How `mergeStats` treats supplemental vs. linked platforms

One function, one behavioural difference — the `markAsSupplemental` option:

```ts
hasSupplementalData: options?.markAsSupplemental ?? true,
```
— `apps/web/lib/github/merge.ts:86`

Linked platforms pass `{ markAsSupplemental: false }` (`client.ts:225`, `:230`,
`:235`); the EMU merge passes no options, so it defaults to `true` (`client.ts:258`).
Every other field is merged identically regardless of source.

Identity fields — including `fetchScope` — are always taken from the left operand:

```ts
handle: primary.handle,
displayName: primary.displayName,
avatarUrl: primary.avatarUrl,
fetchedAt: primary.fetchedAt,
fetchScope: primary.fetchScope,
```
— `apps/web/lib/github/merge.ts:43-47`

Because the EMU merge at `client.ts:258` happens **before** `fetchScope` is assigned
at `client.ts:343`, `primary.fetchScope` is `undefined` at merge time and the field is
overwritten afterwards by direct mutation. Two `merge.test.ts` cases pin the
pass-through behaviour: `"preserves fetchScope from primary, ignoring supplemental's"`
(`apps/web/lib/github/merge.test.ts:251`) and its counterpart at `:260`.

Summed fields relevant to the guards: `commitsTotal` (`merge.ts:33`, `:48`),
`prsMergedCount` (`:50`), `prsMergedWeight` capped at `PR_WEIGHT_AGG_CAP` (`:51`),
`issuesClosedCount` (`:54`), `linesAdded`/`linesDeleted` (`:55-56`),
`reposContributed` (`:57`). `totalStars`/`totalForks`/`totalWatchers` take the max
(`:59-61`).

`primaryReviewsSubmittedCount` is preserved separately from the summed value:

```ts
reviewsSubmittedCount: primary.reviewsSubmittedCount + supplemental.reviewsSubmittedCount,
primaryReviewsSubmittedCount: primary.reviewsSubmittedCount,
```
— `apps/web/lib/github/merge.ts:52-53`

This is the only existing precedent in the merge layer for retaining a pre-merge
value alongside the merged one.

---

## 6. Supplemental storage and read path

**Write** — `apps/web/app/api/supplemental/route.ts`, in order:

1. Bearer-token requirement — `:18-21`
2. IP rate limit, `rateLimitStrict`, 10/hour — `:24-33`
3. `resolveRequestAuth` — `:35-38`
4. Body parse with 256 KB cap (`MAX_SUPPLEMENTAL_BYTES` at `:14`) — `:42-52`
5. Field + shape validation (`isValidHandle`, `isValidEmuHandle`, `isValidStatsShape`) — `:56-70`
6. `assertHandleOwnership(auth, targetHandle)` — `:76`
7. Per-handle rate limit, 10/24h — `:81`
8. Parallel write: `cacheSet('supplemental:<lower>', …, 86400)` (best-effort, errors swallowed at `:100-104`) and `dbUpsertSupplemental` (success criterion) — `:105-110`
9. `if (!dbOk) return 500` — `:112-117`
10. `invalidateProfileReadModels(targetHandle, { stats: true, badgeSvg: true, snapshot: true, history: true })` — `:120-125`
11. `markStatsDirty(targetHandle)` — `:129`
12. `return { success: true }` — `:131`

Given those flags, `invalidateProfileReadModels` deletes:

- `stats:v2:merged:<lower>` — `apps/web/lib/profile/post-write-invalidation.ts:29-31`
- `buildBadgeSvgCacheKey(handle, today)` — `:41-48`
- `buildSnapshotKey(handle)` — `:51-53`
- history cache via `invalidateHistoryCache` — `:57-59`

It does **not** delete `stats:stale:<handle>` — no branch in the function references
that key (`post-write-invalidation.ts:23-61`).

**Read** — `client.ts:242-256`: Redis first, Supabase (`dbGetSupplemental`,
`apps/web/lib/db/supplemental.ts:78-100`) on miss, then fire-and-forget rehydration of
Redis unless `readOnly`. `dbGetSupplemental` lowercases the handle at
`supplemental.ts:88`. One row per target handle, `onConflict: "target_handle"`
(`supplemental.ts:63`).

**Dirty marker** — `apps/web/lib/cache/dirty-stats.ts`: key `stats:dirty:<lower>`
(`:16-18`), TTL 3600 (`:14`), set by `markStatsDirty` (`:21-23`), read by
`isStatsDirty` (`:26-29`), cleared by `clearStatsDirty` (`:32-34`).

---

## 7. Downstream consumption

`materializeProfile` reads stats and the dirty marker concurrently
(`materialize-profile.ts:130-139`), then:

```ts
const inputsChanged = options.inputsChanged ?? dirtyFromCache;
```
— `apps/web/lib/profile/materialize-profile.ts:157`

`materializeImpactState` computes the fresh score and keeps smoothing only for the
persisted snapshot:

```ts
const rawImpact = computeImpactV6(stats, craftResult?.craftScore);
const smoothedImpact = applyImpactScorePolicy(rawImpact, latestSnapshot, {…});
const displayImpact = rawImpact;
```
— `apps/web/lib/profile/materialize-profile.ts:90-106`

```ts
statsComplete: statsLookComplete(stats),
```
— `apps/web/lib/profile/materialize-profile.ts:117`, where
`statsLookComplete = !isPoisonedStats(stats) && !isScopeBlindedStats(stats)`
(`:61-63`)

`statsComplete` gates, in `apps/web/lib/profile/public-profile.ts`:
- the verification/HMAC record — `if (!materialized.statsComplete) return null;` at `:40`
- snapshot persistence — `if (!materialized.statsComplete) { … return false; }` at `:104-115`, emitting `snapshot_skipped_incomplete_stats` at `:107`
- the side-effect dedup short-circuit at `:90`

`inputsChanged` gates:
- the once-per-day SETNX guard — `if (guardStatus === "exists" && !materialized.inputsChanged) return false;` — `public-profile.ts:127`
- insert vs replace — `{ mode: materialized.inputsChanged ? "replace" : "insert" }` — `public-profile.ts:136`
- clearing the marker — `if (persisted && materialized.inputsChanged) { await clearStatsDirty(handle); }` — `public-profile.ts:154-156`

Fields the two most-affected dimensions read:

```ts
export function computeDelivery(stats: StatsData): number {
  const pr = normalize(stats.prsMergedWeight, CAPS.prWeight);
  const issues = normalize(stats.issuesClosedCount, CAPS.issues);
  const commits = normalize(stats.commitsTotal, CAPS.commits);
  …
  const modifier = computeLeadTimeModifier(stats.medianPrLeadTimeHours);
```
— `apps/web/lib/impact/v6.ts:74-80`

```ts
export function computeQuality(stats: StatsData, profileType?: ProfileType): number {
  const reviews = normalize(stats.reviewsSubmittedCount, CAPS.reviews);
  if (stats.prsMergedCount > 0) {
    const ratio = stats.reviewsSubmittedCount / stats.prsMergedCount;
  …
  const batchSize = stats.batchSizeScore ?? BATCH_SIZE_DEFAULT;
```
— `apps/web/lib/impact/v6.ts:108-129`

`/api/refresh` deletes only one key before fetching:

```ts
await cacheDel(`stats:v2:merged:${normalizedHandle}`);
```
— `apps/web/app/api/refresh/route.ts:60`

It does not delete `stats:stale:`. After materializing it calls
`persistOrchestratedSnapshot(…, { mode: "replace" })` (`:87-89`) and then
`invalidateProfileReadModels(handle, { badgeSvg: true, snapshot: true, history: true })`
(`:103-107`) — note `stats` is **not** among those flags.

---

## 8. Existing test coverage over these seams

`apps/web/lib/github/client.test.ts` is 1700+ lines with ~80 `it` blocks. Mocks are
declared at `:8-86`; the shared fixture is `makeStats` wrapping
`apps/web/lib/test-helpers/fixtures.ts` at `client.test.ts:97-108`. The default in
`beforeEach` is `mockDbGetSupplemental.mockResolvedValue(null)` (`client.test.ts:133`).

`cacheGet` is mocked as an ordered sequence, so each test declares the three reads
explicitly. `setupCacheMiss` establishes the baseline shape:

```ts
mockCacheGet
  .mockResolvedValueOnce(null) // stats:v2:merged:test-user (primary)
  .mockResolvedValueOnce(null) // stats:stale:test-user (stale fallback)
  .mockResolvedValueOnce(null); // supplemental:test-user
```
— `apps/web/lib/github/client.test.ts:110-116`

Relevant groups:

| Group | Lines |
|---|---|
| `degraded PR fetch guard (#1002)` — 5 tests | `client.test.ts:155-253` |
| `scope-aware non-downgrading cache writes (#1004 phase 2)` — 10 tests | `client.test.ts:254-485` |
| supplemental merge tests — 5 tests | `client.test.ts:648-796` |
| stale-cache fallback — 9 tests | `client.test.ts:838-962` |
| request deduplication — 8 tests | `client.test.ts:963-1194` |
| Bitbucket / Codeberg / GitLab — 26 tests | `client.test.ts:1195-1710` |

**Cross-seam coverage.** Every test in the two guard groups declares
`// supplemental miss` / `null` for the third `cacheGet` — e.g.
`client.test.ts:301` (`"a public fetch does NOT overwrite an authenticated stats:v2:merged entry"`)
and `client.test.ts:331` (`"a public fetch does NOT overwrite an authenticated stats:stale entry"`).
Conversely, every supplemental test declares `null` for the stale read — e.g.
`client.test.ts:663-666` and `client.test.ts:777-780`.

After reading `client.test.ts`, `client.integrity.contract.test.ts`, `merge.test.ts`
and `stats-integrity.test.ts`: **no test exists in which a supplemental record is
present at the same time as a scope downgrade, and none in which a supplemental record
is present at the same time as `isDegradedPrFetch` returning true.** The two seams are
covered independently and never together.

The closest existing assertion to the interaction is
`client.test.ts:353-360`, which asserts the downgrade branch writes the stale object
to the primary key and that `result!.prsMergedCount` equals the stale value (904) —
with supplemental null.

Coverage floors in `vitest.config.ts` apply to
`apps/web/lib/impact/**` (95/90/95/95) and
`apps/web/lib/github/stats-integrity.ts` (90/85/90/90) per CLAUDE.md's CI-gates
section; `client.ts` itself is covered by the global floor only.

---

## 9. Documented history

Chronology from `git log`, dates from `%ad`:

| Date | Commit | Subject |
|---|---|---|
| 2026-04-26 | `52d7fa04` | `fix(scoring): persist supplemental EMU stats so a missed CLI day stops dropping work data` |
| 2026-07-07 | `9646f133` | `fix(scoring): guard against zero-PR fetch overwriting good stats (#1002)` |
| 2026-07-07 | `b9c1e935` | `feat(scoring): authoritative merged-PR count + fetch-integrity gate (#1004)` |
| 2026-07-07 | `3a9aa37a` | `feat(scoring): scope-aware, non-downgrading cache writes (#1004 phase 2)` |
| 2026-07-16 | `aed5926d` | `fix(scoring): re-arm degraded-fetch guards disarmed by #1004` |
| 2026-07-16 | `91158c13` | `fix(oauth): un-invert fetchScope — a user's own refresh was outranking the server token` |
| 2026-07-16 | `3c11d6dd` | `fix(scoring): teach heal-poisoned-stats + persist gate the #1045 corruption shape` |

The supplemental merge predates every integrity guard by ~10 weeks.

`docs/accepted-risks.md:275-281` records the OAuth-scope decision:

> **Risk:** The GitHub OAuth login requests only `read:user user:email` (`lib/auth/github.ts`, `OAUTH_SCOPES`). A user's session token therefore cannot read their private repositories, so `/api/refresh` sees only public merged PRs. …
> **Decision (owner, 2026-07-16):** keep the narrow scopes. …
> **Mitigation:** post-#1050, a scope-blind refresh is labeled `fetchScope: "public"` and can never outrank or overwrite the server token's complete data — it is *rejected* (last-known-good served), not corrupting. The hourly `warm-cache` cron (#1052) refreshes every score with the `repo`-scoped server `GITHUB_TOKEN`, so freshness no longer depends on user-initiated refreshes. …
> **Severity:** Low (a private-heavy user's manual Refresh is a near-no-op; the cron covers freshness within the hour)

This entry describes the rejection behaviour in terms of GitHub-derived data only. No
entry in `docs/accepted-risks.md` mentions supplemental or EMU data in connection with
the downgrade rule (grep for `supplemental|EMU` returns no other match in that file).

**ADRs.** `docs/decisions/` contains 10 files; grep for
`fetchScope|degraded|supplemental|integrity|1004|1002` matches only
`docs/decisions/2026-06-20-deployment-stack.md`. No ADR records the
scoring-data integrity contract, the scope-ranking rule, or the supplemental
feature — the contract exists only as code comments, CLAUDE.md bullets, and the
`accepted-risks.md` entry above.

**`scripts/heal-poisoned-stats.ts`** (with `scripts/heal-poisoned-stats.test.ts`)
is the maintenance repair path. `parseArgs` takes bare handles plus an `--apply`
flag, defaulting to dry-run (`:76-78`). `healHandle` (`:360-411`):

1. reads `stats:v2:merged:<handle>` and `stats:stale:<handle>` (`:367-370`)
2. classifies each via `statsValueIsPoisoned`, which ORs `isPoisonedStats` and
   `isScopeBlindedStats` (`:225-232`)
3. fetches snapshot rows and selects poisoned dates via
   `selectPoisonedSnapshotDates`, using the same two predicates (`:274-288`)
4. under `--apply`, `DEL`s whichever of the two stats keys is poisoned, `DEL`s
   the snapshot key if either was, and deletes the poisoned Supabase snapshot
   rows (`:385-401`)

The script recognises exactly two corruption shapes — both defined in terms of
`prsMergedCount` / `prsMergedWeight` / lines. It has no notion of supplemental
data, and its key list does not include `supplemental:<handle>`.

CLAUDE.md's "Scoring-data integrity contract (#1004, corrected #1045)" bullet
enumerates three boundaries — fetch, cache, persist — and describes the cache boundary
as governing `fetchScope`-ranked writes. It does not state whether supplemental data
falls inside or outside that contract.

---

## 10. Observed production behaviour (2026-08-11, handle `frivas`)

Recorded here as measured fact, since it is the concrete instance the issues describe.

| Time (UTC) | Observation |
|---|---|
| 08:01:47 | `stats:v2:merged:frivas` held `fetchScope: "authenticated"`, `prsMergedCount: 0`, `commitsTotal: 54`, `reposContributed: 2` |
| 11:13:54 | `supplemental_stats` row written with `target_handle = frivas-at-navteca` |
| 11:14:49 | `supplemental_stats` row written with `target_handle = frivas`, `source_handle = frivas-at-navteca` — 453 commits, 32 PRs, weight 74.47, 17 repos, 366 heatmap days |
| 11:14:57 | `metrics_snapshots` row for 2026-08-11: composite 16, archetype `Emerging`, `prs_merged_count 0` |
| 11:23 | `GET /u/frivas/badge.svg` rendered `16 / Emerging`; `stats:v2:merged:frivas` held `fetchedAt: 2026-08-11T08:01:47.493Z` — identical content to `stats:stale:frivas`, no `hasSupplementalData` field |
| 11:29:33 | After the three read-model keys were deleted and one tokenless request rebuilt the entry: `commitsTotal 507`, `prsMergedCount 32`, `reposContributed 19`, `hasSupplementalData: true`, `fetchScope: "authenticated"` |
| 11:29:34 | `metrics_snapshots` row replaced: composite 68, `building 100`, archetype `Builder`, `prs_merged_count 32` |

The 08:01 `fetchedAt` on an entry present after the 11:14:49 invalidation is the
observable signature of a write whose payload was the pre-fetch `stale` object rather
than the freshly composed one.

---

## 11. Open questions for the planning phase

1. `mergeStats` is used for both linked platforms and supplemental, distinguished only
   by `markAsSupplemental`. Whether the guards should treat linked-platform data the
   same as EMU data is not settled by anything in the codebase or docs.
2. `stats:stale` currently stores the fully merged object (asserted at
   `client.test.ts:790-795`). Whether the protected baseline is intended to hold
   GitHub-derived data or fully merged data is not documented anywhere.
3. `/api/refresh` does not pass `stats: true` to `invalidateProfileReadModels`
   (`refresh/route.ts:103-107`) but does `cacheDel` the merged key directly at `:60`.
   The asymmetry with `/api/supplemental` (`supplemental/route.ts:120-125`) is not
   documented.
4. `isDegradedPrFetch`'s `authenticated` telemetry field is `Boolean(token)`
   (`client.ts:372`), which is the pre-#1050 notion of scope, not `stats.fetchScope`.

---

## Appendix: files read in full

`apps/web/lib/github/client.ts`, `apps/web/lib/github/stats-integrity.ts`,
`apps/web/lib/github/merge.ts`, `apps/web/lib/cache/dirty-stats.ts`,
`apps/web/lib/db/supplemental.ts`, `apps/web/lib/profile/post-write-invalidation.ts`,
`apps/web/lib/profile/materialize-profile.ts`,
`apps/web/lib/profile/orchestrated-profile.ts`,
`apps/web/app/api/supplemental/route.ts`.

Partially read: `apps/web/lib/profile/public-profile.ts` (1-175),
`apps/web/app/api/refresh/route.ts` (36-110),
`apps/web/lib/github/client.test.ts` (1-140, 294-360, 648-800, plus full `describe`/`it` index),
`apps/web/lib/auth/resolve-request-auth.ts` (1-60),
`apps/web/lib/impact/v6.ts` (74-129), `docs/accepted-risks.md` (265-290).
