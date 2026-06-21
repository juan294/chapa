/**
 * Generic platform OAuth handler factory.
 *
 * Encapsulates the shared connect / callback / disconnect / status
 * flow used by Bitbucket, Codeberg, and any future OAuth-linked platform.
 *
 * Each platform provides a `PlatformOAuthConfig` with its specifics
 * (feature flag, env vars, cookie helpers, token exchange, user fetch).
 * The factory returns four route handlers ready to export from Next.js
 * route files.
 */

import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-session";
import { getBaseUrl } from "@/lib/env";
import { dbUpsertLinkedPlatform, dbDeleteLinkedPlatform, dbGetLinkedPlatforms } from "@/lib/db/user-platforms";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { markStatsDirty } from "@/lib/cache/dirty-stats";
import { getClientIp } from "@/lib/http/client-ip";
import { computeTokenExpiry } from "@/lib/auth/bitbucket";
import { buildBadgeSvgCacheKey } from "@/lib/render/badge-svg-cache";
import { toDateString } from "@/lib/utils/date";

/**
 * Invalidate the same-day rendered badge SVG cache so a newly linked or
 * unlinked platform's logo appears on the badge immediately, rather than
 * waiting for the date-keyed cache to roll over (#856). The stats caches are
 * invalidated separately; this covers the rendered artifact that the badge.svg
 * route and the share page both read.
 */
async function invalidateBadgeSvgCache(handle: string): Promise<void> {
  await cacheDel(buildBadgeSvgCacheKey(handle, toDateString(new Date())));
}

async function invalidatePlatformReadModels(
  handle: string,
  platform: string,
  options: { clearSupplemental?: boolean } = {},
): Promise<void> {
  const lh = handle.toLowerCase();
  const deletes: Array<Promise<unknown>> = [
    cacheDel(`stats:v2:merged:${lh}`),
    cacheDel(`stats:v2:${platform}:${lh}`),
    cacheDel(`stats:v2:${platform}:${lh}:neg`),
    invalidateBadgeSvgCache(handle),
  ];

  if (options.clearSupplemental) {
    deletes.push(cacheDel(`supplemental:${lh}`));
  }

  await Promise.all(deletes);
}

function revalidateSharePage(handle: string): void {
  try {
    revalidatePath(`/u/${handle}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("static generation store missing")
    ) {
      return;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Token response shape — must have access_token; everything else is optional. */
export interface PlatformTokenResponse {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
}

/** User profile shape — just needs a login/username string. */
export interface PlatformUser {
  login: string;
}

/** Platform-specific configuration for the OAuth flow. */
export interface PlatformOAuthConfig {
  /** Platform identifier stored in DB (e.g. "bitbucket", "codeberg") */
  platform: string;

  /** Short prefix for rate-limit keys (e.g. "bb", "cb") */
  rateLimitPrefix: string;

  /** Async function to check if the platform feature flag is enabled */
  isEnabled: () => Promise<boolean>;

  /** Read the OAuth client ID from the centralized env boundary. */
  getClientId: () => string | undefined;

  /** Read the OAuth client secret from the centralized env boundary. */
  getClientSecret: () => string | undefined;

  /** Create CSRF state cookie (returns { state, cookie }) */
  createStateCookie: () => { state: string; cookie: string };

  /** Build the OAuth authorize URL */
  buildAuthUrl: (clientId: string, redirectUri: string, state: string) => string;

  /** Validate CSRF state from cookie header against query param */
  validateState: (cookieHeader: string | null, queryState: string | null) => boolean;

  /** Clear the CSRF state cookie (returns Set-Cookie header value) */
  clearStateCookie: () => string;

  /** Exchange authorization code for tokens */
  exchangeCode: (
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) => Promise<PlatformTokenResponse | null>;

  /** Fetch the authenticated user profile — must return { login: string } */
  fetchUser: (accessToken: string) => Promise<PlatformUser | null>;
}

// ---------------------------------------------------------------------------
// Handler factories
// ---------------------------------------------------------------------------

/**
 * Create a GET handler for the OAuth connect route.
 *
 * Flow: feature flag -> rate limit -> require session -> validate env ->
 *       create state cookie -> build auth URL -> redirect
 */
export function createConnectHandler(config: PlatformOAuthConfig) {
  return async function GET(request: NextRequest) {
    // 1. Feature flag check
    if (!(await config.isEnabled())) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2. Rate limit: 10 requests per IP per 15 minutes
    const ip = getClientIp(request);
    const rl = await rateLimit(`ratelimit:${config.rateLimitPrefix}:connect:${ip}`, 10, 900);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    // 3. Require authenticated session
    const { session, error } = requireSession(request);
    if (error) return error;

    // 4. Validate env vars
    const clientId = config.getClientId();
    if (!clientId) {
      return NextResponse.redirect(
        new URL(`/u/${session.login}?error=config`, request.url),
      );
    }

    // 5. Generate CSRF state + cookie
    const { state, cookie } = config.createStateCookie();
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/${config.platform}/callback`;
    const authUrl = config.buildAuthUrl(clientId, redirectUri, state);

    // 6. Redirect to platform
    const response = NextResponse.redirect(authUrl);
    response.headers.append("Set-Cookie", cookie);
    return response;
  };
}

/**
 * Create a GET handler for the OAuth callback route.
 *
 * Flow: feature flag -> rate limit -> require session -> validate code ->
 *       validate CSRF -> validate env -> exchange code -> fetch user ->
 *       store tokens -> invalidate cache -> clear cookie -> redirect
 */
export function createCallbackHandler(config: PlatformOAuthConfig) {
  return async function GET(request: NextRequest) {
    // 1. Feature flag check
    if (!(await config.isEnabled())) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2. Rate limit: 10 requests per IP per 15 minutes
    const ip = getClientIp(request);
    const rl = await rateLimit(`ratelimit:${config.rateLimitPrefix}:callback:${ip}`, 10, 900);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    // 3. Require authenticated session
    const { session, error } = requireSession(request);
    if (error) return error;

    const handle = session.login;
    const errorRedirectBase = `/u/${handle}`;

    // 4. Validate authorization code
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${config.platform}_no_code`, request.url),
      );
    }

    // 5. Validate CSRF state
    const queryState = request.nextUrl.searchParams.get("state");
    const cookieHeader = request.headers.get("cookie");
    if (!config.validateState(cookieHeader, queryState)) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${config.platform}_invalid_state`, request.url),
      );
    }

    // 6. Validate env vars
    const clientId = config.getClientId();
    const clientSecret = config.getClientSecret();
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${config.platform}_config`, request.url),
      );
    }

    // 7. Exchange code for tokens
    const redirectUri = `${getBaseUrl()}/api/auth/${config.platform}/callback`;
    const tokens = await config.exchangeCode(code, clientId, clientSecret, redirectUri);
    if (!tokens) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${config.platform}_token_exchange`, request.url),
      );
    }

    // 8. Fetch platform user profile
    const platformUser = await config.fetchUser(tokens.access_token);
    if (!platformUser) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${config.platform}_user_fetch`, request.url),
      );
    }

    // 9. Store tokens in user_platforms
    const expiresAt = tokens.expires_in
      ? computeTokenExpiry(tokens.expires_in)
      : null;
    const stored = await dbUpsertLinkedPlatform(
      handle,
      config.platform,
      platformUser.login,
      tokens.access_token,
      tokens.refresh_token ?? null,
      expiresAt,
    );
    if (!stored) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${config.platform}_storage`, request.url),
      );
    }

    // 10. Invalidate read models and mark scoring inputs dirty.
    await Promise.all([
      invalidatePlatformReadModels(handle, config.platform),
      markStatsDirty(handle),
    ]);
    revalidateSharePage(handle);

    // 11. Clear state cookie and redirect to share page
    const response = NextResponse.redirect(
      new URL(`/u/${handle}?${config.platform}=linked`, request.url),
    );
    response.headers.append("Set-Cookie", config.clearStateCookie());
    return response;
  };
}

