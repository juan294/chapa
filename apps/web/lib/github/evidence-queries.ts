/**
 * v7 only. Legacy CONTRIBUTION_QUERY remains a v6 reader.
 * Semantics checked against https://docs.github.com/en/graphql/reference/users,
 * /commits and /pulls. Review contributions discover PRs, not all reviews.
 * GitHub issue closures are not collected (#1351): every `issue_work` event
 * the collector produced was inadmissible for scoring (see v7-evidence.ts's
 * `acceptedKind`), so a linked-issue scan spent GraphQL points with no
 * effect on the displayed score.
 */
const pageInfo = "pageInfo { hasNextPage endCursor } totalCount";
const repository = "repository { id nameWithOwner }";
const change = `id ${repository} author { ... on User { id } } merged mergedAt createdAt
  headRefOid body headRefName baseRefName additions deletions changedFiles
  closingIssuesReferences(first: 1) { totalCount }`;

function commitHistoryQuery(name: string, lineFields: string): string {
  return `query ${name}($id: ID!, $subjectId: ID!, $since: GitTimestamp!, $after: String, $first: Int!) {
    node(id: $id) { ... on Repository { isEmpty defaultBranchRef { target { ... on Commit {
      history(first: $first, after: $after, since: $since, author: {id: $subjectId}) {
        ${pageInfo} nodes { id oid author { user { id } } authoredDate${lineFields ? ` ${lineFields}` : ""} }
      }
    } } } } }
  }`;
}

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
  // `since` filters by committed date, not authored date, so the caller sets
  // it a margin before the window and still filters each node by authoredDate.
  // Unbounded history walked a repository's whole past and answered 502 on
  // large histories; smaller pages keep each request well inside GitHub's
  // timeout. `first` is a variable so a failing page can retry smaller
  // (evidence.ts's commit-history 5xx retry ladder, #1351).
  commits: commitHistoryQuery("V7Commits", "additions deletions"),
  // The same page without line counts. GitHub nulls a commit whose lines it
  // cannot count; this variant recovers that commit with unknown lines.
  commitsWithoutLines: commitHistoryQuery("V7CommitsWithoutLines", ""),
} as const;
