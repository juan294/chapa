import type { RawContributionData } from "@chapa/shared";
import { CONTRIBUTION_QUERY, SCORING_WINDOW_DAYS } from "@chapa/shared";
import { getGithubToken } from "@/lib/env";
import { fetchWithRetry, sanitizeLogBody } from "@/lib/utils/fetch-retry";

// Re-export for consumers that import from this module
export type { RawContributionData };

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 15_000; // 15 seconds — prevents SSR from hanging in CI

/**
 * Fetch a user's GitHub contribution data via the GraphQL API.
 *
 * Queries the last 365 days of contribution activity (commits, PRs, reviews,
 * issues, repositories, contribution calendar). Uses the provided OAuth token
 * if available, otherwise falls back to `GITHUB_TOKEN` env var. Returns the
 * raw `RawContributionData` shape used by the scoring pipeline, or `null` on
 * error (HTTP failure, rate limiting, or missing user).
 *
 * Timeout: 15 seconds via `AbortSignal.timeout()`.
 */
export async function fetchContributionData(
  login: string,
  token?: string,
): Promise<RawContributionData | null> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - SCORING_WINDOW_DAYS);

  // Use session token if available, otherwise fall back to server-side
  // GITHUB_TOKEN (provided automatically by GitHub Actions in CI).
  const effectiveToken = token ?? getGithubToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (effectiveToken) {
    headers["Authorization"] = `Bearer ${effectiveToken}`;
  }

  try {
    const res = await fetchWithRetry("https://api.github.com/graphql", {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        query: CONTRIBUTION_QUERY,
        variables: {
          login,
          since: since.toISOString(),
          until: now.toISOString(),
          historySince: since.toISOString(),
          historyUntil: now.toISOString(),
        },
      }),
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "(unreadable)");
      const snippet = sanitizeLogBody(rawBody);
      console.error(`[github] GraphQL HTTP ${res.status} for ${login}: ${snippet}`);
      return null;
    }

    const json = await res.json();

    if (json.errors) {
      console.error(`[github] GraphQL errors for ${login}:`, json.errors);

      // Treat RATE_LIMITED or FORBIDDEN errors as a complete fetch failure.
      // GitHub returns partial data alongside these errors, but that partial data
      // has zero stars/forks/watchers which would get cached for 6h and cause
      // score drops. Returning null lets the caller serve stale cache instead.
      const isBlocking = (json.errors as { extensions?: { type?: string }; code?: string }[]).some(
        (e) =>
          e.extensions?.type === "RATE_LIMITED" ||
          e.extensions?.type === "FORBIDDEN" ||
          e.code === "RATE_LIMITED" ||
          e.code === "FORBIDDEN",
      );
      if (isBlocking) return null;
    }

    if (!json.data?.user) return null;

    const user = json.data.user;
    const cc = user.contributionsCollection;

    return {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      contributionCalendar: cc.contributionCalendar,
      pullRequests: {
        totalCount: cc.pullRequestContributions.totalCount,
        nodes: cc.pullRequestContributions.nodes
          .filter((n: { pullRequest: unknown } | null) => n != null && n.pullRequest != null)
          .map(
            (n: {
              pullRequest: {
                additions: number;
                deletions: number;
                changedFiles: number;
                merged: boolean;
                body: string | null;
                headRefName: string;
                baseRefName: string;
                createdAt: string;
                mergedAt: string | null;
                closingIssuesReferences?: { totalCount: number };
              };
            }) => ({
              additions: n.pullRequest.additions,
              deletions: n.pullRequest.deletions,
              changedFiles: n.pullRequest.changedFiles,
              merged: n.pullRequest.merged,
              body: n.pullRequest.body,
              headRefName: n.pullRequest.headRefName,
              baseRefName: n.pullRequest.baseRefName,
              createdAt: n.pullRequest.createdAt,
              mergedAt: n.pullRequest.mergedAt,
              closingIssuesCount: n.pullRequest.closingIssuesReferences?.totalCount ?? 0,
            }),
          ),
      },
      reviews: { totalCount: cc.pullRequestReviewContributions.totalCount },
      issues: { totalCount: cc.issueContributions.totalCount },
      repositories: {
        totalCount: user.repositories.totalCount,
        nodes: user.repositories.nodes,
      },
      ownedRepoStars: {
        nodes: ((user.ownedRepos?.nodes ?? []) as { stargazerCount: number; forkCount: number; watchers: { totalCount: number } }[])
          .filter((n): n is { stargazerCount: number; forkCount: number; watchers: { totalCount: number } } => n != null)
          .map((n) => ({ stargazerCount: n.stargazerCount, forkCount: n.forkCount, watchers: { totalCount: n.watchers.totalCount } })),
      },
    };
  } catch (err) {
    console.error(`[github] fetch error for ${login}:`, err);
    return null;
  }
}
