import type { RawContributionData } from "@chapa/shared";
import { CONTRIBUTION_QUERY, SCORING_WINDOW_DAYS } from "@chapa/shared";

// Re-export for consumers that import from this module
export type { RawContributionData };

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

export async function fetchContributionData(
  login: string,
  token?: string,
): Promise<RawContributionData | null> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - SCORING_WINDOW_DAYS);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers,
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
      const body = await res.text().catch(() => "(unreadable)");
      console.error(`[github] GraphQL HTTP ${res.status} for ${login}: ${body}`);
      return null;
    }

    const json = await res.json();

    if (json.errors) {
      console.error(`[github] GraphQL errors for ${login}:`, json.errors);
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
            (n: { pullRequest: { additions: number; deletions: number; changedFiles: number; merged: boolean } }) => ({
              additions: n.pullRequest.additions,
              deletions: n.pullRequest.deletions,
              changedFiles: n.pullRequest.changedFiles,
              merged: n.pullRequest.merged,
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
