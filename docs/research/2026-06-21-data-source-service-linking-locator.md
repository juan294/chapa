# Data-Source/Service Linking Locator

Generated: 2026-06-21

Documentarian scope: locator map only. Describes where the current linking/unlinking files live.

## UI / UX Surfaces

- `apps/web/components/UserMenu.tsx:30-60` defines the module-level platform status cache and cache clearing function for Bitbucket, Codeberg, and GitLab.
- `apps/web/components/UserMenu.tsx:226-257` fetches `/api/auth/{platform}/status` for enabled Bitbucket, Codeberg, and GitLab integrations.
- `apps/web/components/UserMenu.tsx:259-288` defines the shared unlink helper that POSTs a platform disconnect endpoint, clears the status cache, updates local status, and calls `router.refresh()`.
- `apps/web/components/UserMenu.tsx:291-316` wires Bitbucket, Codeberg, and GitLab unlink handlers to `/api/auth/{platform}/disconnect`.
- `apps/web/components/UserMenu.tsx:476-568` renders linked and unlinked dropdown rows for Bitbucket, Codeberg, and GitLab, including profile links, unlink buttons, and connect links.
- `apps/web/components/UserMenu.tsx:689-721` renders destructive confirmation dialogs for Bitbucket, Codeberg, and GitLab unlink actions.
- `apps/web/components/Navbar.tsx:21-66` mounts `UserMenu` in the server navbar when a session exists.
- `apps/web/components/NavbarClient.tsx:27-70` mounts `UserMenu` in the client navbar when a session exists.
- `apps/web/components/ImpactBreakdown.tsx:70-100` defines display metadata and profile URL builders for GitHub, Bitbucket, Codeberg, and GitLab.
- `apps/web/components/ImpactBreakdown.tsx:107-128` builds the Data Sources list from GitHub plus `stats.linkedPlatforms` and `stats.linkedPlatformLogins`.
- `apps/web/components/SharePageOwnerContent.tsx:115-119` renders the `DataSources` section on the share page when stats exist.

## Auth Routes

- `apps/web/app/api/auth/bitbucket/connect/route.ts:1-5`, `apps/web/app/api/auth/bitbucket/callback/route.ts:1-5`, `apps/web/app/api/auth/bitbucket/disconnect/route.ts:1-5`, and `apps/web/app/api/auth/bitbucket/status/route.ts:1-5` expose Bitbucket connect, callback, disconnect, and status handlers through the shared platform OAuth factory.
- `apps/web/app/api/auth/codeberg/connect/route.ts:1-5`, `apps/web/app/api/auth/codeberg/callback/route.ts:1-5`, `apps/web/app/api/auth/codeberg/disconnect/route.ts:1-5`, and `apps/web/app/api/auth/codeberg/status/route.ts:1-5` expose Codeberg connect, callback, disconnect, and status handlers through the shared platform OAuth factory.
- `apps/web/app/api/auth/gitlab/connect/route.ts:1-5`, `apps/web/app/api/auth/gitlab/callback/route.ts:1-5`, `apps/web/app/api/auth/gitlab/disconnect/route.ts:1-5`, and `apps/web/app/api/auth/gitlab/status/route.ts:1-5` expose GitLab connect, callback, disconnect, and status handlers through the shared platform OAuth factory.
- `apps/web/app/api/auth/bitbucket/config.ts:12-29`, `apps/web/app/api/auth/codeberg/config.ts:12-24`, and `apps/web/app/api/auth/gitlab/config.ts:12-24` define the per-platform OAuth configuration objects used by those route handlers.
- `apps/web/lib/auth/platform-oauth.ts:101-140` is the shared connect-handler factory.
- `apps/web/lib/auth/platform-oauth.ts:150-247` is the shared callback-handler factory; it stores the linked platform with `dbUpsertLinkedPlatform` and invalidates merged/platform/badge SVG caches.
- `apps/web/lib/auth/platform-oauth.ts:256-291` is the shared disconnect-handler factory; it deletes the linked platform with `dbDeleteLinkedPlatform` and invalidates merged/platform/supplemental/badge SVG caches.
- `apps/web/lib/auth/platform-oauth.ts:300-330` is the shared status-handler factory; it reads `dbGetLinkedPlatforms` and returns `enabled`, `linked`, `remoteLogin`, and `connectedAt`.
- `apps/web/app/api/auth/login/route.ts:31-81` is the GitHub OAuth login redirect route.
- `apps/web/app/api/auth/callback/route.ts:82-224` is the GitHub OAuth callback route.
- `apps/web/app/api/auth/callback/route.ts:150-159` stores the GitHub token through `storeGitHubToken`.
- `apps/web/lib/auth/github-session-token.ts:3-12` reads GitHub tokens from `user_platforms` under platform `github`.
- `apps/web/lib/auth/github-session-token.ts:21-32` stores GitHub tokens with `dbUpsertLinkedPlatform(handle, "github", handle, ...)`.
- `apps/web/app/api/auth/session/route.ts:8-37` returns current session info.
- `apps/web/app/api/auth/logout/route.ts:13-25` clears the session cookie.

