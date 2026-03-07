# Documentation Report
> Generated: 2026-03-06 | Health status: YELLOW

## Executive Summary

Documentation foundation is solid -- all core spec files exist, env vars are 100% aligned with code, and README has proper setup instructions. However, **67 of 78 routes are undocumented** in CLAUDE.md, the design system doc is missing 15 color tokens and 9 animations actually in use, and 18 complex exported functions in `lib/` lack JSDoc comments. The `/api/studio/config` route documents POST but the implementation exports GET + PUT.

## Route Documentation

**Total routes in codebase: 78 | Documented in CLAUDE.md: 11 | Coverage: 14%**

### Routes Documented in CLAUDE.md

| Route | File | Methods | Documented | Status |
|-------|------|---------|------------|--------|
| `/` | `app/page.tsx` | GET | Yes | OK |
| `/studio` | `app/studio/page.tsx` | GET | Yes | OK |
| `/admin` | `app/admin/page.tsx` | GET | Yes | OK |
| `/u/:handle` | `app/u/[handle]/page.tsx` | GET | Yes | OK |
| `/u/:handle/badge.svg` | `app/u/[handle]/badge.svg/route.ts` | GET | Yes | OK |
| `/api/verify/:hash` | `app/api/verify/[hash]/route.ts` | GET, OPTIONS | Yes | OK |
| `/api/admin/users` | `app/api/admin/users/route.ts` | GET | Yes | OK |
| `/api/supplemental` | `app/api/supplemental/route.ts` | POST | Yes | OK |
| `/api/studio/config` | `app/api/studio/config/route.ts` | GET, PUT | POST documented | **STALE** -- actual methods are GET + PUT, not POST |
| `/api/refresh` | `app/api/refresh/route.ts` | POST | Yes | OK |
| `/api/history/:handle` | `app/api/history/[handle]/route.ts` | GET | Yes | OK |

### Undocumented Routes (67 total)

**Auth routes (12):**
`/api/auth/login` (GET), `/api/auth/logout` (POST), `/api/auth/session` (GET), `/api/auth/callback` (GET), `/api/auth/bitbucket/callback` (GET), `/api/auth/bitbucket/connect` (GET), `/api/auth/bitbucket/disconnect` (POST), `/api/auth/bitbucket/status` (GET), `/api/auth/codeberg/callback` (GET), `/api/auth/codeberg/connect` (GET), `/api/auth/codeberg/disconnect` (POST), `/api/auth/codeberg/status` (GET)

**Admin routes (4):**
`/api/admin/agents-summary` (GET), `/api/admin/agents/run` (POST), `/api/admin/engagement-flags` (GET/PATCH), `/api/admin/feature-flags` (GET/PATCH), `/api/admin/stats` (GET)

**CLI routes (3):**
`/cli/authorize` (page), `/api/cli/auth/approve` (POST), `/api/cli/auth/poll` (GET)

**Infrastructure routes (5):**
`/api/cron/warm-cache` (GET), `/api/health` (GET), `/api/feature-flags` (GET), `/api/telemetry` (POST), `/api/generate` (POST)

**Webhook/email routes (2):**
`/api/webhooks/resend` (POST), `/api/notifications/unsubscribe` (GET)

**Content pages (19):**
`/about`, `/about/scoring`, `/about/verification`, `/privacy`, `/terms`, `/coming-soon`, `/verify`, `/verify/:hash`, `/generating/:handle`, 6 archetype pages (`/archetypes/{balanced,builder,emerging,guardian,marathoner,polymath}`)

**OG/metadata routes (4):**
`/u/:handle/og-image`, `/og-image`, `/llms.txt`, `/llms-full.txt`, `/.well-known/security.txt`

**Experiment pages (13):**
13 pages under `/experiments/*` (feature-flagged, non-production)

## Stale Documentation

