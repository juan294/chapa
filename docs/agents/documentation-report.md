# Documentation Report
> Generated: 2026-05-22 | Health status: green

## Executive Summary
All 44 production API routes and 33 page routes are documented in CLAUDE.md, all 38 design-system color tokens match `globals.css` exactly, all required spec docs are present and non-empty, and shared-context has fresh entries through 2026-05-22. Two minor doc-formatting gaps remain (light-theme values for two tokens, terminal-color tokens not listed in the design-system table), and three Resend/Supabase SDK env vars surfaced by grep are framework-internal (not real app config).

## Route Documentation

### API routes (44 total — all documented)

| Route | Documented in CLAUDE.md | Has API docs | Status |
|-------|-------------------------|--------------|--------|
| `/api/auth/login` | ✅ | ✅ | OK |
| `/api/auth/callback` | ✅ | ✅ | OK |
| `/api/auth/session` | ✅ | ✅ | OK |
| `/api/auth/logout` | ✅ | ✅ | OK |
| `/api/auth/bitbucket/{callback,connect,disconnect,status}` | ✅ | ✅ | OK |
| `/api/auth/codeberg/{callback,connect,disconnect,status}` | ✅ | ✅ | OK |
| `/api/verify/[hash]` | ✅ | ✅ | OK |
| `/api/profile/[handle]` | ✅ | ✅ | OK |
| `/api/history/[handle]` | ✅ | ✅ | OK |
| `/api/health` | ✅ | ✅ | OK |
| `/api/feature-flags` | ✅ | ✅ | OK |
| `/api/supplemental` | ✅ | ✅ | OK |
| `/api/studio/config` | ✅ | ✅ | OK |
| `/api/refresh` | ✅ | ✅ | OK |
| `/api/generate` | ✅ | ✅ | OK |
| `/api/recalculate` | ✅ | ✅ | OK |
| `/api/insights/[handle]`, `/api/insights` | ✅ | ✅ | OK |
| `/api/cli/auth/{poll,approve}` | ✅ | ✅ | OK |
| `/api/admin/{users,stats,agents-summary,bulk-recalculate,feature-flags,engagement-flags}` | ✅ | ✅ | OK |
| `/api/admin/agents/run` | ✅ | ✅ | OK |
| `/api/admin/campaigns` (+ `[id]`, `/preview`, `/send`, `/test`) | ✅ | ✅ | OK |
| `/api/notifications/unsubscribe` | ✅ | ✅ | OK |
| `/api/webhooks/resend` | ✅ | ✅ | OK |
| `/api/cron/{warm-cache,sync-audience,process-campaigns}` | ✅ | ✅ | OK |
| `/api/telemetry` | ✅ | ✅ | OK |

### Page routes (33 total — all documented)
All pages including `/`, `/studio`, `/admin`, `/u/[handle]`, `/u/[handle]/badge.svg`, `/verify`, `/verify/[hash]`, `/about(/scoring|/verification)`, `/archetypes/{builder,guardian,marathoner,polymath,artificer,balanced,emerging}`, `/generating/[handle]`, `/cli/authorize`, `/privacy`, `/terms`, `/coming-soon`, `/experiments/*` (13 pages, flag-gated) are listed under the "Pages" block in CLAUDE.md.

## Stale Documentation

