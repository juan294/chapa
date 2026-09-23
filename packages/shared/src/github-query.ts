/**
 * Legacy v6 GraphQL activity contract. Repository history is intentionally a
 * separate request: large accounts can make GitHub time out when both expensive
 * fields share one operation. New scoring consumes collectGitHubSlice
 * (apps/web/lib/github/evidence.ts), never these historical scalar proxies.
 *
 * Variables:
 * - $login: String! — GitHub username
 * - $since: DateTime! — Start of window (contributionsCollection)
 * - $until: DateTime! — End of window (contributionsCollection)
 * - $mergedPrSearch: String! — `author:<login> is:pr is:merged created:<since>..<until>`,
 *   used by the top-level `search` field for a legacy token-visible count.
 *   This is not an independent authoritative completeness cross-check.
 *
 */
export const CONTRIBUTION_QUERY = `
query($login: String!, $since: DateTime!, $until: DateTime!, $mergedPrSearch: String!) {
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
            body
            headRefName
            baseRefName
            createdAt
            mergedAt
            closingIssuesReferences(first: 1) { totalCount }
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
  }
  search(query: $mergedPrSearch, type: ISSUE) {
    issueCount
  }
}
`;

/** Legacy repository and commit-history fields, isolated from activity data. */
export const REPOSITORY_STATS_QUERY = `
query($login: String!, $historySince: GitTimestamp!, $historyUntil: GitTimestamp!) {
  user(login: $login) {
    repositories(first: 100, ownerAffiliations: [OWNER, COLLABORATOR], orderBy: {field: PUSHED_AT, direction: DESC}) {
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
    ownedRepos: repositories(ownerAffiliations: OWNER, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
      nodes { stargazerCount forkCount watchers { totalCount } }
    }
  }
}
`;
