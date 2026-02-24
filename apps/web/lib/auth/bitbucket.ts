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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BB_AUTHORIZE_URL = "https://bitbucket.org/site/oauth2/authorize";
const BB_TOKEN_URL = "https://bitbucket.org/site/oauth2/access_token";
const BB_API_URL = "https://api.bitbucket.org/2.0";

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

export function createBitbucketStateCookie(): {
  state: string;
  cookie: string;
} {
  const state = randomBytes(16).toString("hex");
  const cookie = `${BB_STATE_COOKIE_NAME}=${state}; ${cookieFlags()}; Max-Age=600`;
  return { state, cookie };
}

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
 * Refresh an expired access token.
 */
export async function refreshBitbucketToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<BitbucketTokenResponse | null> {
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
 * Compute token expiry from `expires_in` seconds.
 */
export function computeTokenExpiry(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

/**
 * Check if a token is expired (with 5-minute buffer).
 * Returns true if expiresAt is null (unknown) or within 5 minutes of now.
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - Date.now() <= TOKEN_EXPIRY_BUFFER_MS;
}
