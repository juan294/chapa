# Documentation Report
> Generated: 2026-07-10 | Branch: `develop` | HEAD `9bfb9a6c` | Health status: **green**

## Executive Summary
Documentation is fully in sync with the codebase: all 90 filesystem routes are documented in CLAUDE.md, all 38 color tokens match `globals.css` bidirectionally, every required spec doc is present and non-empty, and there are zero environment-variable mismatches. No stale or missing documentation found.

## Route Documentation
90 filesystem routes total (34 `page.tsx` + 50 `api/**/route.ts` + 6 non-API `route.ts`). All are documented in CLAUDE.md. Representative coverage below; experiment pages are covered by the documented `GET /experiments/*` wildcard.

| Route | Documented in CLAUDE.md | Has API docs | Status |
|-------|------------------------|-------------|--------|
| `GET /` | yes | n/a (page) | OK |
| `GET /studio` | yes | n/a (page) | OK |
| `GET /admin` | yes | n/a (page) | OK |
| `GET /u/[handle]` | yes | n/a (page) | OK |
| `GET /u/[handle]/badge.svg` | yes | yes | OK |
| `GET /u/[handle]/og-image` | yes | yes | OK |
| `GET /verify/[hash]` | yes | n/a (page) | OK |
| `GET /archetypes/{7 types}` | yes (all 7) | n/a (page) | OK |
| `GET /experiments/*` (13 pages) | yes (wildcard) | n/a (page) | OK |
| `GET /cli/authorize` | yes | n/a (page) | OK |
| `POST /api/challenge` | yes | yes | OK |
| `GET /api/cron/latency-check` | yes | yes | OK |
| `POST /api/telemetry` | yes | yes | OK |
| `GET /api/admin/engagement-flags` | yes | yes | OK |
| `GET\|POST /api/admin/campaigns` (+`[id]`, preview, send, test) | yes | yes | OK |
| `GET /api/notifications/unsubscribe` | yes | yes | OK |
| `POST /api/webhooks/resend` | yes | yes | OK |
| `GET /.well-known/security.txt` | yes | yes | OK |
| `GET /llms.txt`, `/llms-full.txt` | yes | yes | OK |
| `GET /og-image` | yes | yes | OK |
| _(all remaining 60 routes)_ | yes | yes | OK |

**Undocumented routes:** none. **Documented-but-missing routes:** none.

## Stale Documentation
None. Specifically verified this cycle:
- **Design tokens** — 38/38 `--color-*` tokens in `docs/design-system.md` match `apps/web/styles/globals.css` exactly (both `comm` directions empty: zero drift, zero orphans).
- **Route table** — CLAUDE.md route list matches the filesystem; the two routes that were doc-lag risks in prior cycles (`POST /api/challenge`, `GET /api/cron/latency-check`) are both present.
- **JSDoc P3 carry closed** — `apps/web/lib/db/campaigns/types.ts` now carries 15 JSDoc blocks over its Zod-derived exports (was the last outstanding P3); no longer a gap.

## Missing Documentation
None.
- **Required spec docs** all present & non-empty: `impact-v4.md` (131), `impact-v5.md` (152), `impact-v6.md` (307, current truth), `svg-design.md` (173), `design-system.md` (236), `README.md` (228).
- **README** has setup instructions: `## Quick Start` (prerequisites → install → env copy → dev server on port 3001), plus `## Environment Variables`, `## Scripts`, `## Key Endpoints`.
- **`docs/agents/shared-context.md`** present (454 lines), fresh through 2026-07-10 (triage and cost-analyst entries dated today).
- **Complex-logic JSDoc** — scoring (`lib/impact`), cache (`lib/cache/redis.ts`), and render (`lib/render`) exports remain fully documented per prior cycles; no new undocumented complex exports observed.

## Environment Variables
Zero mismatches. Every documented var maps to real usage; every server var flows through `lib/env.ts`. Direct `process.env.*` reads outside `lib/env.ts` are all either test/e2e infrastructure or client-component build-time inlining (both permitted).

| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
| All `lib/env.ts`-brokered server vars (GITHUB_*, SUPABASE_*, UPSTASH_*, RESEND_*, ADMIN_*, CRON_SECRET, CHAPA_*, platform OAuth, etc.) | yes | yes (via `env.ts`) | OK |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | yes | yes direct in `components/PostHogProvider.tsx` (client, build-time inline) | OK — acceptable |
| `NEXTAUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (direct) | yes | only in `test/contract/invoke.ts` + `e2e/journey.spec.ts` | OK — test infra |
| `ANALYZE` | yes | `next.config.ts` | OK |
| `NODE_ENV`, `CI`, `VERCEL_*` | intentionally omitted | standard build vars | OK — documented as omitted |
| `PLAYWRIGHT_BASE_URL`, `DEPLOYMENT_SMOKE_STRICT` | omitted | test/smoke only | OK — test-only |
| `process.env.X`, `process.env.UPPERCASE` | n/a | ESLint doc-comment literals in `env.ts` | OK — not real vars |

## TODO/FIXME Doc-Gap Scan
1 match, a false positive: `apps/web/lib/agents/agent-config.ts:283` is this documentation agent's own prompt template ("Look for TODO/FIXME comments that reference missing documentation"), not a real gap. No actionable doc-referencing TODOs.

## Recommendations
No blocking or high-priority documentation actions this cycle. The codebase and docs are in sync.

- **(P4, optional)** Consider enumerating the 13 individual `/experiments/*` pages in the CLAUDE.md route list instead of the wildcard, if per-page discoverability ever matters. The current wildcard is accurate and intentional — no action needed now.

---

_Verification commands run: filesystem route enumeration (`find … page.tsx|route.ts`), `comm`-based token diff (globals.css ↔ design-system.md), `process.env.*` grep vs `lib/env.ts`, required-doc line counts, TODO/FIXME doc-reference grep, README heading scan._
