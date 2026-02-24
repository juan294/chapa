# Phase 3: Bitbucket Data Fetching & StatsData Transform

## Goal

Build the Bitbucket REST API client that fetches a user's contribution data and transforms it into the `StatsData` shape. This is the Bitbucket equivalent of `fetchContributionData()` + `buildStatsFromRaw()`.

## API Call Strategy

Bitbucket's REST API requires multiple calls (vs. GitHub's single GraphQL call). For a typical user (~10 repos, ~50 PRs):

```
1. GET /user/permissions/workspaces     → list workspaces (1 call)
2. For each workspace:
   GET /repositories/{ws}?role=member   → repos user has access to (paginated)
3. For each repo:
   GET /repositories/{ws}/{slug}/commits?author={username}  → commits (paginated, filtered)
   GET /repositories/{ws}/{slug}/pullrequests?state=MERGED&author={username}  → merged PRs
   GET /repositories/{ws}/{slug}/pullrequests/{id}/diffstat → PR size (per merged PR)
   GET /repositories/{ws}/{slug}/pullrequests?state=MERGED  → all merged PRs (for review counting)
   GET /repositories/{ws}/{slug}/issues?status=resolved     → closed issues (if tracker enabled)
4. GET /repositories/{ws}/{slug}/forks  → fork count per owned repo
```

**Limits:** Cap at 10 workspaces, 50 repos total, 100 PRs total. Timeout at 30s total.

## New Files

### 1. `apps/web/lib/bitbucket/types.ts`

Raw API response types (matching Bitbucket REST API 2.0 shapes):

```typescript
/** Paginated response wrapper — Bitbucket uses next/previous URLs */
export interface BitbucketPaginated<T> {
  values: T[];
  page: number;
  size: number;       // items in this page
  pagelen: number;    // page size
  next?: string;      // URL for next page (absent on last page)
}

/** Workspace permission entry */
export interface BitbucketWorkspace {
  workspace: {
    slug: string;
    name: string;
  };
  permission: string;  // "owner" | "collaborator" | "member"
}

/** Repository */
export interface BitbucketRepo {
  slug: string;
  full_name: string;   // "workspace/repo-slug"
  is_private: boolean;
  has_issues: boolean;
  owner: { username: string };
  links: { forks: { href: string } };
  // fork count not directly available — need to call forks endpoint
}

/** Commit */
export interface BitbucketCommit {
  hash: string;
  date: string;        // ISO timestamp
  message: string;
  author: {
    raw: string;       // "Name <email>"
    user?: { username: string };
  };
}

/** Pull request */
export interface BitbucketPullRequest {
  id: number;
  title: string;
  state: "MERGED" | "OPEN" | "DECLINED" | "SUPERSEDED";
  author: { username: string };
  created_on: string;
  updated_on: string;
}

/** PR diffstat entry */
export interface BitbucketDiffstat {
  status: string;      // "added" | "removed" | "modified" | "renamed"
  lines_added: number;
  lines_removed: number;
  old?: { path: string };
  new?: { path: string };
}

/** PR activity entry */
export interface BitbucketPrActivity {
  approval?: { user: { username: string }; date: string };
  comment?: { user: { username: string }; content: { raw: string } };
  changes_requested?: { user: { username: string }; date: string };
}

/** Issue */
export interface BitbucketIssue {
  id: number;
  state: string;       // "resolved" | "open" | etc.
  assignee?: { username: string };
}

/** Aggregated raw data before StatsData transform */
export interface RawBitbucketData {
  username: string;
  displayName: string;
  avatarUrl: string;
  commits: BitbucketCommit[];     // all commits by user across repos
  mergedPRs: {
    pr: BitbucketPullRequest;
    diffstat: BitbucketDiffstat[];
  }[];
  reviewActivities: BitbucketPrActivity[];  // approvals + change requests by user
  closedIssues: number;
  repos: {
    fullName: string;
    commitCount: number;          // commits by this user in this repo
    isOwned: boolean;             // user is repo owner
    forkCount: number;            // forks of this repo (only for owned repos)
  }[];
}
```

### 2. `apps/web/lib/bitbucket/queries.ts`

