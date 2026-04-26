# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Active alerts**: Launch-critical active alert integration for real-time status notifications
- **Structured error logger**: `withErrorCapture()` wrapper and structured JSON logger (`lib/analytics/server-errors.ts`) for consistent server-side error observability
- **Auth modules**: Cleanly separated authentication concerns — `oauth-state` (Redis-backed CSRF-safe state), `session` (session management), `cookie-policy`, `github-session-token` (Supabase-backed token store), `unsubscribe-token` (HMAC-signed)
- **Profile modules**: `materialize-profile`, `orchestrated-profile`, `public-profile`, `post-write-invalidation` — replaces scattered profile assembly logic
- **Spanish localization**: Public flow copy (`lib/copy/public-flow.ts`) translated to Spanish for all error pages, verify flow, and public-facing messages
- **Lease-based campaign send claiming**: Atomic SQL lease (`claim_campaign_sends()`) prevents duplicate email sends in multi-worker deployments
- **Deployment smoke test gate**: CI workflow validates deployment shape before proceeding
- **Migration validation script**: `scripts/validate-migrations.ts` enforces sequential `NNN_` naming on Supabase migrations
- **Auto-commit agent reports**: `scripts/commit-reports.sh` + launchd job (`com.chapa.commit-reports`) automatically commits `docs/agents/` updates at 10:30 UTC daily
- **CODEOWNERS**: `.github/CODEOWNERS` with catch-all `@juan294` ownership
- **Operational runbooks**: `docs/runbooks/` — incident-response, migrations, outage-playbook, release-checklist, rollback, secret-rotation (6 guides)
- **AGENTS.md**: Codex compatibility guide for AI agent workflows
- **Craft score backfill script**: `apps/web/scripts/backfill-craft-scores.ts` for applying formula changes to existing stored scores
- **`useIsClient` hook**: Extracted SSR-safe hydration check from presentational components into `apps/web/hooks/useIsClient.ts`
- **`useSession` hook**: Dedicated hook at `apps/web/hooks/useSession.ts`
- **`StatusCallout` component**: Reusable status/alert callout with semantic variants
- **`ClientFeatureFlagsProvider`**: Client-side feature flag injection component
- **Health endpoint GitHub API probe**: `/api/health` now validates GitHub API reachability alongside Redis and Supabase checks
- **`WARM_CACHE_PRIORITY_HANDLES` env var**: Comma-separated handles always included in warm-cache cron runs
- 237 new tests; total test count: 7,192 across 438 files

