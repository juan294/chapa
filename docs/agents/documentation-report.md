# Documentation Report
> Generated: 2026-06-05 | Branch: `develop` | HEAD: `e275ae6c` | Health status: **green**

## Executive Summary
Documentation is fully in sync with the codebase: 44/44 API routes + 6 special routes + 34 page files documented in CLAUDE.md, 38/38 design-system color tokens match `globals.css` exactly, and all environment variables route through `lib/env.ts` and appear in CLAUDE.md with zero mismatches. No stale docs, one trivial false-positive TODO, and the prior `lib/db/campaigns.ts` JSDoc gap is now resolved.

## Route Documentation
| Route | Documented in CLAUDE.md | Has API docs | Status |
|-------|------------------------|-------------|--------|
| `/api/auth/*` (login, callback, session, logout) | ✅ | ✅ | OK |
| `/api/auth/bitbucket/*` (callback, connect, disconnect, status) | ✅ | ✅ | OK |
| `/api/auth/codeberg/*` (callback, connect, disconnect, status) | ✅ | ✅ | OK |
| `/api/verify/:hash`, `/api/profile/:handle`, `/api/history/:handle` | ✅ | ✅ | OK |
| `/api/health`, `/api/feature-flags`, `/api/telemetry` | ✅ | ✅ | OK |
| `/api/supplemental`, `/api/studio/config`, `/api/refresh`, `/api/generate`, `/api/recalculate` | ✅ | ✅ | OK |
| `/api/insights`, `/api/insights/:handle` | ✅ | ✅ | OK |
| `/api/cli/auth/poll`, `/api/cli/auth/approve` | ✅ | ✅ | OK |
| `/api/admin/*` (users, stats, agents/run, agents-summary, bulk-recalculate, feature-flags, engagement-flags) | ✅ | ✅ | OK |
| `/api/admin/campaigns`, `/api/admin/campaigns/:id` (+ preview, send, test) | ✅ | ✅ | OK |
| `/api/notifications/unsubscribe` | ✅ | ✅ | OK |
| `/api/webhooks/resend` | ✅ | ✅ | OK |
| `/api/cron/*` (warm-cache, sync-audience, process-campaigns) | ✅ | ✅ | OK |
| `/u/:handle/badge.svg`, `/u/:handle/og-image`, `/og-image` | ✅ | ✅ | OK |
| `/llms.txt`, `/llms-full.txt`, `/.well-known/security.txt` | ✅ | ✅ | OK |
| Page routes (landing, studio, admin, share, verify, about/*, archetypes/*, experiments/*, cli/authorize, generating, legal) | ✅ | n/a | OK |

**Coverage: 44/44 API routes + 6 special `route.ts` files + 34 page files — 100% documented.** A scripted diff of every filesystem route path against CLAUDE.md returned 0 missing entries. HEAD advanced `2d7eb73c → e275ae6c` since the last cycle via a JSDoc-only commit (`8e00aa18`) and a deps bump (`e275ae6c`) — no routes added or removed.

## Stale Documentation
None. Specifically verified current:
- **Design system** — all 38 `--color-*` tokens in `docs/design-system.md` match `apps/web/styles/globals.css` exactly (38 in each, no orphans either direction).
- **Required spec docs** — all present and non-empty:
  - `docs/impact-v4.md` (131 lines, correctly marked deprecated)
  - `docs/impact-v5.md` (152 lines)
  - `docs/impact-v6.md` (287 lines, current spec truth)
  - `docs/svg-design.md` (173 lines)
  - `docs/design-system.md` (236 lines)
  - `README.md` (224 lines, Quick Start with prerequisites/install/env/dev at L75)
- **Environment variables** — CLAUDE.md env block matches every var consumed via `lib/env.ts`.
- **Shared context** — `docs/agents/shared-context.md` (546 lines) has entries through 2026-06-05 (coverage agent 02:05Z today). Recent and active.

## Missing Documentation
None blocking. JSDoc spot-check across critical-path lib modules:
- `lib/impact/v6.ts` — 9/9 exports documented
- `lib/cache/redis.ts` — 13/13 documented
- `lib/github/client.ts` — 2/2 documented
- `lib/auth/session.ts` — 8 doc comments across 5 exports (single-line JSDoc style)
- `lib/db/campaigns.ts` — **14/14 exports documented** — the prior-cycle gap (campaign-send helpers `dbClaimPendingSends`/`dbMarkSendsSent`/`dbMarkSendsFailed` lease-token concurrency semantics) is **RESOLVED** in commit `8e00aa18`.

## Environment Variables
| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_TOKEN` | ✅ | ✅ `env.ts` | OK |
| `NEXTAUTH_SECRET` | ✅ | ✅ | OK |
| `NEXT_PUBLIC_BASE_URL` | ✅ | ✅ | OK |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | ✅ | ✅ | OK |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | OK |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | ✅ | ✅ | OK |
| `CHAPA_ALERT_WEBHOOK_URL` | ✅ | ✅ | OK |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` / `SUPPORT_FORWARD_EMAIL` | ✅ | ✅ | OK |
| `CHAPA_VERIFICATION_SECRET` | ✅ | ✅ | OK |
| `CRON_SECRET` / `WARM_CACHE_PRIORITY_HANDLES` | ✅ | ✅ | OK |
| `BITBUCKET_CLIENT_ID` / `_SECRET` / `NEXT_PUBLIC_BITBUCKET_ENABLED` | ✅ | ✅ | OK |
| `CODEBERG_CLIENT_ID` / `_SECRET` / `NEXT_PUBLIC_CODEBERG_ENABLED` | ✅ | ✅ | OK |
| `NEXT_PUBLIC_STUDIO_ENABLED` / `_EXPERIMENTS_ENABLED` / `_INSIGHTS_ENABLED` | ✅ | ✅ | OK |
| `ADMIN_HANDLES` / `ADMIN_SECRET` / `ALLOW_AGENT_RUN` | ✅ | ✅ | OK |
| `VERCEL_ENV` / `ANALYZE` | ✅ | ✅ | OK |
| `NODE_ENV` | ✅ (intentionally noted as standard) | ✅ | OK |
| `CI`, `DEPLOYMENT_SMOKE_STRICT`, `PLAYWRIGHT_BASE_URL` | n/a (test/build-only) | test only | OK — intentional omission |

**No mismatches.** All app config flows through `lib/env.ts` (ESLint `no-restricted-syntax` forbids scattered `process.env` reads). Extraneous vars surfaced by a raw grep (`KV_REST_API_*`, `RESEND_BASE_URL`, `SUPABASE_SECRET_KEY`, `__NEXT_*`, `VERCEL_*`) originate from the `.next/` build cache and Next.js/Vercel framework internals — not application code.

## TODO/FIXME Doc-Gap Scan
1 match, a **false positive**: `lib/agents/agent-config.ts:281` contains this audit prompt's own template text ("Look for TODO/FIXME comments that reference missing documentation"). No real doc-gap markers in source.

## Recommendations
1. **No action required this cycle.** All documentation surfaces are accurate, complete, and current.
2. *(Optional, low priority)* Consider a lightweight CI check that diffs `apps/web/app/**/route.ts` paths against CLAUDE.md so route-doc drift is caught automatically rather than by the weekly audit — purely preventative; coverage is currently 100%.
