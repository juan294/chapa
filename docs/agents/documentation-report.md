# Documentation Report
> Generated: 2026-03-13 | Health status: **YELLOW**

## Executive Summary

Documentation is structurally complete — all 7 required doc files exist, README has full setup instructions, and 29/30 env vars are documented. However, route documentation covers only 11 of 54 routes (20%), 1 env var is undocumented (`NEXT_PUBLIC_INSIGHTS_ENABLED`), JSDoc coverage sits at 80% with 18 complex functions missing docs, and 1 design-system color token (`--color-complement`) remains undocumented. The `/api/studio/config` method mismatch (docs say POST, code exports GET+PUT) persists from the previous audit.

## Route Documentation

| Route | Documented in CLAUDE.md | Has API docs | Status |
|-------|------------------------|-------------|--------|
| `/` | Yes | N/A (page) | ✅ Match |
| `/studio` | Yes | N/A (page) | ✅ Match |
| `/admin` | Yes | N/A (page) | ✅ Match |
| `/u/:handle` | Yes | N/A (page) | ✅ Match |
| `/u/:handle/badge.svg` | Yes | Yes | ✅ Match |
| `/api/verify/:hash` | Yes | Yes | ✅ Match (OPTIONS undocumented) |
| `/api/admin/users` | Yes | Yes | ✅ Match |
| `/api/supplemental` | Yes | Yes | ✅ Match |
| `/api/studio/config` | Partial | Yes | ⚠️ Mismatch — docs say POST, code exports GET+PUT |
| `/api/refresh` | Yes | Yes | ✅ Match |
| `/api/history/:handle` | Yes | Yes | ✅ Match |
| `/generating/:handle` | No | No | ❌ Undocumented |
| `/verify`, `/verify/:hash` | No | No | ❌ Undocumented |
| `/cli/authorize` | No | No | ❌ Undocumented |
| `/about`, `/about/verification`, `/about/scoring` | No | No | ❌ Undocumented |
| `/coming-soon`, `/privacy`, `/terms` | No | No | ❌ Undocumented |
| `/archetypes/*` (7 routes) | No | No | ❌ Undocumented |
| `/experiments/*` (13 routes) | No | No | ❌ Undocumented (feature-gated) |
| `/u/:handle/og-image` | No | No | ❌ Undocumented |
| `/.well-known/security.txt` | No | No | ❌ Undocumented |
| `/llms.txt`, `/llms-full.txt` | No | No | ❌ Undocumented |
| `/og-image` | No | No | ❌ Undocumented |
| `/api/health` | Mentioned in guardrails | No formal entry | ⚠️ Partial |
| `/api/auth/login` | No | No | ❌ Undocumented |
| `/api/auth/callback` | No | No | ❌ Undocumented |
| `/api/auth/session` | No | No | ❌ Undocumented |
| `/api/auth/logout` | No | No | ❌ Undocumented |
| `/api/auth/bitbucket/*` (4 routes) | No | No | ❌ Undocumented |
| `/api/auth/codeberg/*` (4 routes) | No | No | ❌ Undocumented |
| `/api/generate` | No | No | ❌ Undocumented |
| `/api/recalculate` | No | No | ❌ Undocumented |
| `/api/insights/:handle` | No | No | ❌ Undocumented |
| `/api/insights` (POST) | No | No | ❌ Undocumented |
| `/api/cli/auth/poll`, `/api/cli/auth/approve` | No | No | ❌ Undocumented |
| `/api/admin/stats` | No | No | ❌ Undocumented |
| `/api/admin/agents/run` | No | No | ❌ Undocumented |
| `/api/admin/agents-summary` | No | No | ❌ Undocumented |
| `/api/admin/feature-flags` | No | No | ❌ Undocumented |
| `/api/admin/engagement-flags` | No | No | ❌ Undocumented |
| `/api/feature-flags` | No | No | ❌ Undocumented |
| `/api/notifications/unsubscribe` | No | No | ❌ Undocumented |
| `/api/cron/warm-cache` | No | No | ❌ Undocumented |
| `/api/webhooks/resend` | No | No | ❌ Undocumented |
| `/api/telemetry` | No | No | ❌ Undocumented |

**Summary**: 11/54 routes documented (20%). All 11 documented routes exist and are accurate except `/api/studio/config` method mismatch.

## Stale Documentation

| Document | Issue | Severity |
|----------|-------|----------|
| CLAUDE.md "Key routes" | `/api/studio/config` listed as POST — code exports GET+PUT | Medium |
| CLAUDE.md "Key routes" | Only 11 of 54 routes listed — major expansion since initial docs | Medium |
| CLAUDE.md archetypes | Lists "Quality Champion" — codebase uses `/archetypes/guardian` | Low |
| `docs/badge-svg-spec-v1.2.md:905` | TODO: capture reference PNG still outstanding | Low |
| `docs/design-system.md` | `--color-complement` token missing from color table | Low |

