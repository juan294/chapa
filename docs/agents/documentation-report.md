# Documentation Report
> Generated: 2026-04-03 | Branch: `develop` | Health status: **GREEN**

## Executive Summary

Documentation is in excellent shape. All issues from the 2026-03-27 audit have been resolved — route method mismatches corrected, `POST /api/telemetry` added, JSDoc gaps filled, and rogue env vars confirmed as test-only false positives. No P1 or P2 items remain.

---

## Route Documentation

### Pages (34 routes)

| Route | In CLAUDE.md | Status |
|-------|-------------|--------|
| `/` | ✓ | OK |
| `/studio` | ✓ | OK |
| `/admin` | ✓ | OK |
| `/u/:handle` | ✓ | OK |
| `/verify/:hash` | ✓ | OK |
| `/verify` | ✓ | OK |
| `/about` | ✓ | OK |
| `/about/scoring` | ✓ | OK |
| `/about/verification` | ✓ | OK |
| `/archetypes/:type` (7 pages) | ✓ pattern | OK |
| `/generating/:handle` | ✓ | OK |
| `/cli/authorize` | ✓ | OK |
| `/privacy` | ✓ | OK |
| `/terms` | ✓ | OK |
| `/coming-soon` | ✓ | OK |
| `/experiments/*` (13 pages) | ✓ pattern | OK |

### API Routes (44 route.ts files under `/api/`)

All 44 API routes are documented in CLAUDE.md with correct HTTP methods. Five method mismatches from the 2026-03-27 audit were corrected in the 2026-03-28 triage:

| Route | Previous mismatch | Resolved |
|-------|------------------|---------|
| `GET /api/cli/auth/poll` | Was documented as `GET\|POST` | ✓ |
| `PATCH /api/admin/feature-flags` | Was documented as `GET\|PATCH` | ✓ |
| `GET /api/admin/engagement-flags` | Was documented as `GET\|PUT` | ✓ |
| `POST\|GET\|DELETE /api/admin/agents/run` | Was documented as `POST` only | ✓ |
| `GET /api/notifications/unsubscribe` | Was documented as `POST` | ✓ |

**Route coverage: 44/44 API routes + all pages — 100%**

---

## Stale Documentation

None. All previously stale items resolved:

| Item | Previous State | Current State |
|------|---------------|---------------|
| `POST /api/telemetry` | Undocumented | Added to CLAUDE.md |
| 5 HTTP method mismatches | Stale | Fixed (2026-03-28 triage) |
| `animate-shimmer-sweep` missing | Not in table | Added to `docs/design-system.md` |
| `animate-hex-cell-in` duration | Undocumented | 0.45s added to table |
| `--color-complement` dark override | Unconfirmed | Confirmed `#10B981` same in both themes |

---

## Missing Documentation

None critical.

- **Internal helper JSDoc** — Non-exported helpers in `lib/dashboard/generate-insights.ts` and `lib/insights/parser.ts` lack JSDoc. Private functions; acceptable per project convention. All public exports are documented.

---

## Environment Variables

