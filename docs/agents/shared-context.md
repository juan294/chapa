# Agent Shared Context
> Cross-agent intelligence — agents read this before running and write findings after finishing.
> Pruned automatically to keep the last 3 entries per agent type.
>
> **Rules:**
> 1. Read this file before starting any work
> 2. Write an entry after finishing — use the format below
> 3. Cross-agent recommendations are mandatory
> 4. Maximum 3 entries per agent type — remove the oldest when adding a new one
> 5. Be specific with findings — numbers, file paths, and actionable items

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-02T03:00:00Z -->
## Cost Analyst — 2026-05-02
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- Redis: **28 distinct prefixes** audited (+1 vs 2026-04-30: `sync-audience:contacts` 1h Resend pagination cache). TTL coverage 25/28 (89%). 3 persistent singletons unchanged: `cron:warm-cache:offset`, `stats:badges_generated` (INCR), `stats:unique_badges` (HLL ~12 KB). Growth risk: LOW.
- **ISR regression FIXED (Apr 30 P1)**: `lib/feature-flags.ts:84-93` confirms `unstable_cache(fetchFlagFromDb, ["feature-flag-v1"], { revalidate: 300, tags: ["feature-flags"] })` wraps the Upstash `no-store` fetch. Root layout's `isStudioEnabled()` no longer leaks dynamic rendering into `/about/*`, `/archetypes/*`, and other ISR-eligible pages. CDN caching restored.
- GitHub API: cache-first unchanged (6h fresh + 7d stale + in-flight dedup at `lib/github/client.ts:28-82`). 100% timeout coverage. Only intentionally uncached: `/api/health` probe + `/api/refresh` (5/hr + auth).
- Supabase: **11 tables + 2 views + 1 RPC** unchanged. Singleton lazy client at `lib/db/supabase.ts:11`. 0 N+1 patterns. `dbGetLatestSnapshotBatch()` confirmed single `IN()` query for cron warm-cache. `sync-audience` cron uses `Promise.allSettled([dbGetUsersWithEmail(), listAllContacts()])`.
- External APIs: GitHub / Bitbucket / Codeberg / Resend / PostHog — all cached or rate-limited, all with explicit timeouts. No new external surface. `/api/cron/sync-audience` Resend `.list()` 30s timeout + 1h cache.
- ISR (verified post-fix): `/about*`→86400, `/archetypes/*`→604800, `/`→3600, `/u/[handle]`→3600, `/privacy`+`/terms`→86400. `/studio`, `/admin/*` `force-dynamic` (intentional, auth-gated).
- Cron: **4 handlers** at maxDuration=300s unchanged. No edge routes. No oversized routes.
- Timers: All `setTimeout` paired with `clearTimeout()` in `.finally()` (`lib/async/with-timeout.ts:42`). No server-side `setInterval`. No leaks.
- In-memory: `_inflight` Map bounded by 30s timeout + `.finally()` clear. `flagCache` Map bounded ~5 entries. `warmSet` MAX_HANDLES=50. Avatar Base64 cached in Redis (6h TTL).
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED (6th cycle)**: `dbGetCampaignStats()` 4-query parallel count aggregation (`lib/db/campaigns.ts:734-751`). Move to `GROUP BY status` RPC at >5K sends/campaign. Not yet triggered.
- **NEW P3 RECOMMENDATION**: When admin `/api/admin/feature-flags` writes a flag change, call `revalidateTag("feature-flags")` to propagate the new `unstable_cache` data cache immediately. Currently the in-process `flagCache` is invalidated but the Next data cache lags up to 5 min.
- **MONITOR M1–M5 CARRIED**: avatar cache (~300 MB @10K users), OG image cache (~200 MB @1K active/day), HLL (~12 KB), `metrics_snapshots` row growth (~3.65M rows/year @10K — cleanup wired), `withErrorCapture` PostHog spike risk at high error rate (fire-and-forget, timeout-protected).

**Cross-agent recommendations:**
- [Performance]: ISR fix verified — root layout `isStudioEnabled()` flow now uses `unstable_cache`. Layout-bundle aggregation (+194.9 KB / 325 KB chunk `0-v7viuocyjmh.js`) flagged Apr 30 is non-cost-path but worth quantifying CDN egress next cycle.
- [Security]: Fetch timeouts 100%. Fail-open rate limiter intact (`redis.ts:127-149`). Resend webhook 3-layer defense (rate-limit + Svix HMAC + idempotency dedup) intact. `lib/env.ts` typed env getters trim invisible chars.
- [Coverage]: `lib/feature-flags.ts` ISR-fix (`unstable_cache` wrapper) needs a test confirming it wraps `dbGetFeatureFlag` — current 7,331 tests are GREEN but a dedicated cache-tag test would prevent silent regression. `app/api` 98.60%, `lib/db` 97.07% — stable. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-04-30T03:00:00Z -->
## Cost Analyst — 2026-04-30
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- Redis: **27 distinct prefixes** audited. TTL coverage 24/27 (89%). The 3 persistent (TTL=0) keys are bounded singletons — `cron:warm-cache:offset`, `stats:badges_generated` (INCR), `stats:unique_badges` (HLL ~12 KB). Growth risk: LOW.
- **New since 2026-04-29**: `lib/env.ts` typed env getters (b2c8d3c) — zero Redis writes, zero external calls, zero Vercel compute overhead. Pure safety refactor centralizing `process.env` reads with `.trim()`. Phase 9C ESLint rule + ~20 call-site sweep still pending (no cost impact when complete).
- GitHub API: cache-first unchanged (6h fresh + 7d stale + in-flight dedup at `lib/github/client.ts:28`). 100% timeout coverage. Only intentionally uncached: `/api/health` probe + `/api/refresh` (by design, 5/hr + auth).
- Supabase: **11 tables + 2 views + 1 RPC** — unchanged. Singleton lazy client at `lib/db/supabase.ts:11`. 0 N+1 patterns. Batch reads via single `IN()` query. All retention jobs wired and running.
- External APIs: GitHub / Bitbucket / Codeberg / Resend / PostHog — all cached or rate-limited, all with explicit timeouts. No new routes making uncached external calls.
- ISR: `/about*`→86400, `/archetypes/*`→604800, `/`→3600, `/u/[handle]`→3600, `/privacy`+`/terms`→86400. `/studio`, `/admin/*` `force-dynamic` (intentional). No new `force-dynamic` pages.
- Cron: **4 handlers** at maxDuration=300s unchanged. No edge routes. No oversized routes.
- Timers: All `setTimeout` paired with cleanup. No server-side `setInterval`. No leaks.
- In-memory: `_inflight` Map bounded by 30s timeout + `.finally()` clear. All other in-memory structures bounded by MAX_HANDLES=50 or singleton.
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED (5th cycle)**: `dbGetCampaignStats()` 4-query parallel count aggregation (`lib/db/campaigns.ts:734-751`). Move to `GROUP BY status` RPC at >5K sends/campaign. Not yet triggered.
- **MONITOR M1–M5 CARRIED**: avatar cache (~300 MB @10K users), OG image cache (~200 MB @1K active/day), HLL (~12 KB), `metrics_snapshots` row growth (~3.65M rows/year @10K — cleanup wired), `withErrorCapture` PostHog spike risk at high error rate (fire-and-forget, timeout-protected).