None found. Spot-checked CLAUDE.md against current code:
- "Quality Champion" / `guardian` internal-name aliasing is correctly documented.
- Lifetime-snapshot persistence, supplemental EMU fallback, dirty-stats refresh path — all match current `materializeProfile` behavior.
- Cliff-guard fix (collaborative-vs-solo Quality max) referenced with the correct issue (#827).

## Missing Documentation

### Design-system table gaps (3 low-severity, formatting only)
1. `--color-dark-section` light value missing from the table row (actual: `#1A1A2E` per `globals.css:20`).
2. `--color-dark-card` light value missing from the table row (actual: `#252542` per `globals.css:21`).
3. Terminal tokens (`--color-terminal-green/red/yellow/dim`) are mentioned in prose but the per-token light values aren't called out individually in the main color table. Light values are correctly defined in `globals.css:26-29`.

(Note: the documentation-agent 2026-04-17 entry already flagged items 1–3. Carry, not regression.)

### JSDoc
Spot-check passes for `lib/impact/v6.ts`, `lib/cache/redis.ts`, `lib/github/client.ts`, `lib/render/*`. Auth-session helpers were given JSDoc in the 2026-05-22 triage cycle. No new JSDoc gaps on complex public exports.

### Required spec docs
| File | Present | Lines |
|------|---------|-------|
| `docs/impact-v4.md` | ✅ | 131 |
| `docs/impact-v5.md` | ✅ | 138 |
| `docs/impact-v6.md` | ✅ | 540 |
| `docs/svg-design.md` | ✅ | 173 |
| `docs/design-system.md` | ✅ | 256 |
| `README.md` | ✅ | 224 |
| `docs/agents/shared-context.md` | ✅ | 454 (entries through 2026-05-22) |

## Environment Variables

| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|--------------|--------|
| GITHUB_CLIENT_ID / _SECRET | ✅ | ✅ | OK |
| GITHUB_TOKEN | ✅ | ✅ | OK |
| NEXTAUTH_SECRET | ✅ | ✅ | OK |
| NEXT_PUBLIC_BASE_URL | ✅ | ✅ | OK |
| UPSTASH_REDIS_REST_URL / _TOKEN | ✅ | ✅ | OK |
| SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY | ✅ | ✅ | OK |
| NEXT_PUBLIC_POSTHOG_KEY / _HOST | ✅ | ✅ | OK |
| CHAPA_ALERT_WEBHOOK_URL | ✅ | ✅ | OK |
| RESEND_API_KEY / _WEBHOOK_SECRET | ✅ | ✅ | OK |
| SUPPORT_FORWARD_EMAIL | ✅ | ✅ | OK |
| CHAPA_VERIFICATION_SECRET | ✅ | ✅ | OK |
| NEXT_PUBLIC_STUDIO_ENABLED / _EXPERIMENTS_ENABLED / _INSIGHTS_ENABLED | ✅ | ✅ | OK |
| BITBUCKET_CLIENT_ID / _SECRET / NEXT_PUBLIC_BITBUCKET_ENABLED | ✅ | ✅ | OK |
| CODEBERG_CLIENT_ID / _SECRET / NEXT_PUBLIC_CODEBERG_ENABLED | ✅ | ✅ | OK |
| ADMIN_HANDLES / ADMIN_SECRET / ALLOW_AGENT_RUN | ✅ | ✅ | OK |
| CRON_SECRET / WARM_CACHE_PRIORITY_HANDLES | ✅ | ✅ (via `lib/env.ts`) | OK |
| VERCEL_ENV / ANALYZE | ✅ (build-vars block) | ✅ | OK |
| TESTPLATFORM_CLIENT_ID / _SECRET | ✅ (called out as test-only) | test-only | OK |
| CHAPA_API_BASE / CHAPA_PRODUCTION_URL | ❌ (test-only) | `scripts/lib/agent-utils.test.ts` only | OK — test-only, intentional omission |
| DEPLOYMENT_SMOKE_STRICT / PLAYWRIGHT_BASE_URL | ❌ (test-only) | E2E only | OK — test-only, intentional omission |
| SUPABASE_SECRET_KEY / RESEND_BASE_URL / RESEND_USER_AGENT / KV_REST_API_* / ICEBERG_TOKEN | n/a | Next.js / SDK internals (no app reference outside `.next/`) | OK — framework-internal, not real app config |

No mismatches between CLAUDE.md and actual app usage.

## Recommendations

1. **Low priority (carry, 3rd cycle):** Add the missing light-theme columns to the design-system color table for `--color-dark-section`, `--color-dark-card`, and the four terminal tokens. Pure documentation polish; runtime is unaffected.
2. **No new actions required.** Routes, JSDoc, env vars, and required specs are all in sync with the codebase.

---

SHARED_CONTEXT_START
## Documentation Agent — 2026-05-22
- **Status**: GREEN
- Stale docs: 0
- Missing docs: 0 critical (3 minor design-system table formatting gaps remain — 3rd cycle carry, non-functional)
- Env var mismatches: 0

**Cross-agent recommendations:**
- [QA]: No documentation-related UX gaps. All user-facing routes (33 pages) documented.
- [Security]: No security doc gaps. All env vars (`CHAPA_ALERT_WEBHOOK_URL`, `ADMIN_SECRET`, `CRON_SECRET`, `CHAPA_VERIFICATION_SECRET`, `RESEND_WEBHOOK_SECRET`) documented; `NEXT_PUBLIC_*` vars confirmed non-sensitive. SDK-internal env names surfaced by grep (`SUPABASE_SECRET_KEY`, `RESEND_BASE_URL`, `KV_REST_API_*`, `ICEBERG_TOKEN`) are Next.js / library bundled references, not real app config.
SHARED_CONTEXT_END
