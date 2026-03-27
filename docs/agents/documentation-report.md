# Documentation Report
> Generated: 2026-03-27 | Health status: yellow

## Executive Summary

Documentation is **well-maintained** overall (84% JSDoc coverage, 30/30 env vars documented, all 6 required docs present), but **route documentation has 6 method mismatches** and **1 undocumented API route**. Design system tokens are 98%+ accurate. Previous audit's phantom routes (`bitbucket/login`, `codeberg/login`) have been fixed. Key action: correct method signatures in CLAUDE.md and add JSDoc to 11 complex undocumented functions.

## Route Documentation

### Pages (34 total)

All 34 page routes exist and match CLAUDE.md documentation. The 13 experiment pages are covered by the wildcard `/experiments/*` entry.

| Page Route | In CLAUDE.md | Status |
|------------|-------------|--------|
| `/` through `/verify/[hash]` (21 core pages) | Yes | OK |
| `/experiments/*` (13 experiment pages) | Yes (wildcard) | OK |
| `/archetypes/artificer` | Listed in archetype set | OK |

### API Routes (42 total)

| Route | CLAUDE.md | Actual Methods | Status |
|-------|-----------|---------------|--------|
| `/api/auth/login` | GET | GET | OK |
| `/api/auth/callback` | GET | GET | OK |
| `/api/auth/session` | GET | GET | OK |
| `/api/auth/logout` | POST | POST | OK |
| `/api/auth/bitbucket/*` (4 routes) | All correct | All correct | OK |
| `/api/auth/codeberg/*` (4 routes) | All correct | All correct | OK |
| `/api/verify/[hash]` | GET | GET | OK |
| `/api/profile/[handle]` | GET | GET | OK |
| `/api/history/[handle]` | GET | GET | OK |
| `/api/health` | GET | GET | OK |
| `/api/feature-flags` | GET | GET | OK |
| `/api/generate` | POST | POST | OK |
| `/api/refresh` | POST | POST | OK |
| `/api/recalculate` | POST | POST | OK |
| `/api/supplemental` | POST | POST | OK |
| `/api/insights/[handle]` | GET | GET | OK |
| `/api/insights` | POST | POST | OK |
| `/api/studio/config` | GET\|PUT | GET\|PUT | OK |
| `/api/cli/auth/approve` | POST | POST | OK |
| `/api/admin/users` | GET | GET | OK |
| `/api/admin/stats` | GET | GET | OK |
| `/api/admin/agents-summary` | GET | GET | OK |
| `/api/admin/campaigns` | GET\|POST | GET\|POST | OK |
| `/api/admin/campaigns/[id]` | GET\|PATCH\|DELETE | GET\|PATCH\|DELETE | OK |
| `/api/admin/campaigns/[id]/preview` | GET | GET | OK |
| `/api/admin/campaigns/[id]/send` | POST | POST | OK |
| `/api/admin/campaigns/[id]/test` | POST | POST | OK |
| `/api/webhooks/resend` | POST | POST | OK |
| `/api/cron/warm-cache` | GET | GET | OK |
| `/api/cron/sync-audience` | GET | GET | OK |
| `/api/cron/process-campaigns` | GET | GET | OK |
| `/u/[handle]/badge.svg` | GET | GET | OK |
| `/u/[handle]/og-image` | GET | GET | OK |
| `/og-image` | GET | GET | OK |
| `/llms.txt` | GET | GET | OK |
| `/llms-full.txt` | GET | GET | OK |
| `/.well-known/security.txt` | GET | GET | OK |
| **`/api/cli/auth/poll`** | **GET\|POST** | **GET only** | **MISMATCH** |
| **`/api/admin/feature-flags`** | **GET\|PATCH** | **PATCH only** | **MISMATCH** |
| **`/api/admin/engagement-flags`** | **GET\|PUT** | **GET only** | **MISMATCH** |
| **`/api/admin/agents/run`** | **POST** | **POST\|GET\|DELETE** | **MISMATCH** |
| **`/api/notifications/unsubscribe`** | **POST** | **GET** | **MISMATCH** |
| **`/api/telemetry`** | **Not listed** | **POST** | **MISSING** |

### Summary

- **Correct routes**: 36/42 (86%)
- **Method mismatches**: 5
- **Undocumented routes**: 1 (`/api/telemetry`)
- **Phantom routes from previous audit**: 0 (fixed)

## Stale Documentation

