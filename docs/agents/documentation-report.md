# Documentation Report
> Generated: 2026-06-19 | Health status: green

## Executive Summary
All 84 filesystem routes are documented in CLAUDE.md (100%), all 38 design-system color tokens match `globals.css`, all 4 required spec docs exist and are non-empty, and all environment variables in `lib/env.ts` are documented. No stale docs, no broken route coverage, no env var gaps.

## Route Documentation

All routes are verified. The table below covers every distinct filesystem path. Experiment sub-pages are grouped under the wildcard entry.

| Route | In CLAUDE.md | File exists | Status |
|-------|--------------|-------------|--------|
| GET `/` | Yes | `app/page.tsx` | OK |
| GET `/studio` | Yes | `app/studio/page.tsx` | OK |
| GET `/admin` | Yes | `app/admin/page.tsx` | OK |
| GET `/u/:handle` | Yes | `app/u/[handle]/page.tsx` | OK |
| GET `/u/:handle/badge.svg` | Yes | `app/u/[handle]/badge.svg/route.ts` | OK |
| GET `/verify/:hash` | Yes | `app/verify/[hash]/page.tsx` | OK |
| GET `/about` | Yes | `app/about/page.tsx` | OK |
| GET `/about/scoring` | Yes | `app/about/scoring/page.tsx` | OK |
| GET `/about/verification` | Yes | `app/about/verification/page.tsx` | OK |
| GET `/archetypes/builder` | Yes (`:type` wildcard) | `app/archetypes/builder/page.tsx` | OK |
| GET `/archetypes/guardian` | Yes (`:type` wildcard) | `app/archetypes/guardian/page.tsx` | OK |
| GET `/archetypes/marathoner` | Yes (`:type` wildcard) | `app/archetypes/marathoner/page.tsx` | OK |
| GET `/archetypes/polymath` | Yes (`:type` wildcard) | `app/archetypes/polymath/page.tsx` | OK |
| GET `/archetypes/artificer` | Yes (`:type` wildcard) | `app/archetypes/artificer/page.tsx` | OK |
| GET `/archetypes/balanced` | Yes (`:type` wildcard) | `app/archetypes/balanced/page.tsx` | OK |
| GET `/archetypes/emerging` | Yes (`:type` wildcard) | `app/archetypes/emerging/page.tsx` | OK |
| GET `/generating/:handle` | Yes | `app/generating/[handle]/page.tsx` | OK |
| GET `/cli/authorize` | Yes | `app/cli/authorize/page.tsx` | OK |
| GET `/privacy` | Yes | `app/privacy/page.tsx` | OK |
| GET `/terms` | Yes | `app/terms/page.tsx` | OK |
| GET `/coming-soon` | Yes | `app/coming-soon/page.tsx` | OK |
| GET `/verify` | Yes | `app/verify/page.tsx` | OK |
| GET `/experiments/*` (13 sub-pages) | Yes (wildcard) | `app/experiments/*/page.tsx` (×13) | OK |
| GET `/api/auth/login` | Yes | `app/api/auth/login/route.ts` | OK |
| GET `/api/auth/callback` | Yes | `app/api/auth/callback/route.ts` | OK |
| GET `/api/auth/session` | Yes | `app/api/auth/session/route.ts` | OK |
| POST `/api/auth/logout` | Yes | `app/api/auth/logout/route.ts` | OK |
| GET `/api/auth/bitbucket/callback` | Yes | `app/api/auth/bitbucket/callback/route.ts` | OK |
| GET `/api/auth/bitbucket/connect` | Yes | `app/api/auth/bitbucket/connect/route.ts` | OK |
| POST `/api/auth/bitbucket/disconnect` | Yes | `app/api/auth/bitbucket/disconnect/route.ts` | OK |
| GET `/api/auth/bitbucket/status` | Yes | `app/api/auth/bitbucket/status/route.ts` | OK |
| GET `/api/auth/codeberg/callback` | Yes | `app/api/auth/codeberg/callback/route.ts` | OK |
| GET `/api/auth/codeberg/connect` | Yes | `app/api/auth/codeberg/connect/route.ts` | OK |
| POST `/api/auth/codeberg/disconnect` | Yes | `app/api/auth/codeberg/disconnect/route.ts` | OK |
| GET `/api/auth/codeberg/status` | Yes | `app/api/auth/codeberg/status/route.ts` | OK |
| GET `/api/verify/:hash` | Yes | `app/api/verify/[hash]/route.ts` | OK |
| GET `/api/profile/:handle` | Yes | `app/api/profile/[handle]/route.ts` | OK |
| GET `/api/history/:handle` | Yes | `app/api/history/[handle]/route.ts` | OK |
| GET `/api/health` | Yes | `app/api/health/route.ts` | OK |
| GET `/api/feature-flags` | Yes | `app/api/feature-flags/route.ts` | OK |
| GET `/u/:handle/og-image` | Yes | `app/u/[handle]/og-image/route.ts` | OK |
| GET `/og-image` | Yes | `app/og-image/route.ts` | OK |
| GET `/llms.txt` | Yes | `app/llms.txt/route.ts` | OK |
| GET `/llms-full.txt` | Yes | `app/llms-full.txt/route.ts` | OK |
| GET `/.well-known/security.txt` | Yes | `app/.well-known/security.txt/route.ts` | OK |
| POST `/api/supplemental` | Yes | `app/api/supplemental/route.ts` | OK |
| GET\|PUT `/api/studio/config` | Yes | `app/api/studio/config/route.ts` | OK |
| POST `/api/refresh` | Yes | `app/api/refresh/route.ts` | OK |
| POST `/api/generate` | Yes | `app/api/generate/route.ts` | OK |
| POST `/api/recalculate` | Yes | `app/api/recalculate/route.ts` | OK |
| GET `/api/insights/:handle` | Yes | `app/api/insights/[handle]/route.ts` | OK |
| POST `/api/insights` | Yes | `app/api/insights/route.ts` | OK |
| GET `/api/cli/auth/poll` | Yes | `app/api/cli/auth/poll/route.ts` | OK |
| POST `/api/cli/auth/approve` | Yes | `app/api/cli/auth/approve/route.ts` | OK |
| GET `/api/admin/users` | Yes | `app/api/admin/users/route.ts` | OK |
| GET `/api/admin/stats` | Yes | `app/api/admin/stats/route.ts` | OK |
| POST\|GET\|DELETE `/api/admin/agents/run` | Yes | `app/api/admin/agents/run/route.ts` | OK |
| GET `/api/admin/agents-summary` | Yes | `app/api/admin/agents-summary/route.ts` | OK |
| POST `/api/admin/bulk-recalculate` | Yes | `app/api/admin/bulk-recalculate/route.ts` | OK |
| PATCH `/api/admin/feature-flags` | Yes | `app/api/admin/feature-flags/route.ts` | OK |
| GET `/api/admin/engagement-flags` | Yes | `app/api/admin/engagement-flags/route.ts` | OK |
| GET\|POST `/api/admin/campaigns` | Yes | `app/api/admin/campaigns/route.ts` | OK |
| GET\|PATCH\|DELETE `/api/admin/campaigns/:id` | Yes | `app/api/admin/campaigns/[id]/route.ts` | OK |
| GET `/api/admin/campaigns/:id/preview` | Yes | `app/api/admin/campaigns/[id]/preview/route.ts` | OK |
| POST `/api/admin/campaigns/:id/send` | Yes | `app/api/admin/campaigns/[id]/send/route.ts` | OK |
| POST `/api/admin/campaigns/:id/test` | Yes | `app/api/admin/campaigns/[id]/test/route.ts` | OK |
| GET `/api/notifications/unsubscribe` | Yes | `app/api/notifications/unsubscribe/route.ts` | OK |
| POST `/api/webhooks/resend` | Yes | `app/api/webhooks/resend/route.ts` | OK |
| GET `/api/cron/warm-cache` | Yes | `app/api/cron/warm-cache/route.ts` | OK |
| GET `/api/cron/sync-audience` | Yes | `app/api/cron/sync-audience/route.ts` | OK |
| GET `/api/cron/process-campaigns` | Yes | `app/api/cron/process-campaigns/route.ts` | OK |
| POST `/api/telemetry` | Yes | `app/api/telemetry/route.ts` | OK |