## Missing Documentation

### Undocumented Env Var
| Variable | Used In | Status |
|----------|---------|--------|
| `NEXT_PUBLIC_INSIGHTS_ENABLED` | `lib/feature-flags.ts:33,80` | ❌ Missing from CLAUDE.md and .env.example |

### Functions Lacking JSDoc (18 of 89 exported — 80% coverage)

**Auth/Crypto (high priority — security-critical):**
- `lib/auth/github.ts`: `createSessionCookie()`, `readSessionCookie()`, `clearSessionCookie()`
- `lib/auth/bitbucket.ts`: `computeTokenExpiry()`, `isTokenExpired()`
- `lib/auth/codeberg.ts`: similar token lifecycle functions

**Scoring/Impact (medium priority — complex formulas):**
- `lib/impact/v4.ts`: `computeDelivery()`, `computeQuality()`, `computeSoloQuality()`, `computeConsistency()`, `computeBreadth()`, `deriveArchetype()`

**Data Merging (medium priority — non-obvious logic):**
- `lib/github/merge.ts`: `mergeStats()`, `mergeHeatmap()`, `mergeOptionalMax()`

**Rendering (low priority):**
- `lib/render/RadarChart.ts`: `renderRadarChart()`
- `lib/render/heatmap.ts`: heatmap grid rendering functions
- `lib/render/escape.ts`: `escapeXml()` (has examples but no formal JSDoc)

**History (low priority):**
- `lib/history/history.ts`: `getTrendData()`, `getDiff()`

## Environment Variables

| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
| GITHUB_CLIENT_ID | ✅ | ✅ | ✅ Match |
| GITHUB_CLIENT_SECRET | ✅ | ✅ | ✅ Match |
| NEXTAUTH_SECRET | ✅ | ✅ | ✅ Match |
| NEXT_PUBLIC_BASE_URL | ✅ | ✅ | ✅ Match |
| UPSTASH_REDIS_REST_URL | ✅ | ✅ | ✅ Match |
| UPSTASH_REDIS_REST_TOKEN | ✅ | ✅ | ✅ Match |
| SUPABASE_URL | ✅ | ✅ | ✅ Match |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | ✅ | ✅ Match |
| NEXT_PUBLIC_POSTHOG_KEY | ✅ | ✅ | ✅ Match |
| NEXT_PUBLIC_POSTHOG_HOST | ✅ | ✅ | ✅ Match |
| RESEND_API_KEY | ✅ | ✅ | ✅ Match |
| RESEND_WEBHOOK_SECRET | ✅ | ✅ | ✅ Match |
| SUPPORT_FORWARD_EMAIL | ✅ | ✅ | ✅ Match |
| GITHUB_TOKEN | ✅ | ✅ | ✅ Match |
| CHAPA_VERIFICATION_SECRET | ✅ | ✅ | ✅ Match |
| NEXT_PUBLIC_STUDIO_ENABLED | ✅ | ✅ | ✅ Match |
| NEXT_PUBLIC_EXPERIMENTS_ENABLED | ✅ | ✅ | ✅ Match |
| BITBUCKET_CLIENT_ID | ✅ | ✅ | ✅ Match |
| BITBUCKET_CLIENT_SECRET | ✅ | ✅ | ✅ Match |
| NEXT_PUBLIC_BITBUCKET_ENABLED | ✅ | ✅ | ✅ Match |
| CODEBERG_CLIENT_ID | ✅ | ✅ | ✅ Match |
| CODEBERG_CLIENT_SECRET | ✅ | ✅ | ✅ Match |
| NEXT_PUBLIC_CODEBERG_ENABLED | ✅ | ✅ | ✅ Match |
| ADMIN_HANDLES | ✅ | ✅ | ✅ Match |
| ADMIN_SECRET | ✅ | ✅ | ✅ Match |
| ALLOW_AGENT_RUN | ✅ | ✅ | ✅ Match |
| CRON_SECRET | ✅ | ✅ | ✅ Match |
| VERCEL_ENV | ✅ | ✅ | ✅ Match |
| ANALYZE | ✅ | ✅ | ✅ Match |
| **NEXT_PUBLIC_INSIGHTS_ENABLED** | ❌ | ✅ | ⚠️ **Undocumented** |

**29/30 match. 1 undocumented variable. 0 secrets exposed via NEXT_PUBLIC_.**

