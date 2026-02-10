/**
 * GitHub handle validation.
 *
 * Rules (from GitHub docs):
 * - 1–39 alphanumeric characters or hyphens
 * - Cannot start or end with a hyphen
 */
const GITHUB_HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

export function isValidHandle(handle: string): boolean {
  return GITHUB_HANDLE_RE.test(handle);
}