## Persistence / Data Access

- `supabase/migrations/010_add_user_platforms.sql:1-13` creates `user_platforms` with `handle`, `platform`, `remote_login`, encrypted token columns, timestamps, and `UNIQUE(handle, platform)`.
- `supabase/migrations/010_add_user_platforms.sql:15-20` adds the handle index and anon-deny RLS policy for `user_platforms`.
- `supabase/migrations/026_seed_integration_flags.sql:15-19` seeds `bitbucket_integration`, `codeberg_integration`, and `gitlab_integration` feature flags.
- `apps/web/lib/db/user-platforms.ts:42-85` implements `dbGetLinkedPlatform`.
- `apps/web/lib/db/user-platforms.ts:91-127` implements `dbUpsertLinkedPlatform`.
- `apps/web/lib/db/user-platforms.ts:132-152` implements `dbDeleteLinkedPlatform`.
- `apps/web/lib/db/user-platforms.ts:158-189` implements `dbUpdatePlatformTokens`.
- `apps/web/lib/db/user-platforms.ts:194-215` implements `dbHasLinkedPlatform`.
- `apps/web/lib/db/user-platforms.ts:221-248` implements `dbGetLinkedPlatforms`.
- `packages/shared/src/platforms.ts:1-8` defines the shared `Platform` union and `LinkedPlatform` metadata shape.
- `packages/shared/src/types.ts:39-40` stores `linkedPlatforms` and `linkedPlatformLogins` on `StatsData`.
- `packages/shared/src/types.ts:43-53` includes `platform_linked` in confidence flag identifiers.

## Platform Stats Fetch / Merge

- `apps/web/lib/github/client.ts:47-88` is the main `getStats(handle, token?)` cache-first entry point for merged stats.
- `apps/web/lib/github/client.ts:100-134` enriches cached stats with `linkedPlatformLogins` from `dbGetLinkedPlatform`.
- `apps/web/lib/github/client.ts:159-183` fetches Bitbucket, Codeberg, and GitLab in parallel and merges returned stats into primary GitHub stats.
- `apps/web/lib/github/client.ts:206-243` builds `linkedPlatforms` and `linkedPlatformLogins` from DB link status and platform fetch results.
- `apps/web/lib/platform/fetch-linked-platform.ts:82-116` is the shared positive-cache, negative-cache, feature-flag, DB-link, token-resolution, and stats-fetch skeleton for linked platforms.
- `apps/web/lib/bitbucket/client.ts:57-74`, `apps/web/lib/codeberg/client.ts:71-88`, and `apps/web/lib/gitlab/client.ts:77-102` call the shared linked-platform skeleton for Bitbucket, Codeberg, and GitLab.

## Cache Invalidation

- `apps/web/lib/auth/platform-oauth.ts:30-32` invalidates same-day rendered badge SVG cache with `buildBadgeSvgCacheKey`.
- `apps/web/lib/auth/platform-oauth.ts:235-239` invalidates merged stats, per-platform stats, and badge SVG cache after a successful platform callback/link.
- `apps/web/lib/auth/platform-oauth.ts:282-287` invalidates merged stats, per-platform stats, supplemental data, and badge SVG cache after disconnect.
- `apps/web/lib/profile/post-write-invalidation.ts:21-50` defines reusable invalidation for stats, craft, snapshot, and history read models.
- `apps/web/app/api/refresh/route.ts:58-60` clears `stats:v2:merged:{handle}` before forced owner refresh.
- `apps/web/lib/github/client.ts:245-247` writes merged and stale stats caches after a successful fetch.
- `apps/web/lib/platform/fetch-linked-platform.ts:85-103` reads per-platform positive and negative caches and sets negative cache entries for disabled or unlinked platforms.
- `apps/web/lib/platform/fetch-linked-platform.ts:109-113` writes per-platform stats cache when linked-platform stats fetch succeeds.
- `apps/web/app/u/[handle]/page.tsx:116-164` reads/writes the shared badge SVG cache from the share page.
- `apps/web/app/u/[handle]/badge.svg/route.ts:145-152` serves the badge SVG response from cache when present.
- `apps/web/app/u/[handle]/badge.svg/route.ts:226-256` materializes the public profile and writes the badge SVG cache after rendering.

## Score Recalculation / Materialization Entry Points

