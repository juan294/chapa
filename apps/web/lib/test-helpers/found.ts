import { isGitHubUserNotFound, type GitHubUserNotFound } from "@/lib/github/not-found";

/**
 * Narrows a stats-path outcome (`T | GitHubUserNotFound | null`, LE-8-2) to
 * the found value for an assertion. Throws on the other two branches so a
 * test that took the wrong one fails on the cause, not on a property read.
 */
export function expectFound<T>(value: T | GitHubUserNotFound | null | undefined): T {
  if (value === null || value === undefined || isGitHubUserNotFound(value)) {
    throw new Error(`expected a found value, got ${JSON.stringify(value)}`);
  }
  return value;
}
