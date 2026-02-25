# Bitbucket Integration Research

> Date: 2026-02-23
> Status: Research complete — no implementation decision yet
> Related: `docs/research/multi-platform.md` (2026-02-18, covers GitLab/Codeberg/Gitea — not Bitbucket)

## Executive Summary

Chapa's architecture is **fundamentally platform-agnostic**. The scoring pipeline (`StatsData` → `computeImpactV4()` → `ImpactV4Result`) contains zero GitHub-specific logic. All platform coupling lives in three layers: the GraphQL query (`packages/shared/src/github-query.ts`), the fetch function (`apps/web/lib/github/queries.ts`), and the OAuth flow (`apps/web/lib/auth/github.ts`, `apps/web/app/api/auth/callback/route.ts`).

The existing `SupplementalStats` + `mergeStats()` pattern already demonstrates multi-source aggregation. A Bitbucket integration would follow this blueprint: fetch Bitbucket data via its REST API, transform it into `StatsData` shape, and merge it with the GitHub data using the same `mergeStats()` function.

---

## 1. Bitbucket Platform Assessment

| Attribute | Details |
|-----------|---------|
| **Backing** | Atlassian (NASDAQ: TEAM, ~$45B market cap) |
| **Model** | SaaS (bitbucket.org) + self-hosted (Bitbucket Data Center, formerly Server) |
| **Users** | 10M+ developers, widely used in enterprise |
| **API** | REST 2.0 (JSON), no GraphQL |
| **Auth** | OAuth 2.0 (3-legged), App passwords (PATs), repository access tokens |
| **Rate limits** | 1,000 req/hr per user (authenticated) |
| **Data model match** | High — repos, pull requests (≈PRs), issues (limited), code review comments |
| **Heatmap API** | No direct contribution calendar endpoint — must reconstruct from commit history |
| **Key gaps** | No stars/forks equivalent, issues are limited (many teams use Jira instead), no contribution calendar API |
| **Feasibility** | **4/5** |

---

## 2. Bitbucket REST API — Data Endpoints

All endpoints prefixed with `https://api.bitbucket.org/2.0/`.

### User profile
```
GET /user                              → authenticated user (login, display_name, links.avatar.href)
GET /users/{username}                  → public profile
```

### Repositories
```
GET /repositories/{workspace}          → list all repos in a workspace
GET /repositories/{workspace}/{slug}   → single repo metadata (has_issues, forks, watchers — but watchers not public)
```

**Key difference from GitHub:** Bitbucket organizes repos under **workspaces** (≈GitHub organizations). A user can belong to multiple workspaces. Getting "all repos a user contributed to" requires iterating workspaces or using the commit search.

### Pull Requests
```
GET /repositories/{workspace}/{slug}/pullrequests?state=MERGED    → merged PRs
GET /repositories/{workspace}/{slug}/pullrequests/{id}/diffstat   → additions, deletions, files changed
```

Each PR has: `author`, `created_on`, `updated_on`, `state` (OPEN/MERGED/DECLINED/SUPERSEDED), `merge_commit`, `close_source_branch`.

**Mapping to StatsData:**
- `prsMergedCount` → count of PRs with `state=MERGED`
- `prsMergedWeight` → compute from diffstat (additions + deletions + changedFiles)
- `linesAdded` / `linesDeleted` → from diffstat per merged PR

### Code Reviews (PR Activity)
```
GET /repositories/{workspace}/{slug}/pullrequests/{id}/activity   → comments, approvals, changes requested
GET /repositories/{workspace}/{slug}/pullrequests/{id}/comments   → review comments
```

Bitbucket tracks **approvals** and **comments** on PRs, but does not have a first-class "review submitted" event like GitHub's `PullRequestReviewEvent`. The closest mapping:
- `reviewsSubmittedCount` → count of **approvals** + **request-changes** events across repos the user participated in

### Commits
```
GET /repositories/{workspace}/{slug}/commits                      → commit history
GET /repositories/{workspace}/{slug}/commits?include={branch}     → branch-scoped
```

Each commit has: `hash`, `date`, `author.raw` (name + email), `message`, `parents`.

