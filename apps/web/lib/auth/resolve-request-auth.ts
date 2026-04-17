import { isCliToken, verifyCliToken } from "@/lib/auth/cli-token";
import { fetchGitHubUser } from "@/lib/auth/github";
import {
  getOptionalRequestSession,
  getSessionSecret,
} from "@/lib/auth/session";

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
    const token = authHeader.slice(7);
    return resolveHandle(token, secret);
  }

  // 2. Fall back to session cookie
  const session = getOptionalRequestSession(request);
  if (session) {
    return { handle: session.login, token: session.token };
  }

  return null;
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

  // Fallback: verify as GitHub PAT
  const user = await fetchGitHubUser(token);
  return user ? { handle: user.login } : null;
}
