# Data Sources Linking and Scoring Research

Date: 2026-06-21

Scope: current codebase behavior for linking and unlinking developer data sources, with emphasis on Bitbucket, Codeberg, GitLab, merged stats, and Impact score calculation.

Mode: documentarian. This document describes what exists in the current codebase.

Supporting artifacts from parallel research passes:

- Locator map: `docs/research/2026-06-21-data-source-service-linking-locator.md:1`
- Flow analyzer: `docs/research/2026-06-21-data-source-service-linking-unlinking.md:1`
- Test-pattern catalog: `docs/research/2026-06-21-platform-linking-scoring-tests.md:1`
- Historical docs catalog: `docs/research/2026-06-21-data-source-service-linking-scoring-historical-docs.md:1`

## Current Link Surface

- `UserMenu` owns the client-side platform status cache for Bitbucket, Codeberg, and GitLab, with a `fetched` flag plus per-platform status fields and a `clearPlatformStatusCache()` reset function. `apps/web/components/UserMenu.tsx:30`
- `UserMenu` initializes independent status, confirmation, and loading state for Bitbucket, Codeberg, and GitLab. `apps/web/components/UserMenu.tsx:80`
- On mount, `UserMenu` skips status fetches when the module cache is already fetched. `apps/web/components/UserMenu.tsx:226`
- When a public sync feature flag is enabled, `UserMenu` fetches `/api/auth/{platform}/status`; when the response has `enabled: true`, it stores `{ linked, remoteLogin }` in the module cache and component state. `apps/web/components/UserMenu.tsx:235`
- The unlinked UI state renders connect anchors to `/api/auth/bitbucket/connect`, `/api/auth/codeberg/connect`, and `/api/auth/gitlab/connect`. `apps/web/components/UserMenu.tsx:497`, `apps/web/components/UserMenu.tsx:528`, `apps/web/components/UserMenu.tsx:559`
- The linked UI state renders remote profile links and an Unlink button for each platform. `apps/web/components/UserMenu.tsx:476`, `apps/web/components/UserMenu.tsx:507`, `apps/web/components/UserMenu.tsx:538`
- The Unlink buttons open destructive confirmation dialogs wired to platform-specific handlers and loading state. `apps/web/components/UserMenu.tsx:689`

## Current Link Route Flow

- Bitbucket, Codeberg, and GitLab route files export shared connect, callback, disconnect, and status handlers from `platform-oauth`, wrapped by `withErrorCapture`. `apps/web/app/api/auth/bitbucket/connect/route.ts:1`, `apps/web/app/api/auth/codeberg/connect/route.ts:1`, `apps/web/app/api/auth/gitlab/connect/route.ts:1`
- Platform config objects supply the platform id, rate-limit prefix, async feature flag, OAuth env var names, state-cookie helpers, auth URL builder, state validator, token exchange, and user fetcher. `apps/web/app/api/auth/bitbucket/config.ts:12`, `apps/web/app/api/auth/codeberg/config.ts:12`, `apps/web/app/api/auth/gitlab/config.ts:12`
- The shared connect handler checks the server-side feature flag, applies a 10-per-15-minute IP rate limit, requires an authenticated session, validates the platform client ID, creates a CSRF state cookie, builds `{baseUrl}/api/auth/{platform}/callback`, and redirects to the provider authorization URL. `apps/web/lib/auth/platform-oauth.ts:101`
- The shared callback handler checks the feature flag, applies a 10-per-15-minute IP rate limit, requires the session, validates `code`, validates CSRF state, validates client ID/secret, exchanges code for tokens, fetches the remote platform user, stores the link, invalidates caches, clears the state cookie, and redirects to `/u/{handle}?{platform}=linked`. `apps/web/lib/auth/platform-oauth.ts:150`
- The callback stores linked-platform credentials by calling `dbUpsertLinkedPlatform(handle, platform, platformUser.login, access_token, refresh_token ?? null, expiresAt)`. `apps/web/lib/auth/platform-oauth.ts:217`
- After successful link storage, the callback deletes `stats:v2:merged:{handle}`, deletes `stats:v2:{platform}:{handle}`, invalidates the same-day badge SVG cache, clears the platform CSRF cookie, and redirects to the share page. `apps/web/lib/auth/platform-oauth.ts:235`

## Current Unlink Route Flow