| Variable | In CLAUDE.md | Used in code | Notes |
|----------|-------------|-------------|-------|
| `ADMIN_HANDLES` | ✓ | ✓ | OK |
| `ADMIN_SECRET` | ✓ | ✓ | OK |
| `ALLOW_AGENT_RUN` | ✓ | ✓ | OK |
| `ANALYZE` | ✓ | ✓ | OK |
| `BITBUCKET_CLIENT_ID` | ✓ | ✓ | OK |
| `BITBUCKET_CLIENT_SECRET` | ✓ | ✓ | OK |
| `CHAPA_VERIFICATION_SECRET` | ✓ | ✓ | OK |
| `CODEBERG_CLIENT_ID` | ✓ | ✓ | OK |
| `CODEBERG_CLIENT_SECRET` | ✓ | ✓ | OK |
| `CRON_SECRET` | ✓ | ✓ | OK |
| `GITHUB_CLIENT_ID` | ✓ | ✓ | OK |
| `GITHUB_CLIENT_SECRET` | ✓ | ✓ | OK |
| `GITHUB_TOKEN` | ✓ | ✓ | OK |
| `NEXTAUTH_SECRET` | ✓ | ✓ | OK |
| `NEXT_PUBLIC_BASE_URL` | ✓ | ✓ | OK |
| `NEXT_PUBLIC_BITBUCKET_ENABLED` | ✓ | ✓ | OK |
| `NEXT_PUBLIC_CODEBERG_ENABLED` | ✓ | ✓ | OK |
| `NEXT_PUBLIC_EXPERIMENTS_ENABLED` | ✓ | ✓ | OK |
| `NEXT_PUBLIC_INSIGHTS_ENABLED` | ✓ | ✓ | OK |
| `NEXT_PUBLIC_POSTHOG_HOST` | ✓ | ✓ | OK |
| `NEXT_PUBLIC_POSTHOG_KEY` | ✓ | ✓ | OK |
| `NEXT_PUBLIC_STUDIO_ENABLED` | ✓ | ✓ | OK |
| `RESEND_API_KEY` | ✓ | ✓ | OK |
| `RESEND_WEBHOOK_SECRET` | ✓ | ✓ | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | OK |
| `SUPABASE_URL` | ✓ | ✓ | OK |
| `SUPPORT_FORWARD_EMAIL` | ✓ | ✓ | OK |
| `UPSTASH_REDIS_REST_TOKEN` | ✓ | ✓ | OK |
| `UPSTASH_REDIS_REST_URL` | ✓ | ✓ | OK |
| `VERCEL_ENV` | ✓ | ✓ | OK |
| `WARM_CACHE_PRIORITY_HANDLES` | ✓ | ✓ | OK |
| `CI` | — | ✓ | Universal CI standard — no doc needed |
| `NODE_ENV` | — | ✓ | Universal Node.js standard — no doc needed |
| `TESTPLATFORM_CLIENT_ID` | — | test files only | Fake OAuth in `lib/auth/platform-oauth.test.ts` — test scaffolding, not a production variable |
| `TESTPLATFORM_CLIENT_SECRET` | — | test files only | Same as above |

**Env var coverage: 31/31 production variables documented — 100%**

---

## Design System Token Coverage

**Color tokens: 38/38 — 100%**

All `--color-*` tokens in `apps/web/styles/globals.css` match entries in `docs/design-system.md`. Light and dark values are properly defined for all tokens. `--color-complement` uses `#10B981` in both themes (intentional — confirmed in CSS).

**Animation table: 18/18 — 100%**

All animation classes documented with durations and descriptions.

---

## Required Docs

| File | Exists | Non-empty | Notes |
|------|--------|-----------|-------|
| `docs/impact-v4.md` | ✓ | ✓ | Historical v4 spec |
| `docs/impact-v6.md` | ✓ | ✓ | Current spec, source of truth |
| `docs/svg-design.md` | ✓ | ✓ | Badge SVG design spec |
| `README.md` | ✓ | 215 lines | Full setup, CI badges, stack, features |
| `docs/agents/shared-context.md` | ✓ | Active | 10 entries, latest 2026-04-03 |

---

## TODO/FIXME Audit

Zero `TODO`/`FIXME` comments referencing documentation in `apps/web/lib/` or `apps/web/app/`. No outstanding documentation debt markers.

---

## Recommendations

| Priority | Item | Action |
|----------|------|--------|
| P3 | `TESTPLATFORM_*` env vars | No action needed — already test-only. Optionally add an inline comment in `platform-oauth.test.ts` clarifying these are fake OAuth credentials for test scaffolding. |
| P3 | Internal helper JSDoc | Optional — non-exported helpers in `generate-insights.ts` and `parser.ts` could get inline comments, but this is style preference only. |

**No P1 or P2 items.**
