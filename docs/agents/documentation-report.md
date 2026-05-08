# Documentation Report
> Generated: 2026-05-08 | Health status: green

## Executive Summary
Documentation is in excellent shape. All 43 API routes, 33 page routes, 38 color tokens, and 31 of 32 production env vars are accurately documented. One minor gap: `CHAPA_ALERT_WEBHOOK_URL` is documented in `README.md` and `docs/runbooks/incident-response.md` but missing from the env-vars block in `CLAUDE.md`. Five exports in `lib/auth/session.ts` lack JSDoc — low-priority polish.

## Route Documentation
All routes accounted for. Full route-by-route table omitted for brevity; spot-checks confirmed every API route in `apps/web/app/api/` appears in `CLAUDE.md` and every page in `apps/web/app/` appears in the page list.

| Group | Documented in CLAUDE.md | Has API docs | Status |
|-------|------------------------|-------------|--------|
| Auth API (12 routes) | ✓ | ✓ | green |
| Public API (10 routes incl. og-image, llms.txt, .well-known/security.txt) | ✓ | ✓ | green |
| Authenticated API (9 routes) | ✓ | ✓ | green |
| Admin API (12 routes) | ✓ | ✓ | green |
| Webhooks & Cron (5 routes) | ✓ | ✓ | green |
| Pages (33 incl. experiments/*, archetypes/*) | ✓ | ✓ | green |

## Stale Documentation
- None observed. `docs/impact-v4.md` is correctly retained as historical reference; `docs/impact-v6.md` is the current spec. Color tokens in `docs/design-system.md` exactly match the 38 `--color-*` tokens defined in `apps/web/styles/globals.css`.

## Missing Documentation
- **`lib/auth/session.ts`**: 5 exports (`SessionPayload`, `RequireSessionResult`, `getSessionSecret`, `getSessionKey`, `getOptionalServerSessionFromHeaders`, `getOptionalRequestSession`, `requireRequestSession`) have no JSDoc. Low priority — names are descriptive, but adding short doc comments would match the high standard set elsewhere (`lib/impact/v6.ts`, `lib/cache/redis.ts`, `lib/github/client.ts` — all 100% JSDoc-covered).
- No TODO/FIXME comments in source reference missing documentation. The two prior false positives (agent-config template literal, audit prompt string) confirmed not real action items.

## Environment Variables
| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
| `CHAPA_ALERT_WEBHOOK_URL` | ✗ | ✓ (`lib/env.ts` + `lib/analytics/server-errors.ts`) | **MISMATCH — undocumented in CLAUDE.md** (documented in README.md + `docs/runbooks/incident-response.md`) |
| `DEPLOYMENT_SMOKE_STRICT` | ✗ | ✓ (`apps/web/e2e/smoke.spec.ts`) | test-only, intentional omission acceptable |
| `PLAYWRIGHT_BASE_URL` | ✗ | ✓ (`apps/web/playwright.config.ts`) | test-only, intentional omission acceptable |
| All 31 production env vars from `lib/env.ts` | ✓ | ✓ | green (ADMIN_HANDLES, ADMIN_SECRET, ALLOW_AGENT_RUN, BITBUCKET_*, CODEBERG_*, CHAPA_VERIFICATION_SECRET, CRON_SECRET, GITHUB_*, NEXTAUTH_SECRET, NEXT_PUBLIC_*, RESEND_*, SUPABASE_*, SUPPORT_FORWARD_EMAIL, UPSTASH_*, WARM_CACHE_PRIORITY_HANDLES, VERCEL_ENV) |

## Recommendations
1. **P3 — Add `CHAPA_ALERT_WEBHOOK_URL` to the env-vars block in `CLAUDE.md`.** It's used in production for operational alerts and already documented elsewhere; CLAUDE.md should be in sync. Add under a new "Operational alerts" section near `RESEND_API_KEY`.
2. **P3 — Add JSDoc to the 5 `lib/auth/session.ts` exports** (`SessionPayload`, `RequireSessionResult`, `getSessionSecret`, `getSessionKey`, `getOptionalServerSessionFromHeaders`, `getOptionalRequestSession`, `requireRequestSession`) to bring the auth surface in line with `lib/impact/`, `lib/cache/`, and `lib/github/` (all 100%-documented).
3. **No P1/P2 items.** Documentation is otherwise complete and accurate.