**Mapping to StatsData:**
- `commitsTotal` → count commits authored by user across all repos
- `activeDays` → count unique dates with 1+ commit
- `heatmapData` → aggregate commits per date into `HeatmapDay[]`
- `maxCommitsIn10Min` → requires timestamp-level granularity (commit `date` field provides this)

### Issues
```
GET /repositories/{workspace}/{slug}/issues?status=resolved       → closed issues
```

**Important caveat:** Many Bitbucket teams disable the built-in issue tracker in favor of Jira. The `has_issues` repo flag indicates availability. When issues are disabled, `issuesClosedCount` would be 0 — this naturally produces a lower Delivery score but is accurate.

### Social Metrics (Stars / Forks / Watchers)

**Bitbucket does NOT have stars.** It has:
- **Watchers** — users who receive notifications (loosely equivalent to GitHub watch, not star). Not publicly countable via API.
- **Forks** — repos forked from the user's repo. Countable: `GET /repositories/{workspace}/{slug}/forks`.

**Mapping to StatsData:**
- `totalStars` → **0** (no equivalent — Bitbucket does not have a "star" concept)
- `totalForks` → sum of fork counts across owned repos
- `totalWatchers` → **0** (not publicly accessible via API)

This is a **known gap**. The scoring pipeline handles zero gracefully — `normalize(0, cap)` returns 0, so Breadth's stars/watchers components simply contribute nothing for Bitbucket-only users. When merged with GitHub data via `mergeStats()`, the `Math.max()` strategy for social metrics means GitHub's values would prevail.

---

## 3. Current Architecture — Where GitHub Coupling Lives

### Layer 1: OAuth Flow (GitHub-specific)

| File | What it does | Coupling |
|------|-------------|----------|
| `apps/web/lib/auth/github.ts:17-25` | `buildAuthUrl()` — constructs GitHub OAuth authorize URL | Hard: `github.com/login/oauth/authorize` |
| `apps/web/lib/auth/github.ts:74-99` | `exchangeCodeForToken()` — exchanges code for access token | Hard: `github.com/login/oauth/access_token` |
| `apps/web/lib/auth/github.ts:105-125` | `fetchGitHubUser()` — fetches user profile | Hard: `api.github.com/user` |
| `apps/web/lib/auth/github.ts:142-160` | `fetchGitHubUserEmail()` — fetches primary email | Hard: `api.github.com/user/emails` |
| `apps/web/app/api/auth/callback/route.ts` | OAuth callback handler — exchanges code, creates session | Hard: calls all above functions |
| `apps/web/app/api/auth/login/route.ts` | Login redirect — builds GitHub OAuth URL | Hard: calls `buildAuthUrl()` |

**Session payload** (`apps/web/lib/auth/github.ts:213-218`):
```typescript
interface SessionPayload {
  token: string;   // GitHub OAuth access token
  login: string;   // GitHub handle
  name: string | null;
  avatar_url: string;
}
```

The session cookie stores the GitHub OAuth token encrypted with AES-256-GCM. This token is later passed to `getStats()` for authenticated API calls.

### Layer 2: Data Fetching (GitHub-specific)

| File | What it does | Coupling |
|------|-------------|----------|
| `packages/shared/src/github-query.ts` | GraphQL query string | Hard: GitHub GraphQL schema |
| `apps/web/lib/github/queries.ts:13-101` | `fetchContributionData()` — calls `api.github.com/graphql` | Hard: GitHub GraphQL endpoint |
| `packages/shared/src/stats-aggregation.ts:14-106` | `buildStatsFromRaw()` — transforms `RawContributionData` → `StatsData` | Medium: expects GitHub's `RawContributionData` shape |
| `apps/web/lib/github/client.ts:29-54` | `getStats()` — orchestrates cache → fetch → merge → cache | Low: operates on `StatsData`, references GitHub fetch |

### Layer 3: Data Merging (Platform-agnostic)