Bitbucket REST API fetcher:

```typescript
import type {
  BitbucketPaginated,
  BitbucketWorkspace,
  BitbucketRepo,
  BitbucketCommit,
  BitbucketPullRequest,
  BitbucketDiffstat,
  BitbucketPrActivity,
  RawBitbucketData,
} from "./types";
import { SCORING_WINDOW_DAYS } from "@chapa/shared";

const BB_API = "https://api.bitbucket.org/2.0";
const FETCH_TIMEOUT_MS = 30_000;   // 30s total budget
const MAX_WORKSPACES = 10;
const MAX_REPOS = 50;
const MAX_PRS = 100;

/** Fetch all Bitbucket contribution data for a user */
export async function fetchBitbucketContributionData(
  username: string,
  accessToken: string,
): Promise<RawBitbucketData | null>

// Internal helpers:

/** Generic paginated fetch — follows `next` links up to maxPages */
async function fetchPaginated<T>(
  url: string,
  token: string,
  maxPages: number,
  signal: AbortSignal,
): Promise<T[]>

/** Fetch user workspaces */
async function fetchWorkspaces(token: string, signal: AbortSignal): Promise<BitbucketWorkspace[]>

/** Fetch repos in a workspace where user is a member */
async function fetchWorkspaceRepos(
  workspace: string,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketRepo[]>

/** Fetch commits by user in a repo (last 365 days) */
async function fetchRepoCommits(
  repoFullName: string,
  username: string,
  since: Date,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketCommit[]>

/** Fetch merged PRs authored by user in a repo */
async function fetchMergedPRs(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketPullRequest[]>

/** Fetch diffstat for a single PR */
async function fetchPRDiffstat(
  repoFullName: string,
  prId: number,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketDiffstat[]>

/** Fetch review activities (approvals + change requests) by user across PRs */
async function fetchReviewActivities(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketPrActivity[]>

/** Fetch fork count for a repo */
async function fetchForkCount(
  repoFullName: string,
  token: string,
  signal: AbortSignal,
): Promise<number>
```

### 3. `apps/web/lib/bitbucket/stats-aggregation.ts`

Transform `RawBitbucketData` → `StatsData`:

```typescript
import type { StatsData, HeatmapDay } from "@chapa/shared";
import { computePrWeight } from "@chapa/shared";
import { PR_WEIGHT_AGG_CAP, REPO_DEPTH_THRESHOLD } from "@chapa/shared";
import type { RawBitbucketData } from "./types";

/**
 * Transform raw Bitbucket data into a StatsData object.
 * Pure function — mirrors buildStatsFromRaw() for GitHub data.
 */
export function buildStatsFromBitbucket(raw: RawBitbucketData): StatsData {
  // 1. Build heatmap from commit timestamps (aggregate by date)
  const heatmapMap = new Map<string, number>();
  for (const commit of raw.commits) {
    const date = commit.date.slice(0, 10); // YYYY-MM-DD
    heatmapMap.set(date, (heatmapMap.get(date) ?? 0) + 1);
  }
  const heatmapData: HeatmapDay[] = Array.from(heatmapMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // 2. Active days
  const activeDays = heatmapData.filter(d => d.count > 0).length;

  // 3. Total commits
  const commitsTotal = raw.commits.length;

  // 4. PR metrics — compute weight using shared computePrWeight()
  const prsMergedCount = raw.mergedPRs.length;
  let prsMergedWeight = 0;
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const { diffstat } of raw.mergedPRs) {
    const additions = diffstat.reduce((sum, d) => sum + d.lines_added, 0);
    const deletions = diffstat.reduce((sum, d) => sum + d.lines_removed, 0);
    const changedFiles = diffstat.length;
    linesAdded += additions;
    linesDeleted += deletions;
    prsMergedWeight += computePrWeight({ additions, deletions, changedFiles });
  }
  prsMergedWeight = Math.min(prsMergedWeight, PR_WEIGHT_AGG_CAP);

  // 5. Reviews — count approvals and change requests by this user
  const reviewsSubmittedCount = raw.reviewActivities.filter(
    a => a.approval || a.changes_requested
  ).length;

  // 6. Issues closed
  const issuesClosedCount = raw.closedIssues;

  // 7. Repos contributed to (anti-shallow-breadth: >= REPO_DEPTH_THRESHOLD commits)
  const activeRepos = raw.repos.filter(r => r.commitCount > 0);
  const reposContributed = activeRepos.filter(
    r => r.commitCount >= REPO_DEPTH_THRESHOLD
  ).length;

  // 8. Top repo share
  const totalRepoCommits = activeRepos.reduce((s, r) => s + r.commitCount, 0);
  const topRepoShare = totalRepoCommits > 0
    ? Math.max(...activeRepos.map(r => r.commitCount)) / totalRepoCommits
    : 0;

  // 9. maxCommitsIn10Min approximation from daily spikes (same as GitHub)
  const maxDailyCount = Math.max(...heatmapData.map(d => d.count), 0);
  const maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0;

  // 10. Social metrics — Bitbucket has no stars, limited watchers
  const ownedRepos = raw.repos.filter(r => r.isOwned);
  const totalForks = ownedRepos.reduce((sum, r) => sum + r.forkCount, 0);

  return {
    handle: raw.username,
    displayName: raw.displayName,
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
    totalStars: 0,       // Bitbucket has no stars
    totalForks,
    totalWatchers: 0,    // Not publicly accessible
    heatmapData,
    fetchedAt: new Date().toISOString(),
  };
}
```

