# Documentation Report
> Generated: 2026-05-15 | Health status: green

## Executive Summary
Documentation is fully aligned with code: all 44 API routes and 33 page routes appear in `CLAUDE.md`, all 38 design-system color tokens match `globals.css`, and all 32 production environment variables documented in `CLAUDE.md` correspond to centralized accessors in `apps/web/lib/env.ts`. One minor polish item carried from prior cycles (JSDoc on low-level helpers in `lib/auth/session.ts`).

## Route Documentation

| Route | Documented in CLAUDE.md | Has API docs | Status |
|-------|------------------------|--------------|--------|
| `GET /api/auth/login` | yes | yes | OK |
| `GET /api/auth/callback` | yes | yes | OK |
| `GET /api/auth/session` | yes | yes | OK |
| `POST /api/auth/logout` | yes | yes | OK |
| `GET /api/auth/bitbucket/{callback,connect,disconnect,status}` | yes (4) | yes | OK |
| `GET /api/auth/codeberg/{callback,connect,disconnect,status}` | yes (4) | yes | OK |
| `GET /api/verify/[hash]` | yes | yes | OK |
| `GET /api/profile/[handle]` | yes | yes | OK |
| `GET /api/history/[handle]` | yes | yes | OK |
| `GET /api/health` | yes | yes | OK |
| `GET /api/feature-flags` | yes | yes | OK |
| `GET /api/insights/[handle]` | yes | yes | OK |
| `POST /api/insights` | yes | yes | OK |
| `POST /api/supplemental` | yes | yes | OK |
| `GET\|PUT /api/studio/config` | yes | yes | OK |
| `POST /api/refresh` | yes | yes | OK |
| `POST /api/generate` | yes | yes | OK |
| `POST /api/recalculate` | yes | yes | OK |
| `GET /api/cli/auth/{poll,approve}` | yes (2) | yes | OK |
| `GET /api/admin/users` | yes | yes | OK |
| `GET /api/admin/stats` | yes | yes | OK |
| `*  /api/admin/agents/run` | yes | yes | OK |
| `GET /api/admin/agents-summary` | yes | yes | OK |
| `POST /api/admin/bulk-recalculate` | yes | yes | OK |
| `PATCH /api/admin/feature-flags` | yes | yes | OK |
| `GET /api/admin/engagement-flags` | yes | yes | OK |
| `GET\|POST /api/admin/campaigns` | yes | yes | OK |
| `*  /api/admin/campaigns/[id]` | yes | yes | OK |
| `GET /api/admin/campaigns/[id]/preview` | yes | yes | OK |
| `POST /api/admin/campaigns/[id]/send` | yes | yes | OK |
| `POST /api/admin/campaigns/[id]/test` | yes | yes | OK |
| `GET /api/notifications/unsubscribe` | yes | yes | OK |
| `POST /api/webhooks/resend` | yes | yes | OK |
| `GET /api/cron/warm-cache` | yes | yes | OK |
| `GET /api/cron/sync-audience` | yes | yes | OK |
| `GET /api/cron/process-campaigns` | yes | yes | OK |
| `POST /api/telemetry` | yes | yes | OK |
| `GET /og-image` | yes | yes | OK |
| `GET /u/[handle]/og-image` | yes | yes | OK |
| `GET /llms.txt`, `/llms-full.txt` | yes (2) | yes | OK |
| `GET /.well-known/security.txt` | yes | yes | OK |
| Pages: `/`, `/studio`, `/admin`, `/u/[handle]`, `/u/[handle]/badge.svg`, `/verify`, `/verify/[hash]`, `/about`, `/about/scoring`, `/about/verification`, `/archetypes/{builder,guardian,marathoner,polymath,artificer,balanced,emerging}`, `/cli/authorize`, `/coming-soon`, `/generating/[handle]`, `/privacy`, `/terms`, `/experiments/*` (13) | yes (33) | n/a | OK |