| File | What it does | Coupling |
|------|-------------|----------|
| `apps/web/lib/github/merge.ts:18-58` | `mergeStats()` — merges two `StatsData` objects | **None** — operates on `StatsData` only |
| `apps/web/lib/impact/v4.ts:24-229` | `computeImpactV4()` — scores from `StatsData` | **None** — pure function on `StatsData` |
| `apps/web/lib/impact/utils.ts:50-138` | Confidence, adjusted score, tier | **None** — pure functions |
| `apps/web/lib/render/BadgeSvg.tsx` | Badge SVG rendering | **None** — operates on `StatsData` + `ImpactV4Result` |

### Layer 4: Supplemental Data (existing multi-source pattern)

| File | What it does | Coupling |
|------|-------------|----------|
| `apps/web/app/api/supplemental/route.ts` | Upload endpoint — validates, stores in Redis | Low: auth via GitHub PAT or CLI token |
| `apps/web/lib/github/client.ts:80-81` | Merges supplemental data: `mergeStats(primary, supplemental.stats)` | **None** |
| `apps/web/lib/validation.ts:113-155` | `isValidStatsShape()` — validates uploaded `StatsData` | **None** — validates shape only |

**Key insight:** The supplemental upload endpoint at `POST /api/supplemental` already accepts any `StatsData` from any source. The only GitHub-specific part is the token verification (`resolveHandle()` at line 14). A Bitbucket user could upload data via this pattern today if they had a way to generate it.

---

## 4. StatsData Field Mapping: Bitbucket → StatsData

| StatsData Field | Source | Bitbucket API Endpoint | Notes |
|----------------|--------|----------------------|-------|
| `handle` | User profile | `GET /user` → `username` | |
| `displayName` | User profile | `GET /user` → `display_name` | |
| `avatarUrl` | User profile | `GET /user` → `links.avatar.href` | |
| `commitsTotal` | Commit history | `GET /repositories/{ws}/{slug}/commits` → count by author | Must iterate all repos |
| `activeDays` | Derived | Unique dates from commits | |
| `prsMergedCount` | Pull requests | `GET /repositories/{ws}/{slug}/pullrequests?state=MERGED` → count | |
| `prsMergedWeight` | PR diffstat | `GET /repositories/{ws}/{slug}/pullrequests/{id}/diffstat` | Per-PR API call required |
| `reviewsSubmittedCount` | PR activity | `GET /repositories/{ws}/{slug}/pullrequests/{id}/activity` → approvals + change-requests by user | |
| `issuesClosedCount` | Issues | `GET /repositories/{ws}/{slug}/issues?status=resolved` → count where assignee is user | Only when issue tracker enabled |
| `linesAdded` | PR diffstat | From merged PR diffstats | |
| `linesDeleted` | PR diffstat | From merged PR diffstats | |
| `reposContributed` | Derived | Repos where user has commits above `REPO_DEPTH_THRESHOLD` (3) | |
| `topRepoShare` | Derived | Max repo commit count / total commits | |
| `maxCommitsIn10Min` | Commit timestamps | Sliding window analysis on commit dates | |
| `microCommitRatio` | Commit analysis | Ratio of commits with <5 lines changed | Requires per-commit diffstat |
| `docsOnlyPrRatio` | PR analysis | Ratio of PRs touching only docs files | Requires diffstat file paths |
| `totalStars` | N/A | **0** — Bitbucket has no stars | |
| `totalForks` | Repo forks | `GET /repositories/{ws}/{slug}/forks` → count per owned repo | |
| `totalWatchers` | N/A | **0** — not publicly accessible | |
| `heatmapData` | Derived | Commits aggregated by date into `HeatmapDay[]` | |
| `fetchedAt` | System | Current timestamp | |

### API Call Budget Estimate

For a user with ~10 active repos and ~50 merged PRs:
- 1 call: user profile
- 1 call: list workspaces
- ~10 calls: list repos per workspace (paginated)
- ~10 calls: list merged PRs per repo (paginated)
- ~50 calls: diffstat per merged PR
- ~10 calls: commit history per repo
- ~10 calls: PR activity per repo (for reviews)
- ~10 calls: issues per repo

**Total: ~100-150 API calls** at 1,000/hr rate limit → comfortably within limits for a single user fetch.

GitHub's GraphQL batches all this into **1 call**. Bitbucket's REST API requires many calls but the rate limit is adequate for daily caching.

---

## 5. Existing Merge Infrastructure