- The shared unlink helper in `UserMenu` sets the loading flag, posts to the configured disconnect endpoint, and on any `res.ok` response clears the module status cache, sets that platform's local status to unlinked, closes the confirmation dialog, and calls `router.refresh()`. `apps/web/components/UserMenu.tsx:265`
- Bitbucket, Codeberg, and GitLab pass `/api/auth/bitbucket/disconnect`, `/api/auth/codeberg/disconnect`, and `/api/auth/gitlab/disconnect` into the shared unlink helper. `apps/web/components/UserMenu.tsx:291`, `apps/web/components/UserMenu.tsx:300`, `apps/web/components/UserMenu.tsx:309`
- The shared disconnect handler checks the server-side feature flag, applies a 10-per-15-minute IP rate limit, requires an authenticated session, deletes the linked platform row, invalidates caches, and returns JSON `{ success }`. `apps/web/lib/auth/platform-oauth.ts:256`
- The disconnect handler calls `dbDeleteLinkedPlatform(handle, platform)`, then deletes `stats:v2:merged:{handle}`, deletes `stats:v2:{platform}:{handle}`, deletes `supplemental:{handle}`, invalidates the same-day badge SVG cache, and returns `NextResponse.json({ success })`. `apps/web/lib/auth/platform-oauth.ts:280`
- `dbDeleteLinkedPlatform` returns `false` when Supabase is unavailable, deletes from `user_platforms` by lowercased handle and platform when Supabase is available, returns `true` on a successful delete call, and returns `false` on caught errors. `apps/web/lib/db/user-platforms.ts:132`

## Persistence and Feature Flags

- The `user_platforms` migration creates `handle`, `platform`, `remote_login`, encrypted token columns, token expiry, timestamps, and `UNIQUE(handle, platform)`. `supabase/migrations/010_add_user_platforms.sql:1`
- The same migration adds an index on `handle`, enables RLS, and creates an anon-deny policy. `supabase/migrations/010_add_user_platforms.sql:15`
- A later migration applies `FORCE ROW LEVEL SECURITY` to `public.user_platforms`. `supabase/migrations/018_fix_tool_insights_rls.sql:30`
- `dbUpsertLinkedPlatform` encrypts access and refresh tokens using `NEXTAUTH_SECRET`, writes lowercased handle metadata, and upserts on `handle,platform`. `apps/web/lib/db/user-platforms.ts:91`
- `dbGetLinkedPlatform` reads a single linked platform row, decrypts access and refresh tokens, and returns remote login plus token metadata. `apps/web/lib/db/user-platforms.ts:42`
- `dbGetLinkedPlatforms` reads platform metadata without tokens and orders rows by `connected_at`. `apps/web/lib/db/user-platforms.ts:221`
- Integration feature flags are seeded for `bitbucket_integration`, `codeberg_integration`, and `gitlab_integration`. `supabase/migrations/026_seed_integration_flags.sql:15`
- The client menu uses public sync flags before status fetches, while server auth route configs use async DB-backed feature flag functions. `apps/web/components/UserMenu.tsx:230`, `apps/web/app/api/auth/bitbucket/config.ts:15`, `apps/web/app/api/auth/codeberg/config.ts:15`, `apps/web/app/api/auth/gitlab/config.ts:15`

## Stats Merge Path

- `getStats(handle, token?)` is the main cache-first stats entry point and reads `stats:v2:merged:{lowerHandle}` before live fetch work. `apps/web/lib/github/client.ts:47`
- On a merged-cache miss, `getStats` fetches primary GitHub stats, then fetches Bitbucket, Codeberg, and GitLab linked stats in parallel with `Promise.allSettled`. `apps/web/lib/github/client.ts:148`, `apps/web/lib/github/client.ts:159`
- Bitbucket, Codeberg, and GitLab stats are merged into primary stats with `mergeStats(..., { markAsSupplemental: false })`. `apps/web/lib/github/client.ts:170`, `apps/web/lib/github/client.ts:175`, `apps/web/lib/github/client.ts:180`
- Supplemental EMU stats are loaded from Redis first, then Supabase fallback, and merged after linked-platform stats when present. `apps/web/lib/github/client.ts:185`
- `getStats` builds `linkedPlatforms` from successful platform stats or DB link status and attaches `linkedPlatformLogins` from DB records. `apps/web/lib/github/client.ts:206`
- `mergeStats` sums counts and lines, merges heatmap data by date, recomputes active days, caps PR weight, uses weighted averages for optional quality metrics, and preserves primary GitHub identity fields. `apps/web/lib/github/merge.ts:25`
- The shared linked-platform stats skeleton uses positive cache key `stats:v2:{platform}:{lowerHandle}`, negative cache key `stats:v2:{platform}:{lowerHandle}:neg`, 6-hour positive TTL, and 1-hour negative TTL. `apps/web/lib/platform/fetch-linked-platform.ts:4`
- The linked-platform skeleton checks positive cache, negative cache, server feature flag, DB link record, token resolution, live stats fetch, and writes positive stats to cache when available. `apps/web/lib/platform/fetch-linked-platform.ts:82`

