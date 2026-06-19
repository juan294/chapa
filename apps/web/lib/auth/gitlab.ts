import { randomBytes, timingSafeEqual } from "crypto";
import { classifyOAuthError, type TokenRefreshResult } from "./bitbucket";
import { buildAuthCookieFlags } from "./cookie-policy";
import { getBaseUrl } from "@/lib/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitlabUser {
  /** Numeric GitLab user id — needed by the Events/Projects API in stats fetching */
  id: number;
  login: string;
  full_name: string;
  avatar_url: string;
}

export interface GitlabTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number; // GitLab tokens expire (~2h); may be absent on some flows
  refresh_token?: string; // GitLab issues refresh tokens
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GL_AUTHORIZE_URL = "https://gitlab.com/oauth/authorize";
const GL_TOKEN_URL = "https://gitlab.com/oauth/token";
const GL_API_URL = "https://gitlab.com/api/v4";

/** OAuth scopes — read-only access to the user profile and API. */
const GL_SCOPES = "read_user read_api";

/** 10-second timeout for all external OAuth fetches */
const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// OAuth URL
// ---------------------------------------------------------------------------

/**
 * Build GitLab OAuth authorize URL.
 * Unlike Codeberg (Forgejo), GitLab supports scopes — request read-only access.
 */
export function buildGitlabAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope: GL_SCOPES,
  });
  return `${GL_AUTHORIZE_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// CSRF state cookie
// ---------------------------------------------------------------------------

const GL_STATE_COOKIE_NAME = "chapa_gl_oauth_state";

function cookieFlags(): string {
  return buildAuthCookieFlags(getBaseUrl());
}

/**
 * Generate a cryptographically random CSRF state token for GitLab OAuth
 * and return it as a `Set-Cookie` header value (HttpOnly, SameSite=Lax, 10-minute Max-Age).
 *
 * @returns Object with `state` (hex token) and `cookie` (Set-Cookie header value)
 */
export function createGitlabStateCookie(): {
  state: string;
  cookie: string;
} {
  const state = randomBytes(16).toString("hex");
  const cookie = `${GL_STATE_COOKIE_NAME}=${state}; ${cookieFlags()}; Max-Age=600`;
  return { state, cookie };
}

/**
 * Validate the GitLab OAuth CSRF state parameter against the cookie value.
 *
 * Uses `crypto.timingSafeEqual` for constant-time comparison.
 *
 * @param cookieHeader - Raw `Cookie` header string from the incoming request
 * @param queryState - The `state` query parameter from GitLab's OAuth redirect
 * @returns `true` if both values are present and identical; `false` otherwise
 */
export function validateGitlabState(
  cookieHeader: string | null,
  queryState: string | null,
): boolean {
  if (!cookieHeader || !queryState) return false;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GL_STATE_COOKIE_NAME}=`));
  if (!match) return false;
  const cookieState = match.slice(GL_STATE_COOKIE_NAME.length + 1);
  const cookieBuf = Buffer.from(cookieState, "utf8");
  const queryBuf = Buffer.from(queryState, "utf8");
  if (cookieBuf.length !== queryBuf.length) return false;
  return timingSafeEqual(cookieBuf, queryBuf);
}

/**
 * Return a `Set-Cookie` header value that immediately expires the GitLab CSRF state cookie.
 *
 * @returns Set-Cookie header string with Max-Age=0
 */
export function clearGitlabStateCookie(): string {
  return `${GL_STATE_COOKIE_NAME}=; ${cookieFlags()}; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchange authorization code for tokens.
 * GitLab uses a form-encoded body with client credentials inline.
 */
export async function exchangeGitlabCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<GitlabTokenResponse | null> {
  try {
    const res = await fetch(GL_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    return data as GitlabTokenResponse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Refresh an expired access token.
 *
 * Returns a discriminated result distinguishing permanent revocation
 * (HTTP 400 + `invalid_grant`) from transient failures (network, timeout, 5xx).
 * Callers should only unlink the platform on `reason: "revoked"`.
 */
export async function refreshGitlabToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenRefreshResult<GitlabTokenResponse>> {
  try {
    const res = await fetch(GL_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      return { ok: false, reason: await classifyOAuthError(res) };
    }

    const data = await res.json();
    if (!data.access_token) {
      return { ok: false, reason: "transient" };
    }
    return { ok: true, tokens: data as GitlabTokenResponse };
  } catch {
    return { ok: false, reason: "transient" };
  }
}

// ---------------------------------------------------------------------------
// Fetch authenticated GitLab user
// ---------------------------------------------------------------------------

/**
 * Fetch authenticated GitLab user profile.
 * Uses `Bearer` authorization (standard OAuth 2.0).
 */
export async function fetchGitlabUser(
  accessToken: string,
): Promise<GitlabUser | null> {
  try {
    const res = await fetch(`${GL_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      login: data.username,
      full_name: data.name,
      avatar_url: data.avatar_url,
    };
  } catch {
    return null;
  }
}