### Fixed
- **Craft scoring single source of truth**: `/api/refresh` and `/api/recalculate` no longer mutate stored craft scores — all paths read from `getCachedCraftScore()`. Formula changes require explicit backfill via the new backfill script
- **GitHub OAuth tokens moved to Supabase**: Tokens stored in `user_github_session_token` (encrypted) instead of session cookies, preventing token leak via log capture (#807)
- **Campaign send deduplication**: Claim sends before delivery with lease-based locking; prevents duplicate emails in multi-worker environments (#793)
- **Campaign payload validation**: Payloads validated on write, not just on send (#795)
- **Admin dashboard state**: Stabilized loading and error state transitions (#789, #790)
- **Admin user search**: Uses `ILIKE` for case-insensitive handle/name filtering
- **Admin agents/run auth**: Endpoint now requires valid auth; bulk-recalculate uses cursor pagination for large user sets
- **Badge cache coordination**: Hardened concurrent SVG cache writes and sideeffect deduplication (#799, #801)
- **Redis fail-open for public side effects**: Badge route side effects (snapshot, PostHog) fail silently on Redis outage rather than blocking the SVG response (#792)
- **Snapshot invalidation order**: Centralized and consistent cache invalidation sequence on profile writes (#794)
- **Auth cookie policy**: Hardened `SameSite`, `Secure`, and `HttpOnly` attributes; separate policy per environment (#806, #813)
- **Verification read path**: Unified verification data access via single read path (#812)
- **Resend webhook deduplication**: Deduplicated webhook event delivery to prevent double-processing (#796, #809)
- **Cron fail-secure**: All cron endpoints return `503` when `CRON_SECRET` is unset (previously allowed through); `getClientIp` now trusts `x-vercel-forwarded-for` over spoofable headers
- **OAuth callback state**: Stabilized local OAuth callback state transitions for dev environment
- **Module cache on logout**: Module-level promise caches (e.g. `useSession`) cleared on logout
- **`withTimeout()` helper**: Replaced `Promise.race` with a named helper for better error context
- **SVG route**: Cache key, sideeffect dedup guard, and rate limit key corrected
- **Public client shell**: Deferred to avoid SSR/client hydration mismatch (#786, #797)
- **Studio availability flag**: Unified `NEXT_PUBLIC_STUDIO_ENABLED` check across all entry points (#788)
- **Share page UX**: Stabilized public share page rendering and loading state (#787, #818, #821)
- **Status semantics**: Unified status field across admin and API responses (#820)
- **InfoTooltip z-index**: Increased from `9999` to `99999` to layer above animated ancestors
- **Heatmap keyboard navigation**: Day cells are keyboard-navigable with `tabindex`, `role`, and `aria-label` (UX-H4)
- **Radar animation reduced-motion**: Respects `prefers-reduced-motion` media query
- **Badge preview CLS**: Eliminated layout shift on badge preview mount (FE-M5)
- **BadgeContent avatar**: Adds `.img-outline` per design system
- **Profile date alignment**: `buildSnapshot` now uses the `today` param consistently for date binding
- **`useTrendData` waterfall**: Module-level promise cache eliminates redundant sequential fetches

### Security
- **PostCSS XSS CVE**: Pinned `postcss >= 8.5.10` to resolve CVE
- **Next.js 16.2.4**: Resolves PPR-related DoS vulnerability (GHSA-q4gf-8mx6-v5v3)

### Changed
- **Removed stale components**: `ShareBadgePreview`, `ShareBadgePreviewLazy`, `HeroScoreZone`, `RadarChartInteractive` (superseded by current dashboard design)
- **Third-party license inventory**: Refreshed to reflect current dependency set

### Dependencies
- Next.js: 16.2.2 → 16.2.4
- React / React-DOM: 19.2.4 → 19.2.5
- TypeScript: 6.0.2 → 6.0.3
- ESLint: 9.27.0 → 9.39.0
- vitest / @vitest/coverage-v8: 4.1.2 → 4.1.4
- @supabase/supabase-js: 2.103.0 → 2.103.3
- posthog-js: 1.367.0 → 1.369.3
- resend: 6.10.0 → 6.12.0
- @playwright/test: 1.58.2 → 1.59.1
- @types/node: 25.5.0 → 25.6.0

## [2.7.2] - 2026-04-04

### Fixed
- **Craft recompute on refresh**: `/api/refresh` now recomputes craft scores from stored raw data when supplemental insights are present, preventing stale craft dimensions after a force-refresh
- **Craft score passed to impact**: Craft score is now correctly forwarded into the impact calculation pipeline after a refresh, ensuring the badge reflects the latest craft data

## [2.7.1] - 2026-04-04

### Fixed
- **Craft recompute on recalculate**: `/api/recalculate` now recomputes craft scores from stored raw data rather than using cached values, preventing stale craft dimensions after an insights upload

## [2.7.0] - 2026-04-04

### Added
- **Craft dimension scoring page**: New "Craft — AI tool mastery" section on `/about/scoring` explaining how to unlock Craft, the 2-week upload cadence, sub-dimensions, and friction exclusion rationale
- **Insights import cooldown**: Disables "Import Insights" button for 14 days after upload, matching Claude Code's generation cycle; shows re-enable date in tooltip
- **Claude Code footer attribution**: "Powered by Claude Code" with animated star spinner in landing page footer; platform logos (GitHub, Bitbucket, Codeberg) in icons-only layout
- **Owner cache warm on share page**: When badge owners visit their own `/u/:handle`, a client hook silently calls `/api/refresh` with their OAuth token to warm cache and trigger ISR rebuild
- **9 UI polish improvements**: `tabular-nums` on scores, `text-balance`/`text-pretty`, `.img-outline` for avatars, `shadow-card`/`shadow-card-hover` CSS properties, icon cross-fade transitions, `useAnimatedUnmount` hook, `collapse-grid` utility, asymmetric CTA padding
- 41 new test files; total test count: 6,955 across 389 files

### Fixed
- **Craft scoring fairness (critical)**: Excluded friction events (wrong approach, buggy code, misunderstood request) and tool errors from Effectiveness sub-score — these are the AI tool's mistakes, not the developer's. Weights redistributed to achievement rate (55%) + satisfaction rate (45%)
- **Release PR filtering**: Cross-default PRs (develop→main) no longer dilute featureBranchRate, batchSizeScore, issueLinkageRate, prDescriptionRate for solo quality metrics
- **Solo profile detection**: Uses `primaryReviewsSubmittedCount` instead of combined total, preventing supplemental EMU reviews from flipping solo devs to collaborative
- **Merge quality rate preservation**: `mergeOptionalWeightedAvg` no longer treats `undefined` as 0, which was dragging primary quality rates toward zero
- **Minimum sample guard**: Falls back to all merged PRs when fewer than 5 dev PRs remain after release PR filtering
- **ADMIN_SECRET fail-secure**: Returns 503 when env var unset (was 401, confusable with invalid token)
- **Heatmap keyboard accessibility**: Added keyboard navigation and accessible descriptions to heatmap grid
- **WCAG blockers**: Replaced `div[role=button]` with native `<button>` in DimensionCard; moved progressbar ARIA to outer container
- **BadgeOverlay tooltip**: Screen reader announcement on desktop
- **Score snapshot upsert**: Refresh endpoint uses `dbReplaceSnapshot` (UPSERT) so corrected scores overwrite stale same-day snapshots
- **Badge freshness**: Reduced `stale-while-revalidate` from 7 days to 1 day; added `revalidatePath()` to refresh endpoint
- **OG image font paths**: Use `process.cwd()` instead of `__dirname` for Turbopack compatibility
- **Feature flag caching**: 5-minute TTL eliminates redundant Supabase queries

### Changed
- **Impact v4 → v6 rename**: `computeImpactV4` → `computeImpactV6`, `ImpactV4Result` → `ImpactV6Result`, `v4.ts` → `v6.ts` across 71 files — aligns code naming with spec version
- **TypeScript 6.0**: Upgraded from 5.9.3 to 6.0.2; zero type errors, all tests pass
- **Next.js 16.2.2**: PPR DoS security fix
- **`noUnusedLocals` + `noUnusedParameters`**: Enabled in both tsconfigs
- Platform OAuth status rate limit raised from 20/15min to 120/15min

### Documentation
- All living specs updated: impact-v6.md (effectiveness formula, consistency table, v4→v6), svg-design.md (heatmap palette, type rename)
- CRON_SECRET fail-open documented as accepted risk (#685)
- Architecture diagram (`docs/chapa-architecture.drawio`) added
- Pre-launch audit report (6 specialists, all GREEN)
- MetricsSnapshot JSDoc corrected (Redis → Supabase)
- StatsData field count updated (29 → 30)
- README badges and test counts refreshed

## [2.6.0] - 2026-03-29

### Added
- **Scoring v6.1**: Batch size score replaces micro-commit ratio in Quality (15% signal); week coverage replaces inverse burst in Consistency (15% signal); ±5% lead time modifier on Delivery; ratio-based solo profile detection (threshold 0.15); burst confidence threshold raised to 100
- **Portfolio API integration**: Reduced `/api/profile/:handle` cache from 1h to 5min CDN (`s-maxage=300`); `WARM_CACHE_PRIORITY_HANDLES` env var for guaranteed daily cache warming of specified handles; craft dimension persisted in `metrics_snapshots` table (migration 019)
- **Admin bulk-recalculate endpoint**: `POST /api/admin/bulk-recalculate` for force-recalculating impact scores after scoring formula updates
- **Scoring pipeline hardening**: Field completeness guard (`stats-schema.ts`), golden-file scoring tests, end-to-end pipeline integrity tests, `makeFullStats()` test factory, CI scoring integrity gate
- **Shared `useSession()` hook**: Eliminates 3-4 redundant `/api/auth/session` fetches per page via module-level promise deduplication
- 27 new tests; total test count: 6,654 across 382 files

### Fixed
- Tier range copy corrected across BadgeOverlay tooltip, llms.txt, llms-full.txt (Emerging 0-29, Solid 30-69)
- Solo quality fields preserved in `mergeStats` — no longer silently dropped
- Share page Refresh button restored via client-side session check (#647)
- Error handling added to `/api/supplemental`, `/api/insights`, `/api/insights/:handle` — unhandled exceptions now return JSON 500 instead of raw errors (#653)
- RadarChart SVG hit areas now keyboard-accessible: `tabIndex`, `role="button"`, `aria-label`, `onKeyDown` for Enter/Space (#652)
- Mobile nav links include `aria-current` for active state (#642)
- Unused `_resetSessionCache` export removed (knip dead code)

### Changed
- `verifyAdminSecret()` extracted as shared helper — deduplicates bearer-token auth in stats and bulk-recalculate routes (#651)
- Composite score description on `/about/scoring` now documents solo profile quality exclusion
- CI checkout uses `fetch-depth: 0` for accurate scoring file diffs
- Supabase local dev config added (`supabase/config.toml`) with non-conflicting ports

### Documentation
- All scoring docs updated to match v6.1 code: how-it-works, scoring-explainer-video, spec, cli-guide
- `WARM_CACHE_PRIORITY_HANDLES` documented in CLAUDE.md
- StatsData field count corrected (25→29), MetricsSnapshot storage location updated
- README verification hash length corrected (8→32 chars), test counts updated
- Node.js version in cli-guide updated (18→20)
- Scoring pipeline hardening plan — all 5 phases marked complete
- Synced with cc-rpi blueprint v1.14.1

## [2.4.1] - 2026-03-27

### Added
- Share page Suspense boundary for progressive streaming — page shell renders immediately, badge content loads asynchronously with `BadgeSkeleton` fallback (#635)
- 43 new tests: 6 new test files (5 loading.tsx + ClientAnalytics), heading hierarchy regression tests, health endpoint coverage; total test count: 6,414 (#637)

### Fixed
- Linked platforms now appear in Data Sources and badge footer even when stats fetch temporarily fails (expired token, API error) — DB link status is the source of truth (#632)
- Health endpoint uses `dbsize()` instead of `ping()` for actual Redis data-access check; returns `"skipped"` (200 OK) instead of `"unavailable"` (503) when services are not configured (#634)
- Cron auth logs a warning when `CRON_SECRET` is not set, making unprotected endpoints visible in logs (#633)
- Heading hierarchy corrected in experiment pages — `h1` now precedes `h2` in DOM order (#636)
- E2E health test updated to accept `"skipped"` status

### Changed
- UserMenu platform visibility driven by server-side status API instead of client-side sync flags — eliminates env var / DB flag mismatches
- Parallelized linked-platform DB fallback checks via `Promise.all`; extracted `fetchPlatformStatus()` helper in UserMenu
- 6 minor/patch dependency updates: @supabase/supabase-js, posthog-js, svix, @next/bundle-analyzer, @types/node, eslint-config-next (#638)

### Documentation
- Updated README test counts, CLAUDE.md health endpoint + agent report descriptions
- Updated spec.md with Craft dimension, Artificer archetype, profile API + health endpoints
- Updated badge specs: "Platform Branding" (was "GitHub Branding"), 4/5-axis radar chart, 3 missing render files
- Removed stale Confidence references from badge design doc
- Added CHANGELOG link reference definitions for all versions

## [2.4.0] - 2026-03-27

### Added
- Public profile API endpoint (`GET /api/profile/:handle`) — read-only, rate-limited (60 req/IP/min), CORS-enabled, 1h CDN cache; returns latest impact dimensions, archetype, tier, and optional craft score for external consumers (portfolio sites)
- 17 new tests across profile endpoint, history API, campaigns a11y, unsubscribe HTML, share page coverage; total test count: 6,371
- Share page test coverage boosted from 84% to 100% statements

### Changed
- History API (`/api/history/:handle`) strips `confidence` and `confidencePenalties` from response (internal-only data, per CLAUDE.md policy)
- 4 admin routes (users, feature-flags, engagement-flags, agents-summary) migrated to shared `adminAuth()` helper (-105 lines)
- Profile endpoint queries parallelized via `Promise.all` and typed with shared `DimensionScores`
- Dev dependencies: vitest bumped to 4.1.2, pnpm overrides for picomatch (>=4.0.4) and brace-expansion (>=5.0.5) — 0 audit vulnerabilities
- Font files excluded from coverage reporting (binary .ttf noise)

### Fixed
- Flaky `BadgeToolbar.render.test.tsx` test: replaced `setTimeout` with `queueMicrotask` in MockImage callback to eliminate async race
- Campaigns dashboard: added keyboard support (`role="button"`, `tabIndex`, Enter/Space `onKeyDown`) to table rows
- Unsubscribe HTML: added `lang="en"` attribute to `<html>` tag

### Documentation
- `CLAUDE.md`: added `GET /api/profile/:handle` to Public API routes
- `docs/accepted-risks.md`: documented lightningcss MPL-2.0 license as accepted build-only dependency

## [2.3.0] - 2026-03-24

### Added
- Badge loading skeleton (`BadgeSkeleton`) — shimmer placeholder while badge `<img>` loads on share page
- Redis craft score cache (`lib/cache/craft-cache.ts`) — 1h TTL, fail-open to Supabase
- Pre-warming of avatar and craft caches in `warm-cache` cron job
- Generic platform OAuth handler factory (`lib/auth/platform-oauth.ts`) — eliminates Bitbucket/Codeberg code duplication
- `ClientAnalytics` wrapper component for Vercel Analytics/SpeedInsights (Next.js 16 Server Component compatibility)
- ~167 new tests across 48 test files; function coverage boosted from 81.3% to 85.7%
- Shared test helpers: `adminAuthSetup()` for campaign tests, platform auth fixtures
- `report-reader` module for agents-summary route (isolates filesystem access from Turbopack NFT tracing)

### Changed
- HMAC verification hash increased from 64 bits (16 hex chars) to 128 bits (32 hex chars); verification endpoints accept legacy 8/16/32-char formats
- Supabase: `FORCE ROW LEVEL SECURITY` enabled on all 9 tables (defense-in-depth)
- Vercel Analytics and SpeedInsights dynamically imported (reduces server bundle)
- Dev dependencies updated: vitest 4.1.1, @vitest/coverage-v8 4.1.1

### Fixed
- `next/dynamic` with `ssr: false` in Server Component (Next.js 16 build failure) — extracted to client component
- Unhandled "window is not defined" error from `useAnimatedCounter` test cleanup
- `type="button"` added to UserMenu trigger and platform unlink buttons (prevents accidental form submission)
- `htmlFor`/`id` pairing on number-counters experiment slider (screen reader accessibility)
- NFT trace warning in agents-summary route (filesystem reads extracted to separate module)

## [2.2.0] - 2026-03-23

### Added
- YouTube video explainer embed on `/about/scoring` page via new `LiteYouTubeEmbed` component (lazy-loads iframe on click, ~800KB saved on initial load)
- Scoring explainer video source document (`docs/scoring-explainer-video.md`)
- Bearer token authentication for `/api/insights` and `/api/recalculate` endpoints (enables CLI workflows without browser session)
- Shared `resolveRequestAuth()` module supporting both Bearer token and session cookie auth
- Shared `verifyCronSecret()` helper centralizing cron route authentication
- `loading.tsx` for `/coming-soon` route
- 28 new tests: render tests for 9 page components, cron auth helper, Bearer auth resolver, YouTube embed

### Changed
- Cron routes (`warm-cache`, `sync-audience`, `process-campaigns`) refactored to use shared `verifyCronSecret()` helper
- `/api/supplemental` route refactored to use shared `resolveRequestAuth()`
- Removed deprecated `X-XSS-Protection` header (CSP provides real XSS protection)
- CSP updated: added `i.ytimg.com` to `img-src`, `youtube-nocookie.com` to `frame-src`

### Fixed
- OAuth token lost in `resolveRequestAuth` for browser-initiated recalculations
- Campaign feature highlight inputs missing `aria-label` attributes
- RadarChartInteractive SVG vertices suppressing focus outline via inline style
- Scoring page public URL using AND instead of OR for `low_activity_signal` confidence penalty

## [2.1.0] - 2026-03-22

### Added
- Campaign type system: `announcement` (manual blast) vs `engagement` (automated score-bump template)
- Send test email endpoint for campaign drafts (`POST /api/admin/campaigns/:id/test`)
- BIMI logo for email branding (`apps/web/public/bimi.svg`)
- `microCommitRatio` metric: fraction of merged PRs with < 10 lines changed (`MICRO_PR_LINE_THRESHOLD`)
- `MICRO_PR_LINE_THRESHOLD` constant extracted to `packages/shared/src/constants.ts`
- `dev` and `developer` added to `DEFAULT_BRANCH_NAMES` for accurate feature branch detection
- 57 new tests (html-helpers, error boundaries, campaign a11y, experiment landmarks)

### Changed
- `low_activity_signal` confidence penalty: AND → OR (triggers on either low days or low commits)
- Score-bump notification threshold raised from 5 to 10 points (`SCORE_BUMP_THRESHOLD`)
- Email templates: improved subject lines (show delta/tier), multi-paragraph body support, shared `featureRow()` helper
- Next.js updated to 16.2.1
- Dev dependencies updated: vitest 4.1.0, jsdom 29.0.1

### Fixed
- Campaign template placeholder interpolation (ctaUrl, ctaText, features array, engagement fields)
- Email feature bullet spacing
- Campaign form a11y: added `htmlFor`/`id` label associations and `aria-label` on remove buttons
- 7 experiment pages: changed `<div>` to `<main>` for proper landmark semantics
- Suppressed expected stderr noise in error-handling tests

## [2.0.0] - 2026-03-22

### Added

**Multi-Platform Integration**
- Bitbucket OAuth connect/disconnect with encrypted token storage in Supabase
- Codeberg OAuth connect/disconnect with encrypted token storage in Supabase
- Multi-platform stats merging (GitHub + Bitbucket + Codeberg) in badge and share page
- Platform-specific data source chips on share page with clickable profile links
- Dynamic platform logo branding in badge footer (shows only connected platforms)

**Impact V6 Scoring**
- Optional 5th dimension: Craft (AI tool usage insights via Claude Code reports)
- Artificer archetype for developers with strong Craft scores
- Pentagon radar chart when Craft data is present (falls back to diamond for 4 dimensions)
- Impact V6 spec documented as current source of truth (`docs/impact-v6.md`)

**Impact Dashboard Redesign**
- Interactive radar chart with clickable vertices and dimension detail panels
- Enhanced dimension cards with sparklines and expandable sub-metric breakdowns
- Coaching insights with trend-based recommendation cards
- Dot timeline activity chart replacing hex heatmap
- Bold hero score variant with tier badge

**Badge V3**
- Pentagon radar for 5-dimension profiles
- Dot timeline activity visualization
- Platform-neutral Chapa branding (replaced GitHub-only footer)
- Grouped pill container with opacity contrast text
- Updated branding tagline

**Admin & Infrastructure**
- Feature flags system (Supabase `feature_flags` table + API + admin UI)
- Agent fleet: 7 scheduled agents (Coverage, Cost Analyst, QA, Security, Performance, Documentation, cc-rpi Update) with launchd plists and admin dashboard
- Agent run API for manual triggering
- Engagement tab with score notification toggles
- Admin dashboard data layer migrated from Redis to Supabase
- Batch snapshot queries with skeleton loader and deferred search

**Email & Campaigns**
- Campaign management system: CRUD, preview, send, cron processing
- Score-bump email notifications
- Resend audience sync cron job
- Email unsubscribe endpoint with webhook verification

**CLI & Integrations**
- Claude Code Insights import (upload HTML report, compute Craft dimension)
- Telemetry API for CLI merge audit data
- Recalculate endpoint for score refresh after insights upload

**UX & Accessibility**
- Dark/light theme with `next-themes` (light default, dark signature brand)
- Skip-to-main-content link (WCAG 2.4.1)
- ARIA labels on all interactive elements (admin table, confidence bars, dropdowns, overlays)
- Focus trap in mobile nav, keyboard navigation on radar chart and dimension cards
- `prefers-reduced-motion` support across all animations
- Loading and error boundaries for all major routes
- Social sharing: Bluesky and LinkedIn added to share dropdown
- Updated favicon and logo with shield + glow design

**Testing & CI**
- Test suite expanded: 330 test files, 5,680 tests (was 130 files, 2,100 tests)
- 100% API route test coverage (41/41 handlers)
- Render tests for 9 previously untested components
- 113 admin sub-component render tests
- Lighthouse CI workflow for Core Web Vitals tracking
- Bundle size CI with 500KB budget check
- Circular dependency check (madge) in CI
- Dead code detection (knip) in CI

**New API Routes**
- `/api/auth/bitbucket/*` (callback, connect, disconnect, status)
- `/api/auth/codeberg/*` (callback, connect, disconnect, status)
- `/api/admin/campaigns` (CRUD + preview + send)
- `/api/admin/agents-summary`, `/api/admin/agents/run`
- `/api/admin/engagement-flags`, `/api/admin/feature-flags`
- `/api/feature-flags` (public)
- `/api/insights`, `/api/insights/:handle`
- `/api/notifications/unsubscribe`
- `/api/recalculate`
- `/api/telemetry`
- `/api/cron/process-campaigns`, `/api/cron/sync-audience`

### Changed
- Impact scoring: "Building" dimension renamed to "Delivery", "Guarding" to "Quality"
- Archetype: "Guardian" renamed to "Quality Champion" (internal routes still use "guardian")
- Lifetime metric snapshots migrated from Redis sorted sets to Supabase `metrics_snapshots` table
- `GithubBranding.tsx` replaced with platform-neutral `BadgeBranding.tsx`
- `KeyboardShortcutsProvider` wrapper replaced with `KeyboardShortcutsListener` sibling component
- Activity heatmap redesigned from hexagonal grid to dot-based timeline
- Badge cache headers changed from 24h to 6h `s-maxage` for fresher updates

### Fixed
- Token refresh resilience: transient failures (network, timeout) no longer auto-unlink Bitbucket/Codeberg — only confirmed revocation (`400 + invalid_grant`) triggers unlinking
- RLS enabled on all Supabase tables with explicit deny policies for anon role
- Rate limiting added to all API endpoints
- XSS vector: escape handle param in unsubscribe HTML response
- Badge: star pill trailing space, metric pill sizing, empty hexagon visibility
- Accessibility: nested button violations, focus indicators, dark mode contrast, touch targets
- Performance: inline badge SVG, parallel data fetching, lazy-load command bar
- Studio: `force-dynamic` export to suppress build cache warnings
- Experiment pages: heading hierarchy fix, loading state fallbacks
- UTC timezone bug in streak calculation

### Security
- AES-256-GCM token encryption for all platform OAuth tokens
- CSRF state validation with `timingSafeEqual` on all OAuth callbacks
- Comprehensive security headers (HSTS, CSP, X-Frame-Options, Permissions-Policy)
- `flatted` override bumped to `>=3.4.2` (prototype pollution CVE)
- Next.js updated to 16.2.0 (resolved 5 security advisories)
- Dependency audit: `eslint` transitive deps overridden for known vulnerabilities

## [1.0.0] - 2026-02-16

### Added
- Impact v4 scoring engine with 4 dimensions (Delivery, Quality, Consistency, Breadth)
- Developer archetype classification (Builder, Quality Champion, Marathoner, Polymath, Balanced, Emerging)
- Embeddable SVG badge at `/u/:handle/badge.svg` with heatmap, radar chart, and animations
- Share page at `/u/:handle` with score breakdown, tooltips, and embed snippets
- Creator Studio at `/studio` with 9 visual customization categories
- GitHub OAuth login for verified badges
- Badge verification via HMAC-SHA256 hash at `/api/verify/:hash`
- Admin dashboard at `/admin` with user management and command bar
- CLI tool (`chapa-cli`) for GitHub Enterprise (EMU) account merging
- Lifetime metric snapshots stored in Redis sorted sets (permanent history)
- Score history API with trend and diff calculations
- PostHog analytics integration
- Resend email notifications (first badge, webhooks)
- Warm-cache cron job for active users
- Dark/light theme support with terminal-first design system
- Comprehensive test suite (130+ test files, 2100+ tests)
- CI/CD with GitHub Actions (tests, typecheck, lint, security scanning, bundle analysis)
- Public release documentation (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)

[2.7.2]: https://github.com/juan294/chapa/compare/v2.7.1...v2.7.2
[2.7.1]: https://github.com/juan294/chapa/compare/v2.7.0...v2.7.1
[2.7.0]: https://github.com/juan294/chapa/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/juan294/chapa/compare/v2.4.1...v2.6.0
[2.4.1]: https://github.com/juan294/chapa/compare/v2.4.0...v2.4.1
[2.4.0]: https://github.com/juan294/chapa/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/juan294/chapa/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/juan294/chapa/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/juan294/chapa/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/juan294/chapa/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/juan294/chapa/releases/tag/v1.0.0
