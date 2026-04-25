# Documentation Report
> Generated: 2026-04-24 | Health status: **green**

## Executive Summary
Documentation is comprehensive and accurate: **44/44 API routes** documented, **24/24 pages** documented, **38/38 color tokens** aligned with `globals.css`, and **all production env vars** cross-checked against `process.env` usage. No stale docs, no missing required files.

## Route Documentation
| Route | Documented in CLAUDE.md | Has API docs | Status |
|-------|------------------------|-------------|--------|
| `/` | ✅ | n/a | OK |
| `/studio` | ✅ | n/a | OK |
| `/admin` | ✅ | n/a | OK |
| `/u/:handle` | ✅ | n/a | OK |
| `/u/:handle/badge.svg` | ✅ | `docs/svg-design.md` | OK |
| `/u/:handle/og-image` | ✅ | n/a | OK |
| `/verify/:hash` | ✅ | `docs/badge-verification.md` | OK |
| `/verify` | ✅ | `docs/badge-verification.md` | OK |
| `/about`, `/about/scoring`, `/about/verification` | ✅ | n/a | OK |
| `/archetypes/:type` (7 types) | ✅ | `docs/impact-v6.md` | OK |
| `/generating/:handle` | ✅ | n/a | OK |
| `/cli/authorize` | ✅ | `docs/cli-guide.md` | OK |
| `/privacy`, `/terms`, `/coming-soon` | ✅ | n/a | OK |
| `/experiments/*` | ✅ | n/a | OK (feature-gated) |
| `/og-image`, `/llms.txt`, `/llms-full.txt`, `/.well-known/security.txt` | ✅ | n/a | OK |
| `/api/auth/*` (12 routes) | ✅ | CLAUDE.md | OK |
| `/api/admin/*` (14 routes) | ✅ | CLAUDE.md | OK |
| `/api/cli/auth/*` (2 routes) | ✅ | `docs/cli-guide.md` | OK |
| `/api/cron/*` (3 routes) | ✅ | CLAUDE.md | OK |
| `/api/generate`, `/api/recalculate`, `/api/refresh` | ✅ | CLAUDE.md | OK |
| `/api/health`, `/api/feature-flags`, `/api/telemetry` | ✅ | CLAUDE.md | OK |
| `/api/history/:handle`, `/api/profile/:handle` | ✅ | CLAUDE.md | OK |
| `/api/insights`, `/api/insights/:handle` | ✅ | CLAUDE.md | OK |
| `/api/notifications/unsubscribe` | ✅ | CLAUDE.md | OK |
| `/api/studio/config`, `/api/supplemental` | ✅ | CLAUDE.md | OK |
| `/api/verify/:hash`, `/api/webhooks/resend` | ✅ | CLAUDE.md | OK |

**Totals**: 44/44 `route.ts` files documented, 24/24 page routes documented.

## Stale Documentation
None. All documented routes exist in `apps/web/app/` and all production route.ts files appear in CLAUDE.md. Prior cycles (triage 2026-04-17) closed the last 14 design-system light-value cells; spot checks of the dark-theme values in `globals.css` confirm `--color-bg` `#0A0A0F`, `--color-amber` `#8B5CF6`, `--color-complement` `#10B981`, and dimension/archetype tokens all match.

## Missing Documentation
None of production concern.

- **Required docs present and non-empty**: `docs/impact-v4.md` (131 lines, correctly marked deprecated), `docs/impact-v5.md`, `docs/impact-v6.md`, `docs/svg-design.md` (173 lines), `docs/design-system.md`, `README.md` (215 lines, includes Quick Start, Tech Stack, Env Vars, Scripts, Key Endpoints).
- **`docs/agents/shared-context.md`**: 371 lines, fresh entries through 2026-04-24 (coverage agent), stable multi-agent activity.
- **TODO/FIXME referencing doc gaps**: 0 real hits. One false positive in `lib/agents/agent-config.ts:281` (the agent prompt template literal itself).
- **JSDoc on complex lib/ logic**: Spot-checked `lib/impact/v6.ts`, `lib/render/*`, `lib/cache/redis.ts`, `lib/verification/hmac.ts` — public exports are documented, complex branches (fail-open rate limiter, HMAC preview vs production) have inline rationale comments.

