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

const GL_API = "https://gitlab.com/api/v4";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REPOS = 50;
const MAX_PRS = 100;
const MAX_PAGES = 5;
const PAGE_SIZE = 100;

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
    // 1. Heatmap reconstructed from the Events API (no native endpoint).
    const events = await fetchEvents(userId, accessToken, controller.signal);
    if (events === null) return null; // Auth failed
    const heatmap = bucketEventsByDate(events);

    // 2. Merged MRs authored by the user (global scope — no per-project loop).
    const mrs = await fetchMergedMRs(username, accessToken, controller.signal);

    // 3. Per-MR diffstat + per-project merged-MR counts.
    // mrs is already capped at MAX_PRS by fetchMergedMRs.
    const mergedPRs: GitlabMrDiffStat[] = [];
    const projectCommitCounts = new Map<number, number>();
    for (const mr of mrs) {
      projectCommitCounts.set(
        mr.project_id,
        (projectCommitCounts.get(mr.project_id) ?? 0) + 1,
      );
      const stat = await fetchMrDiffStat(
        mr.project_id,
        mr.iid,
        accessToken,
        controller.signal,
      );
      mergedPRs.push(stat ?? { additions: 0, deletions: 0, changed_files: 0 });
    }

    // 4. Reviews — others' MRs the user approved (0 if approvals are Premium-gated).
    const reviewsCount = await fetchReviewsCount(
      username,
      accessToken,
      controller.signal,
    );

    // 5. Closed issues authored by the user.
    const closedIssues = await fetchClosedIssuesCount(
      username,
      accessToken,
      controller.signal,
    );

    // 6. Owned/member projects for social metrics + depth proxy.
    const projects = await fetchUserProjects(
      userId,
      accessToken,
      controller.signal,
    );
    const repos = projects.map((p) => {
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
      mergedPRs,
      reviewsCount,
      closedIssues,
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

/** Fetch a paginated GitLab API endpoint. Stops at a short page or MAX_PAGES. */
async function fetchPaginated<T>(
  path: string,
  token: string,
  signal: AbortSignal,
  maxItems?: number,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${GL_API}${path}${separator}page=${page}&per_page=${PAGE_SIZE}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    });
    if (!res.ok) return items;

    const data = (await res.json()) as T[];
    items.push(...data);

    if (data.length < PAGE_SIZE) break;
    if (maxItems && items.length >= maxItems) break;
    page++;
  }

  return maxItems ? items.slice(0, maxItems) : items;
}

/** Fetch contribution events within the scoring window. Returns null on auth failure. */
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
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    });

    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) return items;

    const data = (await res.json()) as GitlabEvent[];
    items.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return items;
}

/** Fetch merged MRs authored by the user (global scope). */
async function fetchMergedMRs(
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<GitlabMergeRequest[]> {
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

/** Count others' MRs the user approved. 0 when approvals are Premium-gated. */
async function fetchReviewsCount(
  username: string,
  token: string,
  signal: AbortSignal,
): Promise<number> {
  const mrs = await fetchPaginated<GitlabMergeRequest>(
    `/merge_requests?reviewer_username=${encodeURIComponent(username)}&scope=all&state=merged`,
    token,
    signal,
    MAX_PRS,
  );

  let count = 0;
  for (const mr of mrs) {
    // Skip self-authored MRs (self-reviews don't count).
    if (mr.author?.username === username) continue;

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
): Promise<number> {
  const issues = await fetchPaginated<{ id: number }>(
    `/issues?author_username=${encodeURIComponent(username)}&state=closed&scope=all`,
    token,
    signal,
  );
  return issues.length;
}

/** Fetch the user's projects (paginated, capped at MAX_REPOS). */
async function fetchUserProjects(
  userId: number,
  token: string,
  signal: AbortSignal,
): Promise<GitlabProject[]> {
  return fetchPaginated<GitlabProject>(
    `/users/${userId}/projects`,
    token,
    signal,
    MAX_REPOS,
  );
}
