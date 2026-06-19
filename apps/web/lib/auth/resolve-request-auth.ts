import { isCliToken, verifyCliToken } from "@/lib/auth/cli-token";
import { fetchGitHubUser } from "@/lib/auth/github";
import {
  getOptionalRequestSession,
  getSessionSecret,
} from "@/lib/auth/session";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";

/**
 * Resolve the authenticated handle from a request.
 *
 * Tries Bearer token first (CLI token or GitHub PAT), then falls back
 * to session cookie. Returns `{ handle, token? }` on success, `null` on
 * failure. The `token` field is only populated from session cookies (the
 * user's GitHub OAuth token) — CLI tokens are not GitHub tokens.
 *
 * Used by API routes that need to accept both CLI and browser auth:
 * `/api/insights`, `/api/recalculate`, `/api/supplemental`.
 */
export async function resolveRequestAuth(
  request: Request,
): Promise<{ handle: string; token?: string } | null> {
  const secret = getSessionSecret();
  if (!secret) return null;

  // 1. Check Authorization header (Bearer token)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    return resolveHandle(token, secret);
  }

  // 2. Fall back to session cookie
  const session = getOptionalRequestSession(request);
  if (session) {
    const token = await getSessionGitHubToken(session);
    return token
      ? { handle: session.login, token }
      : { handle: session.login };
  }

  return null;
}

/**
 * Cheap structural pre-check before making any outbound GitHub call (BE-H2c #860).
 *
 * A token is considered GitHub-PAT-shaped when it starts with one of the known
 * GitHub token prefixes: ghp_ / gho_ / ghu_ / ghs_ / ghr_ (classic OAuth /
 * fine-grained) or github_pat_ (fine-grained PATs issued after 2022).
 *
 * Tokens that don't match any of these prefixes AND are not Chapa CLI tokens are
 * rejected immediately WITHOUT calling fetchGitHubUser. This prevents a stream of
 * bogus Bearer tokens from burning the shared GitHub API rate-limit quota
 * (resource amplification attack).
 *
 * Trusted proxy assumption: this runs server-side on the Authorization header.
 * It is a cheap pre-filter, not a standalone security boundary.
 */
const GITHUB_TOKEN_PREFIX_RE = /^gh[poushr]_|^github_pat_/;

function isStructurallyValidGithubToken(token: string): boolean {
  if (!token) return false;
  return GITHUB_TOKEN_PREFIX_RE.test(token);
}

/**
 * Resolve a handle from a Bearer token.
 * Supports CLI tokens (HMAC-signed) and GitHub PATs.
 */
async function resolveHandle(
  token: string,
  secret: string,
): Promise<{ handle: string } | null> {
  if (isCliToken(token)) {
    return verifyCliToken(token, secret);
  }

  // BE-H2c: Cheap structural pre-check before hitting the GitHub API.
  // Tokens that are not GitHub-PAT-shaped are rejected immediately.
  // This prevents bogus tokens from burning the shared GitHub API quota.
  if (!isStructurallyValidGithubToken(token)) {
    return null;
  }

  // Fallback: verify as GitHub PAT
  const user = await fetchGitHubUser(token);
  return user ? { handle: user.login } : null;
}
