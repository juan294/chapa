# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
