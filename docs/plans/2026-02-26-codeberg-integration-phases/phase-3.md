# Phase 3: Data Fetching + Stats Transform

> Parent: [Codeberg Integration Plan](../2026-02-26-codeberg-integration.md)
> Depends on: Phase 2
> Estimated new files: 5
> Estimated modified files: 0

## Goal

Implement the Codeberg REST client that fetches contribution data and transforms it into `StatsData`. This is the data-layer equivalent of `apps/web/lib/bitbucket/`.

## Key Advantages Over Bitbucket Implementation

1. **Native heatmap endpoint** — `GET /api/v1/users/{username}/heatmap` returns pre-computed contribution data. No need to iterate commits across repos.
2. **PR stats inline** — PRs include `additions`, `deletions`, `changed_files` directly. No separate diffstat calls per PR.
3. **No workspace enumeration** — Repos are directly under users/orgs, not scoped to workspaces.
4. **Stars, forks, watchers all available** — Codeberg repos have all social metrics.
5. **Result: ~20-50 API calls** vs Bitbucket's ~100-150.

## Codeberg API Response Shapes (verified live)

### Heatmap entry
```typescript
{ timestamp: 1740034800, contributions: 9 }  // Unix epoch, count
```

### Repo
```typescript
{
  id: number, name: string, full_name: string, // "owner/repo"
  private: boolean, fork: boolean, has_issues: boolean,
  stars_count: number, forks_count: number, watchers_count: number,
  owner: { login: string, ... }
}
```

### Pull Request
```typescript
{
  id: number, number: number, title: string,
  state: "open" | "closed",
  merged: boolean, merged_at: string | null,
  additions: number, deletions: number, changed_files: number,
  user: { login: string, ... }
}
```

### Review
```typescript
{
  id: number, state: string,  // "APPROVED" | "REQUEST_CHANGES" | "REQUEST_REVIEW" | "COMMENT"
  user: { login: string, ... },
  submitted_at: string
}
```

### Issue
```typescript
{
  id: number, number: number, title: string,
  state: "open" | "closed",
  user: { login: string, ... },
  closed_at: string | null
}
```

### Pagination
```
?page=1&limit=50
```
Returns array. If `result.length < limit`, this is the last page. No `next` URL — must increment page manually.

## New Files

### 1. `apps/web/lib/codeberg/types.ts` (~70 lines)

Codeberg API response types. Simpler than Bitbucket (no workspace, no separate diffstat).

```typescript
/** Heatmap entry from /api/v1/users/{username}/heatmap */
export interface CodebergHeatmapEntry {
  timestamp: number;       // Unix epoch seconds
  contributions: number;
}

/** Repository from /api/v1/users/{username}/repos */
export interface CodebergRepo {
  id: number;
  name: string;
  full_name: string;       // "owner/repo"
  private: boolean;
  fork: boolean;
  has_issues: boolean;
  stars_count: number;
  forks_count: number;
  watchers_count: number;
  owner: { login: string };
}

/** Pull request from /api/v1/repos/{owner}/{repo}/pulls */
export interface CodebergPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  user: { login: string };
}

/** Review from /api/v1/repos/{owner}/{repo}/pulls/{index}/reviews */
export interface CodebergReview {
  id: number;
  state: string;           // "APPROVED" | "REQUEST_CHANGES" | "REQUEST_REVIEW" | "COMMENT"
  user: { login: string };
  submitted_at: string;
}

/** Issue from /api/v1/repos/{owner}/{repo}/issues */
export interface CodebergIssue {
  id: number;
  number: number;
  state: "open" | "closed";
  user: { login: string };
  closed_at: string | null;
}

/** Aggregated raw data before StatsData transform */
export interface RawCodebergData {
  username: string;
  displayName: string;
  avatarUrl: string;
  heatmap: CodebergHeatmapEntry[];
  mergedPRs: CodebergPullRequest[];     // Already filtered: merged=true, authored by user
  reviews: CodebergReview[];             // Filtered: APPROVED + REQUEST_CHANGES, excludes self
  closedIssues: number;
  repos: {
    fullName: string;
    commitCount: number;                 // Computed from heatmap or commits
    isOwned: boolean;
    starsCount: number;
    forksCount: number;
    watchersCount: number;
  }[];
}
```