- `apps/web/lib/impact/v6.ts:361-390` defines `computeImpactV6`.
- `apps/web/lib/profile/materialize-profile.ts:48-69` computes raw impact, applies display policy, and builds the snapshot.
- `apps/web/lib/profile/materialize-profile.ts:72-117` loads stats, craft score, latest snapshot, and dirty marker before materializing a profile.
- `apps/web/lib/profile/orchestrated-profile.ts:13-25` wraps `materializeProfile` for orchestrated refresh/recalculate/warm/bulk flows.
- `apps/web/lib/profile/orchestrated-profile.ts:27-41` persists orchestrated snapshots and updates the snapshot cache.
- `apps/web/lib/profile/public-profile.ts:20-29` materializes public profile reads.
- `apps/web/lib/profile/public-profile.ts:61-118` runs public profile side effects including verification storage, tracking, notification, snapshot insert/replace, snapshot cache update, dirty marker clear, and user upsert.
- `apps/web/app/api/recalculate/route.ts:24-99` is the authenticated `POST /api/recalculate` entry point.
- `apps/web/app/api/refresh/route.ts:26-117` is the authenticated owner `POST /api/refresh?handle=` entry point.
- `apps/web/app/api/generate/route.ts:21-59` warms authenticated user stats and calls `computeImpactV6`.
- `apps/web/app/api/cron/warm-cache/route.ts:62-251` runs the warm-cache cron loop.
- `apps/web/app/api/admin/bulk-recalculate/route.ts:37-167` runs admin bulk recalculation.
- `apps/web/app/u/[handle]/page.tsx:104-164` materializes public share-page data and schedules public side effects.
- `apps/web/app/u/[handle]/badge.svg/route.ts:226-256` materializes public badge data and schedules public side effects.

## Tests

- `apps/web/lib/auth/platform-oauth.test.ts:155-230` covers the shared connect handler.
- `apps/web/lib/auth/platform-oauth.test.ts:262-435` covers the shared callback handler, token storage, redirect, and cache invalidation.
- `apps/web/lib/auth/platform-oauth.test.ts:462-559` covers the shared disconnect handler, DB delete, supplemental clear, and cache invalidation.
- `apps/web/lib/auth/platform-oauth.test.ts:565-650` covers the shared status handler.
- `apps/web/lib/db/user-platforms.test.ts:71-180` covers `dbGetLinkedPlatform`.
- `apps/web/lib/db/user-platforms.test.ts:186-251` covers `dbUpsertLinkedPlatform`.
- `apps/web/lib/db/user-platforms.test.ts:257-280` covers `dbDeleteLinkedPlatform`.
- `apps/web/lib/db/user-platforms.test.ts:286-340` covers `dbUpdatePlatformTokens`.
- `apps/web/lib/db/user-platforms.test.ts:399-441` covers `dbGetLinkedPlatforms`.
- `apps/web/components/UserMenu.render.test.tsx:198-262` covers platform status caching.
- `apps/web/components/UserMenu.render.test.tsx:615-832` covers Bitbucket link/unlink dropdown behavior.
- `apps/web/components/UserMenu.render.test.tsx:834-1016` covers Codeberg link/unlink dropdown behavior.
- `apps/web/components/UserMenu.test.tsx:899-1035` covers Codeberg unlink success/loading/failure cases.
- `apps/web/components/UserMenu.test.tsx:1039-1088` covers Bitbucket disconnect failure.
- `apps/web/components/UserMenu.test.tsx:1093-1162` covers Bitbucket and Codeberg not-linked states.
- `apps/web/components/UserMenu.render.test.tsx:208-232` covers status fetching for Bitbucket, Codeberg, and GitLab.
- `apps/web/app/api/auth/bitbucket/callback/route.test.ts:123-282`, `apps/web/app/api/auth/codeberg/callback/route.test.ts:126-308`, and `apps/web/app/api/auth/gitlab/callback/route.test.ts:126-307` cover per-platform callback routes.
- `apps/web/app/api/auth/bitbucket/disconnect/route.test.ts:83-156`, `apps/web/app/api/auth/codeberg/disconnect/route.test.ts:82-154`, and `apps/web/app/api/auth/gitlab/disconnect/route.test.ts:82-154` cover per-platform disconnect routes.
- `apps/web/app/api/auth/bitbucket/status/route.test.ts:81-148`, `apps/web/app/api/auth/codeberg/status/route.test.ts:80-147`, and `apps/web/app/api/auth/gitlab/status/route.test.ts:80-147` cover per-platform status routes.
- `apps/web/lib/github/client.test.ts:785-928` covers Bitbucket integration in merged stats.
- `apps/web/lib/github/client.test.ts:928-1183` covers Codeberg integration in merged stats.
- `apps/web/lib/github/client.test.ts:1183-1312` covers GitLab integration in merged stats.
- `apps/web/lib/platform/fetch-linked-platform.test.ts:82-130` covers linked-platform cache/flag/DB/token/fetch skeleton behavior.
- `apps/web/app/api/recalculate/route.test.ts:105-239` covers `POST /api/recalculate`.
- `apps/web/app/api/refresh/route.test.ts:122-269` covers `POST /api/refresh`.
- `apps/web/lib/profile/materialize-profile.test.ts:148-200` covers `materializeProfile`.
- `apps/web/lib/profile/orchestrated-profile.test.ts:93-107` covers orchestrated profile snapshot replacement and cache update.
