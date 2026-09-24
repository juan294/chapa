/**
 * v7 only. Legacy CONTRIBUTION_QUERY remains a v6 reader.
 * Semantics checked against https://docs.github.com/en/graphql/reference/users,
 * /commits, /pulls and /issues. Review contributions discover PRs, not all reviews.
 */
const pageInfo = "pageInfo { hasNextPage endCursor } totalCount";
const repository = "repository { id nameWithOwner }";
const change = `id ${repository} author { ... on User { id } } merged mergedAt createdAt
  headRefOid body headRefName baseRefName additions deletions changedFiles
  closingIssuesReferences(first: 1) { totalCount }`;

export const GITHUB_EVIDENCE_QUERIES = {
  profile: `query V7Profile($login: String!) { user(login: $login) { id login name avatarUrl } }`,
  repositories: `query V7Repositories($login: String!, $after: String) {
    user(login: $login) { repositories(first: 100, after: $after, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
      ${pageInfo} nodes { id nameWithOwner }
    } }
  }`,
  contributed: `query V7ContributedRepositories($login: String!, $after: String) {
    user(login: $login) { repositoriesContributedTo(first: 100, after: $after, includeUserRepositories: true) {
      ${pageInfo} nodes { id nameWithOwner }
    } }
  }`,
  merged: `query V7MergedChanges($query: String!, $after: String) {
    search(query: $query, type: ISSUE, first: 100, after: $after) {
      issueCount pageInfo { hasNextPage endCursor } nodes { ... on PullRequest { ${change} } }
    }
  }`,
  files: `query V7Files($id: ID!, $after: String) {
    node(id: $id) { ... on PullRequest { files(first: 100, after: $after) { ${pageInfo} nodes { path } } } }
  }`,
  reviewDiscovery: `query V7ReviewDiscovery($login: String!, $since: DateTime!, $until: DateTime!, $after: String) {
    user(login: $login) { contributionsCollection(from: $since, to: $until) {
      restrictedContributionsCount pullRequestReviewContributions(first: 100, after: $after) {
        ${pageInfo} nodes { isRestricted pullRequest { id ${repository} } }
      }
    } }
  }`,
  reviews: `query V7Reviews($id: ID!, $after: String) {
    node(id: $id) { ... on PullRequest { reviews(first: 100, after: $after) {
      ${pageInfo} nodes { id author { ... on User { id } } submittedAt state }
    } } }
  }`,
  // Traverse author-filtered history rather than pretending the API's history
  // timestamp filter is a proven authored-date filter. Budget truncation is explicit.
  commits: `query V7Commits($id: ID!, $subjectId: ID!, $after: String) {
    node(id: $id) { ... on Repository { isEmpty defaultBranchRef { target { ... on Commit {
      history(first: 100, after: $after, author: {id: $subjectId}) {
        ${pageInfo} nodes { id oid author { user { id } } authoredDate additions deletions }
      }
    } } } } }
  }`,
  issues: `query V7Issues($id: ID!, $since: DateTime!, $after: String) {
    node(id: $id) { ... on Repository {
      issues(first: 100, after: $after, filterBy: {since: $since}, orderBy: {field: UPDATED_AT, direction: DESC}) {
        ${pageInfo} nodes { id ${repository} }
      }
    } }
  }`,
  closures: `query V7Closures($id: ID!, $after: String) {
    node(id: $id) { ... on Issue { timelineItems(first: 100, after: $after, itemTypes: [CLOSED_EVENT]) {
      ${pageInfo} nodes { ... on ClosedEvent { id createdAt actor { ... on User { id } }
        closer { __typename
          ... on PullRequest { id author { ... on User { id } } merged mergedAt headRefOid repository { id nameWithOwner } }
          ... on Commit { id }
        }
      } }
    } } }
  }`,
} as const;
