import type { RawContributionData } from "@chapa/shared";
import {
  CONTRIBUTION_QUERY,
  REPOSITORY_STATS_QUERY,
  SCORING_WINDOW_DAYS,
} from "@chapa/shared";
import { getGithubToken } from "@/lib/env";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { githubUserNotFound, type GitHubUserNotFound } from "./not-found";

// Re-export for consumers that import from this module
export type { RawContributionData };

interface GraphqlError {
  type?: string;
  code?: string;
  extensions?: { type?: string };
}

/**
 * LE-8-2 — `user: null` beside GitHub's NOT_FOUND error (or beside no error
 * at all) is GitHub saying the handle is nobody's. A payload with no `data`,
 * a `data` without the `user` key, or a null user beside some other error is
 * an answer that cannot be trusted and stays an ordinary failure.
 */
function isUserNotFound(json: { data?: { user?: unknown }; errors?: GraphqlError[] }): boolean {
  if (!json.data || json.data.user !== null) return false;
  const errors = json.errors ?? [];
  if (errors.length === 0) return true;
  return errors.some((e) => e.type === "NOT_FOUND" || e.extensions?.type === "NOT_FOUND");
}

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 15_000; // 15 seconds — prevents SSR from hanging in CI
export interface LegacyFetchContext {
  readonly resolvedCredential?: { readonly token: string | null };
  readonly referenceTime?: string;
}

/**
 * Fetch a user's GitHub contribution data via the GraphQL API.
 *
 * Queries the last 365 days of contribution activity (commits, PRs, reviews,
 * issues, repositories, contribution calendar). Uses the provided OAuth token
 * if available, otherwise falls back to `GITHUB_TOKEN` env var. Returns the
 * raw `RawContributionData` shape used by the scoring pipeline, `null` on
 * error (HTTP failure, rate limiting, an untrusted payload), or the
 * `GitHubUserNotFound` sentinel when GitHub answered that no such user exists
 * (LE-8-2) — the one outcome callers may turn into a 404.
 *
 * Timeout: 15 seconds via `AbortSignal.timeout()`.
 */
export async function fetchContributionData(
  login: string,
  token?: string,
  context: LegacyFetchContext = {},
): Promise<RawContributionData | GitHubUserNotFound | null> {
  const now = context.referenceTime ? new Date(context.referenceTime) : new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - SCORING_WINDOW_DAYS);

  // Merged-PR search window. `search(is:merged)` is token-scoped just like
  // `pullRequestContributions` — it is NOT an independent/authoritative
  // cross-check (that premise was disproven by #1045; see
  // `stats-integrity.ts`'s `assessRawFetchIntegrity` doc comment).
  const sinceDate = since.toISOString().slice(0, 10);
  const untilDate = now.toISOString().slice(0, 10);
  const mergedPrSearch = `author:${login} is:pr is:merged created:${sinceDate}..${untilDate}`;

  // Use session token if available, otherwise fall back to server-side
  // GITHUB_TOKEN (provided automatically by GitHub Actions in CI).
  const effectiveToken = context.resolvedCredential !== undefined ? context.resolvedCredential.token : token ?? getGithubToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (effectiveToken) {
    headers["Authorization"] = `Bearer ${effectiveToken}`;
  }

  try {
    const common = {
      method: "POST",
      headers,
    } as const;
    const [activityResponse, repositoryResponse] = await Promise.all([
      fetchWithRetry("https://api.github.com/graphql", {
        ...common,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        body: JSON.stringify({
          query: CONTRIBUTION_QUERY,
          variables: {
            login,
            since: since.toISOString(),
            until: now.toISOString(),
            mergedPrSearch,
          },
        }),
      }),
      fetchWithRetry("https://api.github.com/graphql", {
        ...common,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        body: JSON.stringify({
          query: REPOSITORY_STATS_QUERY,
          variables: {
            login,
            historySince: since.toISOString(),
            historyUntil: now.toISOString(),
          },
        }),
      }),
    ]);

    if (!activityResponse.ok || !repositoryResponse.ok) {
      console.error(
        `[github] GraphQL HTTP activity=${activityResponse.status} repositories=${repositoryResponse.status} for ${login}`,
      );
      return null;
    }

    const [activityJson, repositoryJson] = await Promise.all([
      activityResponse.json(),
      repositoryResponse.json(),
    ]);
    const errors = [
      ...(activityJson.errors ?? []),
      ...(repositoryJson.errors ?? []),
    ] as GraphqlError[];

    if (errors.length > 0) {
      console.error(`[github] GraphQL errors for ${login}`);

      // Treat RATE_LIMITED or FORBIDDEN errors as a complete fetch failure.
      // GitHub returns partial data alongside these errors, but that partial data
      // has zero stars/forks/watchers which would get cached for 6h and cause
      // score drops. Returning null lets the caller serve stale cache instead.
      const isBlocking = errors.some(
        (e) =>
          e.extensions?.type === "RATE_LIMITED" ||
          e.extensions?.type === "FORBIDDEN" ||
          e.code === "RATE_LIMITED" ||
          e.code === "FORBIDDEN",
      );
      if (isBlocking) return null;
    }

    if (!activityJson.data?.user) {
      return isUserNotFound(activityJson) ? githubUserNotFound(login) : null;
    }
    if (!repositoryJson.data?.user) return null;

    const user = activityJson.data.user;
    const repositoryUser = repositoryJson.data.user;
    const cc = user.contributionsCollection;
    const mergedPrTotalCount: number = activityJson.data?.search?.issueCount ?? 0;

    return {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      mergedPrTotalCount,
      contributionCalendar: cc.contributionCalendar,
      pullRequests: {
        // Optional-chained: an empty/missing `pullRequestContributions` no
        // longer throws (which would mask the degradation as an ordinary
        // fetch failure) — it safely defaults to an empty sample, so
        // `assessRawFetchIntegrity` is the one place that decides whether
        // this payload is trustworthy. It does NOT use `mergedPrTotalCount`
        // above as ground truth (#1045 — that field is token-scoped too);
        // it checks only the sample's internal shape.
        totalCount: cc?.pullRequestContributions?.totalCount ?? 0,
        nodes: (cc?.pullRequestContributions?.nodes ?? [])
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
      reviews: { totalCount: cc?.pullRequestReviewContributions?.totalCount ?? 0 },
      issues: { totalCount: cc?.issueContributions?.totalCount ?? 0 },
      repositories: {
        totalCount: repositoryUser.repositories.totalCount,
        nodes: repositoryUser.repositories.nodes,
      },
      ownedRepoStars: {
        nodes: ((repositoryUser.ownedRepos?.nodes ?? []) as { stargazerCount: number; forkCount: number; watchers: { totalCount: number } }[])
          .filter((n): n is { stargazerCount: number; forkCount: number; watchers: { totalCount: number } } => n != null)
          .map((n) => ({ stargazerCount: n.stargazerCount, forkCount: n.forkCount, watchers: { totalCount: n.watchers.totalCount } })),
      },
    };
  } catch (error) {
    // The reason matters and used to be dropped: an AbortError (the 15s
    // timeout) and a TypeError from an unexpected payload shape are different
    // problems with different fixes, and this line was the only trace of
    // either. Error name and message carry no credentials.
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[github] fetch error for ${login} — ${reason}`);
    return null;
  }
}
