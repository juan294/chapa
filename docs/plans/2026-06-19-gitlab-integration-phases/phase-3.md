# Phase 3 — Stats package (`lib/gitlab/`)

> Parent: [GitLab integration plan](../2026-06-19-gitlab-integration.md) | Issue #855 | Depends on: Phases 1, 2

## Goal

Fetch GitLab contribution data and transform it into the standard `StatsData` shape, mirroring `lib/codeberg/`. The two GitLab-specific challenges: **reconstruct the heatmap from the Events API** (no calendar endpoint) and **map merged MRs → PR fields with per-MR diffstat** (capped).

## New files (mirror `lib/codeberg/`)

### 1. `apps/web/lib/gitlab/types.ts`
```
export interface GitlabEvent { created_at: string; action_name?: string; push_data?: { commit_count: number }; target_type?: string | null; }
export interface GitlabProject { id: number; path_with_namespace: string; star_count: number; forks_count: number; namespace: { path: string }; owner?: { username: string }; }
export interface GitlabMergeRequest { id: number; iid: number; project_id: number; state: string; merged_at: string | null; author: { username: string }; }
export interface GitlabMrDiffStat { additions: number; deletions: number; changed_files: number; }   // from /changes
export interface RawGitlabData {
  username: string; displayName: string; avatarUrl: string;
  heatmap: { date: string; count: number }[];          // pre-bucketed by date (DELTA: already date-keyed, unlike Codeberg's timestamps)
  mergedPRs: { additions: number; deletions: number; changed_files: number }[];
  reviewsCount: number;
  closedIssues: number;
  repos: { fullName: string; commitCount: number; isOwned: boolean; starsCount: number; forksCount: number; watchersCount: number }[];
}
```

### 2. `apps/web/lib/gitlab/queries.ts` — `fetchGitlabContributionData(userId, username, accessToken, profile): RawGitlabData | null`

Constants: `GL_API = "https://gitlab.com/api/v4"`, `FETCH_TIMEOUT_MS = 30_000`, `MAX_PRS = 100`, `MAX_PAGES = 5`, `PAGE_SIZE = 100`. All requests `Authorization: Bearer <token>`.

```
// 1. Heatmap from events (DELTA — the core GitLab-specific work)
//    GET /users/:id/events?after=<window start YYYY-MM-DD>&per_page=100  (paginated, MAX_PAGES)
//    bucket by toDateString(created_at):
//      push event → += push_data.commit_count
//      other contribution event (opened MR/issue, pushed new, approved, commented) → += 1
//    return [{date, count}] sorted asc, filtered to SCORING_WINDOW_DAYS
//    auth failure (401/403) on first page → return null (propagates "not linked/failed")

// 2. Merged MRs (global scope — DELTA: no per-repo loop)
//    GET /merge_requests?author_username=<u>&state=merged&scope=all&per_page=100 (paginated, cap MAX_PRS)

// 3. Per-MR diffstat (capped) — for prsMergedWeight fidelity (locked decision)
//    for each merged MR (up to MAX_PRS): GET /projects/:project_id/merge_requests/:iid/changes
//      sum additions/deletions across changes[].diff (or use diff_stats if present); changed_files = changes.length
//      on per-MR failure → contribute {0,0,0} for that MR (don't fail the batch)

// 4. Reviews (approvals given) — graceful Premium fallback (locked decision)
//    GET /merge_requests?reviewer_username=<u>&scope=all&per_page=100 (cap)
//    for each: GET /projects/:id/merge_requests/:iid/approvals → +1 if <u> in approved_by[].user.username
//    403/404 (Premium-gated) → treat as 0 reviews, continue

// 5. Closed issues authored by user
//    GET /issues?author_username=<u>&state=closed&scope=all&per_page=100 → count

// 6. Owned projects for social metrics
//    GET /users/:id/projects?per_page=100 → repos[]: isOwned = namespace.path === username,
//      starsCount/forksCount = isOwned ? star_count/forks_count : 0, watchersCount: 0 (GitLab has no watchers)
//      commitCount proxy = merged PR count in that project (or events-derived)
```

