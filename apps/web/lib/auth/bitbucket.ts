import { randomBytes, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BitbucketUser {
  username: string;
  display_name: string;
  links: { avatar: { href: string } };
}

export interface BitbucketTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds (typically 7200 = 2 hours)
  token_type: "bearer";
  scopes: string;
}

/**
 * Discriminated result for token refresh attempts.
 * - `ok: true` — refresh succeeded, new tokens available
 * - `ok: false, reason: "revoked"` — grant is dead (user revoked, token expired server-side)
 * - `ok: false, reason: "transient"` — temporary failure (network, timeout, server error)
 */
export type TokenRefreshResult<T> =
  | { ok: true; tokens: T }
  | { ok: false; reason: "revoked" | "transient" };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BB_AUTHORIZE_URL = "https://bitbucket.org/site/oauth2/authorize";
const BB_TOKEN_URL = "https://bitbucket.org/site/oauth2/access_token";
const BB_API_URL = "https://api.bitbucket.org/2.0";

/** 10-second timeout for all external OAuth fetches */
const FETCH_TIMEOUT_MS = 10_000;

/** 5-minute buffer before token expiry — refresh proactively */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// OAuth URL
// ---------------------------------------------------------------------------

/**
 * Build Bitbucket OAuth authorize URL.
 * Scopes are configured on the OAuth consumer in Bitbucket settings (not in URL).
 */
export function buildBitbucketAuthUrl(
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
  return `${BB_AUTHORIZE_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// CSRF state cookie
// ---------------------------------------------------------------------------

const BB_STATE_COOKIE_NAME = "chapa_bb_oauth_state";

function isSecureOrigin(): boolean {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() ?? "";
  return base.startsWith("https://");
}

function cookieFlags(): string {
  const secure = isSecureOrigin() ? " Secure;" : "";
  return `HttpOnly;${secure} SameSite=Lax; Path=/`;
}

/**
 * Generate a cryptographically random CSRF state token for Bitbucket OAuth
 * and return it as a `Set-Cookie` header value (HttpOnly, SameSite=Lax, 10-minute Max-Age).
 *
 * @returns Object with `state` (hex token) and `cookie` (Set-Cookie header value)
 */
export function createBitbucketStateCookie(): {
  state: string;
  cookie: string;
} {
  const state = randomBytes(16).toString("hex");
  const cookie = `${BB_STATE_COOKIE_NAME}=${state}; ${cookieFlags()}; Max-Age=600`;
  return { state, cookie };
}

/**
 * Validate the Bitbucket OAuth CSRF state parameter against the cookie value.
 *
 * Uses `crypto.timingSafeEqual` for constant-time comparison.
 *
 * @param cookieHeader - Raw `Cookie` header string from the incoming request
 * @param queryState - The `state` query parameter from Bitbucket's OAuth redirect
 * @returns `true` if both values are present and identical; `false` otherwise
 */
export function validateBitbucketState(
  cookieHeader: string | null,
  queryState: string | null,
): boolean {
  if (!cookieHeader || !queryState) return false;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${BB_STATE_COOKIE_NAME}=`));
  if (!match) return false;
  const cookieState = match.slice(BB_STATE_COOKIE_NAME.length + 1);
  const cookieBuf = Buffer.from(cookieState, "utf8");
  const queryBuf = Buffer.from(queryState, "utf8");
  if (cookieBuf.length !== queryBuf.length) return false;
  return timingSafeEqual(cookieBuf, queryBuf);
}

/**
 * Return a `Set-Cookie` header value that immediately expires the Bitbucket CSRF state cookie.
 *
 * @returns Set-Cookie header string with Max-Age=0
 */
export function clearBitbucketStateCookie(): string {
  return `${BB_STATE_COOKIE_NAME}=; ${cookieFlags()}; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchange authorization code for tokens.
 * Bitbucket uses form encoding and Basic auth (not JSON like GitHub).
 */
export async function exchangeBitbucketCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<BitbucketTokenResponse | null> {
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const res = await fetch(BB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    return data as BitbucketTokenResponse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Classify an OAuth error response as revoked or transient.
 * Only HTTP 400 with `error: "invalid_grant"` is treated as revocation;
 * everything else (5xx, timeout, other 4xx) is transient.
 */
export async function classifyOAuthError(res: Response): Promise<"revoked" | "transient"> {
  if (res.status === 400) {
    try {
      const body = await res.json();
      if (body.error === "invalid_grant") return "revoked";
    } catch {
      // Unparseable body — treat as transient
    }
  }
  return "transient";
}

/**
 * Refresh an expired access token.
 *
 * Returns a discriminated result distinguishing permanent revocation
 * (HTTP 400 + `invalid_grant`) from transient failures (network, timeout, 5xx).
 * Callers should only unlink the platform on `reason: "revoked"`.
 */
export async function refreshBitbucketToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenRefreshResult<BitbucketTokenResponse>> {
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const res = await fetch(BB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      return { ok: false, reason: await classifyOAuthError(res) };
    }

    const data = await res.json();
    if (!data.access_token) {
      return { ok: false, reason: "transient" };
    }
    return { ok: true, tokens: data as BitbucketTokenResponse };
  } catch {
    return { ok: false, reason: "transient" };
  }
}

// ---------------------------------------------------------------------------
// Fetch authenticated Bitbucket user
// ---------------------------------------------------------------------------

/**
 * Fetch authenticated Bitbucket user profile.
 */
export async function fetchBitbucketUser(
  accessToken: string,
): Promise<BitbucketUser | null> {
  try {
    const res = await fetch(`${BB_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      username: data.username,
      display_name: data.display_name,
      links: { avatar: { href: data.links?.avatar?.href ?? "" } },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token expiry helpers
// ---------------------------------------------------------------------------

/**
 * Compute the absolute expiry timestamp from a relative `expires_in` value.
 *
 * Adds `expiresIn` seconds to `Date.now()` to produce an absolute `Date`.
 *
 * @param expiresIn - Token lifetime in seconds (typically 7200 = 2 hours for Bitbucket)
 * @returns A `Date` representing when the token expires
 */
export function computeTokenExpiry(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

/**
 * Check if a token is expired or about to expire (with 5-minute buffer).
 *
 * Returns `true` if `expiresAt` is `null` (unknown expiry — treat as expired)
 * or if the current time is within 5 minutes of the expiry timestamp.
 * The buffer ensures proactive refresh before the token actually expires.
 *
 * @param expiresAt - The absolute expiry timestamp, or `null` if unknown
 * @returns `true` if the token should be refreshed; `false` if still valid
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - Date.now() <= TOKEN_EXPIRY_BUFFER_MS;
}
