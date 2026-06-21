# Data Source / Service Linking and Unlinking Research

Date: 2026-06-21

Scope: Current end-to-end linking and unlinking flow for Bitbucket, Codeberg, and GitLab in the web app.

Mode: Documentarian. This document describes what exists in the current code.

## Entry Points

Bitbucket, Codeberg, and GitLab each expose four auth routes: `connect`, `callback`, `disconnect`, and `status`; each route exports a shared handler from `platform-oauth` and wraps it with `withErrorCapture`. (`apps/web/app/api/auth/bitbucket/connect/route.ts:1-5`, `apps/web/app/api/auth/bitbucket/callback/route.ts:1-5`, `apps/web/app/api/auth/bitbucket/disconnect/route.ts:1-5`, `apps/web/app/api/auth/bitbucket/status/route.ts:1-5`, `apps/web/app/api/auth/codeberg/connect/route.ts:1-5`, `apps/web/app/api/auth/codeberg/callback/route.ts:1-5`, `apps/web/app/api/auth/codeberg/disconnect/route.ts:1-5`, `apps/web/app/api/auth/codeberg/status/route.ts:1-5`, `apps/web/app/api/auth/gitlab/connect/route.ts:1-5`, `apps/web/app/api/auth/gitlab/callback/route.ts:1-5`, `apps/web/app/api/auth/gitlab/disconnect/route.ts:1-5`, `apps/web/app/api/auth/gitlab/status/route.ts:1-5`)

The shared OAuth factory is explicitly the common connect / callback / disconnect / status implementation for Bitbucket, Codeberg, and future OAuth-linked platforms. (`apps/web/lib/auth/platform-oauth.ts:1-10`)

Each platform supplies a config object with its platform id, rate-limit prefix, server-side feature flag, OAuth env var names, state-cookie helpers, auth URL builder, token exchange, and authenticated-user fetcher. (`apps/web/app/api/auth/bitbucket/config.ts:12-29`, `apps/web/app/api/auth/codeberg/config.ts:12-24`, `apps/web/app/api/auth/gitlab/config.ts:12-24`)

## UI State Transitions

`UserMenu` keeps a module-level status cache with `fetched`, `bitbucket`, `codeberg`, and `gitlab` entries, and exposes `clearPlatformStatusCache()` to reset that cache. (`apps/web/components/UserMenu.tsx:30-60`)

The component initializes separate local state for each platform status, unlink confirmation visibility, and unlink loading state. (`apps/web/components/UserMenu.tsx:80-99`)

On mount, if the module-level cache is already marked fetched, the status-fetch effect returns immediately. (`apps/web/components/UserMenu.tsx:226-229`)

When the public client-side feature flag for a platform is enabled, `UserMenu` fetches `/api/auth/{platform}/status`, parses JSON, and, when `data.enabled` is true, stores `{ linked, remoteLogin }` in both the module cache and component state. (`apps/web/components/UserMenu.tsx:235-256`)

When Bitbucket status is linked, the menu renders a Bitbucket profile link using `https://bitbucket.org/${bbStatus.remoteLogin}` and an Unlink button that opens the Bitbucket confirmation dialog. (`apps/web/components/UserMenu.tsx:476-496`)

When Bitbucket status is not linked, the menu renders a link to `/api/auth/bitbucket/connect`. (`apps/web/components/UserMenu.tsx:497-505`)

When Codeberg status is linked, the menu renders a Codeberg profile link using `https://codeberg.org/${cbStatus.remoteLogin}` and an Unlink button that opens the Codeberg confirmation dialog. (`apps/web/components/UserMenu.tsx:507-527`)

When Codeberg status is not linked, the menu renders a link to `/api/auth/codeberg/connect`. (`apps/web/components/UserMenu.tsx:528-536`)

When GitLab status is linked, the menu renders a GitLab profile link using `https://gitlab.com/${glStatus.remoteLogin}` and an Unlink button that opens the GitLab confirmation dialog. (`apps/web/components/UserMenu.tsx:538-558`)

When GitLab status is not linked, the menu renders a link to `/api/auth/gitlab/connect`. (`apps/web/components/UserMenu.tsx:559-567`)