/**
 * Create a POST handler for the OAuth disconnect route.
 *
 * Flow: feature flag -> rate limit -> require session ->
 *       delete platform -> invalidate cache -> return JSON
 */
export function createDisconnectHandler(config: PlatformOAuthConfig) {
  return async function POST(request: NextRequest) {
    // 1. Feature flag check
    if (!(await config.isEnabled())) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2. Rate limit: 10 requests per IP per 15 minutes
    const ip = getClientIp(request);
    const rl = await rateLimit(`ratelimit:${config.rateLimitPrefix}:disconnect:${ip}`, 10, 900);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    // 3. Require authenticated session
    const { session, error } = requireSession(request);
    if (error) return error;

    const handle = session.login;

    // 4. Delete linked platform
    const success = await dbDeleteLinkedPlatform(handle, config.platform);

    // 5. Invalidate read models + supplemental EMU data. Only a successful
    // delete changes scoring inputs.
    const invalidation = invalidatePlatformReadModels(handle, config.platform, {
      clearSupplemental: true,
    });
    if (success) {
      await Promise.all([invalidation, markStatsDirty(handle)]);
    } else {
      await invalidation;
    }
    revalidateSharePage(handle);

    // 6. Return result
    return NextResponse.json({ success });
  };
}

/**
 * Create a GET handler for the OAuth status route.
 *
 * Flow: feature flag (soft) -> rate limit -> require session ->
 *       get linked platforms -> return JSON
 */
export function createStatusHandler(config: PlatformOAuthConfig) {
  return async function GET(request: NextRequest) {
    // 1. Feature flag check — return soft "not enabled" (not 404)
    if (!(await config.isEnabled())) {
      return NextResponse.json({ enabled: false });
    }

    // 2. Rate limit: 120 requests per IP per 15 minutes (navbar status check — read-only)
    const ip = getClientIp(request);
    const rl = await rateLimit(`ratelimit:${config.rateLimitPrefix}:status:${ip}`, 120, 900);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    // 3. Require authenticated session
    const { session, error } = requireSession(request);
    if (error) return error;

    // 4. Get linked platforms
    const platforms = await dbGetLinkedPlatforms(session.login);
    const match = platforms.find((p) => p.platform === config.platform);

    return NextResponse.json({
      enabled: true,
      linked: !!match,
      remoteLogin: match?.remoteLogin ?? null,
      connectedAt: match?.connectedAt ?? null,
    });
  };
}