### `mergeStats()` — Already Multi-Source Ready

`apps/web/lib/github/merge.ts:18-58`

The function merges two `StatsData` objects with these rules:
- **Additive fields** (commits, PRs, reviews, issues, LOC, repos): summed
- **Social metrics** (stars, forks, watchers): `Math.max()` — prevents double-counting
- **Heatmap**: merged by date (sum counts for same day), sorted chronologically
- **`activeDays`**: recomputed from merged heatmap
- **`topRepoShare`**: approximated — `max(P*shareP, S*shareS) / (P+S)`
- **`prsMergedWeight`**: summed, capped at `PR_WEIGHT_AGG_CAP` (120)
- **Identity fields**: kept from primary (handle, displayName, avatarUrl, fetchedAt)
- **Flag**: sets `hasSupplementalData: true`

This works without modification for Bitbucket data. A Bitbucket `StatsData` with `totalStars: 0` and `totalWatchers: 0` would simply let the GitHub values prevail via `Math.max()`.

### `getStats()` — Supplemental Merge Point

`apps/web/lib/github/client.ts:79-81`:
```typescript
const supplemental = await cacheGet<SupplementalStats>(`supplemental:${lowerHandle}`);
const stats = supplemental ? mergeStats(primary, supplemental.stats) : primary;
```

Currently, this merges one supplemental source. For multi-platform, this could chain: `mergeStats(mergeStats(github, bitbucket), gitlab)`. The `mergeStats()` function is associative for additive fields.

### Cache Key Structure

`apps/web/lib/github/client.ts:34`:
```typescript
const cacheKey = `stats:v2:${lowerHandle}`;
```

Current keys are platform-implicit (always GitHub). Multi-platform would need:
```
stats:v2:github:<handle>       → GitHub-only StatsData
stats:v2:bitbucket:<handle>    → Bitbucket-only StatsData
stats:v2:merged:<handle>       → Combined StatsData
```

### Confidence Penalty: `supplemental_unverified`

`apps/web/lib/impact/utils.ts:110-117`:
```typescript
if (stats.hasSupplementalData) {
  penalties.push({
    flag: "supplemental_unverified",
    penalty: 5,
    reason: "Includes activity from a linked account that cannot be independently verified.",
  });
  score -= 5;
}
```

Any merged data triggers a -5 confidence penalty. This is appropriate for Bitbucket data fetched via API (independently verifiable) vs. EMU data (self-reported). A future refinement might distinguish between "verified supplemental" (fetched via OAuth) and "unverified supplemental" (uploaded via CLI).

---

## 6. OAuth Architecture: Adding Bitbucket

### Current OAuth Flow (GitHub)

```
User clicks "Login with GitHub"
  → GET /api/auth/login → redirects to github.com/login/oauth/authorize
  → GitHub redirects to /api/auth/callback?code=XXX&state=YYY
  → /api/auth/callback:
      1. validateState() (CSRF check)
      2. exchangeCodeForToken() → GitHub access token
      3. fetchGitHubUser() → { login, name, avatar_url }
      4. fetchGitHubUserEmail() → primary verified email
      5. createSessionCookie() → AES-256-GCM encrypted { token, login, name, avatar_url }
      6. Redirect to /generating/{login}
```

### Bitbucket OAuth 2.0

Bitbucket uses standard OAuth 2.0 (RFC 6749):
- **Authorization URL**: `https://bitbucket.org/site/oauth2/authorize`
- **Token URL**: `https://bitbucket.org/site/oauth2/access_token`
- **Scopes**: `account` (profile), `repository` (read repos), `pullrequest` (read PRs)
- **Token type**: Bearer (access token + refresh token)

**Key difference from GitHub:** Bitbucket tokens expire (typically 2 hours) and require refresh. GitHub OAuth tokens do not expire. This means the session/storage layer would need to handle refresh tokens.

### Bitbucket as a **Linked Account** (Not Primary Login)

The most natural integration pattern is:
1. User logs in with **GitHub** (primary identity, unchanged)
2. User links their **Bitbucket** account in settings/studio
3. Chapa fetches Bitbucket data using the linked token
4. Data is merged with GitHub data via `mergeStats()`