The shared unlink helper sets the platform loading flag, sends `POST` to the configured disconnect endpoint, and on an OK response clears the module status cache, sets that platform status to `{ linked: false, remoteLogin: null }`, closes the confirmation dialog, and calls `router.refresh()`. (`apps/web/components/UserMenu.tsx:265-289`)

The Bitbucket, Codeberg, and GitLab unlink handlers pass `/api/auth/bitbucket/disconnect`, `/api/auth/codeberg/disconnect`, and `/api/auth/gitlab/disconnect` respectively into the shared unlink helper. (`apps/web/components/UserMenu.tsx:291-316`)

The confirmation dialogs for Bitbucket, Codeberg, and GitLab wire their `onConfirm` callbacks to the corresponding unlink handlers and pass each platform's loading state. (`apps/web/components/UserMenu.tsx:689-720`)

Signing out clears the session cache, platform status cache, and cache-warm state before posting to `/api/auth/logout` and navigating to `/`. (`apps/web/components/UserMenu.tsx:318-327`)

## Connect Route Flow

The connect handler first checks the platform's server-side feature flag and returns JSON `{ error: "Not found" }` with status 404 when disabled. (`apps/web/lib/auth/platform-oauth.ts:101-106`)

The connect handler rate-limits by client IP at 10 requests per 15 minutes using `ratelimit:{prefix}:connect:{ip}` and returns JSON `{ error: "Too many requests. Please try again later." }` with status 429 and `Retry-After: 900` when blocked. (`apps/web/lib/auth/platform-oauth.ts:108-116`)

The connect handler then requires an authenticated Chapa session and returns the session error response if authentication fails. (`apps/web/lib/auth/platform-oauth.ts:118-120`)

`requireRequestSession` returns `{ error: "Server misconfigured" }` with status 500 when `NEXTAUTH_SECRET` is unavailable, `{ error: "Authentication required" }` with status 401 when the request has no valid session, and `{ session }` when the session cookie verifies. (`apps/web/lib/auth/session.ts:69-94`)

The connect handler reads the platform client ID env var configured by the platform config, trims it, and redirects to `/u/{session.login}?error=config` when it is missing. (`apps/web/lib/auth/platform-oauth.ts:122-128`)

The connect handler creates a CSRF state cookie, builds a redirect URI of `{baseUrl}/api/auth/{platform}/callback`, builds the platform authorization URL, redirects there, and appends the state cookie to the response. (`apps/web/lib/auth/platform-oauth.ts:130-139`)

Bitbucket builds `https://bitbucket.org/site/oauth2/authorize` with `client_id`, `redirect_uri`, `response_type=code`, and `state`; its comment states Bitbucket scopes are configured on the OAuth consumer, not in the URL. (`apps/web/lib/auth/bitbucket.ts:37-39`, `apps/web/lib/auth/bitbucket.ts:51-67`)

Codeberg builds `https://codeberg.org/login/oauth/authorize` with `client_id`, `redirect_uri`, `response_type=code`, and `state`; its comment states Forgejo does not support scopes yet. (`apps/web/lib/auth/codeberg.ts:27-29`, `apps/web/lib/auth/codeberg.ts:38-54`)

GitLab builds `https://gitlab.com/oauth/authorize` with `client_id`, `redirect_uri`, `response_type=code`, `state`, and `scope=read_user read_api`. (`apps/web/lib/auth/gitlab.ts:29-35`, `apps/web/lib/auth/gitlab.ts:43-60`)

The state cookies are random 16-byte hex values, use platform-specific cookie names, include auth cookie flags, and have `Max-Age=600`. (`apps/web/lib/auth/bitbucket.ts:73-91`, `apps/web/lib/auth/codeberg.ts:60-78`, `apps/web/lib/auth/gitlab.ts:66-84`)

