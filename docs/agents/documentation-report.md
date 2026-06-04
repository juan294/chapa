# Documentation Report
> Generated: 2026-05-29 | Branch: `develop` | Health status: **green**

## Executive Summary
Documentation is accurate and complete: 44/44 API routes + 6 special routes + all page routes are documented in CLAUDE.md, all 38 color tokens match `globals.css` exactly, and 100% of production env vars are documented. The only finding is a low-priority polish item — a few campaign-send DB helpers with non-trivial lease/concurrency semantics lack JSDoc.

## Route Documentation

| Route group | Documented in CLAUDE.md | Has API/page docs | Status |
|-------------|------------------------|-------------------|--------|
| Pages (`/`, `/studio`, `/admin`, `/u/:handle`, `/about/*`, `/archetypes/:type`, `/cli/authorize`, `/privacy`, `/terms`, `/coming-soon`, `/verify`, `/verify/:hash`, `/generating/:handle`, `/experiments/*`) | ✅ all | ✅ | ✅ |
| Auth API (`/api/auth/*` incl. GitHub, Bitbucket, Codeberg) | ✅ all 14 | ✅ | ✅ |
| Public API (`/api/verify`, `/api/profile`, `/api/history`, `/api/health`, `/api/feature-flags`, og-image, llms.txt, llms-full.txt, security.txt) | ✅ all | ✅ | ✅ |
| Authenticated API (`/api/supplemental`, `/api/studio/config`, `/api/refresh`, `/api/generate`, `/api/recalculate`, `/api/insights*`, `/api/cli/auth/*`) | ✅ all | ✅ | ✅ |
| Admin API (`/api/admin/*` incl. campaigns CRUD, agents, stats, users, feature-flags, engagement-flags, bulk-recalculate) | ✅ all 12 | ✅ | ✅ |
| Webhooks & Cron (`/api/webhooks/resend`, `/api/cron/*`, `/api/telemetry`, `/api/notifications/unsubscribe`) | ✅ all | ✅ | ✅ |
| Special routes (`badge.svg`, `u/:handle/og-image`, `og-image`, `llms*.txt`, `.well-known/security.txt`) | ✅ all | ✅ | ✅ |

**Result:** 44 API route files + 6 special route files + 34 page files (counting `/experiments/*` as a group) — all accounted for in CLAUDE.md. No undocumented routes; no documented-but-missing routes.

## Stale Documentation
None. Specifically verified:
- **Color tokens:** All 38 `--color-*` tokens in `docs/design-system.md` match `apps/web/styles/globals.css` exactly (38/38, no drift, no orphans in either direction).
- **Required docs:** all present and non-empty — `impact-v4.md` (131 lines, correctly marked deprecated), `impact-v5.md` (152), `impact-v6.md` (287, current spec truth), `svg-design.md` (173), `README.md` (224), `design-system.md` (236), `shared-context.md` (548).
- **Env var doc:** CLAUDE.md's env block matches `lib/env.ts` usage. The grep-detected stragglers (`CI`, `NODE_ENV`, `ANALYZE`, `DEPLOYMENT_SMOKE_STRICT`, `PLAYWRIGHT_BASE_URL`) are standard build/test vars already noted as intentional omissions.

## Missing Documentation
- **[Low] Campaign-send DB helpers lack JSDoc** — `apps/web/lib/db/campaigns.ts` has several exported functions without JSDoc: `dbClaimPendingSends`, `dbCreateCampaignSends`, `dbGetPendingSends`, `dbMarkSendsSent`, `dbMarkSendsFailed`, `dbDeleteCampaign`, `dbGetCampaigns`, `dbGetCampaign`, plus the `mapCampaignRow`/`mapSendRow`/`CampaignSendRowSchema` mappers. Most are self-evident CRUD, but `dbClaimPendingSends` (`campaigns.ts:626`) wraps the `claim_campaign_sends` RPC with **lease-token/lease-expiry concurrency semantics** that are non-obvious and worth a doc comment; `dbMarkSendsSent`/`dbMarkSendsFailed` also accept an optional `leaseToken` whose contract is undocumented. The campaign subsystem is admin-only and well covered by tests (lib/db 96.5%), so this is polish, not a correctness risk.
- No missing route, feature, or env-var documentation found.

## Environment Variables

| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|--------------|--------|
| GITHUB_CLIENT_ID / _SECRET / GITHUB_TOKEN | ✅ | ✅ `lib/env.ts` | ✅ |
| NEXTAUTH_SECRET, NEXT_PUBLIC_BASE_URL | ✅ | ✅ | ✅ |
| UPSTASH_REDIS_REST_URL / _TOKEN | ✅ | ✅ | ✅ |
| SUPABASE_URL / SERVICE_ROLE_KEY | ✅ | ✅ | ✅ |
| NEXT_PUBLIC_POSTHOG_KEY / _HOST | ✅ | ✅ | ✅ |
| CHAPA_ALERT_WEBHOOK_URL, CHAPA_VERIFICATION_SECRET | ✅ | ✅ | ✅ |
| RESEND_API_KEY / _WEBHOOK_SECRET, SUPPORT_FORWARD_EMAIL | ✅ | ✅ | ✅ |
| BITBUCKET_CLIENT_ID/_SECRET, NEXT_PUBLIC_BITBUCKET_ENABLED | ✅ | ✅ | ✅ |
| CODEBERG_CLIENT_ID/_SECRET, NEXT_PUBLIC_CODEBERG_ENABLED | ✅ | ✅ | ✅ |
| NEXT_PUBLIC_STUDIO/_EXPERIMENTS/_INSIGHTS_ENABLED | ✅ | ✅ | ✅ |
| ADMIN_HANDLES, ADMIN_SECRET, ALLOW_AGENT_RUN | ✅ | ✅ | ✅ |
| CRON_SECRET, WARM_CACHE_PRIORITY_HANDLES, VERCEL_ENV, ANALYZE | ✅ | ✅ | ✅ |
| CI, NODE_ENV | omitted (intentional) | ✅ build var | ✅ |
| DEPLOYMENT_SMOKE_STRICT, PLAYWRIGHT_BASE_URL | omitted (test-only) | ✅ tests | ✅ |

**Result:** 0 mismatches. Every production env var read in code is documented; every undocumented var is a standard build or test-only var explicitly called out as an intentional omission.

## Other Checks
- **TODO/FIXME referencing missing docs:** 1 grep hit (`lib/agents/agent-config.ts:281`) is a **false positive** — it is this audit prompt's own text embedded in the agent config template, not a real code TODO.
- **shared-context.md recency:** healthy — latest entry `2026-05-29T03:00:00Z` (cost-analyst), with entries spanning May 28–29 across cost, coverage, performance, qa, triage agents.
- **README setup instructions:** present — "Quick Start" (`README.md:75`) covers install deps, copy/fill env vars, and `pnpm run dev` on port 3001; "Environment Variables" section at line 155.

## Recommendations
1. **[Low]** Add JSDoc to the campaign-send helpers in `apps/web/lib/db/campaigns.ts`, prioritizing `dbClaimPendingSends` and the `leaseToken` parameter on `dbMarkSendsSent`/`dbMarkSendsFailed` — document the lease-claim/expiry contract so the concurrency model is discoverable without reading the `claim_campaign_sends` RPC. The simpler CRUD mappers can follow opportunistically.
2. No other action required — route, env-var, design-token, and required-doc coverage are all at 100%.
