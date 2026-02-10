// ---------------------------------------------------------------------------
// Types for raw GitHub GraphQL response data
// ---------------------------------------------------------------------------

export interface RawContributionData {
  login: string;
  name: string | null;
  avatarUrl: string;
  contributionCalendar: {
    totalContributions: number;
    weeks: {
      contributionDays: {
        date: string;
        contributionCount: number;
      }[];
    }[];
  };
  pullRequests: {
    totalCount: number;
    nodes: {
      additions: number;
      deletions: number;
      changedFiles: number;
      merged: boolean;
    }[];
  };
  reviews: { totalCount: number };
  issues: { totalCount: number };
  repositories: {
    totalCount: number;
    nodes: {
      nameWithOwner: string;
      defaultBranchRef: {
        target: { history: { totalCount: number } };
      } | null;
    }[];
  };
}

// ---------------------------------------------------------------------------
// GraphQL query
// ---------------------------------------------------------------------------

const CONTRIBUTION_QUERY = `
query($login: String!, $since: DateTime!, $until: DateTime!, $historySince: GitTimestamp!, $historyUntil: GitTimestamp!) {
  user(login: $login) {
    login
    name
    avatarUrl
    contributionsCollection(from: $since, to: $until) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
      pullRequestContributions(first: 100) {
        totalCount
        nodes {
          pullRequest {
            additions
            deletions
            changedFiles
            merged
          }
        }
      }
      pullRequestReviewContributions(first: 1) {
        totalCount
      }
      issueContributions(first: 1) {
        totalCount
      }
    }
    repositories(first: 20, ownerAffiliations: [OWNER, COLLABORATOR], orderBy: {field: PUSHED_AT, direction: DESC}) {
      totalCount
      nodes {
        nameWithOwner
        defaultBranchRef {
          target {
            ... on Commit {
              history(since: $historySince, until: $historyUntil) {
                totalCount
              }
            }
          }
        }
      }
    }
  }
}
`;

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

export async function fetchContributionData(
  login: string,
  token?: string,
): Promise<RawContributionData | null> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 90);

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
    };
  } catch (err) {
    console.error(`[github] fetch error for ${login}:`, err);
    return null;
  }
}