**Total: 84 filesystem files (34 `page.tsx` + 50 `route.ts`) — 100% documented in CLAUDE.md.**

## Design System Tokens

All 38 tokens match — no drift.

| Check | Result |
|-------|--------|
| Tokens in `docs/design-system.md` | 38 |
| Tokens in `apps/web/styles/globals.css` | 38 |
| Mismatches | 0 |
| Orphans (in CSS only) | 0 |
| Orphans (in docs only) | 0 |

All 38 `--color-*` tokens match exactly — no drift between design-system.md and globals.css.

## Required Docs

| File | Exists | Lines | Status |
|------|--------|-------|--------|
| `docs/impact-v4.md` | Yes | 131 | OK (deprecated, retained for history) |
| `docs/impact-v5.md` | Yes | 152 | OK |
| `docs/impact-v6.md` | Yes | 287 | OK (current spec truth) |
| `docs/svg-design.md` | Yes | 173 | OK |

## JSDoc Coverage

Coverage is assessed per exported symbol. Type aliases and bare interfaces are lower priority; functions and consts with non-obvious semantics are higher priority.

| File | Documented | Total exports | Coverage | Notes |
|------|-----------|---------------|----------|-------|
| `lib/impact/v6.ts` | 9 | 9 | 100% | All functions documented |
| `lib/cache/redis.ts` | 15 | 17 | 88% | Missing JSDoc on `RateLimitResult` interface (self-explanatory fields) and `CacheSetNxStatus` type alias (value literals are self-documenting) — low priority |
| `lib/db/campaigns.ts` | 16 | 22 | 73% | Missing JSDoc on 6 type/interface exports (`CampaignType`, `CampaignStatus`, `CampaignSendStatus`, `Campaign`, `CampaignSend`, `CampaignSendStats`) and `CampaignRowSchema` const — all function exports are fully documented |
| `lib/auth/session.ts` | 7 | 7 | 100% | All 5 functions + 2 private helpers documented |
| `lib/github/client.ts` | 2 | 2 | 100% | Both exports documented (`_resetInflight` @internal, `getStats` full JSDoc) |