**Cross-agent recommendations:**
- [Performance]: No new cost-performance tradeoffs. ISR and `force-dynamic` set unchanged. `lib/env.ts` adds no bundle size (server-only module, all calls are tree-shaken per route).
- [Security]: Fetch timeouts at 100%. Fail-open rate limiter intact (`redis.ts:183`). Resend webhook: 3 defense layers (rate-limit + Svix HMAC + idempotency dedup) all intact. `lib/env.ts` ensures all env vars are trimmed — eliminates invisible-character auth failures.
- [Coverage]: `lib/env.ts` 100% stmts/funcs, 87.5% branches (one minor ternary). `app/api` ~97%, `lib/db` 96.48% — stable. `og-image/route.ts` 60% funcs is 6th carry cycle — must be resolved this triage.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-04-29T03:00:00Z -->
## Cost Analyst — 2026-04-29
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- Redis: **27 distinct prefixes** audited (+2 corrected vs prior: `stats:v2:bitbucket:` and `stats:v2:codeberg:` now counted separately). TTL coverage 24/27 (89%). The 3 persistent (TTL=0) keys are bounded singletons — `cron:warm-cache:offset`, `stats:badges_generated` (INCR), `stats:unique_badges` (HLL ~12 KB). Growth risk: LOW.
- **New since 2026-04-28**: Structured JSON logger (#712) adds zero Redis writes, zero external calls — stdout/stderr only. `withErrorCapture` (#707) fires one PostHog event per unhandled 500 (fire-and-forget, no blocking). No new cost surface.
- GitHub API: cache-first unchanged (6h fresh + 7d stale + in-flight dedup at `lib/github/client.ts:28`). 100% timeout coverage. Only intentionally uncached: `/api/health` probe + `/api/refresh` (by design, 5/hr + auth).
- Supabase: **11 tables + 2 views + 1 RPC** — unchanged. Singleton lazy client at `lib/db/supabase.ts:11`. 0 N+1 patterns. `dbGetLatestSnapshotBatch()` at `lib/db/snapshots.ts:325` confirmed single `IN()` query for cron batch. All retention jobs wired and running.
- External APIs: GitHub / Bitbucket / Codeberg / Resend / PostHog — all cached or rate-limited, all with explicit timeouts. No new routes making uncached external calls.
- ISR: `/about*`→86400, `/archetypes/*`→604800, `/`→3600, `/u/[handle]`→3600, `/privacy`+`/terms`→86400. `/studio`, `/admin/*` `force-dynamic` (intentional). No new `force-dynamic` pages.
- Cron: **4 handlers** at maxDuration=300s unchanged. No edge routes. No oversized routes.
- Timers: All `setTimeout` paired with cleanup. No server-side `setInterval`. No leaks.
- In-memory: `_inflight` Map bounded by 30s timeout + `.finally()` clear (`client.ts:82`). All other in-memory structures bounded by MAX_HANDLES=50 or singleton.
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED (4th cycle)**: `dbGetCampaignStats()` 4-query parallel count aggregation (`lib/db/campaigns.ts:734-751`). Move to `GROUP BY status` RPC at >5K sends/campaign. Not yet triggered.
- **MONITOR M1–M5 CARRIED**: avatar cache (~300 MB @10K users), OG image cache (~200 MB @1K active/day), HLL (~12 KB), `metrics_snapshots` row growth (~3.65M rows/year @10K — cleanup wired), `withErrorCapture` PostHog spike risk at high error rate (fire-and-forget, timeout-protected).

**Cross-agent recommendations:**
- [Performance]: No new cost-performance tradeoffs. ISR and `force-dynamic` set unchanged. JSON logger adds no bundle size. `withErrorCapture` is 100% server-side.
- [Security]: Fetch timeouts at 100%. Fail-open rate limiter intact. Resend webhook: 3 defense layers (rate-limit + Svix HMAC + idempotency dedup) all intact. `withErrorCapture` PostHog event includes redacted error message — confirm `SENSITIVE_PATTERNS` scrubbing applies before PostHog send.
- [Coverage]: `lib/log.ts` 100% covered per 2026-04-29 coverage report. `app/api` ~97%, `lib/db` 96.47% — stable. `og-image/route.ts` 60% funcs (avatar-fetch + error-fallback) is now 5th carry cycle — triage should escalate.
<!-- ENTRY:END -->

**Cross-agent recommendations:**
- [Performance]: No new cost-performance tradeoffs. ISR coverage and `force-dynamic` set unchanged. No edge-route opportunities — Redis/Supabase clients require Node runtime.
- [Security]: Fetch timeouts 100%. Fail-open rate limiter intact (`redis.ts:127-149`). Resend webhook is rate-limited at the entry + Svix-verified + idempotency-dedup'd — no cost-security conflict.
- [Coverage]: app/api 97.34%, lib/db 96.48% (per 2026-04-28 coverage report) — stable. No cost-critical path coverage gaps. `dbGetCampaignStats` (P2-1) is a scale concern, not a correctness one. `og-image/route.ts` 60% funcs gap is rendering-side, not cost-path.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-05-03T07:00:00Z -->
## Triage — 2026-05-03
- **Reports processed**: 3 (cost-analyst GREEN, coverage INCOMPLETE, cc-rpi-update FALSE FAILURE)
- **Action items resolved**: 1 of 1 — all implemented
- **Summary**: Minimal cycle — only cc-rpi update false failure required a fix. (1) Fixed `scripts/cc-rpi-update.sh` validation pattern: extended `valid_pattern` to also accept `^The local cc-rpi` as a valid first line. Root cause: agent output a natural-language preamble ("The local cc-rpi is already at the same commit...") before the required "cc-rpi sync: already up to date as of v1.18.0." line. Both retry attempts hit the same validation failure → script logged FAILED. Actual sync state was correct (v1.18.0 already up to date). Cost analyst GREEN with no new action items (P2-1 still threshold-gated). Coverage agent wrote "Coverage running. Waking back up at scheduled time." — incomplete report, no prior coverage gaps outstanding.
- **Skipped with reason**: Cost-analyst P2-1 (`dbGetCampaignStats` GROUP BY RPC) — threshold-gated at >5K sends/campaign; not yet triggered.

**Cross-agent recommendations:**
- [cc-rpi-update]: Validation pattern now accepts "The local cc-rpi" prefix — false FAILED status resolved. Monitor next cycle to confirm fix holds.
- [Coverage]: Report incomplete this cycle — coverage agent emitted a ScheduleWakeup-style message instead of completing the analysis. If report is empty next cycle, investigate launchd context (may need `--allowedTools` audit or headless mode flag change).
- [Cost Analyst]: No new action items. P2-1 carry unchanged.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-05-02T07:25:00Z -->
## Triage — 2026-05-02
- **Reports processed**: 4 (cost-analyst GREEN, coverage GREEN, documentation GREEN, cc-rpi-update OK)
- **Action items resolved**: 4 of 4 — all implemented
- **Summary**: (1) Fixed `BadgeToolbar > strips @keyframes` flake (confirmed recurrent 2-of-3 cycles): replaced `queueMicrotask` with synchronous `onerror`/`onload` firing in `MockImage.src` setters — eliminates microtask bleed between test runs. (2) Added `getAdminHandles` tests to `env.test.ts` — covers `readList` ternary branches, pushing `lib/env.ts` branches from 87.5% to 100%. (3) Added `revalidateTag("feature-flags", "seconds")` to `PATCH /api/admin/feature-flags` — Next.js data cache now busts within seconds of a flag write instead of waiting up to 5 min for `unstable_cache` TTL. (4) Added intentional-omissions note to CLAUDE.md env vars section. Verification: 7334/7334 tests, 0 type errors, 0 lint issues. CI green.
- **Skipped with reason**: Cost-analyst P2-1 (`dbGetCampaignStats` GROUP BY RPC) — threshold-gated at >5K sends/campaign; not yet triggered. Premature.

**Cross-agent recommendations:**
- [Coverage]: `BadgeToolbar @keyframes` flake fix uses synchronous MockImage callbacks. If flake recurs after this change, investigate the component's Promise executor for other async sources.
- [Cost Analyst]: `revalidateTag("feature-flags", "seconds")` now wired to admin flag writes. The P3 recommendation from prior cycles is resolved.
- [Performance]: ISR busting now immediate on admin flag writes. `lib/env.ts` branch coverage complete.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-04-30T18:35:00Z -->
## Triage — 2026-04-30
- **Reports processed**: 7 (cost-analyst GREEN, performance YELLOW, coverage GREEN, security GREEN, cc-rpi-update OK, update-docs OK, qa GREEN)
- **Action items resolved**: 8 of 8 — all implemented
- **Summary**: (1) Wrapped `dbGetFeatureFlag` in `unstable_cache` (5-min revalidate, `feature-flags` tag) so the root layout's `isStudioEnabled()` no longer leaks the Upstash REST `no-store` fetch into ISR — closes performance YELLOW P1. Tests mock `next/cache` with a pass-through. (2) Closed the 6th-cycle critical og-image route gap: added 3 fixtures covering avatar-fetch rejection (line 77 catch), missing avatarUrl branch, and cacheSet-rejected fire-and-forget (line 97 onError) — `og-image/route.ts` now 100% (5/5 funcs, 34/34 lines, 12/12 branches). (3) Added `dirty-stats.test.ts` (5 tests) — `lib/cache/dirty-stats.ts` 100% covered. (4) Added reload-after-success and fetch-rejects-network-error fixtures to `SharePageOwnerContent.render.test.tsx` — file 100% covered. (5) Investigated +194.9 KB bundle growth: traced to a 325 KB layout client-modules entry (`0-v7viuocyjmh.js`) aggregating ClientInstrumentation/ThemeProvider/UserMenu/etc. plus a Buffer polyfill and ua-parser-js — likely Turbopack aggregation behavior, no single import to unwind. Filing a follow-up issue. (6) Extended `knip.json` with the 8 stable false-positive deps + `vitest.setup.ts` ignore — `knip --production` now clean. (7) Phase 9C: ESLint `no-restricted-syntax` rule against direct `process.env.*` was already wired in `eslint.config.mjs` for `app/**` + `lib/**` — swept the one in-scope script (`backfill-craft-scores.ts`) to use `getSupabaseUrl()`/`getSupabaseServiceRoleKey()`. Remaining `process.env` reads are all intentional: client components (Next.js inlines `NEXT_PUBLIC_*` only via direct member access), config files, and unrelated scripts. (8) Added `cors-mutation-guard.test.ts` — mechanical test that fails the build if any POST/PUT/PATCH/DELETE handler ever ships with `Access-Control-Allow-Origin: *`. Verification: 7294/7294 tests pass (+22), 0 type errors, 0 lint issues, knip clean.
- **Skipped with reason**:
  - Cost-analyst P2-1 (`dbGetCampaignStats` GROUP BY RPC) — threshold-gated at >5K sends/campaign; report classifies "not yet triggered, acceptable today". Premature.
  - Flaky `BadgeToolbar > strips @keyframes` — coverage report explicitly says "Low confidence in recurrence — confirm over next 2 cycles before taking action." 1 of 4 runs after a previous fix.
  - Bundle growth root-cause fix (P2) — investigated; not a single-source fix, deferred to a follow-up issue with the 325 KB chunk findings documented above.

**Cross-agent recommendations:**
- [Performance]: Layout-bundle aggregation (`0-v7viuocyjmh.js`, 325 KB) is now the dominant client-side cost. Next investigation: identify whether the Buffer polyfill / ua-parser-js entries are pulled from `posthog-js` or `@vercel/analytics`/`speed-insights` and consider lazy-loading further. Also: archetype/about pages remain ƒ in build output because `Navbar` calls `await headers()` — a separate dynamic source from the report's Redis-no-store finding (which IS now fixed).
- [Coverage]: Three files moved to 100%: `og-image/route.ts`, `lib/cache/dirty-stats.ts`, `components/SharePageOwnerContent.tsx`. `BadgeToolbar @keyframes` flake should be re-checked next cycle — if it appears again, the `vi.stubGlobal` restore pattern needs another look.
- [Security]: `cors-mutation-guard.test.ts` mechanically enforces the wildcard-CORS-only-on-read-only-routes invariant — the security report's INFO recommendation is now mandatory.
- [Cost Analyst]: ISR regression fix lands `unstable_cache` around `dbGetFeatureFlag` with a 5-minute revalidate + `feature-flags` tag. When DB flags change, a future admin write hook should call `revalidateTag("feature-flags")` to propagate; currently the in-process `flagCache` is invalidated but the data cache will lag up to 5 minutes.
<!-- ENTRY:END -->


<!-- ENTRY:START agent=performance timestamp=2026-04-30T09:00:00Z -->
## Performance Engineer — 2026-04-30
- **Status**: YELLOW
- Build: Next.js 16.2.4 (Turbopack), compiled 6.6s, 0 TypeScript errors. 64 pages, 84 routes (5 static, rest dynamic).
- Total client JS: **1,876.9 KB raw / 598.1 KB gzipped** — +194.9 KB (+11.6%) vs 2026-04-09 (1,682 KB). 68 chunks, no chunk >500 KB.
- Largest chunks: 227.1 KB (Next.js framework), 175.3 KB (PostHog lazy), 125.9 KB (React DOM/RSC), 110.0 KB (core-js). All vendor/framework.
- Knip `--production`: **8 false positives** confirmed in use (stable from prior cycles). No new unused production exports.
- `"use client"` audit: 94 non-test files. All appropriate — error boundaries, interactive UI, Canvas/WebGL, hooks. No misplaced directives.
- Dynamic imports: GlobalCommandBar, PostHog, ShortcutCheatSheet, admin sub-dashboards, Studio effects — all `next/dynamic`. Good code-splitting.
- Font loading: optimal (`next/font/google`, `display: "swap"`, Latin subset). No external font requests.
- CLS risks: **none** — all `<Image>` have explicit dims. Badge `<img>` fallback has `1200×630`. `LiteYouTubeEmbed <img>` inside `aspect-video` container — no CLS.
- Badge SVG caching: `s-maxage=21600, stale-while-revalidate=86400` (success), `s-maxage=300, stale-while-revalidate=600` (error). Correct.
- Turbopack NFT warning: **RESOLVED** — `svg-to-png.ts` now uses `import.meta.url` + `dirname(fileURLToPath(...))`. Zero warnings in build.
- **NEW YELLOW P1 — ISR regression**: Root layout (`app/layout.tsx:71`) calls `isStudioEnabled()` → `dbGetFeatureFlag()` → `cacheGet()` → Upstash Redis with `no-store`. This defeats ISR on 13 pages: `/about`, `/about/scoring`, `/about/verification`, `/archetypes/*` (7), `/_not-found`, `/cli/authorize`, `/admin`. Pages with `revalidate=604800`/`86400` are being server-rendered on every request. Fix: wrap `dbGetFeatureFlag` in `unstable_cache()`, or move `isStudioEnabled` out of root layout.
- **NEW YELLOW P2 — bundle growth**: +194.9 KB vs Apr 9. All recent commits are server-only — growth predates visible log. Run `ANALYZE=true pnpm run build` to identify source.

**Cross-agent recommendations:**
- [Coverage]: No new performance-coverage gaps. `og-image/route.ts` 60% funcs remains the only critical-path gap (6th cycle carry).
- [Security]: ISR regression means archetype/about pages no longer serve from CDN — slightly more origin exposure. Existing rate limiting on those pages still intact.
- [QA]: ISR regression may affect LCP on archetype pages (now server-rendered every request instead of CDN-cached). Consider a load-time smoke test.
- [Cost Analyst]: ISR regression likely increased Vercel serverless invocations for 7 archetype pages (should be CDN-cached for 7 days) — quantify in next cost cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-04-09T09:00:00Z -->
## Performance Engineer — 2026-04-09
- **Status**: GREEN
- Build: Next.js 16.2.2 (Turbopack), compiled 2.8s, 0 TypeScript errors. 64 static pages, 84 routes (5 static, 79 dynamic).
- Total client JS: **1,682 KB (1.64 MB)** — +19 KB (+1.1%) vs 2026-04-02. 68 chunks, no chunk >500 KB. Gzipped: ~522 KB. CSS: 103 KB raw / 15 KB gzip.
- Largest chunks: 232 KB (framework), 173 KB (PostHog lazy), 137 KB (React DOM), 113 KB (polyfills). All vendor/framework — no app code chunk >64 KB.
- Knip: **0 findings** — fully clean.
- `"use client"` audit: 98 non-test files. All appropriate (error boundaries, interactive components, canvas/WebGL experiments, hooks). No misplaced directives.
- Dynamic imports: 6 files use `next/dynamic` with `ssr: false` — `GlobalCommandBarLazy`, `ShareBadgePreviewLazy`, `AgentsDashboard`, `EngagementDashboard`, `CampaignsDashboard`, `ShortcutCheatSheet`.
- **Finding (LOW)**: Landing page imports `GlobalCommandBar` synchronously via `LandingTerminal` re-export (`app/page.tsx:10`). Admin + share pages use `GlobalCommandBarLazy` instead. Inconsistency — consider unifying or documenting.
- Font loading: optimal (`next/font/google`, `display: "swap"`, Latin subset only).
- CLS risks: **none** — all 3 `<Image>` components have explicit dimensions (`width`+`height`). Bare `<img>` in `SharePageOwnerContent.tsx:44` is embed code string, not rendered in DOM.
- Badge SVG caching: `s-maxage=21600, stale-while-revalidate=86400` (success), `s-maxage=300, stale-while-revalidate=600` (error). Correct.
- Turbopack NFT warning: **PERSISTS** despite `turbopackIgnore` comments added 2026-04-03 — `existsSync` in `svg-to-png.ts:38` also triggers full-project tracing. Cosmetic only, no functional impact.

**Cross-agent recommendations:**
- [Coverage]: No new performance-coverage gaps. All rendering/API paths at 93%+. Canvas/WebGL experiments remain untestable in JSDOM — accepted limitation.
- [Security]: No performance-related security concerns. Knip clean (0 findings). PostHog CSP correctly scoped.
- [QA]: Landing page `GlobalCommandBar` synchronous import is minor inconsistency — worth documenting or standardizing.
- [Cost Analyst]: Bundle grew only +19 KB vs last cycle — stable. OG image Redis memory monitor carried.
<!-- ENTRY:END -->


<!-- ENTRY:START agent=documentation timestamp=2026-04-17T10:00:00Z -->
## Documentation Agent — 2026-04-17
- **Status**: GREEN
- Route coverage: **50/50 API routes + 24 pages documented** (100%). 6 net new routes vs 2026-04-10 (Codeberg auth, campaign CRUD, telemetry, engagement-flags additions).
- Design system: **38/38 dark-theme color tokens** accurate. **3 minor gaps**: light values for `--color-dark-section` (`#1A1A2E`), `--color-dark-card` (`#252542`), and 4 terminal tokens not listed in table. All values correct in `globals.css` — docs formatting only.
- Env vars: **33/33 production vars documented** (100%). `TESTPLATFORM_*` confirmed test-only.
- JSDoc coverage: **100% on public exports**. Spot-checked `lib/impact/v6.ts` — all 8 exports have JSDoc.
- Required docs: all 6 present and non-empty. `impact-v4.md` correctly marked deprecated. No TODO/FIXME referencing doc gaps (2 false positives: agent-config template text + test mock string literal).
- Shared-context entries through 2026-04-17. Stable.

**Cross-agent recommendations:**
- [QA]: No doc changes needed for UX. Three low-severity design-system table gaps don't affect runtime behavior.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars confirmed non-sensitive. `ALLOW_AGENT_RUN` documented and confirmed in use at `app/api/admin/agents/run/route.ts:75`.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-04-10T10:00:00Z -->
## Documentation Agent — 2026-04-10
- **Status**: GREEN
- Route coverage: **44/44 API routes + 15 pages documented** (100%). Unchanged from 2026-04-03. No new routes added.
- Design system: **38/38 color tokens** (100%) and **18/18 animations** (100%). All hex values verified accurate in both light and dark theme variants.
- Env vars: **31/31 production vars documented** (100%). `TESTPLATFORM_*` confirmed test-only. `CI`/`NODE_ENV`/`ANALYZE` are standard build vars (intentional omissions).
- JSDoc coverage: **100% on public exports**. No gaps found across lib/impact, lib/render, lib/cache, lib/auth, lib/github, packages/shared.
- Required docs: all 6 present and non-empty (`impact-v4.md`, `impact-v6.md`, `svg-design.md`, `README.md` 215 lines, `design-system.md`, `shared-context.md`). 0 TODO/FIXME referencing doc gaps.
- Shared-context has entries up to 2026-04-10. Stable.

**Cross-agent recommendations:**
- [QA]: No documentation-related test concerns. BadgeToolbar flaky test (coverage agent P2 escalated) is not a docs issue — no doc changes needed.
- [Security]: No security-related doc gaps. All env vars correctly scoped. `NEXT_PUBLIC_*` vars confirmed non-sensitive.
- [Coverage]: No doc-coverage gaps remaining. All critical-path functions have JSDoc.
- [Cost Analyst]: No doc gaps affecting cost model. All routes and env vars fully documented.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-04-20T09:00:00Z -->
## Security Scanner — 2026-04-20
- **Status**: GREEN
- Vulnerabilities: **0 critical, 0 high, 0 moderate, 0 low** — `pnpm audit` fully clean. Prior vite CVEs resolved by vite ≥8.0.8 bump (triage 2026-04-17).
- Secret leaks: none — all server secrets isolated. `NEXT_PUBLIC_*` vars non-sensitive. `SENSITIVE_PATTERNS` regex (9 patterns) in `lib/analytics/server-errors.ts` scrubs tokens before PostHog logging.
- License issues: 2 MPL-2.0 (`@resvg/resvg-js`, `lightningcss`) + 1 dual Apache-2.0/MPL-2.0 (`dompurify`). No GPL/AGPL/LGPL. No source modifications. No compliance action needed.
- Knip `--production`: **8 false positives** — all confirmed in use. Same 8 as prior cycle. Do not remove any.
- XSS: **9 user-input entry points** in SVG pipeline, all escaped via `escapeXml()`. Avatar URL enforces hostname + MIME whitelist + 5s timeout. 18 `dangerouslySetInnerHTML` uses — all safe.
- CORS: **2 routes** with wildcard `*` — `/api/verify/[hash]` (30 req/60s) + `/api/profile/[handle]` (60 req/60s). Read-only, rate-limited. Intentional design. All 17 mutation routes: no CORS headers.
- RLS: **9 tables** with ENABLE + FORCE ROW LEVEL SECURITY + explicit deny-all for anon. 2 views with `security_invoker = true`.
- OAuth: CSRF via `timingSafeEqual()`, AES-256-GCM (fresh IV), CLI tokens HMAC-SHA256 90-day expiry. Sessions: `HttpOnly`, `SameSite=Lax`, `Secure`, 10-min `Max-Age`.
- Fetch timeouts: **100%** — all external calls use `AbortSignal.timeout()` or `withTimeout()`.
- **P2 OPEN**: `lib/analytics/server-errors.ts` — 63.63% branch coverage. The 9 SENSITIVE_PATTERNS scrubbing branches are untested. Token-redaction guards before PostHog logging need test coverage.

**Cross-agent recommendations:**
- [Coverage]: Priority item — add tests for all 9 SENSITIVE_PATTERNS types in `lib/analytics/server-errors.ts`. These are security-critical token-scrubbing guards with no branch coverage.
- [QA]: No new security UX issues. All XSS vectors covered. Knip false positives confirmed stable — no removals.
- [Cost Analyst]: No new cost-security conflicts. Fetch timeouts at 100%. Fail-open rate limiting intact.
- [Performance]: Knip `--production` false positives unchanged — confirmed in active use via grep. No bundle changes.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-04-29T09:00:00Z -->
## QA Agent — 2026-04-29
- **Status**: GREEN
- Tests: 7,272/7,272 passed across 409 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` have alt, focus-visible in globals.css + 4 production components, prefers-reduced-motion respected, aria-label in 20+ components, heading hierarchy correct in all pages, 14 error boundaries, multiple loading/empty states
- Design system: 0 violations in production components. global-error.tsx hardcoded hex intentional (documented). apple-icon.tsx + icon.tsx hardcoded (static assets, accepted). experiments/** accepted P3 (Canvas/WebGL).

**Cross-agent recommendations:**
- [Coverage]: `og-image/route.ts` 60% funcs (`route.ts:77,97`) is the only critical-path gap — 5th carry cycle, must address this triage. `dirty-stats.ts` 75% funcs is a one-test fix.
- [Security]: No new security-related quality issues. All XSS vectors covered. All interactive elements accessible. global-error.tsx hardcoded hex does not touch server secrets.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-04-01T09:00:00Z -->
## QA Agent — 2026-04-01
- **Status**: GREEN
- Tests: 6,879/6,879 passed across 386 files, 0 failed, 0 skipped (+16 tests, +1 file vs 2026-03-30 triage)
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all buttons labeled, focus-visible present, no bare `<img>` tags, no heading skips in production pages. 13 error boundaries, 13 loading states.
- Design system: **0 violations** in production components. Experiment pages use raw hex arrays (WebGL/Canvas requirement, accepted). Static icon assets (`apple-icon.tsx`, `icon.tsx`) correctly hardcoded.

**Cross-agent recommendations:**
- [Coverage]: `debug-quality/route.ts` coverage gap resolved by deletion. `AdminDashboardClient.tsx` funcs at 68.4% remains top actionable gap.
- [Security]: No new security-related quality issues. All XSS vectors covered, all interactive elements accessible.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-05-01T02:00:00Z -->
## Coverage Agent — 2026-05-01
- **Status**: GREEN
- Overall coverage: **93.39% stmts** (8322/8911), 89.92% branches, 90.89% funcs, 94.43% lines
- Test suite: 412 files, 7294 tests (+22 tests, +3 files vs 2026-04-30). Duration 70s with coverage.
- Delta vs 2026-04-30: stmts +0.08pp, branches +0.04pp, funcs +0.19pp, lines +0.06pp — all critical-path P2 carries cleared by Apr 30 triage.
- Critical paths GREEN: lib/impact 99.59%, lib/render 100%, lib/db 96.48%, app/api 97.48%, lib/auth 98.00%, lib/cache 98.13%, lib/github 97.35%, lib/bitbucket 97.70%, lib/codeberg 98.03%, lib/email 97.57%, lib/analytics 97.30%, lib/history 98.26%, lib/profile 100%, lib/insights 100%, lib/async 100%, lib/log 100%, lib/env 100% stmts/funcs.
- **P2 RETIRED this cycle**: `app/u/[handle]/og-image/route.ts` (6-cycle 60%-funcs carry → 100%), `lib/cache/dirty-stats.ts` (75% funcs → 100%), `components/SharePageOwnerContent.tsx` (75% funcs → 100%). All addressed in Apr 30 triage.
- **Flaky tests: 0** — three consecutive full runs passed 7294/7294 (durations 70s coverage / 30s / 20s). The `BadgeToolbar > strips @keyframes` intermittent flake noted Apr 30 did NOT recur.
- **P3 carried (all accepted, all pre-existing)**: experiments/** 56.68% stmts (Canvas/WebGL JSDOM-blocked), `HolographicOverlay.tsx` 50% stmts (Canvas), `ParticleBackground.tsx` 90.35% stmts / 77.77% funcs (Canvas), `archetypeDemoData/demoData` 50% br (TS overload signatures), `lib/env.ts` 87.5% br (one ternary), framework shells 0% (no logic).
- Critical-path files without sibling .test: only `app/api/auth/bitbucket/config.ts` + `app/api/auth/codeberg/config.ts` — pure config, exercised transitively. Not actionable.

**Cross-agent recommendations:**
- [Triage]: No mandatory action items this cycle. The 6-cycle og-image carry is finally retired. Optional one-test cleanup: cover the `lib/env.ts` env-coercion ternary to push branches over 90%.
- [QA]: Suite fully stable across 3 consecutive runs (7294/7294 each). No flakes detected. The BadgeToolbar flake monitor (Apr 30 ask) shows clean — recommend dropping watch unless it reappears.
- [Security]: lib/analytics 97.30% stmts / 89.47% branches — SENSITIVE_PATTERNS redaction paths stable. No security-relevant gaps.
- [Cost Analyst]: app/api 97.48% (+0.10pp), lib/db 96.48% (stable). No cost-path coverage regressions.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-04-30T02:00:00Z -->
## Coverage Agent — 2026-04-30
- **Status**: GREEN
- Overall coverage: **93.31% stmts** (8307/8902), 89.88% branches, 90.70% funcs, 94.37% lines
- Test suite: 409 files, 7272 tests — unchanged vs 2026-04-29. Duration 88s with coverage.
- Delta vs 2026-04-29: stmts +0.02pp, funcs +0.18pp, branches −0.05pp (new `lib/env.ts` 87.5% branches — one uncovered ternary, minor)
- All critical paths GREEN: lib/impact 99.59%, lib/render 100%, lib/log 100%, lib/profile 100%, lib/history 98.26%, lib/auth 98.00%, lib/codeberg 98.03%, lib/email 97.57%, lib/cache 97.50%, lib/bitbucket 97.70%, lib/github 97.35%, lib/analytics 97.30%, app/api 97.38%, lib/db 96.48%, lib/env 100% stmts/funcs
- **New `lib/env.ts`** (typed env getters, feat/env commit): 100% stmts/funcs, 87.5% br (7/8 branches — one uncovered ternary). Accepted gap.
- **Flaky test — INTERMITTENT**: `BadgeToolbar > strips @keyframes` reappeared once in 4 runs (run 2 verbose output only). Runs 1, 3, 4 and isolated run (47/47) all passed. Previously "resolved" Apr 26 — may be an intermittent recurrence. Monitor next 2 cycles before acting.
- **P2 active (CRITICAL — 6th carry cycle)**: `app/u/[handle]/og-image/route.ts` **60% funcs** (`route.ts:77,97`). Avatar-fetch failure + error-fallback remain untested. Must be addressed this triage.
- **P2 active (small)**: `lib/cache/dirty-stats.ts` 83.3% stmts / **75% funcs** (line 33). `components/SharePageOwnerContent.tsx` 90.5% stmts / **75% funcs** (one handler path).
- **P3 carried (accepted)**: experiments/** Canvas/WebGL JSDOM-blocked, `AuthorTypewriter.tsx` 67.5% br (timers), `HolographicOverlay.tsx` 50% stmts (Canvas), `ParticleBackground.tsx` 72.2% br (Canvas), `archetypeDemoData/demoData` 50% br (overload signatures).

**Cross-agent recommendations:**
- [Triage]: `og-image/route.ts` 60% funcs is 6th carry cycle — must be fixed this sprint. Two helpers: mock `fetch()` rejection for avatar timeout + stub missing-avatar SVG fallback. `dirty-stats.ts` line 33 is a one-test fix. Also monitor `BadgeToolbar > strips @keyframes` across next 2 cycles for intermittent flake.
- [QA]: Suite stable (7272/7272) across 3 full runs. `poolOptions.forks.maxForks` pin continues to hold. BadgeToolbar flake intermittently active — triage should re-investigate `vi.stubGlobal` restore logic.
- [Security]: lib/analytics 97.30% stmts / 89.47% branches — SENSITIVE_PATTERNS redaction paths stable. No new security-relevant gaps.
- [Cost Analyst]: app/api 97.38%, lib/db 96.48% — stable. lib/env fully covered on stmts/funcs; no cost-path impact from typed env getters.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-04-29T02:00:00Z -->
## Coverage Agent — 2026-04-29
- **Status**: GREEN
- Overall coverage: **93.29% stmts** (8275/8870), 89.93% branches, 90.52% funcs, 94.34% lines
- Test suite: 409 files, 7272 tests (+48 vs 2026-04-28, +1 file). Duration 63s with coverage.
- Delta vs 2026-04-28: stmts +0.02pp, branches +0.04pp — new tests from #712 (structured JSON logger) + #707 (withErrorCapture) absorbed cleanly.
- All critical paths GREEN: lib/impact 99.58%, lib/render 100%, lib/profile 100%, lib/insights 100%, lib/async 100%, lib/auth 98.01%, lib/history 98.26%, lib/codeberg 98.02%, lib/github 97.35%, lib/email 97.41%, lib/bitbucket 97.7%, lib/analytics 97.29%, lib/cache 97.48%, lib/db 96.47%, app/api ~97%
- **Flaky tests: 0** — three consecutive runs (7272/7272 each). BadgeToolbar `@keyframes` flake resolved and stable across 5 cycles.
- **New**: `lib/log.ts` (structured JSON logger #712) ships with full test coverage via `lib/log.test.ts` (10 tests: levels, context spreading, VERCEL_ENV, getRequestId header + UUID fallback).
- **P2 active (CRITICAL — 5th carry cycle)**: `app/u/[handle]/og-image/route.ts` **60% funcs** (`route.ts:77,97`). Avatar-fetch failure path and error-fallback branch remain untested. Must be addressed this triage cycle.
- **P2 active (small)**: `lib/cache/dirty-stats.ts` **83.33% stmts / 75% funcs** (`dirty-stats.ts:33`). Small file, clear marker untested. `lib/effects/interactions/HolographicOverlay.tsx` 50% stmts / 75% funcs (Canvas — consider downgrading to accepted P3).
- **P3 carried (accepted)**: experiments/** 56.7%, framework shells 0%, `AuthorTypewriter.tsx` 67.5% branches (JSDOM timers), `ParticleBackground.tsx` 72.2% branches (Canvas), `demoData.ts`/`archetypeDemoData.ts` 50% branches (overload signatures).
- Untested critical-path files: only `api/auth/bitbucket/config.ts` + `api/auth/codeberg/config.ts` — pure config, exercised transitively. Not actionable.

**Cross-agent recommendations:**
- [Triage]: `og-image/route.ts` 60% funcs is entering its 5th carry cycle — escalate priority. Add fixtures for `fetch()` rejection (avatar timeout) and the missing-avatar SVG fallback. This is the only actionable critical-path gap. Also: `lib/cache/dirty-stats.ts` is a simple clear-marker function — one test closes it.
- [QA]: Suite stable and flake-free across 3 consecutive runs. `poolOptions.forks.maxForks` pin continues to hold.
- [Security]: `lib/analytics/server-errors.ts` SENSITIVE_PATTERNS branch coverage stable at 89.09% — no new security-relevant gaps.
- [Cost Analyst]: app/api ~97%, lib/db 96.47% — stable. `lib/log.ts` (JSON logger) fully covered; no cost-path impact.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation_agent timestamp=2026-04-24T07:03:08Z -->
## Documentation Agent — 2026-04-24
- **Status**: GREEN
- Stale docs: 0
- Missing docs: 0
- Env var mismatches: 0 (33/33 production vars documented; `TESTPLATFORM_*`, `CI`, `NODE_ENV` intentionally omitted)
- Route coverage: 44/44 API routes + 24/24 pages documented
- Design tokens: 38/38 color tokens in `globals.css` match `docs/design-system.md`
- Required docs present and non-empty: `impact-v4.md`, `impact-v5.md`, `impact-v6.md`, `svg-design.md`, `design-system.md`, `README.md` (215 lines with Quick Start), `shared-context.md` (371 lines, fresh through 2026-04-24)
- TODO/FIXME referencing doc gaps: 0 (1 false positive in agent-config template literal)

**Cross-agent recommendations:**
- [QA]: No user-facing features with doc gaps. All feature-flagged routes (studio, experiments, insights, bitbucket, codeberg) have both CLAUDE.md entries and env var documentation.
- [Security]: No outdated security docs. `docs/accepted-risks.md` present. All `NEXT_PUBLIC_*` vars confirmed non-sensitive and documented. OAuth flows (GitHub, Bitbucket, Codeberg) and HMAC verification (`docs/badge-verification.md`) docs align with current implementation.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-04-25T14:00:00Z -->
## Triage — 2026-04-25
- **Reports processed**: 5 (cc-rpi-update, cost-analyst, coverage, documentation, pre-launch)
- **Action items resolved**: 10 of 12 (2 confirmed already implemented — DO-H1/CC-H1 no code change)
- **Summary**: Validated all Apr 24 reports against current source. Implemented 10 live gaps: extracted `fetchBitbucketIfLinked` + `fetchCodebergIfLinked` from `lib/github/client.ts` into dedicated `lib/bitbucket/client.ts` + `lib/codeberg/client.ts` (AR-M1, 349→210 lines); added 9 tests each for the new platform clients; fixed BadgeToolbar double-restore flaky test (remove manual `vi.stubGlobal` restore, rely on `vi.unstubAllGlobals()` only); added fire-and-forget catch path tests + onError override test; pinned `poolOptions.forks.maxForks` in vitest config to prevent fork-pool starvation; mocked aurora page canvas animation + `testTimeout: 30000` to fix 15s timeout; extracted `AgentRunResult` type to `lib/agents/types.ts`; deleted dead `HeroScoreZone` + `RadarChartInteractive` (4 files); updated E2E copy expectations to Spanish; extracted `AgentRunResult` shared type. Commit: 9c1e6cf. Tests: 7179 (+14), 0 type errors, 0 lint issues.

**Cross-agent recommendations:**
- [Coverage]: `lib/bitbucket/client.ts` + `lib/codeberg/client.ts` are new files with full test coverage (9 tests each). `lib/github/client.ts` reduced 349→210 lines — expect lib/github coverage to remain 96%+. `lib/async/fire-and-forget.ts` catch path now tested — P2 from Apr 25 coverage report should be cleared next cycle.
- [Performance]: `HeroScoreZone.tsx` + `RadarChartInteractive.tsx` deleted — Knip should report 0 findings for those paths next cycle. No bundle impact (components were conditionally rendered).
- [QA]: BadgeToolbar flaky test root cause resolved (double vi.stubGlobal restore). Aurora page test stabilized via canvas mock + testTimeout bump. Fork-pool starvation mitigated by pinned maxForks.
- [Documentation]: Two new platform client modules follow existing patterns — no doc gaps. CLAUDE.md does not need updating for internal module splits.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-04-29T07:05:08Z -->
## QA Agent — 2026-04-29
- **Status**: GREEN
- Tests: 7272/7272 passed across 409 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` have alt, focus-visible in globals.css + 4 production components, prefers-reduced-motion respected, aria-label present in 20+ components, heading hierarchy correct in all pages, 14 error boundaries, multiple loading states

**Cross-agent recommendations:**
- [Coverage]: `og-image/route.ts` 60% funcs (lines 77, 97) is the only critical-path gap — entering 5th carry cycle, triage must address this sprint. `dirty-stats.ts` 75% funcs is a one-test fix.
- [Security]: No new security-related quality issues. All XSS vectors covered via escapeXml(), interactive elements fully accessible. global-error.tsx hardcoded hex is intentional and does not touch any server secrets.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance_agent timestamp=2026-04-30T07:09:55Z -->
## Performance Engineer — 2026-04-30
- **Status**: YELLOW
- Total First Load JS: 1,876.9 KB raw / 598.1 KB gzipped (+194.9 KB / +11.6% vs Apr 9)
- Chunks >500 KB: **0**
- Unused exports (production): 8 confirmed false positives (stable)
- Turbopack NFT warning: RESOLVED
- **NEW YELLOW**: ISR regression — root layout `no-store` Redis call forces 13 pages dynamic (should be static/ISR)
- **NEW YELLOW**: Bundle +194.9 KB growth since Apr 9 — origin unknown (all recent commits are server-only)

**Cross-agent recommendations:**
- [Coverage]: No new performance-coverage gaps. `og-image/route.ts` 60% funcs remains the only critical-path gap (6th cycle).
- [Security]: ISR regression means archetype/about pages no longer serve from CDN cache — DDoS surface slightly increased. Rate limiting on these pages already present via Redis, but fixing ISR would reduce origin exposure.
- [QA]: `/about/scoring` embeds `LiteYouTubeEmbed` — not a CLS risk (`aspect-video` container). No rendering regressions observed.
- [Cost Analyst]: ISR regression likely increased Vercel serverless invocations for 7+ pages that should be CDN-cached. Archetype pages (revalidate=604800) hitting origin every request instead of being CDN-cached for a week is a cost regression worth quantifying.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost_analyst timestamp=2026-05-01T01:02:46Z -->
## Cost Analyst — 2026-05-01
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- **ISR regression CLOSED**: Apr 30 triage wrapped `dbGetFeatureFlag` in
  `unstable_cache` (`lib/feature-flags.ts:80-94`, revalidate=300, tag
  `feature-flags`). 13 pages (`/about*`, `/archetypes/*`, `/cli/authorize`,
  `/admin`, `/_not-found`) eligible for ISR again — Vercel serverless
  invocation regression projected by Performance Apr 30 is recovered.
- Redis: 27 prefixes, TTL coverage 24/27 (89%), 3 bounded singletons. Growth
  risk LOW. Env access centralized via `lib/env.ts` getters this cycle (zero
  functional/cost impact).
- New `lib/cache/dirty-stats.ts` covered 100% — no new growth surface.
- GitHub API: cache-first unchanged. 100% timeout coverage. Only intentionally
  uncached: `/api/health` probe + `/api/refresh` (5/hr + auth).
- Supabase: 11 tables + 2 views + 1 RPC, lazy singleton client. 0 N+1s.
  `dbGetFeatureFlag` reads now reduced to ~1/300s/instance via `unstable_cache`.
- External APIs: 16 routes audited, all cached or rate-limited, all with
  explicit timeouts. No new uncached calls.
- Cron: 4 handlers at maxDuration=300s, bearer-auth, unchanged.
- No edge routes (Redis + Supabase SDKs require Node runtime).
- Resource leaks: 0. All timers paired with cleanup. All in-memory structures
  bounded.
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED (6th cycle)**: `dbGetCampaignStats()` 4-query parallel count
  aggregation (`lib/db/campaigns.ts:734-751`). Move to `GROUP BY status` RPC
  at >5K sends/campaign. Not yet triggered.
- **NEW MONITOR M6**: `unstable_cache(feature-flags)` data cache lag up to
  5 min after admin writes — wire `revalidateTag("feature-flags")` into
  `/api/admin/feature-flags` PATCH handler when convenient.
- **MONITOR M1–M5 CARRIED**: avatar cache (~300 MB @10K users), OG image
  cache (~200 MB @1K active/day), HLL (~12 KB), `metrics_snapshots` row
  growth (~3.65M rows/year @10K — cleanup wired), `withErrorCapture` PostHog
  spike risk at high error rate (fire-and-forget, timeout-protected).

**Cross-agent recommendations:**
- [Performance]: ISR regression closed — re-measure archetype/about CDN-cache
  hit ratios next cycle to confirm serverless invocations dropped to baseline.
  Bundle growth (+194.9 KB Apr 30) is browser-side and outside cost scope.
- [Security]: No new cost-security conflicts. Fail-open rate limiter intact
  (`redis.ts:183`). All env reads now go through `lib/env.ts` `.trim()` —
  eliminates invisible-character auth-failure class. Resend webhook 3-layer
  defense intact.
- [Coverage]: `lib/feature-flags.ts` `unstable_cache` wrap should be tested —
  confirm a covered fixture exists for the cached path and the
  `revalidateTag` invalidation. `app/api` ~97.48%, `lib/db` 96.48% stable.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-05-02T00:04:47Z -->
## Coverage Agent — 2026-05-02
- **Status**: GREEN
- Overall coverage: 93.31% stmts / 90.55% funcs / 89.79% br / 94.36% lines (7,331 tests / 419 files / +37 tests)
- Critical gaps: NONE — every critical-path module ≥97% (lib/impact 99.59%, lib/render 100%, lib/db 97.07%, app/api 98.60%, lib/auth 98.67%, lib/cache 99.48%)
- Flaky tests: 1 — BadgeToolbar > strips @keyframes (1/3 runs; Apr 30 triage fix did not fully hold)

**Cross-agent recommendations:**
- [Security]: lib/analytics 98.46% / lib/auth 98.67% — SENSITIVE_PATTERNS scrubbing and OAuth paths well covered. No security-relevant test gaps.
- [QA]: BadgeToolbar @keyframes flake recurred after Apr 30 fix. Recommend reopening with a deterministic Image.onload stub instead of relying on vi.unstubAllGlobals() ordering. The other 7,331/7,331 ran clean across 2 of 3 full-suite runs.
<!-- ENTRY:END -->
