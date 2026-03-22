# Documentation Report
> Generated: 2026-03-20 | Health status: **yellow**

## Executive Summary
Documentation is mostly accurate (env vars 100%, design tokens 98%, docs all present) but route coverage remains low at ~65% — 20+ routes including the entire campaigns API, platform connect/disconnect/status endpoints, OG images, and LLM endpoints are undocumented. Two HTTP method mismatches and two phantom routes need correction.

---

## Route Documentation

### Pages

| Route | Documented in CLAUDE.md | Actually Exists | Status |
|-------|:-----------------------:|:---------------:|--------|
| GET `/` | ✓ | ✓ | OK |
| GET `/studio` | ✓ | ✓ | OK |
| GET `/admin` | ✓ | ✓ | OK |
| GET `/u/:handle` | ✓ | ✓ | OK |
| GET `/u/:handle/badge.svg` | ✓ | ✓ | OK |
| GET `/verify/:hash` | ✓ | ✓ | OK |
| GET `/about` | ✓ | ✓ | OK |
| GET `/about/scoring` | ✓ | ✓ | OK |
| GET `/about/verification` | ✓ | ✓ | OK |
| GET `/archetypes/:type` | ✓ | ✓ (builder, guardian, marathoner, polymath, balanced, emerging) | OK |
| GET `/generating/:handle` | ✓ | ✓ | OK |
| GET `/cli/authorize` | ✓ | ✓ | OK |
| GET `/privacy` | ✓ | ✓ | OK |
| GET `/terms` | ✓ | ✓ | OK |
| GET `/coming-soon` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/experiments/*` (13 pages) | ✗ | ✓ | **MISSING_DOCS** |
| GET `/verify` (page) | ✗ | ✓ | **MISSING_DOCS** |

### Auth API

| Route | Documented in CLAUDE.md | Actually Exists | Status |
|-------|:-----------------------:|:---------------:|--------|
| GET `/api/auth/login` | ✓ | ✓ | OK |
| GET `/api/auth/callback` | ✓ | ✓ | OK |
| GET `/api/auth/session` | ✓ | ✓ | OK |
| POST `/api/auth/logout` | ✓ | ✓ | OK |
| GET `/api/auth/bitbucket/login` | ✓ | ✗ | **PHANTOM** — route doesn't exist |
| GET `/api/auth/bitbucket/callback` | ✓ | ✓ | OK |
| GET `/api/auth/bitbucket/connect` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/api/auth/bitbucket/disconnect` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/api/auth/bitbucket/status` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/api/auth/codeberg/login` | ✓ | ✗ | **PHANTOM** — route doesn't exist |
| GET `/api/auth/codeberg/callback` | ✓ | ✓ | OK |
| GET `/api/auth/codeberg/connect` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/api/auth/codeberg/disconnect` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/api/auth/codeberg/status` | ✗ | ✓ | **MISSING_DOCS** |

### Public API

| Route | Documented in CLAUDE.md | Actually Exists | Status |
|-------|:-----------------------:|:---------------:|--------|
| GET `/api/verify/:hash` | ✓ | ✓ | OK |
| GET `/api/history/:handle` | ✓ | ✓ | OK |
| GET `/api/health` | ✓ | ✓ | OK |
| GET `/api/feature-flags` | ✓ | ✓ | OK |

### Authenticated API

| Route | Documented in CLAUDE.md | Actually Exists | Status |
|-------|:-----------------------:|:---------------:|--------|
| POST `/api/supplemental` | ✓ | ✓ | OK |
| GET\|PUT `/api/studio/config` | ✓ | ✓ | OK |
| POST `/api/refresh` | ✓ | ✓ | OK |
| POST `/api/generate` | ✓ | ✓ | OK |
| POST `/api/recalculate` | ✓ | ✓ | OK |
| GET `/api/insights/:handle` | ✓ | ✓ | OK |
| POST `/api/insights` | ✓ | ✓ | OK |
| GET\|POST `/api/cli/auth/poll` | ✓ | ✓ | OK |
| POST `/api/cli/auth/approve` | ✓ | ✓ | OK |

### Admin API

| Route | Documented in CLAUDE.md | Actually Exists | Status |
|-------|:-----------------------:|:---------------:|--------|
| GET `/api/admin/users` | ✓ | ✓ | OK |
| GET `/api/admin/stats` | ✓ | ✓ | OK |
| POST `/api/admin/agents/run` | ✓ | ✓ | OK |
| GET `/api/admin/agents-summary` | ✓ | ✓ | OK |
| GET\|PUT `/api/admin/feature-flags` | ✓ | ✓ (GET\|PATCH) | **MISMATCH** — docs say PUT, code is PATCH |
| GET\|PUT `/api/admin/engagement-flags` | ✓ | ✓ (GET only) | **MISMATCH** — docs say GET\|PUT, code has GET only |
| POST `/api/notifications/unsubscribe` | ✓ | ✓ | OK |
| GET\|POST `/api/admin/campaigns` | ✗ | ✓ | **MISSING_DOCS** |
| GET\|PATCH\|DELETE `/api/admin/campaigns/:id` | ✗ | ✓ | **MISSING_DOCS** |
| POST `/api/admin/campaigns/:id/preview` | ✗ | ✓ | **MISSING_DOCS** |
| POST `/api/admin/campaigns/:id/send` | ✗ | ✓ | **MISSING_DOCS** |

### Webhooks, Cron & Special

| Route | Documented in CLAUDE.md | Actually Exists | Status |
|-------|:-----------------------:|:---------------:|--------|
| POST `/api/webhooks/resend` | ✓ | ✓ | OK |
| GET `/api/cron/warm-cache` | ✓ | ✓ | OK |
| POST `/api/telemetry` | ✓ | ✓ | OK |
| GET `/api/cron/process-campaigns` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/api/cron/sync-audience` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/.well-known/security.txt` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/og-image` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/u/:handle/og-image` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/llms.txt` | ✗ | ✓ | **MISSING_DOCS** |
| GET `/llms-full.txt` | ✗ | ✓ | **MISSING_DOCS** |

### Route Summary
- **Documented & exist**: 38 routes — OK
- **Undocumented**: 20+ routes (campaigns API, platform connect/disconnect/status, crons, OG images, LLM endpoints, experiments, coming-soon)
- **Phantom routes** (documented but don't exist): 2 (`/api/auth/bitbucket/login`, `/api/auth/codeberg/login`)
- **Method mismatches**: 2 (`feature-flags` PUT→PATCH, `engagement-flags` missing PUT)

---

## Design System Token Accuracy

| Area | Documented | In CSS | Status |
|------|:----------:|:------:|--------|
| Color tokens | 50 | 51 | **98%** — `--color-complement` base token undocumented (light variant documented) |
| Animation classes | 17 | 18 | **94%** — `animate-hex-cell-in` undocumented |
| Hex values | All match | — | OK |

### Discrepancies
1. **`--color-complement`** (`#10B981`) — base token exists in CSS, only `-light` variant in docs
2. **`animate-hex-cell-in`** — fully implemented (keyframe + utility class) but not in docs table
3. **`animate-shimmer-sweep`** — documented but has NO utility class (keyframe only)
4. **`animate-terminal-type`** — documented but has NO utility class (keyframe only, used inline per-element)

---

## Stale Documentation

| Document | Issue | Severity |
|----------|-------|----------|
| CLAUDE.md — Auth API | Documents `/api/auth/bitbucket/login` and `/api/auth/codeberg/login` which don't exist; actual routes are `/connect`, `/disconnect`, `/status` | HIGH |
| CLAUDE.md — Admin API | `feature-flags` documented as GET\|PUT, code is GET\|PATCH; `engagement-flags` documented as GET\|PUT, code is GET only | MEDIUM |
| CLAUDE.md — Archetypes | Lists "artificer" in archetype list but no `/archetypes/artificer` page exists | LOW |
| design-system.md | Missing `--color-complement` base token and `animate-hex-cell-in` animation | LOW |

---

## Missing Documentation

### Undocumented Routes (20+)
1. **Campaign Management API** (7 routes): `/api/admin/campaigns`, `/api/admin/campaigns/:id`, preview, send
2. **Campaign Cron Jobs** (2 routes): `/api/cron/process-campaigns`, `/api/cron/sync-audience`
3. **Platform Connect/Disconnect/Status** (6 routes): Bitbucket + Codeberg connect, disconnect, status
4. **OG Image Routes** (2): `/og-image`, `/u/:handle/og-image`
5. **LLM Endpoints** (2): `/llms.txt`, `/llms-full.txt`
6. **Well-known** (1): `/.well-known/security.txt`
7. **Pages**: `/coming-soon`, `/verify` (page), `/experiments/*`

### Undocumented Complex Functions (4 critical)
| Function | File | Lines | Why it matters |
|----------|------|-------|----------------|
| `isValidTelemetryPayload()` | `lib/utils/validation.ts:85` | ~40 | Complex nested validation, no JSDoc |
| `isValidStatsShape()` | `lib/utils/validation.ts:133` | ~45 | Complex object validation, no JSDoc |
| `isValidInsightsUpload()` | `lib/insights/validation.ts:5` | ~130 | Largest undocumented function in codebase |
| `fetchContributionData()` | `lib/github/queries.ts:13` | ~60 | Core GraphQL fetch, complex data transform |

### JSDoc Coverage
- **Overall**: ~78% of exported functions in `lib/` have JSDoc
- **Well-documented areas**: auth (100%), render (100%), history (95%), impact (100%), cache (95%)
- **Gaps**: validation functions, agent report parsers, some utility helpers

---

## Environment Variables

| Variable | In CLAUDE.md | Used in Code | In .env.example | Status |
|----------|:------------:|:------------:|:---------------:|--------|
| GITHUB_CLIENT_ID | ✓ | ✓ | ✓ | OK |
| GITHUB_CLIENT_SECRET | ✓ | ✓ | ✓ | OK |
| NEXTAUTH_SECRET | ✓ | ✓ | ✓ | OK |
| NEXT_PUBLIC_BASE_URL | ✓ | ✓ | ✓ | OK |
| UPSTASH_REDIS_REST_URL | ✓ | ✓ | ✓ | OK |
| UPSTASH_REDIS_REST_TOKEN | ✓ | ✓ | ✓ | OK |
| SUPABASE_URL | ✓ | ✓ | ✓ | OK |
| SUPABASE_SERVICE_ROLE_KEY | ✓ | ✓ | ✓ | OK |
| NEXT_PUBLIC_POSTHOG_KEY | ✓ | ✓ | ✓ | OK |
| NEXT_PUBLIC_POSTHOG_HOST | ✓ | ✓ | ✓ | OK |
| RESEND_API_KEY | ✓ | ✓ | ✓ | OK |
| RESEND_WEBHOOK_SECRET | ✓ | ✓ | ✓ | OK |
| SUPPORT_FORWARD_EMAIL | ✓ | ✓ | ✓ | OK |
| GITHUB_TOKEN | ✓ | ✓ | ✓ | OK |
| CHAPA_VERIFICATION_SECRET | ✓ | ✓ | ✓ | OK |
| NEXT_PUBLIC_STUDIO_ENABLED | ✓ | ✓ | ✓ | OK |
| NEXT_PUBLIC_EXPERIMENTS_ENABLED | ✓ | ✓ | ✓ | OK |
| NEXT_PUBLIC_INSIGHTS_ENABLED | ✓ | ✓ | ✓ | OK |
| BITBUCKET_CLIENT_ID | ✓ | ✓ | ✓ | OK |
| BITBUCKET_CLIENT_SECRET | ✓ | ✓ | ✓ | OK |
| NEXT_PUBLIC_BITBUCKET_ENABLED | ✓ | ✓ | ✓ | OK |
| CODEBERG_CLIENT_ID | ✓ | ✓ | ✓ | OK |
| CODEBERG_CLIENT_SECRET | ✓ | ✓ | ✓ | OK |
| NEXT_PUBLIC_CODEBERG_ENABLED | ✓ | ✓ | ✓ | OK |
| ADMIN_HANDLES | ✓ | ✓ | ✓ | OK |
| ADMIN_SECRET | ✓ | ✓ | ✓ | OK |
| ALLOW_AGENT_RUN | ✓ | ✓ | ✓ | OK |
| CRON_SECRET | ✓ | ✓ | ✓ | OK |
| VERCEL_ENV | ✓ | ✓ | (commented) | OK |
| ANALYZE | ✓ | ✓ | (commented) | OK |

**30/30 project-specific env vars fully consistent** across CLAUDE.md, codebase, and .env.example. All sensitive vars use `.trim()`. No mismatches.

---

## Required Documents

| Document | Exists | Non-empty | Status |
|----------|:------:|:---------:|--------|
| `docs/impact-v4.md` | ✓ | ✓ (6.7K) | OK — marked deprecated, references v6 |
| `docs/impact-v5.md` | ✓ | ✓ (5.1K) | OK — marked superseded by v6 |
| `docs/impact-v6.md` | ✓ | ✓ (8.9K) | OK — current spec |
| `docs/svg-design.md` | ✓ | ✓ (6.0K) | OK |
| `docs/agents/shared-context.md` | ✓ | ✓ (12.1K) | OK — 7 entries, latest 2026-03-19 |
| `README.md` | ✓ | ✓ (195 lines) | OK — full setup instructions |

---

## Recommendations

### Priority 1 — Fix stale/incorrect docs
1. **Update Bitbucket/Codeberg auth routes** in CLAUDE.md: replace phantom `/login` routes with actual `/connect`, `/disconnect`, `/status` pattern
2. **Fix method mismatches**: `feature-flags` PUT→PATCH, `engagement-flags` remove PUT

### Priority 2 — Document new features
3. **Add Campaign Management API** to CLAUDE.md (7 routes + 2 cron jobs)
4. **Add OG image routes**, LLM endpoints, and `/.well-known/security.txt`
5. **Add `--color-complement`** base token and `animate-hex-cell-in` to design-system.md

### Priority 3 — JSDoc gaps
6. **Add JSDoc** to 4 critical validation/query functions (`isValidTelemetryPayload`, `isValidStatsShape`, `isValidInsightsUpload`, `fetchContributionData`)

### Priority 4 — Low-priority cleanup
7. Decide whether `/archetypes/artificer` page should be created or removed from archetype list
8. Clarify `animate-shimmer-sweep` and `animate-terminal-type` — either add utility classes or update docs to note they're keyframe-only