The shared auth cookie flags are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` except for local HTTP localhost origins. (`apps/web/lib/auth/cookie-policy.ts:1-23`)

## Callback Route Flow

The callback handler checks the platform server-side feature flag and returns JSON `{ error: "Not found" }` with status 404 when disabled. (`apps/web/lib/auth/platform-oauth.ts:150-155`)

The callback handler rate-limits by client IP at 10 requests per 15 minutes using `ratelimit:{prefix}:callback:{ip}` and returns JSON `{ error: "Too many requests. Please try again later." }` with status 429 and `Retry-After: 900` when blocked. (`apps/web/lib/auth/platform-oauth.ts:157-165`)

The callback handler requires an authenticated session and uses `session.login` as the Chapa handle for persistence and redirects. (`apps/web/lib/auth/platform-oauth.ts:167-172`)

If the callback query has no `code`, the handler redirects to `/u/{handle}?error={platform}_no_code`. (`apps/web/lib/auth/platform-oauth.ts:174-180`)

The callback handler reads the `state` query parameter and request `cookie` header, validates them with the platform state validator, and redirects to `/u/{handle}?error={platform}_invalid_state` when validation fails. (`apps/web/lib/auth/platform-oauth.ts:182-189`)

Each platform's state validator extracts its platform-specific cookie, compares byte lengths, and uses `timingSafeEqual` to compare the cookie state to the query state. (`apps/web/lib/auth/bitbucket.ts:103-118`, `apps/web/lib/auth/codeberg.ts:90-105`, `apps/web/lib/auth/gitlab.ts:96-111`)

The callback handler reads and trims the platform client ID and client secret env vars, and redirects to `/u/{handle}?error={platform}_config` when either is missing. (`apps/web/lib/auth/platform-oauth.ts:191-198`)

The callback handler exchanges the authorization code for tokens using `{baseUrl}/api/auth/{platform}/callback` as the redirect URI, and redirects to `/u/{handle}?error={platform}_token_exchange` when token exchange returns null. (`apps/web/lib/auth/platform-oauth.ts:200-207`)

Bitbucket exchanges the code with `POST https://bitbucket.org/site/oauth2/access_token`, form-encoded `grant_type=authorization_code`, `code`, and `redirect_uri`, and Basic auth built from client ID and secret. (`apps/web/lib/auth/bitbucket.ts:133-167`)

Codeberg exchanges the code with `POST https://codeberg.org/login/oauth/access_token`, JSON body containing `client_id`, `client_secret`, `code`, `grant_type=authorization_code`, and `redirect_uri`. (`apps/web/lib/auth/codeberg.ts:120-153`)

GitLab exchanges the code with `POST https://gitlab.com/oauth/token`, form-encoded `client_id`, `client_secret`, `code`, `grant_type=authorization_code`, and `redirect_uri`. (`apps/web/lib/auth/gitlab.ts:126-159`)

The callback handler fetches the authenticated platform user with the returned access token and redirects to `/u/{handle}?error={platform}_user_fetch` when user fetch returns null. (`apps/web/lib/auth/platform-oauth.ts:209-215`)

Bitbucket fetches the user from `https://api.bitbucket.org/2.0/user` with `Authorization: Bearer {accessToken}` and maps the returned `username`, `display_name`, and avatar link. (`apps/web/lib/auth/bitbucket.ts:236-259`)

The Bitbucket config maps Bitbucket's `username` to the generic `login` field stored by the shared callback handler. (`apps/web/app/api/auth/bitbucket/config.ts:23-28`)

Codeberg fetches the user from `https://codeberg.org/api/v1/user` with `Authorization: token {accessToken}` and maps `login`, `full_name`, and `avatar_url`. (`apps/web/lib/auth/codeberg.ts:204-228`)

GitLab fetches the user from `https://gitlab.com/api/v4/user` with `Authorization: Bearer {accessToken}` and maps `id`, `username` as `login`, `name`, and `avatar_url`. (`apps/web/lib/auth/gitlab.ts:210-235`)

The callback handler computes `token_expires_at` from `expires_in` when present, then calls `dbUpsertLinkedPlatform(handle, platform, platformUser.login, access_token, refresh_token ?? null, expiresAt)`. (`apps/web/lib/auth/platform-oauth.ts:217-228`)

If the linked platform row is not stored, the callback handler redirects to `/u/{handle}?error={platform}_storage`. (`apps/web/lib/auth/platform-oauth.ts:229-233`)