**Note**: The JSDoc gaps in `campaigns.ts` and `redis.ts` are all on type/interface exports, not functions. All complex function semantics (lease tokens, rate limiting, quota reservation, in-flight dedup) are fully documented. No P1 or P2 gaps.

## Environment Variables

All 32 environment variables read by `lib/env.ts` are documented in CLAUDE.md. `ANALYZE` is documented in CLAUDE.md as a build-only var and is correctly absent from `lib/env.ts` (it is consumed by `next.config.ts`, not app code).

| Variable | In CLAUDE.md | In `lib/env.ts` | Status |
|----------|-------------|-----------------|--------|
| `GITHUB_CLIENT_ID` | Yes | Yes | OK |
| `GITHUB_CLIENT_SECRET` | Yes | Yes | OK |
| `NEXTAUTH_SECRET` | Yes | Yes | OK |
| `NEXT_PUBLIC_BASE_URL` | Yes | Yes | OK |
| `UPSTASH_REDIS_REST_URL` | Yes | Yes | OK |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Yes | OK |
| `SUPABASE_URL` | Yes | Yes | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Yes | OK |
| `NEXT_PUBLIC_POSTHOG_KEY` | Yes | Yes | OK |
| `NEXT_PUBLIC_POSTHOG_HOST` | Yes | Yes | OK |
| `CHAPA_ALERT_WEBHOOK_URL` | Yes | Yes | OK |
| `RESEND_API_KEY` | Yes | Yes | OK |
| `RESEND_WEBHOOK_SECRET` | Yes | Yes | OK |
| `SUPPORT_FORWARD_EMAIL` | Yes | Yes | OK |
| `GITHUB_TOKEN` | Yes | Yes | OK |
| `CHAPA_VERIFICATION_SECRET` | Yes | Yes | OK |
| `NEXT_PUBLIC_STUDIO_ENABLED` | Yes | Yes | OK |
| `NEXT_PUBLIC_EXPERIMENTS_ENABLED` | Yes | Yes | OK |
| `NEXT_PUBLIC_INSIGHTS_ENABLED` | Yes | Yes | OK |
| `BITBUCKET_CLIENT_ID` | Yes | Yes | OK |
| `BITBUCKET_CLIENT_SECRET` | Yes | Yes | OK |
| `NEXT_PUBLIC_BITBUCKET_ENABLED` | Yes | Yes | OK |
| `CODEBERG_CLIENT_ID` | Yes | Yes | OK |
| `CODEBERG_CLIENT_SECRET` | Yes | Yes | OK |
| `NEXT_PUBLIC_CODEBERG_ENABLED` | Yes | Yes | OK |
| `ADMIN_HANDLES` | Yes | Yes | OK |
| `ADMIN_SECRET` | Yes | Yes | OK |
| `ALLOW_AGENT_RUN` | Yes | Yes | OK |
| `CRON_SECRET` | Yes | Yes | OK |
| `WARM_CACHE_PRIORITY_HANDLES` | Yes | Yes | OK |
| `VERCEL_ENV` | Yes | Yes | OK |
| `NODE_ENV` | Yes (intentional omission note) | Yes | OK |
| `ANALYZE` | Yes | No (consumed by `next.config.ts`) | OK — build-only var, correct |

