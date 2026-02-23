import type {
  BitbucketPaginated,
  BitbucketWorkspace,
  BitbucketRepo,
  BitbucketCommit,
  BitbucketPullRequest,
  BitbucketDiffstat,
  BitbucketPrActivity,
  BitbucketIssue,
  RawBitbucketData,
} from "./types";
import { SCORING_WINDOW_DAYS } from "@chapa/shared";

const BB_API = "https://api.bitbucket.org/2.0";
const FETCH_TIMEOUT_MS = 30_000; // 30s total budget
const MAX_WORKSPACES = 10;
const MAX_REPOS = 50;
const MAX_PRS = 100;
const MAX_PAGES = 5; // pagination safety limit per endpoint

/** User profile info passed in from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Fetch all Bitbucket contribution data for a user */
export async function fetchBitbucketContributionData(
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<RawBitbucketData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // 1. Fetch workspaces (first page also serves as auth check)
    const wsResult = await fetchPaginatedWithStatus<BitbucketWorkspace>(
      `${BB_API}/user/permissions/workspaces`,
      accessToken,
      MAX_PAGES,
      controller.signal,
    );
    if (wsResult.authFailed) return null;
    const workspaces = wsResult.items.slice(0, MAX_WORKSPACES);

    // 2. Fetch repos across all workspaces
    let allRepos: BitbucketRepo[] = [];
    for (const ws of workspaces) {
      if (allRepos.length >= MAX_REPOS) break;
      const wsRepos = await fetchPaginated<BitbucketRepo>(
        `${BB_API}/repositories/${ws.workspace.slug}?role=member`,
        accessToken,
        MAX_PAGES,
        controller.signal,
      );
      allRepos = allRepos.concat(wsRepos);
    }
    allRepos = allRepos.slice(0, MAX_REPOS);

    // 3. For each repo, fetch commits, PRs, reviews, issues, forks
    const since = new Date();
    since.setDate(since.getDate() - SCORING_WINDOW_DAYS);

    const allCommits: BitbucketCommit[] = [];
    const allMergedPRs: RawBitbucketData["mergedPRs"] = [];
    const allReviewActivities: BitbucketPrActivity[] = [];
    let totalClosedIssues = 0;
    const repoData: RawBitbucketData["repos"] = [];

    for (const repo of allRepos) {
      // Commits by this user
      const commits = await fetchRepoCommits(
        repo.full_name,
        username,
        since,
        accessToken,
        controller.signal,
      );
      allCommits.push(...commits);

      // Merged PRs authored by this user
      const mergedPRs = await fetchMergedPRs(
        repo.full_name,
        username,
        accessToken,
        controller.signal,
      );

      // Diffstat for each merged PR (capped globally)
      for (const pr of mergedPRs) {
        if (allMergedPRs.length >= MAX_PRS) break;
        const diffstat = await fetchPRDiffstat(
          repo.full_name,
          pr.id,
          accessToken,
          controller.signal,
        );
        allMergedPRs.push({ pr, diffstat });
      }

      // Review activities (approvals/changes requested by this user)
      const activities = await fetchReviewActivities(
        repo.full_name,
        username,
        accessToken,
        controller.signal,
      );
      allReviewActivities.push(...activities);

      // Issues closed (only if repo has issue tracker)
      if (repo.has_issues) {
        const issues = await fetchClosedIssues(
          repo.full_name,
          accessToken,
          controller.signal,
        );
        totalClosedIssues += issues.length;
      }

      // Fork count (only for owned repos)
      const isOwned = repo.owner.username === username;
      let forkCount = 0;
      if (isOwned) {
        forkCount = await fetchForkCount(
          repo.full_name,
          accessToken,
          controller.signal,
        );
      }

      repoData.push({
        fullName: repo.full_name,
        commitCount: commits.length,
        isOwned,
        forkCount,
      });
    }

    return {
      username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      commits: allCommits,
      mergedPRs: allMergedPRs,
      reviewActivities: allReviewActivities,
      closedIssues: totalClosedIssues,
      repos: repoData,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Generic paginated fetch — follows `next` links up to maxPages */
async function fetchPaginated<T>(
  url: string,
  token: string,
  maxPages: number,
  signal: AbortSignal,
): Promise<T[]> {
  const result = await fetchPaginatedWithStatus<T>(url, token, maxPages, signal);
  return result.items;
}

/** Paginated fetch that also reports auth failures */
async function fetchPaginatedWithStatus<T>(
  url: string,
  token: string,
  maxPages: number,
  signal: AbortSignal,
): Promise<{ items: T[]; authFailed: boolean }> {
  const items: T[] = [];
  let nextUrl: string | undefined = url;
  let pages = 0;

  while (nextUrl && pages < maxPages) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    });
    if (res.status === 401 || res.status === 403) {
      return { items, authFailed: true };
    }
    if (!res.ok) return { items, authFailed: false };

    const data = (await res.json()) as BitbucketPaginated<T>;
    items.push(...data.values);
    nextUrl = data.next;
    pages++;
  }

  return { items, authFailed: false };
}