On successful storage, the callback handler deletes `stats:v2:merged:{lowerHandle}`, deletes `stats:v2:{platform}:{lowerHandle}`, invalidates the same-day badge SVG cache, clears the state cookie, and redirects to `/u/{handle}?{platform}=linked`. (`apps/web/lib/auth/platform-oauth.ts:235-246`)

## Disconnect Route Flow and Return Shape

The disconnect handler checks the platform server-side feature flag and returns JSON `{ error: "Not found" }` with status 404 when disabled. (`apps/web/lib/auth/platform-oauth.ts:256-261`)

The disconnect handler rate-limits by client IP at 10 requests per 15 minutes using `ratelimit:{prefix}:disconnect:{ip}` and returns JSON `{ error: "Too many requests. Please try again later." }` with status 429 and `Retry-After: 900` when blocked. (`apps/web/lib/auth/platform-oauth.ts:263-271`)

The disconnect handler requires an authenticated session and uses `session.login` as the handle for deletion. (`apps/web/lib/auth/platform-oauth.ts:273-280`)

The disconnect handler calls `dbDeleteLinkedPlatform(handle, platform)`, then deletes `stats:v2:merged:{lowerHandle}`, `stats:v2:{platform}:{lowerHandle}`, and `supplemental:{lowerHandle}`, invalidates the same-day badge SVG cache, and returns JSON `{ success }`. (`apps/web/lib/auth/platform-oauth.ts:280-290`)

`dbDeleteLinkedPlatform` returns `false` when Supabase is unavailable, deletes from `user_platforms` where lowercased `handle` and `platform` match when Supabase is available, returns `true` when the delete call succeeds, and returns `false` on caught errors. (`apps/web/lib/db/user-platforms.ts:132-151`)

The disconnect handler constructs `NextResponse.json({ success })` after the delete and cache invalidation steps, while feature-flag, rate-limit, and session failures return before that body is constructed. (`apps/web/lib/auth/platform-oauth.ts:256-290`, `apps/web/lib/auth/session.ts:69-94`)

## Supabase Persistence

The server-side Supabase client is a lazy singleton created from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, with `persistSession: false`; it returns `null` when either env var is missing. (`apps/web/lib/db/supabase.ts:1-34`)

The `user_platforms` table has `id`, lowercased GitHub `handle`, `platform`, `remote_login`, encrypted `access_token`, encrypted optional `refresh_token`, optional `token_expires_at`, `connected_at`, `updated_at`, and a unique constraint on `(handle, platform)`. (`supabase/migrations/010_add_user_platforms.sql:1-13`)

The migration creates an index on `user_platforms(handle)`, enables RLS, and creates a deny policy for `anon`. (`supabase/migrations/010_add_user_platforms.sql:15-20`)

A later migration applies `FORCE ROW LEVEL SECURITY` to `public.user_platforms`. (`supabase/migrations/018_fix_tool_insights_rls.sql:30-37`)

The integration feature flags are seeded as `bitbucket_integration`, `codeberg_integration`, and `gitlab_integration` with enabled value `true` when no conflicting row exists. (`supabase/migrations/026_seed_integration_flags.sql:15-19`)

`dbUpsertLinkedPlatform` encrypts the access token and optional refresh token using `NEXTAUTH_SECRET`, writes `handle`, `platform`, `remote_login`, encrypted tokens, `token_expires_at`, and `updated_at` to `user_platforms`, and upserts on `handle,platform`. (`apps/web/lib/db/user-platforms.ts:91-127`)

`dbGetLinkedPlatform` queries `user_platforms` by lowercased handle and platform, selects `remote_login`, `access_token`, `refresh_token`, and `token_expires_at`, decrypts tokens with `NEXTAUTH_SECRET`, and returns `remoteLogin` plus token metadata. (`apps/web/lib/db/user-platforms.ts:42-85`)

`dbGetLinkedPlatforms` queries `user_platforms` by lowercased handle, selects `platform`, `remote_login`, and `connected_at`, orders by `connected_at`, and returns metadata without tokens. (`apps/web/lib/db/user-platforms.ts:217-248`)

