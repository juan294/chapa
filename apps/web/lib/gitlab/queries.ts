import type {
  GitlabEvent,
  GitlabProject,
  GitlabMergeRequest,
  GitlabMrChange,
  GitlabApprovals,
  GitlabMrDiffStat,
  RawGitlabData,
} from "./types";
import { SCORING_WINDOW_DAYS } from "@chapa/shared";
import { toDateString } from "@/lib/utils/date";
import { fetchWithRetry, sanitizeLogBody } from "@/lib/utils/fetch-retry";

const GL_API = "https://gitlab.com/api/v4";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REPOS = 50;
const MAX_PRS = 100;
const MAX_PAGES = 5;
const PAGE_SIZE = 100;
/** Maximum per-MR approver lookups in fetchReviewsCount (BE-L1 / #886). */
const MAX_APPROVER_LOOKUPS = 10;

interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/**
 * Bucket GitLab events into per-day contribution counts.
 *
 * Push events contribute their `commit_count`; every other contribution event
 * counts as 1. This reconstructs a GitHub-style contribution calendar because
 * GitLab has no native heatmap endpoint.
 */
export function bucketEventsByDate(
  events: GitlabEvent[],
): { date: string; count: number }[] {
  const byDate = new Map<string, number>();
  for (const ev of events) {
    const date = toDateString(new Date(ev.created_at));
    const delta = ev.push_data?.commit_count ?? 1;
    byDate.set(date, (byDate.get(date) ?? 0) + delta);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Parse additions/deletions/changed_files from a merge request's unified diff.
 *
 * GitLab does not expose aggregate line stats on the free tier, so we count
 * added/removed lines from each file's `diff` string (skipping the +++/---
 * file headers).
 */
export function parseDiffStat(changes: GitlabMrChange[]): GitlabMrDiffStat {
  let additions = 0;
  let deletions = 0;
  for (const change of changes) {
    for (const line of change.diff.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }
  }
  return { additions, deletions, changed_files: changes.length };
}

/** Fetch all GitLab contribution data for a user. */
export async function fetchGitlabContributionData(
  userId: number,
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<RawGitlabData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // 1. Heatmap (events) and merged MRs are independent — fetch concurrently.
    // mrs caps at MAX_PRS inside fetchMergedMRs.
    // Null from either means auth failure / rate-limit → abort everything.
    const [eventsResult, mrsResult, reviewsResult, closedIssuesResult, projectsResult] =
      await Promise.all([
        fetchEvents(userId, accessToken, controller.signal),
        fetchMergedMRs(username, accessToken, controller.signal),
        fetchReviewsCount(username, accessToken, controller.signal),
        fetchClosedIssuesCount(username, accessToken, controller.signal),
        fetchUserProjects(userId, accessToken, controller.signal),
      ]);

    if (
      eventsResult === null ||
      mrsResult === null ||
      reviewsResult === null ||
      closedIssuesResult === null ||
      projectsResult === null
    ) {
      return null;
    }

    const heatmap = bucketEventsByDate(eventsResult);

    // 2. Per-project commit counts (pure — no I/O).
    const projectCommitCounts = new Map<number, number>();
    for (const mr of mrsResult) {
      projectCommitCounts.set(
        mr.project_id,
        (projectCommitCounts.get(mr.project_id) ?? 0) + 1,
      );
    }

    // 3. Per-MR diffstats — fetch all in parallel (#928).
    // Each failure is treated as a zero-stat MR (same behaviour as before,
    // just concurrent instead of sequential).
    const diffStats = await Promise.all(
      mrsResult.map((mr) =>
        fetchMrDiffStat(mr.project_id, mr.iid, accessToken, controller.signal).then(
          (stat) => stat ?? { additions: 0, deletions: 0, changed_files: 0 },
        ),
      ),
    );

    const repos = projectsResult.map((p) => {
      const isOwned = p.namespace?.path === username;
      return {
        fullName: p.path_with_namespace,
        commitCount: projectCommitCounts.get(p.id) ?? 0,
        isOwned,
        starsCount: isOwned ? p.star_count : 0,
        forksCount: isOwned ? p.forks_count : 0,
        watchersCount: 0,
      };
    });

    return {
      username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      heatmap,
      mergedPRs: diffStats,
      reviewsCount: reviewsResult,
      closedIssues: closedIssuesResult,
      repos,
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
 * Fetch a paginated GitLab API endpoint. Stops at a short page or MAX_PAGES.
 *
 * BE-H1 (#859): 429 or 5xx mid-pagination returns `null` (signals failure to
 * the caller so it can fall back to stale cache). 401/403 also return `null`.
 * Genuine 2xx with data returns the accumulated items array.
 *
 * BE-M3 (#880): Uses `fetchWithRetry` for a single bounded jittered retry on
 * transient 5xx before giving up.
 *
 * BE-M5 (#881): Validates that the response body is an array; non-array bodies
 * (malformed / unexpected shape) return `null` rather than throwing.
 */
async function fetchPaginated<T>(
  path: string,
  token: string,
  signal: AbortSignal,
  maxItems?: number,
): Promise<T[] | null> {
  const items: T[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${GL_API}${path}${separator}page=${page}&per_page=${PAGE_SIZE}`;

    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    });

    if (!res.ok) {
      // BE-H1: 401/403 (auth) + 429 (rate-limit) + 5xx (server error) → null
      if (
        res.status === 401 ||
        res.status === 403 ||
        res.status === 429 ||
        res.status >= 500
      ) {
        const rawBody = await res.text().catch(() => "");
        if (rawBody) {
          // BE-M4: log only status + truncated, sanitized snippet
          console.error(`[gitlab] HTTP ${res.status} on ${path}: ${sanitizeLogBody(rawBody)}`);
        }
        return null;
      }
      // Other non-ok (unlikely) — stop pagination with what we have
      return items;
    }

    const json: unknown = await res.json();

    // BE-M5: shape guard — must be an array
    if (!Array.isArray(json)) {
      console.error(`[gitlab] Unexpected non-array response on ${path}`);
      return null;
    }

    const data = json as T[];
    items.push(...data);

    if (data.length < PAGE_SIZE) break;
    if (maxItems && items.length >= maxItems) break;
    page++;
  }

  return maxItems ? items.slice(0, maxItems) : items;
}

/**
 * Fetch contribution events within the scoring window.
 *
 * BE-H1 (#859): Returns null on auth failure (401/403), rate-limit (429),
 * or server error (5xx). A null return causes the caller to abort and return
 * null for the entire contribution data fetch.
 *
 * BE-M3 (#880): Uses fetchWithRetry for a single jittered retry on 5xx.
 *
 * BE-M5 (#881): Validates array shape; non-array body returns null.
 */
async function fetchEvents(
  userId: number,
  token: string,
  signal: AbortSignal,
): Promise<GitlabEvent[] | null> {
  const since = new Date();
  since.setDate(since.getDate() - SCORING_WINDOW_DAYS);
  const after = toDateString(since);

  const items: GitlabEvent[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const url = `${GL_API}/users/${userId}/events?after=${after}&page=${page}&per_page=${PAGE_SIZE}`;
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    });

    if (!res.ok) {
      // BE-H1: auth, rate-limit, or server error → signal failure
      if (
        res.status === 401 ||
        res.status === 403 ||
        res.status === 429 ||
        res.status >= 500
      ) {
        const rawBody = await res.text().catch(() => "");
        if (rawBody) {
          console.error(
            `[gitlab] HTTP ${res.status} on /events for user ${userId}: ${sanitizeLogBody(rawBody)}`,
          );
        }
        return null;
      }
      return items;
    }

    const json: unknown = await res.json();

    // BE-M5: shape guard
    if (!Array.isArray(json)) {
      console.error(`[gitlab] Unexpected non-array events response for user ${userId}`);
      return null;
    }

    const data = json as GitlabEvent[];
    items.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return items;
}

/** Fetch merged MRs authored by the user (global scope). Returns null on error. */
async function fetchMergedMRs(
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<GitlabMergeRequest[] | null> {
  return fetchPaginated<GitlabMergeRequest>(
    `/merge_requests?author_username=${encodeURIComponent(username)}&state=merged&scope=all`,
    token,
    signal,
    MAX_PRS,
  );
}

/** Fetch + parse a single MR's diffstat. Returns null on failure. */
async function fetchMrDiffStat(
  projectId: number,
  iid: number,
  token: string,
  signal: AbortSignal,
): Promise<GitlabMrDiffStat | null> {
  const res = await fetch(
    `${GL_API}/projects/${projectId}/merge_requests/${iid}/changes`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { changes?: GitlabMrChange[] };
  return parseDiffStat(data.changes ?? []);
}

/**
 * Count others' MRs the user approved. 0 when approvals are Premium-gated.
 *
 * BE-L1 (#886): Caps the number of per-MR approver lookups at
 * MAX_APPROVER_LOOKUPS to prevent O(n) unbounded API calls.
 */
async function fetchReviewsCount(
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<number | null> {
  const mrs = await fetchPaginated<GitlabMergeRequest>(
    `/merge_requests?reviewer_username=${encodeURIComponent(username)}&scope=all&state=merged`,
    token,
    signal,
    MAX_PRS,
  );
  if (mrs === null) return null;

  let count = 0;
  let lookups = 0;

  for (const mr of mrs) {
    // Skip self-authored MRs (self-reviews don't count).
    if (mr.author?.username === username) continue;

    // BE-L1: cap per-MR approver lookups
    if (lookups >= MAX_APPROVER_LOOKUPS) break;
    lookups++;

    const approvedBy = await fetchApprovers(
      mr.project_id,
      mr.iid,
      token,
      signal,
    );
    if (approvedBy === null) continue; // Premium-gated / unavailable
    if (approvedBy.includes(username)) count++;
  }
  return count;
}

/** Fetch the usernames that approved an MR. Returns null on 4xx (Premium fallback). */
async function fetchApprovers(
  projectId: number,
  iid: number,
  token: string,
  signal: AbortSignal,
): Promise<string[] | null> {
  const res = await fetch(
    `${GL_API}/projects/${projectId}/merge_requests/${iid}/approvals`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as GitlabApprovals;
  return (data.approved_by ?? []).map((a) => a.user.username);
}

/** Count closed issues authored by the user. */
async function fetchClosedIssuesCount(
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<number | null> {
  const issues = await fetchPaginated<{ id: number }>(
    `/issues?author_username=${encodeURIComponent(username)}&state=closed&scope=all`,
    token,
    signal,
  );
  if (issues === null) return null;
  return issues.length;
}

/** Fetch the user's projects (paginated, capped at MAX_REPOS). Returns null on error. */
async function fetchUserProjects(
  userId: number,
  token: string,
  signal: AbortSignal,
): Promise<GitlabProject[] | null> {
  return fetchPaginated<GitlabProject>(
    `/users/${userId}/projects`,
    token,
    signal,
    MAX_REPOS,
  );
}