### 4. `apps/web/lib/bitbucket/stats.ts`

Orchestrator (mirrors `apps/web/lib/github/stats.ts`):

```typescript
import { fetchBitbucketContributionData } from "./queries";
import { buildStatsFromBitbucket } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

/** Fetch and transform Bitbucket data into StatsData */
export async function fetchBitbucketStats(
  username: string,
  accessToken: string,
): Promise<StatsData | null> {
  const raw = await fetchBitbucketContributionData(username, accessToken);
  if (!raw) return null;
  return buildStatsFromBitbucket(raw);
}
```

### 5. Test Files

**`apps/web/lib/bitbucket/stats-aggregation.test.ts`** — Most important tests:

```
describe("buildStatsFromBitbucket")
  - transforms commits into heatmap (aggregated by date)
  - counts active days from heatmap
  - computes PR weight using shared computePrWeight()
  - caps prsMergedWeight at PR_WEIGHT_AGG_CAP (120)
  - counts reviews from approvals and change requests
  - applies REPO_DEPTH_THRESHOLD to reposContributed
  - computes topRepoShare from commit distribution
  - sets totalStars to 0 (Bitbucket has no stars)
  - sets totalWatchers to 0
  - sums fork counts from owned repos only
  - handles empty data gracefully (0 commits, 0 PRs)
  - handles user with no owned repos (totalForks = 0)
```

**`apps/web/lib/bitbucket/queries.test.ts`** — API client tests:

```
describe("fetchBitbucketContributionData")
  - returns null on network error
  - returns null on 401 (invalid token)
  - respects 30s timeout
  - follows pagination (next links)
  - caps at MAX_WORKSPACES (10)
  - caps at MAX_REPOS (50)
  - caps at MAX_PRS (100)
  - filters commits by date range (365 days)
  - handles repos with issues disabled (has_issues: false)
```

## Automated Verification

```bash
pnpm run typecheck 2>&1; pnpm run test -- --run apps/web/lib/bitbucket/ 2>&1; pnpm run lint 2>&1
```

## Manual Verification

This phase requires manual testing with a real Bitbucket account to verify API responses match the expected types. Create a test script or use the Studio terminal to invoke `fetchBitbucketStats()` with a real token.

## Success Criteria

- [x] `fetchBitbucketContributionData()` handles pagination, timeouts, and rate limits
- [x] `buildStatsFromBitbucket()` produces valid `StatsData` (passes `isValidStatsShape()`)
- [x] PR weight uses shared `computePrWeight()` — same calculation as GitHub
- [x] Repos apply `REPO_DEPTH_THRESHOLD` anti-shallow-breadth filter
- [x] `totalStars: 0` and `totalWatchers: 0` (known Bitbucket limitations)
- [x] All tests pass, typecheck clean