### 2. `apps/web/lib/codeberg/queries.ts` (~220 lines)

REST client for Codeberg API. Simpler than Bitbucket — no workspace traversal, no diffstat calls.

```typescript
import type {
  CodebergHeatmapEntry, CodebergRepo, CodebergPullRequest,
  CodebergReview, CodebergIssue, RawCodebergData,
} from "./types";
import { SCORING_WINDOW_DAYS } from "@chapa/shared";

const CB_API = "https://codeberg.org/api/v1";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REPOS = 50;
const MAX_PRS = 100;
const MAX_PAGES = 5;
const PAGE_SIZE = 50;

interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

export async function fetchCodebergContributionData(
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<RawCodebergData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // 1. Fetch heatmap (single call — no pagination, ~365 entries)
    const heatmap = await fetchHeatmap(username, accessToken, controller.signal);
    if (heatmap === null) return null; // Auth failed

    // Filter heatmap to scoring window
    const since = new Date();
    since.setDate(since.getDate() - SCORING_WINDOW_DAYS);
    const sinceTs = Math.floor(since.getTime() / 1000);
    const filteredHeatmap = heatmap.filter(h => h.timestamp >= sinceTs);

    // 2. Fetch user repos (paginated)
    const allRepos = await fetchUserRepos(username, accessToken, controller.signal);

    // 3. For each non-fork repo, fetch merged PRs, reviews, issues
    const allMergedPRs: CodebergPullRequest[] = [];
    const allReviews: CodebergReview[] = [];
    let totalClosedIssues = 0;
    const repoData: RawCodebergData["repos"] = [];

    for (const repo of allRepos) {
      const isOwned = repo.owner.login === username;

      // Merged PRs (only for repos with PRs)
      const prs = await fetchMergedPRs(repo.full_name, username, accessToken, controller.signal);
      allMergedPRs.push(...prs);

      // Reviews on other people's PRs
      const reviews = await fetchUserReviews(repo.full_name, username, accessToken, controller.signal);
      allReviews.push(...reviews);

      // Closed issues (only if repo has issues)
      if (repo.has_issues) {
        const issues = await fetchClosedIssues(repo.full_name, username, accessToken, controller.signal);
        totalClosedIssues += issues.length;
      }

      repoData.push({
        fullName: repo.full_name,
        commitCount: 0,  // Will be computed from heatmap in stats-aggregation
        isOwned,
        starsCount: isOwned ? repo.stars_count : 0,
        forksCount: isOwned ? repo.forks_count : 0,
        watchersCount: isOwned ? repo.watchers_count : 0,
      });
    }

    return {
      username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      heatmap: filteredHeatmap,
      mergedPRs: allMergedPRs.slice(0, MAX_PRS),
      reviews: allReviews,
      closedIssues: totalClosedIssues,
      repos: repoData,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Internal helpers ---

async function fetchPaginated<T>(
  baseUrl: string,
  token: string,
  signal: AbortSignal,
  maxItems?: number,
): Promise<T[]> {
  // Page-based pagination: ?page=N&limit=PAGE_SIZE
  // Stops when result.length < PAGE_SIZE or page >= MAX_PAGES
  // Auth: Authorization: token <accessToken>
  // Returns null-safe array
}

async function fetchHeatmap(
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergHeatmapEntry[] | null> {
  // GET CB_API/users/{username}/heatmap
  // No pagination needed (returns all entries)
  // Returns null on 401/403 (auth check)
}

async function fetchUserRepos(
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergRepo[]> {
  // GET CB_API/users/{username}/repos?page=N&limit=50
  // Paginate up to MAX_REPOS total
}

async function fetchMergedPRs(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergPullRequest[]> {
  // GET CB_API/repos/{owner}/{repo}/pulls?state=closed&limit=50
  // Filter: merged === true && user.login === username
}

async function fetchUserReviews(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergReview[]> {
  // For each closed PR NOT authored by username:
  //   GET CB_API/repos/{owner}/{repo}/pulls/{index}/reviews
  //   Filter: state === "APPROVED" || state === "REQUEST_CHANGES"
  //   Filter: user.login === username (our user's reviews)
  // Return all matching reviews
}

async function fetchClosedIssues(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergIssue[]> {
  // GET CB_API/repos/{owner}/{repo}/issues?state=closed&type=issues&limit=50
  // Filter: user.login === username (assigned to or created by)
}
```