| Item | Document | Issue | Severity |
|------|----------|-------|----------|
| `/api/cli/auth/poll` methods | CLAUDE.md:290 | Docs say GET\|POST, code exports GET only | Medium |
| `/api/admin/feature-flags` methods | CLAUDE.md:296 | Docs say GET\|PATCH, code exports PATCH only | Medium |
| `/api/admin/engagement-flags` methods | CLAUDE.md:297 | Docs say GET\|PUT, code exports GET only | Medium |
| `/api/admin/agents/run` methods | CLAUDE.md:298 | Docs say POST, code exports POST\|GET\|DELETE | Medium |
| `/api/notifications/unsubscribe` method | CLAUDE.md:305 | Docs say POST, code exports GET | High |
| `animate-hex-cell-in` duration | design-system.md | Docs say "(set per-element)", actual CSS defines 0.45s | Low |
| `animate-shimmer-sweep` | design-system.md animation table | Exists in CSS, mentioned in tokens table but missing from animation table | Low |

## Missing Documentation

### Undocumented API Route
- **`POST /api/telemetry`** — Client telemetry ingestion endpoint. Not listed in CLAUDE.md Key Routes section.

### Complex Functions Without JSDoc (11 total)

| File | Function | Lines | Priority |
|------|----------|-------|----------|
| `lib/validation.ts` | `isValidTelemetryPayload` | 43 | P1 — validates critical API payload |
| `lib/validation.ts` | `isValidBadgeConfig` | 17 | P1 — validates badge config API payload |
| `lib/dashboard/generate-insights.ts` | `generateInsights` | >30 | P1 — core feature: personalized insights |
| `lib/db/campaigns.ts` | `dbCreateCampaign` | >30 | P2 — campaign CRUD |
| `lib/db/campaigns.ts` | `dbUpdateCampaign` | >30 | P2 — campaign CRUD |
| `lib/db/campaigns.ts` | `dbGetActiveEngagementCampaign` | >30 | P2 — campaign query |
| `lib/db/campaigns.ts` | `dbGetCampaignStats` | >30 | P2 — JS aggregation (PostgREST limitation) |
| `lib/email/score-bump.ts` | `notifyScoreBump` | >30 | P2 — email notification |
| `lib/email/templates/announcement.ts` | `buildAnnouncementHtml` | >30 | P2 — email template |
| `lib/effects/counters/use-animated-counter.ts` | `useAnimatedCounter` | >30 | P3 — UI hook |
| `lib/hooks/use-trend-data.ts` | `useTrendData` | >30 | P3 — data hook |

### JSDoc Coverage by Category

| Category | Coverage | Status |
|----------|----------|--------|
| Auth & OAuth | 100% | Excellent |
| Cache & Performance | 100% | Excellent |
| Core Scoring & Impact | 100% | Excellent |
| History & Trends | 100% | Excellent |
| Utilities & Helpers | 100% | Excellent |
| packages/shared | 100% | Excellent |
| Database & ORM | 98% | Excellent |
| Email & Templates | 50% | Needs attention |
| UI Effects | 42% | Critical gaps |

**Overall JSDoc coverage: 84% (284/338 exports)**

### Previously Reported Gaps — Now Resolved
- `lib/insights/validation.ts::isValidInsightsUpload` — now fully documented
- `lib/github/queries.ts::fetchContributionData` — now fully documented
- `lib/utils/validation.ts::isValidStatsShape` — now fully documented
- Auth cookie functions — now documented per security agent

## Environment Variables