/** Fetch commits by user in a repo (last SCORING_WINDOW_DAYS) */
async function fetchRepoCommits(
  repoFullName: string,
  username: string,
  since: Date,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketCommit[]> {
  // Bitbucket commit API doesn't filter by author directly in all cases,
  // but we include the author in the include parameter for server-side filtering
  const url =
    `${BB_API}/repositories/${repoFullName}/commits` +
    `?include=HEAD` +
    `&pagelen=50`;

  const commits = await fetchPaginated<BitbucketCommit>(
    url,
    token,
    MAX_PAGES,
    signal,
  );

  // Client-side filter: by username and date range
  return commits.filter((c) => {
    const commitDate = new Date(c.date);
    const isInRange = commitDate >= since;
    const isAuthor = c.author.user?.username === username;
    return isInRange && isAuthor;
  });
}

/** Fetch merged PRs authored by user in a repo */
async function fetchMergedPRs(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketPullRequest[]> {
  const url =
    `${BB_API}/repositories/${repoFullName}/pullrequests` +
    `?state=MERGED&pagelen=50`;

  const prs = await fetchPaginated<BitbucketPullRequest>(
    url,
    token,
    MAX_PAGES,
    signal,
  );

  // Filter to PRs authored by this user
  return prs.filter((pr) => pr.author.username === username);
}

/** Fetch diffstat for a single PR */
async function fetchPRDiffstat(
  repoFullName: string,
  prId: number,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketDiffstat[]> {
  return fetchPaginated<BitbucketDiffstat>(
    `${BB_API}/repositories/${repoFullName}/pullrequests/${prId}/diffstat`,
    token,
    MAX_PAGES,
    signal,
  );
}

/** Fetch review activities (approvals + change requests) by user across PRs in a repo */
async function fetchReviewActivities(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketPrActivity[]> {
  // Fetch all merged PRs in the repo (not just by this user)
  const url =
    `${BB_API}/repositories/${repoFullName}/pullrequests` +
    `?state=MERGED&pagelen=50`;

  const prs = await fetchPaginated<BitbucketPullRequest>(
    url,
    token,
    MAX_PAGES,
    signal,
  );

  const activities: BitbucketPrActivity[] = [];

  for (const pr of prs) {
    // Skip PRs authored by this user (self-reviews don't count)
    if (pr.author.username === username) continue;

    const prActivities = await fetchPaginated<BitbucketPrActivity>(
      `${BB_API}/repositories/${repoFullName}/pullrequests/${pr.id}/activity`,
      token,
      MAX_PAGES,
      signal,
    );

    // Filter to activities by this user (approvals + change requests)
    for (const a of prActivities) {
      if (a.approval?.user.username === username) {
        activities.push(a);
      } else if (a.changes_requested?.user.username === username) {
        activities.push(a);
      }
    }
  }

  return activities;
}

/** Fetch closed/resolved issues in a repo */
async function fetchClosedIssues(
  repoFullName: string,
  token: string,
  signal: AbortSignal,
): Promise<BitbucketIssue[]> {
  return fetchPaginated<BitbucketIssue>(
    `${BB_API}/repositories/${repoFullName}/issues?status=resolved&pagelen=50`,
    token,
    MAX_PAGES,
    signal,
  );
}

/** Fetch fork count for a repo */
async function fetchForkCount(
  repoFullName: string,
  token: string,
  signal: AbortSignal,
): Promise<number> {
  const res = await fetch(
    `${BB_API}/repositories/${repoFullName}/forks?pagelen=0`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    },
  );
  if (!res.ok) return 0;

  const data = (await res.json()) as BitbucketPaginated<unknown>;
  return data.size;
}