This avoids the complexity of multi-provider primary authentication and keeps the GitHub handle as the canonical identity (matching the current session model at `apps/web/lib/auth/github.ts:213-218`).

### Database Storage for Linked Accounts

The existing `multi-platform.md` research doc proposes:
```sql
CREATE TABLE user_platforms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),
  platform     text NOT NULL,
  instance_url text,
  remote_login text NOT NULL,
  token        text,           -- encrypted OAuth token
  connected_at timestamptz DEFAULT now(),
  UNIQUE(user_id, platform, instance_url)
);
```

For Bitbucket specifically, this would also need:
- `refresh_token text` — Bitbucket tokens expire
- `token_expires_at timestamptz` — to know when to refresh

---

## 7. Data Pipeline Comparison

### Current GitHub Pipeline

```
fetchContributionData()                          [queries.ts:13-101]
  → 1 GraphQL call to api.github.com/graphql
  → Returns RawContributionData

buildStatsFromRaw(raw)                           [stats-aggregation.ts:14-106]
  → Transforms RawContributionData → StatsData
  → Pure function

getStats(handle, token)                          [client.ts:29-91]
  → Cache check → fetchStats() → merge supplemental → cache set
  → Returns StatsData
```

### Proposed Bitbucket Pipeline

```
fetchBitbucketData(username, token)              [NEW: bitbucket/queries.ts]
  → ~100-150 REST calls to api.bitbucket.org/2.0/
  → Returns RawBitbucketData (new type)

buildStatsFromBitbucket(raw)                     [NEW: bitbucket/stats-aggregation.ts]
  → Transforms RawBitbucketData → StatsData
  → Pure function

getBitbucketStats(handle, token)                 [NEW: bitbucket/client.ts]
  → Cache check → fetch → cache set
  → Returns StatsData

// In the merged pipeline:
getStats(handle, githubToken)                    [github/client.ts — modified]
  → Fetch GitHub StatsData
  → Fetch Bitbucket StatsData (if linked)
  → mergeStats(github, bitbucket)
  → Return merged StatsData
```

---

## 8. Scoring Implications

### Dimensions That Work Unchanged

All four dimensions operate on `StatsData` and are **completely platform-agnostic**:

| Dimension | Formula | Bitbucket data quality |
|-----------|---------|----------------------|
| **Delivery** | `0.7*norm(prWeight,60) + 0.2*norm(issues,40) + 0.1*norm(commits,300)` | Full: PRs + commits available. Issues may be 0 if Jira used |
| **Quality** | `0.6*norm(reviews,80) + 0.25*reviewRatio + 0.15*inverseMicro` | Partial: "approvals" map to reviews but may undercount |
| **Consistency** | `0.45*sqrt(activeDays/365) + 0.40*evenness + 0.15*inverseBurst` | Full: commits provide dates for heatmap |
| **Breadth** | `0.40*repos + 0.25*inverseConc + 0.10*stars + 0.05*forks + 0.15*docs` | Partial: no stars, limited watchers |

### Profile Type Detection

`apps/web/lib/impact/v4.ts:120-122`:
```typescript
export function detectProfileType(stats: StatsData): ProfileType {
  return stats.reviewsSubmittedCount === 0 ? "solo" : "collaborative";
}
```

A Bitbucket-only user who uses PR approvals would be detected as "collaborative". One who codes solo without review workflows would be "solo". The logic works correctly without modification.

### Confidence Penalties

`apps/web/lib/impact/utils.ts:50-138`:

The confidence system applies penalties based on data patterns, not data sources. A Bitbucket user with burst activity would still trigger `burst_activity`. The `supplemental_unverified` flag would apply to any merged data. No changes needed.

### Tier Mapping

`apps/web/lib/impact/utils.ts:156-161`:
```typescript
export function getTier(adjustedScore: number): ImpactTier {
  if (adjustedScore >= 85) return "Elite";
  if (adjustedScore >= 70) return "High";
  if (adjustedScore >= 30) return "Solid";
  return "Emerging";
}
```

Pure numeric threshold — no platform awareness. Works unchanged.

---

## 9. Key Differences from the EMU/Supplemental Pattern

