# Documentation Report
> Generated: 2026-06-26 | Health status: yellow

## Executive Summary
One missing route entry (`/api/challenge`, added by #933) is the only documentation gap since the last GREEN cycle on 2026-06-19. All 38 design-system color tokens, all environment variables, and all other routes remain fully documented.

---

## Route Documentation

| Route | In CLAUDE.md | Status |
|-------|-------------|--------|
| `GET /` | ✅ | OK |
| `GET /studio` | ✅ | OK |
| `GET /admin` | ✅ | OK |
| `GET /u/:handle` | ✅ | OK |
| `GET /u/:handle/badge.svg` | ✅ | OK |
| `GET /verify/:hash` | ✅ | OK |
| `GET /about` | ✅ | OK |
| `GET /about/scoring` | ✅ | OK |
| `GET /about/verification` | ✅ | OK |
| `GET /archetypes/:type` (7 variants) | ✅ | OK |
| `GET /generating/:handle` | ✅ | OK |
| `GET /cli/authorize` | ✅ | OK |
| `GET /privacy` | ✅ | OK |
| `GET /terms` | ✅ | OK |
| `GET /coming-soon` | ✅ | OK |
| `GET /verify` | ✅ | OK |
| `GET /experiments/*` (13 variants) | ✅ | OK |
| `GET /api/auth/login` | ✅ | OK |
| `GET /api/auth/callback` | ✅ | OK |
| `GET /api/auth/session` | ✅ | OK |
| `POST /api/auth/logout` | ✅ | OK |
| `GET /api/auth/bitbucket/callback` | ✅ | OK |
| `GET /api/auth/bitbucket/connect` | ✅ | OK |
| `POST /api/auth/bitbucket/disconnect` | ✅ | OK |
| `GET /api/auth/bitbucket/status` | ✅ | OK |
| `GET /api/auth/codeberg/callback` | ✅ | OK |
| `GET /api/auth/codeberg/connect` | ✅ | OK |
| `POST /api/auth/codeberg/disconnect` | ✅ | OK |
| `GET /api/auth/codeberg/status` | ✅ | OK |
| `GET /api/auth/gitlab/callback` | ✅ | OK |
| `GET /api/auth/gitlab/connect` | ✅ | OK |
| `POST /api/auth/gitlab/disconnect` | ✅ | OK |
| `GET /api/auth/gitlab/status` | ✅ | OK |
| `GET /api/verify/:hash` | ✅ | OK |
| `GET /api/profile/:handle` | ✅ | OK |
| `GET /api/history/:handle` | ✅ | OK |
| `GET /api/health` | ✅ | OK |
| `GET /api/feature-flags` | ✅ | OK |
| `GET /u/:handle/og-image` | ✅ | OK |
| `GET /og-image` | ✅ | OK |
| `GET /llms.txt` | ✅ | OK |
| `GET /llms-full.txt` | ✅ | OK |
| `GET /.well-known/security.txt` | ✅ | OK |
| `POST /api/supplemental` | ✅ | OK |
| `GET\|PUT /api/studio/config` | ✅ | OK |
| `POST /api/refresh` | ✅ | OK |
| `POST /api/generate` | ✅ | OK |
| `POST /api/recalculate` | ✅ | OK |
| `GET /api/insights/:handle` | ✅ | OK |
| `POST /api/insights` | ✅ | OK |
| `GET /api/cli/auth/poll` | ✅ | OK |
| `POST /api/cli/auth/approve` | ✅ | OK |
| `GET /api/admin/users` | ✅ | OK |
| `GET /api/admin/stats` | ✅ | OK |
| `POST\|GET\|DELETE /api/admin/agents/run` | ✅ | OK |
| `GET /api/admin/agents-summary` | ✅ | OK |
| `POST /api/admin/bulk-recalculate` | ✅ | OK |
| `PATCH /api/admin/feature-flags` | ✅ | OK |
| `GET /api/admin/engagement-flags` | ✅ | OK |
| `GET\|POST /api/admin/campaigns` | ✅ | OK |
| `GET\|PATCH\|DELETE /api/admin/campaigns/:id` | ✅ | OK |
| `GET /api/admin/campaigns/:id/preview` | ✅ | OK |
| `POST /api/admin/campaigns/:id/send` | ✅ | OK |
| `POST /api/admin/campaigns/:id/test` | ✅ | OK |
| `GET /api/notifications/unsubscribe` | ✅ | OK |
| `POST /api/webhooks/resend` | ✅ | OK |
| `GET /api/cron/warm-cache` | ✅ | OK |
| `GET /api/cron/sync-audience` | ✅ | OK |
| `GET /api/cron/process-campaigns` | ✅ | OK |
| `POST /api/telemetry` | ✅ | OK |
| **`POST /api/challenge`** | ❌ | **MISSING — added by #933** |

**Route coverage: 85/86 (99%).** One route missing from CLAUDE.md.

---

## Stale Documentation

None. All sections verified against current code:

- **Design system tokens**: 38/38 `--color-*` tokens in `docs/design-system.md` exactly match `apps/web/styles/globals.css`. Zero drift.
- **Required docs**: All present and non-empty — `impact-v4.md` (131 lines, deprecated), `impact-v5.md` (152 lines), `impact-v6.md` (289 lines, current spec), `svg-design.md` (173 lines), `README.md` (228 lines with Quick Start).
- **CLAUDE.md acceptance criteria and engineering rules**: Match current codebase behavior (v2.15.0 / HEAD `1bfc75df`). The challenge flow (#933) does not contradict any existing acceptance criteria.

---

## Missing Documentation

### P2 — Route missing from CLAUDE.md

**`POST /api/challenge`** (added by #933, `app/api/challenge/route.ts`)

- Authenticated endpoint: requires session, IP-based rate-limited
- Sends a challenge email when a user disputes their impact score
- Validates body via `isChallengeBody()` + `MIN/MAX_CHALLENGE_REASON_LENGTH`
- Depends on: `lib/challenge/validation.ts`, `lib/email/challenge.ts`
- Currently zero mentions in CLAUDE.md

**Suggested entry** (under Authenticated API section):

```
- POST `/api/challenge` Score challenge submission — authenticated, rate-limited; sends dispute email via Resend
```

### P3 — JSDoc carries (unchanged from prior cycle)

These were logged as P3 in the 2026-06-19 cycle and remain:
- `lib/cache/redis.ts`: `RateLimitResult` interface and `CacheSetNxStatus` type — no JSDoc (self-explanatory)
- `lib/db/campaigns/types.ts`: Zod schema and 5 type exports without JSDoc

---

## Environment Variables

| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
| `GITHUB_CLIENT_ID` | ✅ | ✅ via env.ts | OK |
| `GITHUB_CLIENT_SECRET` | ✅ | ✅ via env.ts | OK |
| `NEXTAUTH_SECRET` | ✅ | ✅ via env.ts | OK |
| `NEXT_PUBLIC_BASE_URL` | ✅ | ✅ via env.ts | OK |
| `UPSTASH_REDIS_REST_URL` | ✅ | ✅ via env.ts | OK |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | ✅ via env.ts | OK |
| `SUPABASE_URL` | ✅ | ✅ via env.ts | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ via env.ts | OK |
| `NEXT_PUBLIC_POSTHOG_KEY` | ✅ | ✅ via env.ts + PostHogProvider.tsx direct | OK (NEXT_PUBLIC_ in client component — acceptable) |
| `NEXT_PUBLIC_POSTHOG_HOST` | ✅ | ✅ via env.ts + PostHogProvider.tsx direct | OK (NEXT_PUBLIC_ in client component — acceptable) |
| `CHAPA_ALERT_WEBHOOK_URL` | ✅ | ✅ via env.ts | OK |
| `RESEND_API_KEY` | ✅ | ✅ via env.ts | OK |
| `RESEND_WEBHOOK_SECRET` | ✅ | ✅ via env.ts | OK |
| `SUPPORT_FORWARD_EMAIL` | ✅ | ✅ via env.ts | OK |
| `GITHUB_TOKEN` | ✅ | ✅ via env.ts | OK |
| `CHAPA_VERIFICATION_SECRET` | ✅ | ✅ via env.ts | OK |
| `NEXT_PUBLIC_STUDIO_ENABLED` | ✅ | ✅ via env.ts | OK |
| `NEXT_PUBLIC_EXPERIMENTS_ENABLED` | ✅ | ✅ via env.ts | OK |
| `NEXT_PUBLIC_INSIGHTS_ENABLED` | ✅ | ✅ via env.ts | OK |
| `BITBUCKET_CLIENT_ID` | ✅ | ✅ via env.ts | OK |
| `BITBUCKET_CLIENT_SECRET` | ✅ | ✅ via env.ts | OK |
| `NEXT_PUBLIC_BITBUCKET_ENABLED` | ✅ | ✅ via env.ts | OK |
| `CODEBERG_CLIENT_ID` | ✅ | ✅ via env.ts | OK |
| `CODEBERG_CLIENT_SECRET` | ✅ | ✅ via env.ts | OK |
| `NEXT_PUBLIC_CODEBERG_ENABLED` | ✅ | ✅ via env.ts | OK |
| `GITLAB_CLIENT_ID` | ✅ | ✅ via env.ts | OK |
| `GITLAB_CLIENT_SECRET` | ✅ | ✅ via env.ts | OK |
| `NEXT_PUBLIC_GITLAB_ENABLED` | ✅ | ✅ via env.ts | OK |
| `ADMIN_HANDLES` | ✅ | ✅ via env.ts | OK |
| `ADMIN_SECRET` | ✅ | ✅ via env.ts | OK |
| `ALLOW_AGENT_RUN` | ✅ | ✅ via env.ts | OK |
| `CRON_SECRET` | ✅ | ✅ via env.ts | OK |
| `WARM_CACHE_PRIORITY_HANDLES` | ✅ | ✅ via env.ts | OK |
| `VERCEL_ENV` | ✅ | ✅ via env.ts | OK |
| `ANALYZE` | ✅ (noted as dev-only) | ✅ via next.config.ts | OK (intentionally outside env.ts) |
| `CI` | — | playwright.config.ts | OK (test-only, documented as intentional omission) |
| `PLAYWRIGHT_BASE_URL` | — | playwright.config.ts | OK (test-only, intentional omission) |
| `DEPLOYMENT_SMOKE_STRICT` | — | e2e/smoke.spec.ts | OK (test-only, intentional omission) |

**Env var coverage: 100%. Zero mismatches. Zero undocumented server-side vars.**

---

## Shared Context Health

`docs/agents/shared-context.md` — 453 lines, entries as recent as **2026-06-26** (coverage + cost analyst). GREEN. All agent types have active entries well within the 3-per-type limit.

---

## TODO/FIXME Scan

No real documentation-gap TODOs found. One false positive: `lib/agents/agent-config.ts:283` — this is the audit prompt's own instruction text rendered into the agent config, not a real TODO.

---

## Recommendations

| Priority | Item | Action |
|----------|------|--------|
| **P2** | `POST /api/challenge` missing from CLAUDE.md | Add one-line entry under "Authenticated API" section: `POST /api/challenge Score challenge submission — authenticated, rate-limited; sends dispute email via Resend` |
| P3 | `lib/cache/redis.ts` — `RateLimitResult` + `CacheSetNxStatus` no JSDoc | Add one-line JSDoc (carry from prior cycle) |
| P3 | `lib/db/campaigns/types.ts` — Zod schema + 5 type exports no JSDoc | Add one-line JSDoc per export (carry from prior cycle) |

**The only actionable item is P2: add the `/api/challenge` route to CLAUDE.md.** Everything else is green.