## Visible Data Source Effects

- `StatsData` includes `linkedPlatforms` and `linkedPlatformLogins` for informational platform metadata and platform-specific profile URLs. `packages/shared/src/types.ts:38`
- `DataSources` always includes GitHub, appends non-GitHub entries from `stats.linkedPlatforms`, uses the main handle for GitHub, and uses `stats.linkedPlatformLogins` for linked-platform usernames. `apps/web/components/ImpactBreakdown.tsx:107`
- `DataSources` builds profile URLs for GitHub, Bitbucket, Codeberg, and GitLab. `apps/web/components/ImpactBreakdown.tsx:93`
- `SharePageOwnerContent` renders `DataSources` when stats are present. `apps/web/components/SharePageOwnerContent.tsx:111`
- The badge renderer uses all four platforms in demo mode and GitHub plus non-GitHub entries from `stats.linkedPlatforms` in normal mode. `apps/web/lib/render/BadgeSvg.tsx:123`
- Badge branding sorts and renders platform logos in canonical order `github`, `bitbucket`, `codeberg`, `gitlab`. `apps/web/lib/render/BadgeBranding.tsx:3`

## Score Calculation Path

- `materializeProfile` loads stats, cached Craft score, cached latest snapshot, and the dirty-stats marker concurrently. `apps/web/lib/profile/materialize-profile.ts:72`
- `materializeImpactState` computes raw Impact v6, applies the selected score policy, and builds a metrics snapshot from the display impact. `apps/web/lib/profile/materialize-profile.ts:48`
- `computeImpactV6` detects profile type, computes dimensions, derives archetype, computes composite, applies recency weighting, computes confidence, computes adjusted composite, assigns tier, and returns the result. `apps/web/lib/impact/v6.ts:361`
- Delivery uses PR weight, issues, commits, and a median lead-time modifier. `apps/web/lib/impact/v6.ts:74`
- Quality chooses solo or collaborative behavior based on profile type and uses a collaborative/solo max guard for collaborative profiles. `apps/web/lib/impact/v6.ts:108`
- Consistency uses active days, heatmap evenness, and week coverage. `apps/web/lib/impact/v6.ts:186`
- Breadth uses repositories, inverse top-repo concentration, stars, forks, and docs-only PR ratio. `apps/web/lib/impact/v6.ts:212`
- The adjusted score formula is `base * (0.85 + 0.15 * confidence / 100)`, clamped to 0-100. `apps/web/lib/impact/utils.ts:238`
- Platform-linked data adds an informational `platform_linked` confidence entry with penalty `0` when `linkedPlatforms` exist and `hasSupplementalData` is not true. `apps/web/lib/impact/utils.ts:209`

## Recalculation and Snapshot Paths