| Aspect | Current Supplemental (EMU) | Proposed Bitbucket Integration |
|--------|--------------------------|-------------------------------|
| **Data source** | Self-reported (CLI upload) | Server-fetched (Bitbucket API) |
| **Verification** | Unverifiable (trust user) | Verifiable (OAuth token proves identity) |
| **Token management** | User provides GitHub PAT | OAuth 2.0 with refresh tokens |
| **Upload trigger** | Manual (CLI `chapa link`) | Automatic (fetch on badge request, cached) |
| **Cache strategy** | `supplemental:<handle>` (24h TTL) | `stats:v2:bitbucket:<handle>` (6h TTL, matching GitHub) |
| **Confidence penalty** | -5 (`supplemental_unverified`) | Could be 0 (server-verified) or -5 (conservative) |
| **Identity mapping** | User asserts targetHandle↔sourceHandle | OAuth proves Bitbucket identity, user links to GitHub handle |

---

## 10. Bitbucket-Specific API Challenges

### 1. No Contribution Calendar

GitHub provides a pre-computed contribution calendar via `contributionsCollection.contributionCalendar`. Bitbucket has no equivalent. The heatmap must be reconstructed by:
1. Iterating all repos the user contributed to
2. Fetching commit history with date filter (365 days)
3. Filtering commits authored by the authenticated user
4. Aggregating by date into `HeatmapDay[]`

This is more API calls but the data quality is equivalent.

### 2. No Stars

Bitbucket does not have a "star" concept. The `totalStars` field would be 0 for Bitbucket-only data. When merged with GitHub data, GitHub's star count prevails via `Math.max()`. For a Bitbucket-only user (no GitHub), Breadth's stars component contributes 0 — the other 4 components (repos, concentration, forks, docs) still function.

### 3. Workspace-Scoped Repos

GitHub's API returns "repositories contributed to" directly. Bitbucket requires:
1. List workspaces the user belongs to
2. For each workspace, list repos
3. For each repo, check if user has commits

This is O(workspaces × repos) API calls. Caching and pagination mitigate this.

### 4. Token Refresh

GitHub OAuth tokens don't expire. Bitbucket tokens expire in ~2 hours with a refresh token. The integration needs:
- Store both access and refresh tokens (encrypted)
- Check expiry before API calls
- Auto-refresh and update stored tokens

### 5. Review Semantics

GitHub has explicit "review submitted" events with states (APPROVED, CHANGES_REQUESTED, COMMENTED). Bitbucket has:
- PR approvals (binary: approved or not)
- PR comments (inline or general)
- No formal "request changes" workflow

Mapping: count approvals + "request changes" (if available via newer API) as reviews. This may slightly undercount compared to GitHub's review model.

---

## 11. File Inventory — What Exists, What Would Be New

### Existing (no changes needed)
- `packages/shared/src/types.ts` — `StatsData`, `ImpactV4Result`, all scoring types
- `packages/shared/src/constants.ts` — `SCORING_CAPS`, `SCORING_WINDOW_DAYS`
- `apps/web/lib/impact/v4.ts` — all scoring functions
- `apps/web/lib/impact/utils.ts` — confidence, tier, normalization
- `apps/web/lib/impact/heatmap-evenness.ts` — heatmap analysis
- `apps/web/lib/impact/recency.ts` — recency weighting
- `apps/web/lib/github/merge.ts` — `mergeStats()` (already multi-source ready)
- `apps/web/lib/render/BadgeSvg.tsx` — badge rendering
- `apps/web/lib/validation.ts:113-155` — `isValidStatsShape()` (validates any `StatsData`)

### Existing (minor modifications)
- `apps/web/lib/github/client.ts` — add Bitbucket fetch + merge step in `_fetchAndCache()`
- `apps/web/lib/cache/redis.ts` — new cache keys for `stats:v2:bitbucket:<handle>`
- `apps/web/lib/auth/github.ts` — session payload may need platform field
- `apps/web/app/api/auth/callback/route.ts` — no change if Bitbucket link is separate from login