| Variable | In CLAUDE.md | Used in Code | Status |
|----------|-------------|-------------|--------|
| GITHUB_CLIENT_ID | Yes | Yes | OK |
| GITHUB_CLIENT_SECRET | Yes | Yes | OK |
| NEXTAUTH_SECRET | Yes | Yes | OK |
| NEXT_PUBLIC_BASE_URL | Yes | Yes | OK |
| UPSTASH_REDIS_REST_URL | Yes | Yes | OK |
| UPSTASH_REDIS_REST_TOKEN | Yes | Yes | OK |
| SUPABASE_URL | Yes | Yes | OK |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Yes | OK |
| NEXT_PUBLIC_POSTHOG_KEY | Yes | Yes | OK |
| NEXT_PUBLIC_POSTHOG_HOST | Yes | Yes | OK |
| RESEND_API_KEY | Yes | Yes | OK |
| RESEND_WEBHOOK_SECRET | Yes | Yes | OK |
| SUPPORT_FORWARD_EMAIL | Yes | Yes | OK |
| GITHUB_TOKEN | Yes | Yes | OK |
| CHAPA_VERIFICATION_SECRET | Yes | Yes | OK |
| NEXT_PUBLIC_STUDIO_ENABLED | Yes | Yes | OK |
| NEXT_PUBLIC_EXPERIMENTS_ENABLED | Yes | Yes | OK |
| NEXT_PUBLIC_INSIGHTS_ENABLED | Yes | Yes | OK |
| BITBUCKET_CLIENT_ID | Yes | Yes | OK |
| BITBUCKET_CLIENT_SECRET | Yes | Yes | OK |
| NEXT_PUBLIC_BITBUCKET_ENABLED | Yes | Yes | OK |
| CODEBERG_CLIENT_ID | Yes | Yes | OK |
| CODEBERG_CLIENT_SECRET | Yes | Yes | OK |
| NEXT_PUBLIC_CODEBERG_ENABLED | Yes | Yes | OK |
| ADMIN_HANDLES | Yes | Yes | OK |
| ADMIN_SECRET | Yes | Yes | OK |
| ALLOW_AGENT_RUN | Yes | Yes | OK |
| CRON_SECRET | Yes | Yes | OK |
| VERCEL_ENV | Yes | Yes | OK |
| ANALYZE | Yes | Yes | OK |

**30/30 documented env vars present in code. 0 documented vars missing from code.**

### Undocumented Env Vars Found in Code

| Variable | Context | Action Needed |
|----------|---------|---------------|
| `ICEBERG_TOKEN` | Unknown integration | Investigate — document if production |
| `SVIX_SERVER_URL` | Webhook infrastructure | Document if production dependency |
| `SVIX_TOKEN` | Webhook infrastructure | Document if production dependency |
| `BOOK_LANG` | Template generation | Document if production dependency |
| `HOST` | Dev server binding | Low priority (dev-only) |
| `MY_SERVER_PORT` | Dev server port | Low priority (dev-only) |
| `TESTPLATFORM_CLIENT_ID` | Test fixtures | No action (test-only) |
| `TESTPLATFORM_CLIENT_SECRET` | Test fixtures | No action (test-only) |

### Design System Token Accuracy

- **Color tokens**: 50/51 documented — `--color-complement` base token defined in `:root` and `@theme` but missing explicit dark override in `[data-theme="dark"]` block
- **Animations**: 17/18 documented — `animate-hex-cell-in` exists but duration undocumented; `animate-shimmer-sweep` missing from animation table
- **All hex values verified accurate** against `globals.css`
- **Dimension colors**: 10/10 match
- **Archetype colors**: 7/7 match

## Recommendations

### Priority 1 — Fix Stale Route Methods (5 mismatches)
1. Update `/api/notifications/unsubscribe` in CLAUDE.md from POST to GET
2. Update `/api/cli/auth/poll` from GET|POST to GET
3. Update `/api/admin/feature-flags` from GET|PATCH to PATCH
4. Update `/api/admin/engagement-flags` from GET|PUT to GET
5. Update `/api/admin/agents/run` from POST to POST|GET|DELETE

### Priority 2 — Document Missing Route
6. Add `POST /api/telemetry` to CLAUDE.md Key Routes section

### Priority 3 — Add JSDoc to Complex Functions (3 P1 items)
7. `lib/validation.ts::isValidTelemetryPayload` (43 lines)
8. `lib/validation.ts::isValidBadgeConfig` (17 lines)
9. `lib/dashboard/generate-insights.ts::generateInsights` (>30 lines, core feature)

### Priority 4 — Investigate Undocumented Env Vars
10. Determine if `ICEBERG_TOKEN`, `SVIX_SERVER_URL`, `SVIX_TOKEN`, `BOOK_LANG` are production dependencies and document accordingly

### Priority 5 — Design System Polish
11. Add `animate-shimmer-sweep` to animation table in design-system.md
12. Clarify `animate-hex-cell-in` duration (0.45s) in design-system.md

### Priority 6 — JSDoc for Campaign & Email Functions (8 P2 items)
13. Add JSDoc to `lib/db/campaigns.ts` (4 complex functions at 9% coverage)
14. Add JSDoc to `lib/email/score-bump.ts` and `lib/email/templates/announcement.ts`
