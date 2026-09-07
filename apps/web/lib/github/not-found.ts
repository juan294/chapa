/**
 * GitHub answered the lookup, and the answer is that nobody owns the handle
 * (LE-8-2).
 *
 * Every other failure on the stats path stays `null`: an HTTP error, a
 * RATE_LIMITED or FORBIDDEN response, a timeout, a payload the integrity
 * guard rejects. Those mean "could not load right now", and every consumer
 * keeps its "try later" state for them. This value is reserved for the one
 * case GitHub responded with data and `user` was null, so the public
 * surfaces can answer 404 without ever turning an outage into one.
 *
 * Pure and dependency-free on purpose: it is imported by the GraphQL layer,
 * the cache seam, the materializer and the routes alike.
 */
export interface GitHubUserNotFound {
  readonly kind: "github_user_not_found";
  readonly login: string;
}

export function githubUserNotFound(login: string): GitHubUserNotFound {
  return { kind: "github_user_not_found", login };
}

export function isGitHubUserNotFound(value: unknown): value is GitHubUserNotFound {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "github_user_not_found"
  );
}