| Document | Issue | Severity |
|----------|-------|----------|
| **CLAUDE.md** | `/api/studio/config` documented as POST -- actual implementation exports GET + PUT | Medium |
| **CLAUDE.md** | "Quality Champion" listed as archetype but code uses "Guardian" (see archetype pages) | Medium |
| **design-system.md** | `--color-complement` (#10B981) documented but **missing from globals.css** | Medium |
| **design-system.md** | 15 color tokens in globals.css not documented (8 dimension + 6 archetype + 1 track) | Medium |
| **design-system.md** | 9 animation classes in globals.css not documented | Medium |
| **design-system.md** | `--font-terminal` variable exists in globals.css but not documented | Low |
| **docs/badge-svg-spec-v1.2.md:905** | TODO: reference PNG screenshot never captured | Low |

## Missing Documentation

### Undocumented Exports (18 complex functions lacking JSDoc)

**Priority 1 -- Security & Core Logic:**
| Function | File | Why Critical |
|----------|------|-------------|
| `validateState()` | `lib/auth/github.ts:49` | CSRF validation with timing-safe comparison |
| `exchangeCodeForToken()` | `lib/auth/github.ts:74` | OAuth token exchange |
| `encryptToken()` | `lib/auth/github.ts:170` | AES-256-GCM encryption |
| `decryptToken()` | `lib/auth/github.ts:183` | AES-256-GCM decryption |
| `readSessionCookie()` | `lib/auth/github.ts:239` | Cookie parsing + validation + decryption |
| `computeConfidence()` | `lib/impact/utils.ts:52` | 99-line scoring function with 8 penalty conditions |
| `computeAdjustedScore()` | `lib/impact/utils.ts:156` | Non-obvious formula: `0.85 + 0.15 * (confidence/100)` |
| `mergeStats()` | `lib/github/merge.ts:18` | 42-line cross-platform stats aggregation |

**Priority 2 -- Data & Rendering:**
| Function | File | Why Critical |
|----------|------|-------------|
| `rowToSnapshot()` | `lib/db/snapshots.ts:49` | 44-line DB row mapping with defaults |
| `dbGetLatestSnapshotBatch()` | `lib/db/snapshots.ts:270` | Batch query with deduplication logic |
| `renderRadarChart()` | `lib/render/RadarChart.ts:16` | 76-line SVG with trigonometry |
| `buildHeatmapCells()` | `lib/render/heatmap.ts:16` | Cell layout math + animation delays |
| `buildStatsFromBitbucket()` | `lib/bitbucket/stats-aggregation.ts:9` | 85-line aggregation pipeline |

**Priority 3 -- Validation & Utility:**
| Function | File | Why Critical |
|----------|------|-------------|
| `isValidTelemetryPayload()` | `lib/validation.ts:65` | 41-line nested validation |
| `isValidStatsShape()` | `lib/validation.ts:113` | 42-line shape validation (13+ fields) |
| `comboMatches()` | `lib/keyboard/shortcuts.ts:147` | 33-line keyboard matching logic |
| `dbStoreVerification()` | `lib/db/verification.ts:102` | Upsert with handle normalization |
| `getRedis()` | `lib/cache/redis.ts:20` | Lazy singleton initialization |

### Missing Documentation Files
- No `docs/api-reference.md` exists -- 32 API routes lack centralized documentation
- No CLI authorization flow documentation

### Overall JSDoc Coverage
- Total exported functions in `lib/`: **89**
- With JSDoc: **71 (80%)**
- Missing JSDoc (complex): **18 (20%)**

## Environment Variables

**Total documented: 29 | Total used in code: 29 | Mismatches: 0**

All documented environment variables are actively used in the codebase. Auto-injected vars (`NODE_ENV`, `CI`) are correctly omitted from docs since they're platform-provided.

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

## Design System Drift

### Color Tokens
- **Documented & matching**: 19/20 tokens match between `design-system.md` and `globals.css`
- **Documented but missing from code**: `--color-complement` (#10B981) -- documented but not defined in globals.css
- **In code but undocumented** (15 tokens):
  - 8 dimension colors: `--color-dimension-{delivery,quality,consistency,breadth}` + light variants
  - 6 archetype colors: `--color-archetype-{builder,guardian,marathoner,polymath,balanced,emerging}`
  - 1 utility: `--color-track`

### Animations
- **Documented & matching**: 7/7 documented animations present in code
- **In code but undocumented** (9 animations): `animate-float-medium`, `animate-float-fast`, `animate-drift`, `animate-gauge-fill`, `animate-bar-fill`, `animate-terminal-type`, sparkline animation, `animate-shimmer-sweep`, radar-expand

### Typography
- **Documented & matching**: `--font-heading` (JetBrains Mono), `--font-body` (Plus Jakarta Sans)
- **Undocumented**: `--font-terminal` (alias for JetBrains Mono with different fallbacks)

## Recommendations

### High Priority
1. **Fix `/api/studio/config` documentation** -- CLAUDE.md says POST, code exports GET + PUT
2. **Add dimension & archetype color tokens to design-system.md** -- 15 tokens actively used in rendering but invisible to the design spec
3. **Resolve `--color-complement` ghost token** -- documented but doesn't exist in code. Either add to `globals.css` or remove from docs
4. **Add JSDoc to security-critical auth functions** -- `encryptToken`, `decryptToken`, `validateState`, `readSessionCookie` in `lib/auth/github.ts`

### Medium Priority
5. **Document undocumented animations** -- 9 animation classes in globals.css missing from design-system.md
6. **Add JSDoc to scoring functions** -- `computeConfidence()` (99 lines, 8 penalty conditions) and `computeAdjustedScore()` have no documentation
7. **Create `docs/api-reference.md`** -- centralized reference for all 32 API routes with methods, parameters, auth requirements
8. **Update CLAUDE.md key routes section** -- add auth, admin, CLI, cron, health routes (most impactful ones)

### Low Priority
9. **Document `--font-terminal` CSS variable** in design-system.md
10. **Capture badge reference PNG** per TODO in `docs/badge-svg-spec-v1.2.md:905`
11. **Add JSDoc to validation functions** in `lib/validation.ts` (41-line telemetry validator, 42-line stats shape validator)
12. **Verify "Quality Champion" vs "Guardian" archetype naming** -- CLAUDE.md lists "Quality Champion" but codebase has `/archetypes/guardian`
