# Documentation Report
> Generated: 2026-06-12 | Health status: green | HEAD: `5ef06c09`

## Executive Summary

All documentation is current and accurate: 82 filesystem routes match CLAUDE.md 100%, all 38 color tokens match between `globals.css` and `docs/design-system.md`, and all 7 required reference docs exist and are non-empty. One minor JSDoc gap (`getSessionSecret` in `lib/auth/session.ts:31`) and one direct `process.env` read in `PostHogProvider.tsx` outside `lib/env.ts` are the only non-trivial findings — neither affects runtime behavior.

---

## Route Documentation

All 82 routes verified against the filesystem (`apps/web/app/`). No undocumented routes; no documented-but-missing routes.

| Category | Count | Documented in CLAUDE.md | Status |
|----------|-------|------------------------|--------|
| Auth API (`/api/auth/*`) | 10 | Yes (all 10) | ✅ |
| Admin API (`/api/admin/*`) | 12 | Yes (all 12) | ✅ |
| Cron + Webhooks | 4 | Yes (all 4) | ✅ |
| Public API (profile/history/verify/etc.) | 9 | Yes (all 9) | ✅ |
| Authenticated API (generate/refresh/studio/etc.) | 7 | Yes (all 7) | ✅ |
| CLI auth | 2 | Yes (both) | ✅ |
| Special routes (llms.txt, og-image, .well-known, badge.svg) | 6 | Yes (all 6) | ✅ |
| Pages (/, /about, /studio, /u/:handle, archetypes, experiments, etc.) | 32 | Yes (all 32) | ✅ |
| **Total** | **82** | **82/82** | **✅ 100%** |

---

## Color Token Audit

| Compared | globals.css | design-system.md | Match |
|----------|-------------|-----------------|-------|
| `--color-*` tokens | 38 | 38 | ✅ Exact match |
| Archetype colors | 7 (`builder` → `artificer`) | 7 | ✅ |
| Dimension colors | 10 (5 + 5 light variants) | 10 | ✅ |
| Core UI tokens | 21 | 21 | ✅ |

Zero drift between source and documentation.

---

## Required Reference Docs

| File | Exists | Lines | Notes |
|------|--------|-------|-------|
| `docs/impact-v4.md` | ✅ | 131 | Deprecated spec, retained for history |
| `docs/impact-v5.md` | ✅ | 152 | Previous version |
| `docs/impact-v6.md` | ✅ | 287 | Current scoring truth |
| `docs/svg-design.md` | ✅ | 173 | Badge rendering spec |
| `docs/design-system.md` | ✅ | 236 | Full design system |
| `README.md` | ✅ | 224 | Quick Start at line 75 |
| `docs/agents/shared-context.md` | ✅ | 515 | Most recent entry: 2026-06-12 |

---

## Stale Documentation

None found. Color tokens, routes, and env vars all match current code at HEAD `5ef06c09`.

---

## Missing Documentation

### Low priority

| Item | Location | Gap |
|------|----------|-----|
| `getSessionSecret` JSDoc | `lib/auth/session.ts:31` | One-liner utility missing `/** ... */` comment; other 4/5 exports in this file are documented |

---

## Environment Variables

All 32 production env vars in `lib/env.ts` are documented in `CLAUDE.md`. Standard framework vars (`CI`, `NODE_ENV`, `VERCEL_*`) and test-only vars (`DEPLOYMENT_SMOKE_STRICT`, `PLAYWRIGHT_BASE_URL`) are intentionally omitted per the existing policy.

| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
| `GITHUB_CLIENT_ID` | ✅ | `lib/env.ts:21` | ✅ |
| `GITHUB_CLIENT_SECRET` | ✅ | `lib/env.ts:24` | ✅ |
| `NEXTAUTH_SECRET` | ✅ | `lib/env.ts` | ✅ |
| `NEXT_PUBLIC_BASE_URL` | ✅ | `lib/env.ts` | ✅ |
| `UPSTASH_REDIS_REST_URL` | ✅ | `lib/env.ts` | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | `lib/env.ts` | ✅ |
| `SUPABASE_URL` | ✅ | `lib/env.ts` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | `lib/env.ts` | ✅ |
| `NEXT_PUBLIC_POSTHOG_KEY` | ✅ | `lib/env.ts` + `PostHogProvider.tsx:8` (direct) | ⚠️ minor |
| `NEXT_PUBLIC_POSTHOG_HOST` | ✅ | `lib/env.ts` + `PostHogProvider.tsx:9` (direct) | ⚠️ minor |
| `CHAPA_ALERT_WEBHOOK_URL` | ✅ | `lib/env.ts:60` | ✅ |
| `CHAPA_VERIFICATION_SECRET` | ✅ | `lib/env.ts` | ✅ |
| `RESEND_API_KEY` | ✅ | `lib/env.ts` | ✅ |
| `RESEND_WEBHOOK_SECRET` | ✅ | `lib/env.ts` | ✅ |
| `SUPPORT_FORWARD_EMAIL` | ✅ | `lib/env.ts` | ✅ |
| `GITHUB_TOKEN` | ✅ | `lib/env.ts` | ✅ |
| `ADMIN_HANDLES` | ✅ | `lib/env.ts` | ✅ |
| `ADMIN_SECRET` | ✅ | `lib/env.ts` | ✅ |
| `ALLOW_AGENT_RUN` | ✅ | `lib/env.ts` | ✅ |
| `CRON_SECRET` | ✅ | `lib/env.ts` | ✅ |
| `WARM_CACHE_PRIORITY_HANDLES` | ✅ | `lib/env.ts` | ✅ |
| `BITBUCKET_CLIENT_ID` | ✅ | `lib/env.ts` | ✅ |
| `BITBUCKET_CLIENT_SECRET` | ✅ | `lib/env.ts` | ✅ |
| `NEXT_PUBLIC_BITBUCKET_ENABLED` | ✅ | `lib/env.ts` | ✅ |
| `CODEBERG_CLIENT_ID` | ✅ | `lib/env.ts` | ✅ |
| `CODEBERG_CLIENT_SECRET` | ✅ | `lib/env.ts` | ✅ |
| `NEXT_PUBLIC_CODEBERG_ENABLED` | ✅ | `lib/env.ts` | ✅ |
| `NEXT_PUBLIC_STUDIO_ENABLED` | ✅ | `lib/env.ts` | ✅ |
| `NEXT_PUBLIC_EXPERIMENTS_ENABLED` | ✅ | `lib/env.ts` | ✅ |
| `NEXT_PUBLIC_INSIGHTS_ENABLED` | ✅ | `lib/env.ts` | ✅ |
| `VERCEL_ENV` | ✅ | `lib/env.ts` | ✅ |
| `ANALYZE` | ✅ (intentional omission note) | `next.config.ts:5` (build-only) | ✅ |

**Minor inconsistency**: `PostHogProvider.tsx:8-9` reads `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` directly via `process.env` instead of routing through `lib/env.ts`. Both vars are fully documented; this is an access pattern inconsistency only with no documentation gap.

---

## JSDoc Coverage

| File | Exported functions | Documented | Coverage |
|------|--------------------|------------|----------|
| `lib/impact/v6.ts` | 9 | 9 | 100% ✅ |
| `lib/cache/redis.ts` | 16 | 16 | 100% ✅ |
| `lib/db/campaigns.ts` | 13 | 13 | 100% ✅ |
| `lib/auth/session.ts` | 5 | 4 | 80% ⚠️ (`getSessionSecret:31` missing) |

---

## TODO/FIXME Doc-Gap Scan

0 real findings. One false positive: `lib/agents/agent-config.ts:281` contains the audit prompt's own template text.

---

## Recommendations

| # | Priority | Item | Action |
|---|----------|------|--------|
| 1 | Low | `getSessionSecret` missing JSDoc | Add one-line `/** Returns the session signing secret from env. */` above `lib/auth/session.ts:31` |
| 2 | Low | `PostHogProvider.tsx:8-9` direct env reads | Route through `lib/env.ts` accessors to stay consistent with access pattern policy |