- `/api/recalculate` is an authenticated route that applies IP and handle rate limits, materializes an orchestrated profile, persists a replacement snapshot, invalidates history read models, optionally updates Craft cache, revalidates `/u/{handle}`, and returns display plus raw score fields. `apps/web/app/api/recalculate/route.ts:24`
- `materializeOrchestratedProfile` calls `materializeProfile` with the `public-display` policy. `apps/web/lib/profile/orchestrated-profile.ts:13`
- `persistOrchestratedSnapshot` uses `dbReplaceSnapshot` for replace mode or `dbInsertSnapshot` for insert mode, and updates the snapshot cache after a successful write. `apps/web/lib/profile/orchestrated-profile.ts:27`
- `/api/refresh` clears `stats:v2:merged:{handle}` before materialization, persists a replacement snapshot, invalidates history read models, updates Craft cache when present, and revalidates `/u/{handle}`. `apps/web/app/api/refresh/route.ts:58`, `apps/web/app/api/refresh/route.ts:64`, `apps/web/app/api/refresh/route.ts:102`, `apps/web/app/api/refresh/route.ts:111`
- Public share-page reads call `materializePublicProfile(handle)` and schedule `runPublicProfileSideEffects` with `after()`. `apps/web/app/u/[handle]/page.tsx:109`, `apps/web/app/u/[handle]/page.tsx:157`
- Badge SVG reads call `materializePublicProfile(handle, { token })` and schedule `runPublicProfileSideEffects` with `after()`. `apps/web/app/u/[handle]/badge.svg/route.ts:226`, `apps/web/app/u/[handle]/badge.svg/route.ts:244`
- `runPublicProfileSideEffects` uses a once-per-day `sideeffects:done:{handle}:{date}` guard and returns early when the guard exists and `materialized.inputsChanged` is false. `apps/web/lib/profile/public-profile.ts:61`
- When side effects persist a snapshot, they use `dbReplaceSnapshot` only when `materialized.inputsChanged` is true; otherwise they use `dbInsertSnapshot`. `apps/web/lib/profile/public-profile.ts:93`
- `smoothScore` returns the existing same-day snapshot score unless `bypassSameDayLock` is true. `apps/web/lib/impact/smoothing.ts:63`
- `applyImpactScorePolicy` passes `inputsChanged` into the same-day lock bypass option. `apps/web/lib/impact/smoothing.ts:95`
- The dirty-stats marker is set through `markStatsDirty(handle)`, read through `isStatsDirty(handle)`, and cleared through `clearStatsDirty(handle)`. `apps/web/lib/cache/dirty-stats.ts:20`
- The supplemental upload route writes supplemental stats, clears the merged stats cache, and calls `markStatsDirty(targetHandle)`. `apps/web/app/api/supplemental/route.ts:66`, `apps/web/app/api/supplemental/route.ts:81`, `apps/web/app/api/supplemental/route.ts:85`
- The insights upload route stores computed Craft data, defers invalidation of stats, craft, snapshot, and history read models, and returns the stored craft score. `apps/web/app/api/insights/route.ts:83`, `apps/web/app/api/insights/route.ts:89`, `apps/web/app/api/insights/route.ts:101`
- The `UserMenu` insights flow calls `/api/insights`, then starts `/api/recalculate` in parallel with reading the upload response. `apps/web/components/UserMenu.tsx:165`, `apps/web/components/UserMenu.tsx:175`
- In the current platform callback and disconnect handlers, the direct post-link/post-unlink side effects are cache deletions, badge SVG invalidation, redirects or JSON response, and no direct `/api/recalculate` invocation is present in those handler bodies. `apps/web/lib/auth/platform-oauth.ts:235`, `apps/web/lib/auth/platform-oauth.ts:280`

## Historical Documentation Facts

- Historical multi-platform research describes the scoring pipeline as platform-agnostic, with platform coupling isolated to query/fetch/OAuth layers. `docs/research/multi-platform.md:9`
- Bitbucket planning records GitHub login as unchanged, Bitbucket as optional, Bitbucket data fetched through OAuth, transformed into `StatsData`, and merged with GitHub data through `mergeStats()`. `docs/plans/2026-02-23-bitbucket-integration.md:9`
- Codeberg planning records the same pattern: GitHub primary identity, Codeberg linked from User Menu, Codeberg OAuth stats fetched and merged with GitHub data. `docs/plans/2026-02-26-codeberg-integration.md:10`
- GitLab planning records GitLab as a fourth connectable developer source whose commit/MR/review data is merged into `StatsData` and used by Impact v6 scoring. `docs/plans/2026-06-19-gitlab-integration.md:8`
- The current Impact v6 doc states that deliberate user actions including insights upload and platform connect trigger immediate recalculation through `POST /api/recalculate`. `docs/impact-v6.md:140`
- The same Impact v6 doc describes `/api/recalculate` as fetching stats cache-first, reading Craft, computing fresh impact, replacing today's snapshot, and updating Redis snapshot cache. `docs/impact-v6.md:142`

## Existing Automated Coverage

