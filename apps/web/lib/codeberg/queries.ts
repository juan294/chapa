import type {
  CodebergHeatmapEntry,
  CodebergRepo,
  CodebergPullRequest,
  CodebergReview,
  CodebergIssue,
  RawCodebergData,
} from "./types";
import { SCORING_WINDOW_DAYS } from "@chapa/shared";
import { fetchWithRetry, sanitizeLogBody } from "@/lib/utils/fetch-retry";

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

/** Fetch all Codeberg contribution data for a user */
export async function fetchCodebergContributionData(
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<RawCodebergData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // 1. Fetch heatmap (single call — no pagination, ~365 entries)
    const heatmap = await fetchHeatmap(
      username,
      accessToken,
      controller.signal,
    );
    if (heatmap === null) return null; // Auth failed

    // Filter heatmap to scoring window
    const since = new Date();
    since.setDate(since.getDate() - SCORING_WINDOW_DAYS);
    const sinceTs = Math.floor(since.getTime() / 1000);
    const filteredHeatmap = heatmap.filter((h) => h.timestamp >= sinceTs);

    // 2. Fetch user repos (paginated)
    // BE-H1: null means rate-limited/error — treat as empty to preserve heatmap
    const allRepos =
      (await fetchUserRepos(username, accessToken, controller.signal)) ?? [];

    // 3. For each repo, fetch merged PRs, reviews, issues
    const allMergedPRs: CodebergPullRequest[] = [];
    const allReviews: CodebergReview[] = [];
    let totalClosedIssues = 0;
    const repoData: RawCodebergData["repos"] = [];

    for (const repo of allRepos) {
      const isOwned = repo.owner.login === username;

      // Merged PRs authored by this user
      const prs = await fetchMergedPRs(
        repo.full_name,
        username,
        accessToken,
        controller.signal,
      );
      allMergedPRs.push(...prs);

      // Reviews on other people's PRs
      const reviews = await fetchUserReviews(
        repo.full_name,
        username,
        accessToken,
        controller.signal,
      );
      allReviews.push(...reviews);

      // Closed issues (only if repo has issue tracker)
      if (repo.has_issues) {
        const issues = await fetchClosedIssues(
          repo.full_name,
          username,
          accessToken,
          controller.signal,
        );
        totalClosedIssues += issues.length;
      }

      repoData.push({
        fullName: repo.full_name,
        commitCount: prs.length, // Use merged PR count as proxy (heatmap is user-global)
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated Codeberg API endpoint. Stops when result < PAGE_SIZE or page >= MAX_PAGES.
 *
 * BE-H1 (#859): 429 and 5xx mid-pagination return `null` (failure signal) so
 * callers can fall back to stale cache. 401/403 also return `null`.
 *
 * BE-M3 (#880): Uses fetchWithRetry for a single jittered retry on 5xx.
 *
 * BE-M5 (#881): Shape-guards the response; non-array body returns `null`.
 */
async function fetchPaginated<T>(
  baseUrl: string,
  token: string,
  signal: AbortSignal,
  maxItems?: number,
): Promise<T[] | null> {
  const items: T[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${separator}page=${page}&limit=${PAGE_SIZE}`;

    const res = await fetchWithRetry(url, {
      headers: { Authorization: `token ${token}`, Accept: "application/json" },
      signal,
    });

    if (!res.ok) {
      // BE-H1: auth, rate-limit, or server error → null
      if (
        res.status === 401 ||
        res.status === 403 ||
        res.status === 429 ||
        res.status >= 500
      ) {
        const rawBody = await res.text().catch(() => "");
        if (rawBody) {
          console.error(
            `[codeberg] HTTP ${res.status} on ${baseUrl}: ${sanitizeLogBody(rawBody)}`,
          );
        }
        return null;
      }
      return items;
    }

    const json: unknown = await res.json();

    // BE-M5: shape guard
    if (!Array.isArray(json)) {
      console.error(`[codeberg] Unexpected non-array response on ${baseUrl}`);
      return null;
    }

    const data = json as T[];
    items.push(...data);

    // Stop if fewer items than PAGE_SIZE (last page) or we've hit max
    if (data.length < PAGE_SIZE) break;
    if (maxItems && items.length >= maxItems) break;
    page++;
  }

  return maxItems ? items.slice(0, maxItems) : items;
}

/**
 * Fetch heatmap — single call, no pagination.
 *
 * BE-H1 (#859): Returns null on auth failure (401/403), rate-limit (429),
 * or server error (5xx). The caller treats null as a full abort.
 *
 * BE-M5 (#881): Validates array shape; non-array returns null (not []).
 */
async function fetchHeatmap(
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergHeatmapEntry[] | null> {
  const res = await fetchWithRetry(
    `${CB_API}/users/${encodeURIComponent(username)}/heatmap`,
    {
      headers: { Authorization: `token ${token}`, Accept: "application/json" },
      signal,
    },
  );

  if (!res.ok) {
    if (
      res.status === 401 ||
      res.status === 403 ||
      res.status === 429 ||
      res.status >= 500
    ) {
      return null;
    }
    return [];
  }

  const json: unknown = await res.json();

  // BE-M5: shape guard
  if (!Array.isArray(json)) {
    console.error(
      `[codeberg] Unexpected non-array heatmap response for ${username}`,
    );
    return null;
  }

  return json as CodebergHeatmapEntry[];
}

/** Fetch user repos (paginated, capped at MAX_REPOS). Returns null on error. */
async function fetchUserRepos(
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergRepo[] | null> {
  return fetchPaginated<CodebergRepo>(
    `${CB_API}/users/${encodeURIComponent(username)}/repos`,
    token,
    signal,
    MAX_REPOS,
  );
}

/** Fetch merged PRs authored by username in a repo. Returns [] on error. */
async function fetchMergedPRs(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergPullRequest[]> {
  const prs =
    (await fetchPaginated<CodebergPullRequest>(
      `${CB_API}/repos/${repoFullName}/pulls?state=closed`,
      token,
      signal,
    )) ?? [];

  // Filter: merged AND authored by this user
  return prs.filter((pr) => pr.merged && pr.user.login === username);
}

/** Fetch reviews by username on other people's PRs. Returns [] on error. */
async function fetchUserReviews(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergReview[]> {
  // First get closed PRs NOT authored by this user
  const prs =
    (await fetchPaginated<CodebergPullRequest>(
      `${CB_API}/repos/${repoFullName}/pulls?state=closed`,
      token,
      signal,
    )) ?? [];

  const reviews: CodebergReview[] = [];

  for (const pr of prs) {
    // Skip self-authored PRs (self-reviews don't count)
    if (pr.user.login === username) continue;

    const prReviews =
      (await fetchPaginated<CodebergReview>(
        `${CB_API}/repos/${repoFullName}/pulls/${pr.number}/reviews`,
        token,
        signal,
      )) ?? [];

    // Filter: by this user AND only APPROVED or REQUEST_CHANGES
    for (const r of prReviews) {
      if (
        r.user.login === username &&
        (r.state === "APPROVED" || r.state === "REQUEST_CHANGES")
      ) {
        reviews.push(r);
      }
    }
  }

  return reviews;
}

/** Fetch closed issues authored/assigned to username in a repo. Returns [] on error. */
async function fetchClosedIssues(
  repoFullName: string,
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<CodebergIssue[]> {
  const issues =
    (await fetchPaginated<CodebergIssue>(
      `${CB_API}/repos/${repoFullName}/issues?state=closed&type=issues`,
      token,
      signal,
    )) ?? [];

  return issues.filter((i) => i.user.login === username);
}
