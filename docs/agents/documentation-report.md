# Documentation Report
> Generated: 2026-04-17 | Health status: green

## Executive Summary
All 50 API routes, 24 pages, and 33 production environment variables are fully documented and match their implementations. Three minor gaps exist in design-system.md: light-mode values for `--color-dark-section`, `--color-dark-card`, and the four terminal tokens are not listed in the table.

## Route Documentation

### Pages (24 routes)

| Route | Documented in CLAUDE.md | File exists | Status |
|-------|------------------------|-------------|--------|
| `/` | ✓ | `app/page.tsx` | ✓ OK |
| `/studio` | ✓ | `app/studio/page.tsx` | ✓ OK |
| `/admin` | ✓ | `app/admin/page.tsx` | ✓ OK |
| `/u/:handle` | ✓ | `app/u/[handle]/page.tsx` | ✓ OK |
| `/verify/:hash` | ✓ | `app/verify/[hash]/page.tsx` | ✓ OK |
| `/verify` | ✓ | `app/verify/page.tsx` | ✓ OK |
| `/about` | ✓ | `app/about/page.tsx` | ✓ OK |
| `/about/scoring` | ✓ | `app/about/scoring/page.tsx` | ✓ OK |
| `/about/verification` | ✓ | `app/about/verification/page.tsx` | ✓ OK |
| `/archetypes/:type` | ✓ | builder/guardian/marathoner/polymath/artificer/balanced/emerging | ✓ OK |
| `/generating/:handle` | ✓ | `app/generating/[handle]/page.tsx` | ✓ OK |
| `/cli/authorize` | ✓ | `app/cli/authorize/page.tsx` | ✓ OK |
| `/privacy` | ✓ | `app/privacy/page.tsx` | ✓ OK |
| `/terms` | ✓ | `app/terms/page.tsx` | ✓ OK |
| `/coming-soon` | ✓ | `app/coming-soon/page.tsx` | ✓ OK |
| `/experiments/*` | ✓ | 13 experiment pages | ✓ OK |

### API Routes (50 routes)
All 50 `app/api/**/route.ts` files have corresponding entries in CLAUDE.md. Full cross-check confirmed — zero undocumented routes, zero stale entries pointing to non-existent files.

Notable: `/.well-known/security.txt`, `/llms.txt`, `/llms-full.txt`, `/og-image` are implemented as route.ts files outside `/api/` — all documented correctly in CLAUDE.md's Public API section.

## Stale Documentation

| Doc | Issue | Severity |
|-----|-------|----------|
| `docs/design-system.md` | `--color-amber`, `--color-amber-light`, `--color-amber-dark`, `--color-stroke`, `--color-warm-bg/card/stroke`, `--color-dark-section`, `--color-dark-card`, `--color-purple-tint`, `--color-complement-light`, `--color-track` rows are missing the "Light value" column in the color table | Low |
| `docs/design-system.md` | Light values for terminal tokens (`--color-terminal-green: #16A34A`, `--color-terminal-red: #DC2626`, `--color-terminal-yellow: #D97706`, `--color-terminal-dim: #9CA3AF`) exist in `globals.css` `:root` but are not listed in the table — only dark values shown | Low |

No stale routes, no stale env vars, no stale type references found.

## Missing Documentation

- `docs/design-system.md` table: light values for `--color-dark-section` (`#1A1A2E`), `--color-dark-card` (`#252542`), and the four terminal tokens are defined in `globals.css:6–31` but absent from the docs table. The doc text says terminal colors "also have light-appropriate values" but does not enumerate them.

No missing API docs, no missing exported function documentation found.

## Environment Variables

All 33 production environment variables used in code are documented in CLAUDE.md. Audit performed against `process.env.*` references in all non-test `.ts/.tsx` files.

| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
| `GITHUB_CLIENT_ID` | ✓ | `app/api/auth/login/route.ts:42`, `callback/route.ts:85` | ✓ Match |
| `GITHUB_CLIENT_SECRET` | ✓ | `app/api/auth/callback/route.ts:86` | ✓ Match |
| `NEXTAUTH_SECRET` | ✓ | 7 production files | ✓ Match |
| `NEXT_PUBLIC_BASE_URL` | ✓ | `lib/env.ts:9`, auth files | ✓ Match |
| `UPSTASH_REDIS_REST_URL` | ✓ | `lib/cache/redis.ts:23` | ✓ Match |
| `UPSTASH_REDIS_REST_TOKEN` | ✓ | `lib/cache/redis.ts:24` | ✓ Match |
| `SUPABASE_URL` | ✓ | `lib/db/supabase.ts:15` | ✓ Match |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | `lib/db/supabase.ts:16` | ✓ Match |
| `NEXT_PUBLIC_POSTHOG_KEY` | ✓ | `lib/analytics/server-errors.ts:63`, `PostHogProvider.tsx:8` | ✓ Match |
| `NEXT_PUBLIC_POSTHOG_HOST` | ✓ | `lib/analytics/server-errors.ts:64`, `PostHogProvider.tsx:9` | ✓ Match |
| `RESEND_API_KEY` | ✓ | `lib/email/resend.ts:47` | ✓ Match |
| `RESEND_WEBHOOK_SECRET` | ✓ | `lib/email/resend.ts:71` | ✓ Match |
| `SUPPORT_FORWARD_EMAIL` | ✓ | `lib/email/resend.ts:173`, `notifications.ts:40` | ✓ Match |
| `GITHUB_TOKEN` | ✓ | `lib/github/queries.ts:34`, warm-cache route | ✓ Match |
| `CHAPA_VERIFICATION_SECRET` | ✓ | `lib/verification/hmac.ts:46` | ✓ Match |
| `NEXT_PUBLIC_STUDIO_ENABLED` | ✓ | `lib/feature-flags.ts:27` | ✓ Match |
| `NEXT_PUBLIC_EXPERIMENTS_ENABLED` | ✓ | `lib/feature-flags.ts:103` | ✓ Match |
| `NEXT_PUBLIC_INSIGHTS_ENABLED` | ✓ | `lib/feature-flags.ts:57` | ✓ Match |
| `BITBUCKET_CLIENT_ID` | ✓ | `lib/github/client.ts:213` | ✓ Match |
| `BITBUCKET_CLIENT_SECRET` | ✓ | `lib/github/client.ts:214` | ✓ Match |
| `NEXT_PUBLIC_BITBUCKET_ENABLED` | ✓ | `lib/feature-flags.ts:37` | ✓ Match |
| `CODEBERG_CLIENT_ID` | ✓ | `lib/github/client.ts:282` | ✓ Match |
| `CODEBERG_CLIENT_SECRET` | ✓ | `lib/github/client.ts:283` | ✓ Match |
| `NEXT_PUBLIC_CODEBERG_ENABLED` | ✓ | `lib/feature-flags.ts:47` | ✓ Match |
| `ADMIN_HANDLES` | ✓ | `lib/auth/admin.ts:61` | ✓ Match |
| `ADMIN_SECRET` | ✓ | `lib/auth/admin.ts:32` | ✓ Match |
| `ALLOW_AGENT_RUN` | ✓ | `app/api/admin/agents/run/route.ts:75` | ✓ Match |
| `CRON_SECRET` | ✓ | `lib/auth/cron.ts:21` | ✓ Match |
| `WARM_CACHE_PRIORITY_HANDLES` | ✓ | `app/api/cron/warm-cache/route.ts:197` | ✓ Match |
| `VERCEL_ENV` | ✓ | `lib/email/notifications.ts:26` | ✓ Match |
| `ANALYZE` | ✓ | `next.config.ts:5` | ✓ Match |
| `TESTPLATFORM_CLIENT_ID/SECRET` | — | Test-only (`platform-oauth.test.ts`) | ✓ Intentional omission |
| `CI`, `NODE_ENV` | — | Standard build vars | ✓ Intentional omission |

## JSDoc Coverage

Spot-checked `lib/impact/v6.ts` — all 8 exported functions have JSDoc (verified at lines 23–338). Prior documentation agent confirmed 100% JSDoc on all public exports across `lib/impact`, `lib/render`, `lib/cache`, `lib/auth`, `lib/github`, `packages/shared` (2026-04-10). No production code changes since then. Status: **100%**.

No TODO/FIXME comments referencing missing documentation found in production code. Two TODOs found:
- `lib/agents/agent-config.ts:281` — the audit template text embedded in agent config (not a real TODO)
- `components/AuthorTypewriter.tsx:23` — a string literal `"// TODO: fix later"` in mock data, not a code comment

## Required Documents

| Document | Exists | Non-empty | Notes |
|----------|--------|-----------|-------|
| `docs/impact-v4.md` | ✓ | ✓ | Historical spec, correctly marked deprecated |
| `docs/impact-v6.md` | ✓ | ✓ | Current spec |
| `docs/svg-design.md` | ✓ | ✓ | References `lib/render/BadgeSvg.tsx` |
| `README.md` | ✓ | ✓ | 215+ lines with Quick Start, project structure, CLI, badge embed |
| `docs/design-system.md` | ✓ | ✓ | Full design spec |
| `docs/agents/shared-context.md` | ✓ | ✓ | Entries through 2026-04-17 |

## Recommendations

1. **[Low] Fill light-mode terminal color values in design-system.md table** — Add light hex values for `--color-terminal-green` (`#16A34A`), `--color-terminal-red` (`#DC2626`), `--color-terminal-yellow` (`#D97706`), `--color-terminal-dim` (`#9CA3AF`). These exist in `globals.css:26–29` but aren't enumerated in the docs table.

2. **[Low] Document light values for structural dark tokens** — `--color-dark-section` (`#1A1A2E` light) and `--color-dark-card` (`#252542` light) are defined in `globals.css:20–21` but absent from the design-system table. Add a "Light value" column entry for these rows.

3. **[Low] Fix amber/stroke/warm-token row formatting** — Several rows in the design-system color table have 4 columns instead of 5 (missing "Light value" column). The amber tokens use the same purple in both themes — documenting that explicitly would clarify intent.
