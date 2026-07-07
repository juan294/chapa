/**
 * GitHub GraphQL query for fetching a user's contribution data over 365 days.
 *
 * Variables:
 * - $login: String! — GitHub username
 * - $since: DateTime! — Start of window (contributionsCollection)
 * - $until: DateTime! — End of window (contributionsCollection)
 * - $historySince: GitTimestamp! — Start of window (commit history)
 * - $historyUntil: GitTimestamp! — End of window (commit history)
 * - $mergedPrSearch: String! — `author:<login> is:pr is:merged created:<since>..<until>`,
 *   used by the top-level `search` field for an authoritative merged-PR count
 *   that isn't capped/scoped the way `pullRequestContributions` is.
 *
 * Note: DateTime and GitTimestamp are different GraphQL types but accept
 * the same ISO 8601 strings. They must be declared as separate variables.
 */
export const CONTRIBUTION_QUERY = `
query($login: String!, $since: DateTime!, $until: DateTime!, $historySince: GitTimestamp!, $historyUntil: GitTimestamp!, $mergedPrSearch: String!) {
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
    ownedRepos: repositories(ownerAffiliations: OWNER, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
      nodes { stargazerCount forkCount watchers { totalCount } }
    }
  }
  search(query: $mergedPrSearch, type: ISSUE) {
    issueCount
  }
}
`;