- Connect route tests exist for Bitbucket, Codeberg, and GitLab success redirects, CSRF state cookies, redirect URI construction, disabled flags, rate limits, unauthenticated access, and missing client IDs. `apps/web/app/api/auth/bitbucket/connect/route.test.ts:88`, `apps/web/app/api/auth/codeberg/connect/route.test.ts:87`, `apps/web/app/api/auth/gitlab/connect/route.test.ts:87`
- Callback route tests exist for Bitbucket, Codeberg, and GitLab success redirect, token storage through `dbUpsertLinkedPlatform`, cache invalidation, CSRF cookie clearing, exchange arguments, and access-token user fetch. `apps/web/app/api/auth/bitbucket/callback/route.test.ts:229`, `apps/web/app/api/auth/codeberg/callback/route.test.ts:232`, `apps/web/app/api/auth/gitlab/callback/route.test.ts:232`
- Disconnect route tests exist for Bitbucket, Codeberg, and GitLab successful disconnect, delete arguments, stats cache invalidation, DB-delete failure response, and cache invalidation when DB delete fails. `apps/web/app/api/auth/bitbucket/disconnect/route.test.ts:83`, `apps/web/app/api/auth/codeberg/disconnect/route.test.ts:82`, `apps/web/app/api/auth/gitlab/disconnect/route.test.ts:82`
- Status route tests exist for Bitbucket, Codeberg, and GitLab disabled flags, rate limits, unauthenticated access, not-linked responses, linked responses with `remoteLogin`, and session-login DB lookup. `apps/web/app/api/auth/bitbucket/status/route.test.ts:81`, `apps/web/app/api/auth/codeberg/status/route.test.ts:80`, `apps/web/app/api/auth/gitlab/status/route.test.ts:80`
- `UserMenu` runtime tests cover Bitbucket and Codeberg unlink confirmation, disconnect POSTs, loading state, graceful disconnect failure, unlinked local state after disconnect, router refresh, and unlinked link rendering. `apps/web/components/UserMenu.test.tsx:519`, `apps/web/components/UserMenu.test.tsx:572`, `apps/web/components/UserMenu.test.tsx:750`, `apps/web/components/UserMenu.test.tsx:806`, `apps/web/components/UserMenu.test.tsx:873`, `apps/web/components/UserMenu.test.tsx:986`, `apps/web/components/UserMenu.test.tsx:1039`, `apps/web/components/UserMenu.test.tsx:1096`
- `UserMenu` source-level tests cover GitLab link/unlink rendering and handler wiring. `apps/web/components/UserMenu.test.tsx:271`
- `getStats` tests cover Bitbucket, Codeberg, and GitLab merge behavior, `linkedPlatforms`, platform-login metadata, failed platform fetch fallback labels, all-three-platform merge, and platform-error isolation. `apps/web/lib/github/client.test.ts:788`, `apps/web/lib/github/client.test.ts:931`, `apps/web/lib/github/client.test.ts:1186`
- `fetchLinkedPlatformStats` tests cover positive cache hits, negative cache hits, disabled flags, unlinked DB state, null token resolution, successful fetch/cache, and no-cache behavior when fetch returns null. `apps/web/lib/platform/fetch-linked-platform.test.ts:50`
- Scoring pipeline tests cover merge-to-scoring-to-snapshot field survival, solo-quality survival through multi-platform merge, and merged stats feeding `computeImpactV6`. `apps/web/lib/impact/pipeline.test.ts:17`, `apps/web/lib/impact/pipeline.test.ts:66`
- Impact v6 tests cover result shape, composite averaging, adjusted bounds, tier derivation, profile type, solo composite behavior, and Craft composite behavior. `apps/web/lib/impact/v6.test.ts:803`, `apps/web/lib/impact/v6.test.ts:1041`, `apps/web/lib/impact/v6.test.ts:1375`
- Materialization tests cover raw/display distinction, previous-day EMA, same-day snapshot reuse, Craft inclusion, and explicit recalculation snapshotting display score. `apps/web/lib/profile/materialize-profile.test.ts:48`
- Recalculate route tests cover authentication, rate limits, materialization, replacement snapshot persistence, raw/display return fields, persistence before invalidation, Craft-cache behavior, share-page revalidation, and persistence failure behavior. `apps/web/app/api/recalculate/route.test.ts:105`

## Targeted Verification Run

Command run on 2026-06-21:

```bash
pnpm exec vitest run apps/web/components/UserMenu.test.tsx apps/web/app/api/auth/bitbucket/connect/route.test.ts apps/web/app/api/auth/bitbucket/callback/route.test.ts apps/web/app/api/auth/bitbucket/disconnect/route.test.ts apps/web/app/api/auth/bitbucket/status/route.test.ts apps/web/app/api/auth/codeberg/connect/route.test.ts apps/web/app/api/auth/codeberg/callback/route.test.ts apps/web/app/api/auth/codeberg/disconnect/route.test.ts apps/web/app/api/auth/codeberg/status/route.test.ts apps/web/app/api/auth/gitlab/connect/route.test.ts apps/web/app/api/auth/gitlab/callback/route.test.ts apps/web/app/api/auth/gitlab/disconnect/route.test.ts apps/web/app/api/auth/gitlab/status/route.test.ts apps/web/lib/platform/fetch-linked-platform.test.ts apps/web/lib/github/client.test.ts apps/web/lib/github/merge.test.ts apps/web/lib/impact/pipeline.test.ts apps/web/lib/impact/v6.test.ts apps/web/lib/impact/utils.test.ts apps/web/lib/profile/materialize-profile.test.ts apps/web/lib/profile/orchestrated-profile.test.ts apps/web/app/api/recalculate/route.test.ts
```

Result: 22 test files passed, 566 tests passed.