**Result:** 44/44 API routes + 33/33 page routes documented (100%). Net new since prior cycle: 0.

## Stale Documentation

None detected this cycle.

- `docs/impact-v4.md` (6.8 KB) and `docs/svg-design.md` (6.1 KB) present and non-empty — `impact-v4.md` correctly marked as a deprecated reference (current spec is `impact-v6.md`).
- `docs/design-system.md` color table values exactly match `apps/web/styles/globals.css` for both light and dark themes (38/38 tokens verified, including dimension and archetype subgroups).
- `docs/agents/shared-context.md` (~40 KB, 25 entries) up to date through 2026-05-14.
- `README.md` (10.5 KB / 224 lines) covers setup and matches current commands.

## Missing Documentation

- **JSDoc carry — `apps/web/lib/auth/session.ts`**: top-of-file exports `getSessionSecret()` and `getSessionKey()` carry JSDoc; the lower-level cookie-parser helpers further down the file lack inline comments on edge-case branches. Polish only — no consumer impact.
- **No undocumented routes, exports, or env vars** were found this cycle.

## Environment Variables

All vars below resolve through the centralized `apps/web/lib/env.ts` accessors. ESLint `no-restricted-syntax` enforces single-source reads.

| Variable | In CLAUDE.md | Used in code | Status |
|----------|--------------|--------------|--------|
| `GITHUB_CLIENT_ID` | yes | `getGithubClientId()` | OK |
| `GITHUB_CLIENT_SECRET` | yes | `getGithubClientSecret()` | OK |
| `GITHUB_TOKEN` | yes | `getGithubToken()` | OK |
| `NEXTAUTH_SECRET` | yes | `getNextauthSecret()` | OK |
| `NEXT_PUBLIC_BASE_URL` | yes | `getBaseUrl()` | OK |
| `UPSTASH_REDIS_REST_URL` | yes | `getUpstashRedisRestUrl()` | OK |
| `UPSTASH_REDIS_REST_TOKEN` | yes | `getUpstashRedisRestToken()` | OK |
| `SUPABASE_URL` | yes | `getSupabaseUrl()` | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | `getSupabaseServiceRoleKey()` | OK |
| `NEXT_PUBLIC_POSTHOG_KEY` | yes | `getPosthogKey()` + `PostHogProvider.tsx` | OK |
| `NEXT_PUBLIC_POSTHOG_HOST` | yes | `getPosthogHost()` + `PostHogProvider.tsx` | OK |
| `CHAPA_ALERT_WEBHOOK_URL` | yes | `getChapaAlertWebhookUrl()` | OK |
| `RESEND_API_KEY` | yes | `getResendApiKey()` | OK |
| `RESEND_WEBHOOK_SECRET` | yes | `getResendWebhookSecret()` | OK |
| `SUPPORT_FORWARD_EMAIL` | yes | `getSupportForwardEmail()` | OK |
| `CHAPA_VERIFICATION_SECRET` | yes | `getChapaVerificationSecret()` | OK |
| `NEXT_PUBLIC_STUDIO_ENABLED` | yes | `getStudioEnabledEnv()` | OK |
| `NEXT_PUBLIC_EXPERIMENTS_ENABLED` | yes | `getExperimentsEnabledEnv()` | OK |
| `NEXT_PUBLIC_INSIGHTS_ENABLED` | yes | `getInsightsEnabledEnv()` | OK |
| `BITBUCKET_CLIENT_ID` | yes | `getBitbucketClientId()` | OK |
| `BITBUCKET_CLIENT_SECRET` | yes | `getBitbucketClientSecret()` | OK |
| `NEXT_PUBLIC_BITBUCKET_ENABLED` | yes | `getBitbucketEnabledEnv()` | OK |
| `CODEBERG_CLIENT_ID` | yes | `getCodebergClientId()` | OK |
| `CODEBERG_CLIENT_SECRET` | yes | `getCodebergClientSecret()` | OK |
| `NEXT_PUBLIC_CODEBERG_ENABLED` | yes | `getCodebergEnabledEnv()` | OK |
| `ADMIN_HANDLES` | yes | `getAdminHandles()` | OK |
| `ADMIN_SECRET` | yes | `getAdminSecret()` | OK |
| `ALLOW_AGENT_RUN` | yes | `getAllowAgentRun()` | OK |
| `CRON_SECRET` | yes | `getCronSecret()` | OK |
| `WARM_CACHE_PRIORITY_HANDLES` | yes | `getWarmCachePriorityHandles()` | OK |
| `VERCEL_ENV` | yes (auto-injected) | `getVercelEnv()` | OK |
| `ANALYZE` | yes (build-only) | `next.config.ts` | OK |
| `NODE_ENV` | intentional omit (standard) | `getNodeEnv()`, `next.config.ts`, `next.config.test.ts` | OK |
| `CI` | intentional omit (standard) | `playwright.config.ts` | OK |
| `DEPLOYMENT_SMOKE_STRICT` | intentional omit (test-only) | `e2e/smoke.spec.ts` | OK |
| `PLAYWRIGHT_BASE_URL` | intentional omit (test-only) | `playwright.config.ts` | OK |
| `CHAPA_PRODUCTION_URL`, `CHAPA_API_BASE` | intentional omit (script test-only) | `scripts/lib/agent-utils.test.ts` | OK |