### New files required
- `apps/web/lib/bitbucket/queries.ts` — Bitbucket REST API fetcher
- `apps/web/lib/bitbucket/stats-aggregation.ts` — `buildStatsFromBitbucket()` transform
- `apps/web/lib/bitbucket/client.ts` — cache-aware Bitbucket stats client
- `apps/web/lib/bitbucket/types.ts` — `RawBitbucketData` (raw API response shape)
- `apps/web/app/api/auth/bitbucket/connect/route.ts` — OAuth initiation for linking
- `apps/web/app/api/auth/bitbucket/callback/route.ts` — OAuth callback for linking
- Database migration — `user_platforms` table (or equivalent Supabase table)

---

## 12. Comparison with Multi-Platform Research

The earlier `docs/research/multi-platform.md` (2026-02-18) did NOT include Bitbucket in its assessment. It evaluated: GitLab, Codeberg, Gitea/Forgejo, Gitness, SourceHut, Radicle, OneDev.

### Why Bitbucket Was Likely Omitted

The multi-platform research focused on **open-source alternatives** to GitHub (platforms where developers migrate away from GitHub). Bitbucket is an Atlassian commercial product — it's less of an "alternative" and more of a "parallel platform" used alongside GitHub in enterprise contexts.

### Bitbucket vs. the Tier 1 Platforms

| Aspect | Bitbucket | GitLab | Codeberg |
|--------|-----------|--------|----------|
| **User base** | 10M+ | 30M+ | 200K+ |
| **API type** | REST only | REST + GraphQL | REST only |
| **Auth** | OAuth 2.0 (tokens expire) | OAuth 2.0 | OAuth 2.0 |
| **Stars** | No | Yes | Yes |
| **Heatmap API** | No (reconstruct from commits) | No (reconstruct from events) | Yes (dedicated endpoint) |
| **Enterprise adoption** | Very high (Atlassian ecosystem) | Very high | Low |
| **API call budget** | ~100-150 per user | Similar | Similar |
| **Feasibility** | 4/5 | 5/5 | 5/5 |

Bitbucket's feasibility is slightly lower than GitLab/Codeberg due to: no stars, no heatmap endpoint, workspace-scoped repos (more API calls), and token refresh requirement.

---

## 13. Platform-Agnostic Architecture Readiness

The proposed `PlatformQuery` interface from `docs/research/multi-platform.md` applies directly to Bitbucket:

```typescript
interface PlatformQuery {
  platform: "github" | "bitbucket" | "gitlab" | "gitea";
  fetchStats(login: string, token: string): Promise<StatsData>;
}
```

Each implementation:
1. Calls platform-specific API
2. Transforms response into `StatsData` shape
3. Returns normalized, platform-agnostic data

The scoring pipeline (`computeImpactV4`) and merge infrastructure (`mergeStats`) require **zero changes**. The investment is in:
1. Bitbucket API client + data transform
2. Bitbucket OAuth linking flow
3. Token storage + refresh management
4. Cache key namespacing

---

## 14. Summary of Findings

1. **Architecture is ready.** `StatsData`, `mergeStats()`, `computeImpactV4()`, and all rendering are platform-agnostic. No scoring or rendering changes needed.

2. **Bitbucket data maps well** to `StatsData` with two known gaps: no stars (Breadth component gets 0) and no heatmap API (must reconstruct from commit history).

3. **The SupplementalStats pattern is the blueprint.** Bitbucket integration follows the same flow: fetch data → transform to `StatsData` → merge with primary → score.

4. **OAuth linking is the main new work.** Bitbucket OAuth 2.0 with token refresh adds complexity beyond the current GitHub-only session model.

5. **API call budget is manageable.** ~100-150 REST calls per user at 1,000/hr limit, cached daily.

6. **Scoring fairness:** A developer using only Bitbucket would have stars=0 and watchers=0. This reduces Breadth's maximum by ~15% (10% stars + 5% watchers contribute nothing). The other 85% of Breadth and 100% of Delivery/Quality/Consistency function normally.

7. **Shared investment with other platforms.** Developing the platform abstraction layer (`PlatformQuery` interface, `user_platforms` table, multi-provider OAuth linking) benefits all future integrations (GitLab, Codeberg, etc.). Bitbucket is a viable second platform to build this infrastructure for.