The `status` handler uses `dbGetLinkedPlatforms(session.login)`, finds the current platform, and returns JSON with `enabled: true`, `linked`, `remoteLogin`, and `connectedAt`. (`apps/web/lib/auth/platform-oauth.ts:300-330`)

When a platform's server-side feature flag is disabled, the `status` handler returns JSON `{ enabled: false }` rather than a 404. (`apps/web/lib/auth/platform-oauth.ts:300-305`)

## Feature Flags

The client-side `UserMenu` checks only public env-backed synchronous flags before deciding whether to call each status endpoint. (`apps/web/components/UserMenu.tsx:230-256`, `apps/web/lib/feature-flags-sync.ts:25-53`)

The server-side auth route configs use async DB-backed feature flag functions for Bitbucket, Codeberg, and GitLab. (`apps/web/app/api/auth/bitbucket/config.ts:1-16`, `apps/web/app/api/auth/codeberg/config.ts:1-16`, `apps/web/app/api/auth/gitlab/config.ts:1-16`)

The async feature flag module checks Supabase through `dbGetFeatureFlag` with a timeout and Next.js cache, stores results in an in-process five-minute TTL cache, and falls back to env-derived values when the DB flag lookup returns null. (`apps/web/lib/feature-flags.ts:40-73`)

The async functions use DB keys `bitbucket_integration`, `codeberg_integration`, and `gitlab_integration`, each with a public env fallback from the corresponding sync helper. (`apps/web/lib/feature-flags.ts:110-147`)

The feature flag DB layer caches all flags under `ff:all` and individual flags under `ff:key:{key}` with a 1-hour Redis TTL, falls through to Supabase on Redis errors, and returns null or empty arrays when Supabase is unavailable. (`apps/web/lib/db/feature-flags.ts:1-18`, `apps/web/lib/db/feature-flags.ts:24-27`, `apps/web/lib/db/feature-flags.ts:71-148`)

## Cache Effects

Redis cache operations are wrapped for graceful degradation: reads return null when Redis is unavailable, writes return false or no-op on failure, deletes no-op when Redis is unavailable, and rate limiting fails open. (`apps/web/lib/cache/redis.ts:1-6`, `apps/web/lib/cache/redis.ts:48-99`, `apps/web/lib/cache/redis.ts:166-197`)

The same-day badge SVG cache key is `badge:{CACHE_VERSION}:{lowerHandle}:warm-amber:{date}`. (`apps/web/lib/render/badge-svg-cache.ts:45-47`)

The helper used by link and unlink invalidates the same-day rendered badge SVG cache by deleting `buildBadgeSvgCacheKey(handle, toDateString(new Date()))`. (`apps/web/lib/auth/platform-oauth.ts:23-32`)

Successful callback invalidation deletes the merged stats cache and platform stats cache, and also deletes the same-day badge SVG cache. (`apps/web/lib/auth/platform-oauth.ts:235-239`)

Successful or unsuccessful disconnect attempts after authentication delete the merged stats cache, platform stats cache, supplemental stats cache, and same-day badge SVG cache before returning `{ success }`. (`apps/web/lib/auth/platform-oauth.ts:280-290`)

The platform stats helper uses a positive platform stats cache key `stats:v2:{platform}:{lowerHandle}` and a negative cache key `stats:v2:{platform}:{lowerHandle}:neg`; positive entries use a 6-hour TTL and negative entries use a 1-hour TTL. (`apps/web/lib/platform/fetch-linked-platform.ts:4-13`, `apps/web/lib/platform/fetch-linked-platform.ts:82-113`)

The platform stats helper checks the positive cache first, then the negative cache, then the server-side feature flag, then the linked-platform DB record, then resolves a token, fetches live platform stats, and writes positive stats to Redis when available. (`apps/web/lib/platform/fetch-linked-platform.ts:82-115`)

The main `getStats` function reads `stats:v2:merged:{lowerHandle}` first, uses in-flight request de-duplication on cache misses, fetches GitHub primary stats, fetches Bitbucket, Codeberg, and GitLab linked stats in parallel, merges available platform stats, applies supplemental stats, writes merged stats for 6 hours, writes stale stats for 7 days, and fire-and-forget upserts the user. (`apps/web/lib/github/client.ts:47-88`, `apps/web/lib/github/client.ts:136-252`)