### 3. `apps/web/lib/gitlab/stats-aggregation.ts` — `buildStatsFromGitlab(raw): StatsData` (pure, mirror `buildStatsFromCodeberg`)
```
// heatmap already date-bucketed → HeatmapDay[] sorted
// commitsTotal = sum(heatmap.count); activeDays = count(heatmap.count > 0)
// prsMergedCount = mergedPRs.length
// prsMergedWeight = min( sum(computePrWeight({additions,deletions,changedFiles: changed_files})), PR_WEIGHT_AGG_CAP )
// linesAdded/linesDeleted = sums
// reviewsSubmittedCount = raw.reviewsCount
// issuesClosedCount = raw.closedIssues
// reposContributed = repos with commitCount >= REPO_DEPTH_THRESHOLD
// topRepoShare = max(commitCount)/sum(commitCount)
// maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0
// totalStars/totalForks = sum over owned repos; totalWatchers = 0
// return StatsData { handle: raw.username, displayName, avatarUrl, ...all fields..., fetchedAt: new Date().toISOString() }
```

### 4. `apps/web/lib/gitlab/stats.ts` — `fetchGitlabStats(userId, username, accessToken, profile): StatsData | null`
```
const raw = await fetchGitlabContributionData(userId, username, accessToken, profile);
if (!raw) return null;
return buildStatsFromGitlab(raw);
```

### 5. `apps/web/lib/gitlab/client.ts` — `fetchGitlabIfLinked(handle, lowerHandle): StatsData | null` (mirror codeberg client)
```
cacheKey = `stats:v2:gitlab:${lowerHandle}`; CACHE_TTL = 21600
cache hit → return; isGitlabEnabled() false → null; dbGetLinkedPlatform(handle,"gitlab") null → null
if isTokenExpired(expiresAt):
  no refreshToken & expiresAt!==null → dbDeleteLinkedPlatform; return null
  else refreshGitlabToken(...) → !ok: if "revoked" dbDeleteLinkedPlatform; return null
       ok → accessToken = tokens.access_token; dbUpdatePlatformTokens(...)
// NOTE: GitLab user id needed for events/projects endpoints. dbGetLinkedPlatform stores remote_login only.
//   → resolve numeric id at fetch time via fetchGitlabUser(accessToken) is insufficient (no id field mapped);
//   extend GitlabUser mapping to also return `id`, OR call GET /user here to get id, then fetchGitlabStats(id, login, token, ...)
stats = fetchGitlabStats(userId, linked.remoteLogin, accessToken, { displayName: linked.remoteLogin, avatarUrl: "" })
cacheSet(cacheKey, stats, CACHE_TTL) if stats; return stats
```

## Implementation note — GitLab numeric user id

GitLab's events/projects endpoints key on numeric `user_id`, but `user_platforms` stores `remote_login` (username) only. Resolve the id inside `fetchGitlabIfLinked` by calling `GET /user` (already implemented as `fetchGitlabUser`) — extend `GitlabUser`/`fetchGitlabUser` (Phase 2 file) to also surface `id`, or add a lightweight `fetchGitlabUserId(token)` here. No schema change (avoids storing id). This is the one GitLab-specific deviation from the Codeberg client shape; document it inline.

## Tests (write first)

- `apps/web/lib/gitlab/stats-aggregation.test.ts` (pure-function, highest value): heatmap→commits/activeDays; MR diffstat→prsMergedWeight cap; social metrics from owned repos only; `totalWatchers === 0`; empty input → zeroed StatsData.
- `apps/web/lib/gitlab/queries.test.ts` (mock `fetch`): events bucket by date with push commit_count; pagination stops at MAX_PAGES / short page; 401 first page → null; per-MR diffstat failure contributes 0; approvals 403 → 0 reviews (no throw).
- `apps/web/lib/gitlab/client.test.ts`: cache hit short-circuits; flag off → null; not linked → null; expired token + revoked refresh → deletes link + null; expired + transient → null (keeps link); success caches.
- `apps/web/lib/gitlab/stats.test.ts`: null raw → null; else delegates to aggregation.

## Success criteria — ✅ COMPLETE (2026-06-19)

**Automated:**
- [x] `pnpm run test` green — **454 files / 7721 tests passing**.
- [x] `pnpm run typecheck` green.
- [x] `pnpm run lint` green.
- [x] aggregation + queries + client + stats tests (incl. events 403→null, pagination short-page + MAX_PAGES cap).

**Manual:** none.

Implemented in worktree `gitlab-foundation` (stacked on Phases 1–2). Reviewer (plan + correctness): PASS — logic correct; added 2 plan-required test gaps it flagged (events 403, pagination stop). 3 correctness concerns accepted (30s timeout matches Codeberg + plan-locked cap; force-push `commit_count:0` is spec; `fetchPaginated` non-200 stop mirrors Codeberg). `/simplify`: removed a redundant `mrs.slice(0, MAX_PRS)` (already capped by `fetchMergedMRs`). **Live API validation**: probed real GitLab endpoints via authed `glab` CLI — events/MR/projects/issues shapes + params confirmed.
