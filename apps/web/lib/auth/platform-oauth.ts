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
import { cacheDel, rateLimit, rateLimitStrict } from "@/lib/cache/redis";
import { markStatsDirty } from "@/lib/cache/dirty-stats";
import { getClientIp } from "@/lib/http/client-ip";
import { computeTokenExpiry } from "@/lib/auth/bitbucket";
import { buildBadgeSvgCacheKey } from "@/lib/render/badge-svg-cache";
import { toDateString } from "@/lib/utils/date";
import { buildAuthCookieFlags } from "@/lib/auth/cookie-policy";
import { issueOauthState, consumeOauthState } from "@/lib/auth/oauth-state";

function cookieFlags(): string {
  return buildAuthCookieFlags(getBaseUrl());
}

function isLocalDevRequest(request: NextRequest): boolean {
  const hostname = request.nextUrl.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Per-platform cookie name that tracks whether {@link issueOauthState} wrote
 * the CSRF nonce to the shared Redis store ("shared") or fell back to local
 * in-memory storage ("fallback"). Mirrors the GitHub login/callback flow's
 * `chapa_oauth_state_store` cookie (see `app/api/auth/login/route.ts` and
 * `app/api/auth/callback/route.ts`), namespaced per platform so concurrent
 * connect flows for different providers never collide.
 */
function stateStoreCookieName(config: PlatformOAuthConfig): string {
  return `chapa_${config.rateLimitPrefix}_oauth_state_store`;
}

function readStateStoreCookie(
  cookieHeader: string | null,
  config: PlatformOAuthConfig,
): "shared" | "fallback" | null {
  if (!cookieHeader) return null;
  const name = stateStoreCookieName(config);
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.slice(`${name}=`.length);
  return value === "shared" || value === "fallback" ? value : null;
}

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
 *       create state cookie -> issue single-use nonce -> build auth URL ->
 *       redirect
 */
export function createConnectHandler(config: PlatformOAuthConfig) {
  return async function GET(request: NextRequest) {
    // 1. Feature flag check
    if (!(await config.isEnabled())) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2. Rate limit: 10 requests per IP per 15 minutes.
    // Fail-closed (rateLimitStrict): connect is an auth route that kicks off
    // token exchange and a subsequent user_platforms write, so per redis.ts's
    // documented policy ("auth and write routes where losing rate-limit
    // enforcement during a Redis outage is unacceptable"), it must fail
    // closed rather than fail open (#1027 BE-M3).
    const ip = getClientIp(request);
    const rl = await rateLimitStrict(`ratelimit:${config.rateLimitPrefix}:connect:${ip}`, 10, 900);
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

    // 5. Generate CSRF state + cookie, and register a single-use,
    // replay-resistant nonce in the shared oauth-state store (#1027 SE-L1).
    // Reuses the exact same issue/consume helpers GitHub's login/callback
    // flow uses, including their Upstash read-your-writes retry/fallback
    // behavior — see oauth-state.ts.
    const { state, cookie } = config.createStateCookie();
    const stateStoreMode = await issueOauthState(state);
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/${config.platform}/callback`;
    const authUrl = config.buildAuthUrl(clientId, redirectUri, state);

    // 6. Redirect to platform
    const response = NextResponse.redirect(authUrl);
    response.headers.append("Set-Cookie", cookie);
    response.headers.append(
      "Set-Cookie",
      `${stateStoreCookieName(config)}=${stateStoreMode}; ${cookieFlags()}; Max-Age=600`,
    );
    return response;
  };
}

/**
 * Create a GET handler for the OAuth callback route.
 *
 * Flow: feature flag -> rate limit -> require session -> validate code ->
 *       validate CSRF (cookie double-submit) -> consume single-use nonce ->
 *       validate env -> exchange code -> fetch user -> store tokens ->
 *       invalidate cache -> clear cookie -> redirect
 */
export function createCallbackHandler(config: PlatformOAuthConfig) {
  return async function GET(request: NextRequest) {
    // 1. Feature flag check
    if (!(await config.isEnabled())) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2. Rate limit: 10 requests per IP per 15 minutes.
    // Fail-closed (rateLimitStrict) — see createConnectHandler comment above
    // and redis.ts's documented fail-open/fail-closed policy (#1027 BE-M3).
    const ip = getClientIp(request);
    const rl = await rateLimitStrict(`ratelimit:${config.rateLimitPrefix}:callback:${ip}`, 10, 900);
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

    // 5. Validate CSRF state (cookie double-submit)
    const queryState = request.nextUrl.searchParams.get("state");
    const cookieHeader = request.headers.get("cookie");
    if (!config.validateState(cookieHeader, queryState)) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${config.platform}_invalid_state`, request.url),
      );
    }

    // 5b. Consume the single-use nonce (#1027 SE-L1). This makes a captured
    // (state cookie + state param) pair unreplayable even within the CSRF
    // window, mirroring the GitHub callback exactly (same issue/consume
    // helpers, same "shared" vs "fallback" store-mode gate, same local-dev
    // exemption). CRITICAL: do not reimplement a simpler consume — a naive
    // hard-consume caused the "state_already_used on first legitimate link"
    // production incident (2026-05-01) because Upstash's read-your-writes
    // consistency is client-scoped in serverless environments. The retry
    // loop that fixes this lives in oauth-state.ts and is reused as-is here.
    const stateStoreMode = readStateStoreCookie(cookieHeader, config);
    const mustConsumeSharedState =
      !isLocalDevRequest(request) && stateStoreMode === "shared";
    const consumed = mustConsumeSharedState && queryState
      ? await consumeOauthState(queryState)
      : true;
    if (mustConsumeSharedState && !consumed) {
      return NextResponse.json({ error: "state_already_used" }, { status: 400 });
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

    // 11. Clear state cookies and redirect to share page
    const response = NextResponse.redirect(
      new URL(`/u/${handle}?${config.platform}=linked`, request.url),
    );
    response.headers.append("Set-Cookie", config.clearStateCookie());
    response.headers.append(
      "Set-Cookie",
      `${stateStoreCookieName(config)}=; ${cookieFlags()}; Max-Age=0`,
    );
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

    // 2. Rate limit: 10 requests per IP per 15 minutes.
    // Fail-closed (rateLimitStrict) — disconnect mutates user_platforms, so
    // per redis.ts's documented policy this is a write route that must not
    // silently lose rate-limit enforcement during a Redis outage (#1027 BE-M3).
    const ip = getClientIp(request);
    const rl = await rateLimitStrict(`ratelimit:${config.rateLimitPrefix}:disconnect:${ip}`, 10, 900);
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

    // 2. Rate limit: 120 requests per IP per 15 minutes (navbar status
    // check — read-only). Stays fail-open (rateLimit): per redis.ts's
    // documented policy, public/read-only routes must preserve availability
    // over rate-limit enforcement during a Redis outage (#1027 BE-M3 — this
    // route is intentionally NOT switched to rateLimitStrict).
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