When merged cached stats include linked platform names but no platform logins, `_enrichWithLogins` reads `dbGetLinkedPlatform` for each platform and backfills `linkedPlatformLogins` into the merged stats cache. (`apps/web/lib/github/client.ts:90-134`)

After the linked platform stats fetches, `getStats` builds `linkedPlatforms` from DB link status as well as successful stats fetches, then builds `linkedPlatformLogins` from DB records and attaches both to the final stats object. (`apps/web/lib/github/client.ts:206-243`)

The `StatsData` type defines `linkedPlatforms` as informational platform identifiers and `linkedPlatformLogins` as platform-to-remote-username data for profile URLs. (`packages/shared/src/types.ts:38-40`)

The share page attempts to read the shared badge SVG cache and writes to it after a fresh render with a resolved avatar. (`apps/web/app/u/[handle]/page.tsx:116-164`)

The badge SVG route reads the shared SVG cache before rate limiting, rate-limits only on cache miss, materializes the public profile, renders SVG, writes the same shared SVG cache, and returns SVG cache headers. (`apps/web/app/u/[handle]/badge.svg/route.ts:145-166`, `apps/web/app/u/[handle]/badge.svg/route.ts:226-259`)

The badge SVG cache write TTL is 24 hours plus a per-handle jitter of up to 2 hours. (`apps/web/lib/render/badge-svg-cache.ts:13-26`, `apps/web/lib/render/badge-svg-cache.ts:80-90`)

## Stats and Visible Data Source Effects

`mergeStats` sums counts and lines, merges heatmap days by date, recomputes active days, caps PR weight, preserves identity fields from the primary GitHub stats, and sets `hasSupplementalData` according to `options.markAsSupplemental`. (`apps/web/lib/github/merge.ts:4-29`, `apps/web/lib/github/merge.ts:42-87`)

Linked platform stats are merged with `markAsSupplemental: false` for Bitbucket, Codeberg, and GitLab. (`apps/web/lib/github/client.ts:170-183`)

Bitbucket resolves a usable token by refreshing expired tokens when a refresh token exists, deleting the link on missing refresh token or revoked refresh result, updating stored tokens after refresh, and then fetching Bitbucket stats for the remote login. (`apps/web/lib/bitbucket/client.ts:16-73`)

Codeberg resolves a usable token by treating `expiresAt === null` without a refresh token as a long-lived token path, refreshing when a refresh token exists, deleting the link on revoked refresh result, updating stored tokens after refresh, and then fetching Codeberg stats for the remote login. (`apps/web/lib/codeberg/client.ts:17-88`)

GitLab resolves a usable token by refreshing expired tokens when a refresh token and OAuth app credentials exist, deleting the link on missing refresh token with non-null expiry or revoked refresh result, resolving the numeric GitLab user id from the access token, and then fetching GitLab stats with that id and remote login. (`apps/web/lib/gitlab/client.ts:17-102`)

The share page owner content renders `DataSources` when stats are present. (`apps/web/components/SharePageOwnerContent.tsx:111-120`)

`DataSources` always includes GitHub, appends non-GitHub entries from `stats.linkedPlatforms`, uses the main handle for GitHub, uses `stats.linkedPlatformLogins` for linked platforms, and renders platform links when a URL can be built. (`apps/web/components/ImpactBreakdown.tsx:93-129`, `apps/web/components/ImpactBreakdown.tsx:147-160`)

The badge renderer chooses footer branding platforms as all four platforms in demo mode or GitHub plus non-GitHub entries from `stats.linkedPlatforms` in normal mode. (`apps/web/lib/render/BadgeSvg.tsx:123-129`)

Badge branding sorts requested platforms in canonical order `github`, `bitbucket`, `codeberg`, `gitlab` and renders their logos in the footer strip. (`apps/web/lib/render/BadgeBranding.tsx:3-16`, `apps/web/lib/render/BadgeBranding.tsx:31-66`)

## Analytics and Error Capture Effects