### Housekeeping Notes
- `NEXT_PUBLIC_POSTHOG_PROJECT_ID` exists in `.env.local` but is never used in code — dead variable, safe to remove.
- `NODE_ENV` and `CI` are standard runtime vars, not project-specific — omission from CLAUDE.md is acceptable.

## Design System Token Audit

| Category | Total in Code | Documented | Match Rate |
|----------|--------------|-----------|-----------|
| Color tokens | 31 | 30 | 96.8% |
| Animation keyframes | 17 | 17 | 100% |
| Typography tokens | 3 | 3 | 100% |
| **Overall** | **51** | **50** | **98.0%** |

**Missing**: `--color-complement` (`#10B981`) — exists in `globals.css` but not in `design-system.md` color table.

**Previous issue resolved**: Last audit flagged 15 undocumented tokens (8 dimension + 6 archetype + 1 track). All dimension and archetype tokens are now documented. Only `--color-complement` remains.

**All hex values accurate** — no drift between `globals.css` and `design-system.md` for documented tokens.

## Required Documentation Files

| File | Status | Notes |
|------|--------|-------|
| `docs/impact-v4.md` | ✅ Present (6.7 KB) | Historical reference, marked deprecated |
| `docs/impact-v5.md` | ✅ Present (5.1 KB) | Superseded by v6, calibrations still apply |
| `docs/impact-v6.md` | ✅ Present (8.9 KB) | Current spec truth |
| `docs/svg-design.md` | ✅ Present (6.0 KB) | Badge layout and rendering spec |
| `docs/accepted-risks.md` | ✅ Present (7.4 KB) | 10 risks, last reviewed 2026-02-24 |
| `docs/agents/shared-context.md` | ✅ Present (13 KB) | Recent entries (2026-03-13) |
| `README.md` | ✅ Present (195 lines) | Full setup, features, env vars, commands |

## Recommendations

### P1 — Correctness (fix now)
1. **Fix `/api/studio/config` method in CLAUDE.md** — change POST to GET|PUT to match code. Carried from 2026-03-06 audit.
2. **Add `NEXT_PUBLIC_INSIGHTS_ENABLED` to CLAUDE.md** env vars section and `.env.example` with description: `Set to "true" to enable AI Insights integration (optional, disabled by default)`.

### P2 — Completeness (fix soon)
3. **Add `--color-complement` to `design-system.md`** color table: `#10B981` / `#10B981` / `text-complement`, `bg-complement` / Soft teal accent (sparingly) — verification, secondary CTAs.
4. **Add JSDoc to 6 scoring functions** in `lib/impact/v4.ts` — `computeDelivery()`, `computeQuality()`, `computeSoloQuality()`, `computeConsistency()`, `computeBreadth()`, `deriveArchetype()`. These are core business logic with complex formulas.
5. **Add JSDoc to stats merging functions** in `lib/github/merge.ts` — `mergeStats()`, `mergeHeatmap()`, `mergeOptionalMax()`.
6. **Expand CLAUDE.md "Key routes"** to include at minimum: `/api/health`, `/api/auth/*` (GitHub/Bitbucket/Codeberg flows), `/api/cron/warm-cache`, `/api/insights/:handle`, `/verify/:hash` page, `/api/cli/auth/*`, `/archetypes/*`.

### P3 — Housekeeping (backlog)
7. **Add JSDoc to auth cookie functions** in `lib/auth/github.ts` — `createSessionCookie()`, `readSessionCookie()`, `clearSessionCookie()`.
8. **Capture badge reference PNG** per TODO at `docs/badge-svg-spec-v1.2.md:905`.
9. **Clarify archetype naming** — CLAUDE.md says "Quality Champion", code uses `/archetypes/guardian`. Confirm canonical name.
10. **Remove dead env var** `NEXT_PUBLIC_POSTHOG_PROJECT_ID` from `.env.local`.

### Delta vs Previous Audit (2026-03-06)

| Metric | 2026-03-06 | 2026-03-13 | Change |
|--------|-----------|-----------|--------|
| Documented routes | 11/78 (14%) | 11/54 (20%) | Route count corrected; same 11 documented |
| Design system tokens | 36/51 (70%) | 50/51 (98%) | +14 tokens documented (dimension + archetype) |
| Undocumented animations | 9 | 0 | All animations now documented |
| Env var mismatches | 0 | 1 | `NEXT_PUBLIC_INSIGHTS_ENABLED` added to code |
| JSDoc coverage | 71/89 (80%) | 71/89 (80%) | No change |
| Outstanding TODOs | 1 | 1 | Badge reference PNG still pending |
| `/api/studio/config` mismatch | Yes | Yes | **Still unfixed** |
