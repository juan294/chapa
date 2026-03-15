import { randomBytes, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodebergUser {
  login: string;
  full_name: string;
  avatar_url: string;
}

export interface CodebergTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number; // May be absent — handle both cases
  refresh_token?: string; // May be absent
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CB_AUTHORIZE_URL = "https://codeberg.org/login/oauth/authorize";
const CB_TOKEN_URL = "https://codeberg.org/login/oauth/access_token";
const CB_API_URL = "https://codeberg.org/api/v1";

/** 10-second timeout for all external OAuth fetches */
const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// OAuth URL
// ---------------------------------------------------------------------------

/**
 * Build Codeberg OAuth authorize URL.
 * Codeberg (Forgejo) does not support scopes yet — full user permissions are granted.
 */
export function buildCodebergAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `${CB_AUTHORIZE_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// CSRF state cookie
// ---------------------------------------------------------------------------

const CB_STATE_COOKIE_NAME = "chapa_cb_oauth_state";

function isSecureOrigin(): boolean {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() ?? "";
  return base.startsWith("https://");
}

function cookieFlags(): string {
  const secure = isSecureOrigin() ? " Secure;" : "";
  return `HttpOnly;${secure} SameSite=Lax; Path=/`;
}

/**
 * Generate a cryptographically random CSRF state token for Codeberg OAuth
 * and return it as a `Set-Cookie` header value (HttpOnly, SameSite=Lax, 10-minute Max-Age).
 *
 * @returns Object with `state` (hex token) and `cookie` (Set-Cookie header value)
 */
export function createCodebergStateCookie(): {
  state: string;
  cookie: string;
} {
  const state = randomBytes(16).toString("hex");
  const cookie = `${CB_STATE_COOKIE_NAME}=${state}; ${cookieFlags()}; Max-Age=600`;
  return { state, cookie };
}

/**
 * Validate the Codeberg OAuth CSRF state parameter against the cookie value.
 *
 * Uses `crypto.timingSafeEqual` for constant-time comparison.
 *
 * @param cookieHeader - Raw `Cookie` header string from the incoming request
 * @param queryState - The `state` query parameter from Codeberg's OAuth redirect
 * @returns `true` if both values are present and identical; `false` otherwise
 */
export function validateCodebergState(
  cookieHeader: string | null,
  queryState: string | null,
): boolean {
  if (!cookieHeader || !queryState) return false;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CB_STATE_COOKIE_NAME}=`));
  if (!match) return false;
  const cookieState = match.slice(CB_STATE_COOKIE_NAME.length + 1);
  const cookieBuf = Buffer.from(cookieState, "utf8");
  const queryBuf = Buffer.from(queryState, "utf8");
  if (cookieBuf.length !== queryBuf.length) return false;
  return timingSafeEqual(cookieBuf, queryBuf);
}

/**
 * Return a `Set-Cookie` header value that immediately expires the Codeberg CSRF state cookie.
 *
 * @returns Set-Cookie header string with Max-Age=0
 */
export function clearCodebergStateCookie(): string {
  return `${CB_STATE_COOKIE_NAME}=; ${cookieFlags()}; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchange authorization code for tokens.
 * Codeberg uses JSON body with client credentials inline (not Basic auth).
 */
export async function exchangeCodebergCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<CodebergTokenResponse | null> {
  try {
    const res = await fetch(CB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    return data as CodebergTokenResponse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Refresh an expired access token.
 * Returns null if Codeberg doesn't support refresh for this token.
 */
export async function refreshCodebergToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<CodebergTokenResponse | null> {
  try {
    const res = await fetch(CB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    return data as CodebergTokenResponse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch authenticated Codeberg user
// ---------------------------------------------------------------------------

/**
 * Fetch authenticated Codeberg user profile.
 * Uses `token` prefix (canonical for Forgejo/Gitea) instead of `Bearer`.
 */
export async function fetchCodebergUser(
  accessToken: string,
): Promise<CodebergUser | null> {
  try {
    const res = await fetch(`${CB_API_URL}/user`, {
      headers: {
        Authorization: `token ${accessToken}`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      login: data.login,
      full_name: data.full_name,
      avatar_url: data.avatar_url,
    };
  } catch {
    return null;
  }
}