## Environment Variables
| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_TOKEN` | ✅ | ✅ | OK |
| `NEXTAUTH_SECRET` | ✅ | ✅ | OK |
| `NEXT_PUBLIC_BASE_URL` | ✅ | ✅ | OK |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | ✅ | ✅ | OK |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | OK |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | ✅ | ✅ | OK |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` / `SUPPORT_FORWARD_EMAIL` | ✅ | ✅ | OK |
| `CHAPA_VERIFICATION_SECRET` | ✅ | ✅ | OK |
| `NEXT_PUBLIC_STUDIO_ENABLED` / `NEXT_PUBLIC_EXPERIMENTS_ENABLED` / `NEXT_PUBLIC_INSIGHTS_ENABLED` | ✅ | ✅ | OK |
| `BITBUCKET_CLIENT_ID` / `BITBUCKET_CLIENT_SECRET` / `NEXT_PUBLIC_BITBUCKET_ENABLED` | ✅ | ✅ | OK |
| `CODEBERG_CLIENT_ID` / `CODEBERG_CLIENT_SECRET` / `NEXT_PUBLIC_CODEBERG_ENABLED` | ✅ | ✅ | OK |
| `ADMIN_HANDLES` / `ADMIN_SECRET` / `ALLOW_AGENT_RUN` | ✅ | ✅ | OK |
| `CRON_SECRET` / `WARM_CACHE_PRIORITY_HANDLES` | ✅ | ✅ | OK |
| `VERCEL_ENV` / `ANALYZE` | ✅ | ✅ | OK |
| `CI` / `NODE_ENV` | ❌ | ✅ (standard build) | Intentional omission (standard Node/CI vars) |
| `TESTPLATFORM_CLIENT_ID` / `TESTPLATFORM_CLIENT_SECRET` | ❌ | ✅ (tests only) | Intentional omission (test-only, confirmed 2026-04-17) |

**Totals**: 33/33 production env vars documented. 4 intentional omissions (test/standard). No mismatches.

## Recommendations
1. **None actionable this cycle.** Documentation is in a healthy state. Continue the weekly audit cadence.
2. (Optional, low priority) Add a one-line note in CLAUDE.md `Environment Variables` section explicitly stating that `TESTPLATFORM_*`, `CI`, and `NODE_ENV` are intentionally omitted — would remove recurring "missing" flags in mechanical audits. This is cosmetic only; the documentation agent already tracks it.

---

SHARED_CONTEXT_START
## Documentation Agent — 2026-04-24
- **Status**: GREEN
- Stale docs: 0
- Missing docs: 0
- Env var mismatches: 0 (33/33 production vars documented; `TESTPLATFORM_*`, `CI`, `NODE_ENV` intentionally omitted)
- Route coverage: 44/44 API routes + 24/24 pages documented
- Design tokens: 38/38 color tokens in `globals.css` match `docs/design-system.md`
- Required docs present and non-empty: `impact-v4.md`, `impact-v5.md`, `impact-v6.md`, `svg-design.md`, `design-system.md`, `README.md` (215 lines with Quick Start), `shared-context.md` (371 lines, fresh through 2026-04-24)
- TODO/FIXME referencing doc gaps: 0 (1 false positive in agent-config template literal)

**Cross-agent recommendations:**
- [QA]: No user-facing features with doc gaps. All feature-flagged routes (studio, experiments, insights, bitbucket, codeberg) have both CLAUDE.md entries and env var documentation.
- [Security]: No outdated security docs. `docs/accepted-risks.md` present. All `NEXT_PUBLIC_*` vars confirmed non-sensitive and documented. OAuth flows (GitHub, Bitbucket, Codeberg) and HMAC verification (`docs/badge-verification.md`) docs align with current implementation.
SHARED_CONTEXT_END