The platform auth route files wrap each route handler with `withErrorCapture`, passing the concrete route string for each connect, callback, disconnect, and status route. (`apps/web/app/api/auth/bitbucket/connect/route.ts:3-5`, `apps/web/app/api/auth/bitbucket/callback/route.ts:3-5`, `apps/web/app/api/auth/bitbucket/disconnect/route.ts:3-5`, `apps/web/app/api/auth/bitbucket/status/route.ts:3-5`, `apps/web/app/api/auth/codeberg/connect/route.ts:3-5`, `apps/web/app/api/auth/codeberg/callback/route.ts:3-5`, `apps/web/app/api/auth/codeberg/disconnect/route.ts:3-5`, `apps/web/app/api/auth/codeberg/status/route.ts:3-5`, `apps/web/app/api/auth/gitlab/connect/route.ts:3-5`, `apps/web/app/api/auth/gitlab/callback/route.ts:3-5`, `apps/web/app/api/auth/gitlab/disconnect/route.ts:3-5`, `apps/web/app/api/auth/gitlab/status/route.ts:3-5`)

`withErrorCapture` obtains a request id, runs the handler, and on thrown errors fire-and-forget captures a server error with route, status code 500, error, and request id before rethrowing. (`apps/web/lib/analytics/server-errors.ts:265-293`)

`captureServerError` sanitizes error details, sends a `server_error` event to PostHog's `/capture/` endpoint when PostHog key and host are configured, and optionally emits an operational alert for classified 5xx routes. (`apps/web/lib/analytics/server-errors.ts:191-263`)

The server analytics module is described as fire-and-forget, non-blocking, sensitive-data stripping, and silent when monitoring is unavailable or unconfigured. (`apps/web/lib/analytics/server-errors.ts:1-13`)

The badge SVG route separately captures thrown render-path errors with `captureServerError` for `/u/{handle}/badge.svg`, resolves its in-flight render result with a fallback SVG, and returns status 500. (`apps/web/app/u/[handle]/badge.svg/route.ts:260-277`)

## End-to-End Summary

For linking, the visible menu state begins from `/status` reads, renders a `Link {Platform}` anchor when status is unlinked, sends the browser to `/api/auth/{platform}/connect`, creates a CSRF state cookie, redirects to the provider OAuth screen, validates session/code/state/env vars on callback, exchanges code for tokens, fetches the remote user, upserts encrypted tokens in `user_platforms`, invalidates selected Redis and SVG cache entries, clears the CSRF cookie, and redirects to `/u/{handle}?{platform}=linked`. (`apps/web/components/UserMenu.tsx:226-256`, `apps/web/components/UserMenu.tsx:497-505`, `apps/web/components/UserMenu.tsx:528-536`, `apps/web/components/UserMenu.tsx:559-567`, `apps/web/lib/auth/platform-oauth.ts:101-139`, `apps/web/lib/auth/platform-oauth.ts:150-246`, `apps/web/lib/db/user-platforms.ts:91-127`)

For unlinking, the visible menu state begins from a linked status, opens a confirmation dialog, posts to `/api/auth/{platform}/disconnect`, deletes the `user_platforms` row, invalidates merged stats, platform stats, supplemental stats, and same-day SVG cache entries, returns `{ success }`, and on an OK response the UI clears its platform-status cache, sets that platform to unlinked, closes the dialog, and refreshes the route. (`apps/web/components/UserMenu.tsx:476-558`, `apps/web/components/UserMenu.tsx:265-316`, `apps/web/components/UserMenu.tsx:689-720`, `apps/web/lib/auth/platform-oauth.ts:256-290`, `apps/web/lib/db/user-platforms.ts:132-151`)

For subsequent badge/share/profile reads, `getStats` reads the merged cache first, fetches primary GitHub stats on a miss, fetches linked platform stats from per-platform cache/DB/token/API paths, merges successful linked platform stats, attaches linked platform metadata from DB link status, and writes the final merged/stale cache entries used by share-page data sources and badge branding. (`apps/web/lib/github/client.ts:47-88`, `apps/web/lib/github/client.ts:136-252`, `apps/web/components/ImpactBreakdown.tsx:107-160`, `apps/web/lib/render/BadgeSvg.tsx:123-129`)