**Result:** 32/32 production vars documented (100%). 0 mismatches. All omissions are intentional and justified in `CLAUDE.md`.

## TODO/FIXME Audit

Two grep hits, both **not real doc gaps**:
- `apps/web/lib/agents/agent-config.ts:281` — template/documentation string used by the documentation agent itself.
- `apps/web/components/AuthorTypewriter.tsx:23` — display string `"// TODO: fix later"` rendered by the typewriter component (decorative).

## Recommendations

1. **(Low / polish)** Add JSDoc to the remaining un-annotated cookie-parser helpers in `apps/web/lib/auth/session.ts` to reach 100% inline-comment coverage in the auth module. No consumer impact.
2. **(None other)** No high- or medium-priority documentation work this cycle. Project is in a fully aligned state.

---

<!-- ENTRY:START agent=documentation timestamp=2026-05-15T10:00:00Z -->
## Documentation Agent — 2026-05-15
- **Status**: GREEN
- Stale docs: 0
- Missing docs: 0 (1 polish item carried — JSDoc on lower-level helpers in `lib/auth/session.ts`)
- Env var mismatches: 0
- Routes: 44/44 API + 33/33 pages documented (100%). Net new vs prior cycle: 0.
- Design system: 38/38 color tokens in `docs/design-system.md` match `apps/web/styles/globals.css` for both themes. No drift.
- Env vars: 32/32 production vars documented in `CLAUDE.md`, all routed through `apps/web/lib/env.ts`. ESLint `no-restricted-syntax` enforces single source. Test/build-only vars (`CI`, `NODE_ENV`, `PLAYWRIGHT_BASE_URL`, `DEPLOYMENT_SMOKE_STRICT`, `CHAPA_PRODUCTION_URL`, `CHAPA_API_BASE`) are intentional omissions.
- Required docs present and non-empty: `impact-v4.md` (6.8 KB, deprecated reference), `impact-v5.md`, `impact-v6.md`, `svg-design.md` (6.1 KB), `README.md` (10.5 KB / 224 lines), `design-system.md`, `shared-context.md` (~40 KB / 25 entries through 2026-05-14).
- TODO/FIXME hits: 2, both false positives (agent template + decorative typewriter literal).

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All user-facing routes and components documented. No action.
- [Security]: All security-relevant env vars and surfaces documented. `CHAPA_ALERT_WEBHOOK_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHAPA_VERIFICATION_SECRET`, `NEXTAUTH_SECRET` all in `CLAUDE.md` env block and routed through `lib/env.ts`. No action.
<!-- ENTRY:END -->