**0 undocumented vars. 0 documented vars missing from code.**

## Stale Documentation

None found. The only commits since the last documentation cycle (2026-06-12, HEAD `5ef06c09`) are:
- `66f6900e` — DOMPurify audit advisory fix (dependency bump only, no route/API/env changes)
- `12d68c98` — docs: commit triage agent reports (docs only)
- `4245dab0` — fix: resolve agent report findings [triage] (knip.json schema update, no app code)
- `b6cb414d` — chore(agents): update agent reports (docs only)
- `b7b33ace` — fix(deps): force js-yaml >=4.2.0 via pnpm override (build tooling only)

No app routes, API endpoints, environment variables, or design tokens changed. All documentation remains accurate.

## Missing Documentation

None found. All filesystem routes have CLAUDE.md entries. All lib functions with non-trivial semantics have JSDoc. The only gaps are on type/interface exports in `campaigns.ts` and `redis.ts`, which are self-explanatory from field names and TypeScript types.

## Shared Context

- File exists: yes (`docs/agents/shared-context.md`)
- Most recent documentation entry: Documentation Agent — 2026-06-12
- Recency: STALE (7 days; today is 2026-06-19 — exactly at the 7-day boundary)
- Most recent overall entry: Coverage Agent — 2026-06-19 (today, GREEN)

## Recommendations

**P3 (low priority — housekeeping)**

1. Add JSDoc to 6 type/interface exports in `lib/db/campaigns.ts` (`CampaignType`, `CampaignStatus`, `CampaignSendStatus`, `Campaign`, `CampaignSend`, `CampaignSendStats`) and the `CampaignRowSchema` const. These are currently undocumented type-level exports; the functions that use them are all fully documented. A one-line `/** ... */` per type is sufficient.

2. Add JSDoc to `RateLimitResult` interface and `CacheSetNxStatus` type in `lib/cache/redis.ts`. Both are self-explanatory but completing the file's JSDoc coverage is tidy.

No P1 or P2 items. Documentation is GREEN.