### 3. `apps/web/lib/codeberg/queries.test.ts` (~250 lines)

Test the REST client with mocked fetch:

```
describe("fetchCodebergContributionData")
  - returns null on heatmap auth failure (401)
  - fetches heatmap + repos + PRs + reviews + issues
  - filters heatmap to scoring window
  - caps merged PRs at MAX_PRS
  - handles timeout (AbortController)
  - returns null on network error

describe("pagination")
  - stops when result count < PAGE_SIZE
  - stops at MAX_PAGES
  - accumulates across pages
```

### 4. `apps/web/lib/codeberg/stats-aggregation.ts` (~80 lines)

Transform `RawCodebergData` → `StatsData`. Simpler than Bitbucket because heatmap is pre-computed and PR stats are inline.

```typescript
import type { StatsData, HeatmapDay } from "@chapa/shared";
import { computePrWeight, PR_WEIGHT_AGG_CAP, REPO_DEPTH_THRESHOLD } from "@chapa/shared";
import type { RawCodebergData } from "./types";

export function buildStatsFromCodeberg(raw: RawCodebergData): StatsData {
  // 1. Build heatmap from native data
  //    Convert {timestamp, contributions} → {date: "YYYY-MM-DD", count}
  //    Aggregate by date (multiple timestamps can map to same date)
  //    Sort chronologically
  const heatmapMap = new Map<string, number>();
  for (const entry of raw.heatmap) {
    const date = new Date(entry.timestamp * 1000).toISOString().slice(0, 10);
    heatmapMap.set(date, (heatmapMap.get(date) ?? 0) + entry.contributions);
  }
  const heatmapData: HeatmapDay[] = Array.from(heatmapMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // 2. Commit count from heatmap totals
  const commitsTotal = heatmapData.reduce((sum, d) => sum + d.count, 0);

  // 3. Active days
  const activeDays = heatmapData.filter(d => d.count > 0).length;

  // 4. PR metrics — additions/deletions/changedFiles are inline
  const prsMergedCount = raw.mergedPRs.length;
  let prsMergedWeight = 0;
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const pr of raw.mergedPRs) {
    linesAdded += pr.additions;
    linesDeleted += pr.deletions;
    prsMergedWeight += computePrWeight({
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
    });
  }
  prsMergedWeight = Math.min(prsMergedWeight, PR_WEIGHT_AGG_CAP);

  // 5. Reviews — already filtered in queries
  const reviewsSubmittedCount = raw.reviews.length;

  // 6. Issues closed
  const issuesClosedCount = raw.closedIssues;

  // 7. Repos contributed to (use heatmap-derived commit count or PR count as proxy)
  //    Since Codeberg heatmap is user-global (not per-repo), use repos with PRs
  //    or repos where user is owner/contributor
  const activeRepos = raw.repos.filter(r => r.commitCount > 0 || raw.mergedPRs.some(pr => {
    const [owner, repo] = r.fullName.split("/");
    // PR is in this repo if full_name matches
    return true; // Simplified — actual implementation checks PR repo
  }));
  const reposContributed = raw.repos.filter(
    r => r.commitCount >= REPO_DEPTH_THRESHOLD
  ).length;
  // NOTE: Since heatmap is user-global, per-repo commit counts aren't directly
  // available. We'll use the number of repos the user has PRs in + owned repos
  // as a proxy for reposContributed. This is a known approximation.
  // Alternative: count repos with merged PRs as "contributed to".

  // 8. Top repo share — approximation from repo list
  //    Without per-repo commit counts, use equal distribution assumption
  const totalRepos = raw.repos.filter(r => r.isOwned || raw.mergedPRs.length > 0).length;
  const topRepoShare = totalRepos > 0 ? 1 / totalRepos : 0;

  // 9. Spike detection
  const maxDailyCount = Math.max(...heatmapData.map(d => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0;

  // 10. Social metrics — all available on Codeberg!
  const ownedRepos = raw.repos.filter(r => r.isOwned);
  const totalStars = ownedRepos.reduce((sum, r) => sum + r.starsCount, 0);
  const totalForks = ownedRepos.reduce((sum, r) => sum + r.forksCount, 0);
  const totalWatchers = ownedRepos.reduce((sum, r) => sum + r.watchersCount, 0);

  return {
    handle: raw.username,
    displayName: raw.displayName || raw.username,
    avatarUrl: raw.avatarUrl,
    commitsTotal,
    activeDays,
    prsMergedCount,
    prsMergedWeight,
    reviewsSubmittedCount,
    issuesClosedCount,
    linesAdded,
    linesDeleted,
    reposContributed,
    topRepoShare,
    maxCommitsIn10Min,
    totalStars,
    totalForks,
    totalWatchers,
    heatmapData,
    fetchedAt: new Date().toISOString(),
  };
}
```

**Note on `reposContributed` and `topRepoShare`:** The Codeberg heatmap endpoint is user-global (not per-repo). We can't easily determine per-repo commit counts without fetching commits per repo (which we're avoiding for API budget). Two approaches:

- **Approach A (chosen):** Count repos where user has merged PRs as "contributed to". This undercounts (misses commit-only contributions) but avoids extra API calls.
- **Approach B (fallback):** Fetch `GET /api/v1/repos/{owner}/{repo}/commits?author={username}&limit=1` per repo to check if user has commits. Adds 1 call per repo.

If testing reveals Approach A is too inaccurate, we can switch to Approach B in a follow-up.

### 5. `apps/web/lib/codeberg/stats-aggregation.test.ts` (~300 lines)

Mirror `apps/web/lib/bitbucket/stats-aggregation.test.ts`:

```
describe("buildStatsFromCodeberg")
  - converts heatmap timestamps to YYYY-MM-DD format
  - aggregates multiple timestamps on same date
  - sorts heatmap chronologically
  - counts active days from heatmap
  - sums commits from heatmap contributions
  - computes PR weight using shared computePrWeight()
  - caps prsMergedWeight at PR_WEIGHT_AGG_CAP
  - sums lines added/deleted from inline PR stats
  - counts reviews (APPROVED + REQUEST_CHANGES)
  - passes through closedIssues count
  - computes reposContributed from PR activity
  - detects maxCommitsIn10Min from daily spikes
  - sums stars from owned repos
  - sums forks from owned repos
  - sums watchers from owned repos
  - handles empty data gracefully
  - sets handle and display name from raw data
  - falls back to username when displayName is empty
  - sets fetchedAt to current ISO timestamp
```

### 6. `apps/web/lib/codeberg/stats.ts` (~20 lines)

Orchestrator — same minimal shape as `apps/web/lib/bitbucket/stats.ts`:

```typescript
import { fetchCodebergContributionData } from "./queries";
import { buildStatsFromCodeberg } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

export async function fetchCodebergStats(
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<StatsData | null> {
  const raw = await fetchCodebergContributionData(username, accessToken, profile);
  if (!raw) return null;
  return buildStatsFromCodeberg(raw);
}
```

## Success Criteria

### Automated
- [x] `pnpm run typecheck` passes
- [x] `pnpm run test -- codeberg` passes (all query + aggregation tests)
- [x] `pnpm run lint` passes

### Manual
- [ ] With a linked Codeberg account, calling `fetchCodebergStats(username, token, profile)` returns a valid `StatsData` object with non-zero values for a user with activity.
