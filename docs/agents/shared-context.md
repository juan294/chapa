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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-06T03:00:00Z -->
## Cost Analyst — 2026-05-06
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- Redis: **28 distinct prefixes** audited (full re-audit this cycle). TTL coverage 25/28 (89%). 3 persistent singletons unchanged: `cron:warm-cache:offset`, `stats:badges_generated` (INCR counter), `stats:unique_badges` (HLL ~12 KB). Growth risk: LOW.
- **All 5 recent commits are i18n-only** (1396fda5, 25573aba, 8f6fe87a) — zero Redis writes, zero external API calls, zero Supabase queries. i18n uses browser cookies only (`chapa-locale`). No new cost surface.
- **P2-1 CARRIED (9th cycle)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation (`lib/db/campaigns.ts:734-751`). Threshold-gated at >5K sends/campaign. Not yet triggered.
- **MONITOR M7 CARRIED**: `config:` key TTL = 1yr per user — studio configs accumulate ~200–400 bytes/user. Negligible at current scale.
- GitHub API: cache-first unchanged (6h fresh + 7d stale + in-flight dedup). 100% timeout coverage. Only intentionally uncached: `/api/health` probe + `/api/refresh` (5/hr + auth).
- Supabase: **11 tables** confirmed, singleton lazy client at `lib/db/supabase.ts:11`. 0 N+1 patterns. `dbGetLatestSnapshotBatch()` confirmed single `IN()` query for cron. No new tables or queries.
- External APIs: GitHub / Bitbucket / Codeberg / Resend / PostHog — all cached or rate-limited, all with explicit timeouts. Bitbucket and Codeberg `clearTimeout` confirmed in finally blocks.
- Cron: 3 cron routes at maxDuration=300s. Badge route has no `maxDuration` (new finding — defaults to Vercel 10s, but GitHub INFLIGHT_TIMEOUT_MS=30s). No edge routes.
- Timers: All `setTimeout` paired with `clearTimeout()` in finally blocks. No server-side `setInterval`. 0 resource leaks.
- In-memory: `_inflight` Map bounded by 30s timeout + `.finally()` clear. `inflightBadgeRenders` Map cleared in finally. `flagCache` bounded ~5–20 entries.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated).**
- **MONITORS M1–M5 CARRIED**: avatar cache (~300 MB @10K users), OG image cache (~200 MB @1K active/day), HLL (~12 KB), `metrics_snapshots` row growth (~3.65M rows/year @10K — cleanup wired), `withErrorCapture` PostHog spike risk (fire-and-forget, timeout-protected).

**Cross-agent recommendations:**
- [Performance]: Badge route (`app/u/[handle]/badge.svg/route.ts`) has no `export const maxDuration`. Vercel Pro defaults to 10s. The GitHub API `INFLIGHT_TIMEOUT_MS=30s` could trip at 10s on cold paths. Recommend adding `export const maxDuration = 30`.
- [Security]: Fetch timeouts 100%. Fail-open rate limiter intact. Resend webhook 3-layer defense intact. `lib/env.ts` typed getters trim invisible chars on all env reads.
- [Coverage]: `app/api` 97.5%, `lib/db` 96.5%, `lib/cache` 98.1% — stable. No cost-path coverage gaps found this cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-05T03:00:00Z -->
## Cost Analyst — 2026-05-05
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- Redis: **21+ distinct prefixes** audited. TTL coverage 18/21 (86%). 3 persistent singletons unchanged: `cron:warm-cache:offset`, `stats:badges_generated` (INCR), `stats:unique_badges` (HLL ~12 KB). Growth risk: LOW.
- **All 5 commits since 2026-05-02 are i18n-only** — zero Redis writes, zero external API calls, zero Supabase queries. No new cost surface.
- **P3 CLOSED**: `revalidateTag("feature-flags")` wired to PATCH `/api/admin/feature-flags` in May 2 triage. Monitor M6 retired.
- **NEW MONITOR M7**: `config:` key TTL = 31536000s (1 year per user) — studio badge configs accumulate per user. LOW risk at current scale; watch if studio adoption grows.
- **ISR constraint confirmed**: Archetype/about pages remain dynamic due to Navbar `await headers()` — architectural constraint, not regression. The `unstable_cache` fix (Apr 30) still reduces Redis RTTs on dynamic requests.
- GitHub API: cache-first unchanged (6h fresh + 7d stale + in-flight dedup). 100% timeout coverage. Only intentionally uncached: `/api/health` probe + `/api/refresh` (5/hr + auth).
- Supabase: **11 tables + 2 views + 1 RPC** unchanged. Singleton lazy client at `lib/db/supabase.ts:11`. 0 N+1 patterns. No new tables or queries.
- External APIs: GitHub / Bitbucket / Codeberg / Resend / PostHog — all cached or rate-limited, all with explicit timeouts. No new external surface.
- Cron: **4 handlers** at maxDuration=300s unchanged. No edge routes. No oversized routes.
- Timers: All `setTimeout` paired with `clearTimeout()`. No server-side `setInterval`. 0 resource leaks.
- In-memory: `_inflight` Map bounded by 30s timeout + `.finally()` clear. `flagCache` bounded by feature flags table size (~5-20 entries).
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED (7th cycle)**: `dbGetCampaignStats()` 4-query parallel count aggregation (`lib/db/campaigns.ts:734-751`). Move to `GROUP BY status` RPC at >5K sends/campaign. Not yet triggered.
- **MONITOR M1–M5 CARRIED**: avatar cache (~300 MB @10K users), OG image cache (~200 MB @1K active/day), HLL (~12 KB), `metrics_snapshots` row growth (~3.65M rows/year @10K — cleanup wired), `withErrorCapture` PostHog spike risk at high error rate (fire-and-forget, timeout-protected).

**Cross-agent recommendations:**
- [Performance]: Navbar `await headers()` is the remaining barrier to ISR on archetype/about pages. If CDN cache-hit ratio for those pages is a goal, consider moving session reads out of the Navbar into per-page RSC boundaries.
- [Security]: Fetch timeouts 100%. Fail-open rate limiter intact. Resend webhook 3-layer defense intact. `lib/env.ts` typed getters trim invisible chars on all env reads.
- [Coverage]: `app/api` 97.5%, `lib/db` 96.5% — stable. No cost-path coverage gaps. Studio config cache path (`config:` 1-year TTL) has no dedicated test; low priority but worth one fixture.
<!-- ENTRY:END -->

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



<!-- ENTRY:START agent=triage timestamp=2026-05-06T06:41:00Z -->
## Triage — 2026-05-06
- **Reports processed**: 3 (cc-rpi-update OK, cost-analyst GREEN, coverage YELLOW→resolved)
- **Action items resolved**: 3 of 3 — all implemented
- **Summary**: (1) Added runtime `generateMetadata` tests for `artificer/page.tsx` and `emerging/page.tsx` in `archetypes-component.render.test.tsx` — both were at 0% v8 coverage because only source-string tests existed. (2) Added jsdom render test `cli/authorize/error.render.test.tsx` — component was at 0% stmts despite a source-string test existing. (3) Fixed `lib/i18n/detect.ts` branches from 75% → 100%: added 1 test for the reachable `param.startsWith('q=')` false path (non-q semicolon param like `charset=utf-8`), and added `/* v8 ignore next */` to 3 unreachable `?? ''` branches forced by `noUncheckedIndexedAccess`. Total: 4 files changed, +104 insertions, +8 new tests. cc-rpi at v1.18.0 (no action). Cost-analyst GREEN (P2-1 still threshold-gated, 9th carry cycle).
- **Skipped with reason**: Cost-analyst P2-1 (`dbGetCampaignStats` GROUP BY RPC) — threshold-gated at >5K sends/campaign; not yet triggered.

**Cross-agent recommendations:**
- [Coverage]: 3 P2 gaps closed this cycle. `app/archetypes` and `cli/authorize/error.tsx` should now report 100%. `lib/i18n/detect.ts` should report 100% branches. Monitor for new P2s next cycle.
- [Cost Analyst]: No cost-path changes this cycle. P2-1 carry unchanged at cycle 9.
- [cc-rpi-update]: Validation preamble-agnostic fix from May 5 is holding — report shows correct "already up to date" status.
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

<!-- ENTRY:START agent=triage timestamp=2026-05-05T10:20:00Z -->
## Triage — 2026-05-05
- **Reports processed**: 3 (cc-rpi-update FALSE FAILURE again, coverage YELLOW, shared-context reference)
- **Action items resolved**: 10 of 10 — all implemented
- **Summary**: (1) Fixed cc-rpi validation for the 3rd consecutive false FAILED cycle: replaced brittle preamble first-line matching with a secondary `grep -q "cc-rpi sync: already up to date"` check anywhere in the file. Root cause: preamble text changed from "The local cc-rpi..." (May 3 fix) to "The cc-rpi blueprint HEAD is identical to..." — brittle regex kept failing. New approach is preamble-agnostic. (2) Fixed `BadgeToolbar > strips @keyframes` flaky test (4th cycle): isolated root cause to `setDownloadStatus("idle")` queuing a React state update that races into the next test's stub setup. Fix: `await act(async () => {})` before `vi.unstubAllGlobals()` in the test's finally block — drains React's concurrent scheduler. (3) Added 3 branch-coverage tests: `pickFromAcceptLanguage` malformed-q and empty-lang-token paths; `getClientIp` whitespace-only XFF last hop. (4) Added 5-test source-string suites for `archetypes/artificer/page.tsx` and `archetypes/emerging/page.tsx` (both 0% coverage). (5) Added `generateMetadata` runtime tests to `about/scoring`, `about/verification`, `verify`, and `cli/authorize` pages (+11 tests total). (6) Merged Dependabot PR #839 (jsdom + @supabase/supabase-js + posthog-js, 3× patch, CI green). Total: 10 files changed, 211 insertions.
- **Skipped with reason**: P2-1 (`dbGetCampaignStats` GROUP BY RPC) — threshold-gated at >5K sends/campaign; not yet triggered (8th carry cycle).

**Cross-agent recommendations:**
- [cc-rpi-update]: Validation is now preamble-agnostic — grep checks for success string anywhere in file. If false FAILEDs recur next cycle, the success string itself may be changing (investigate Claude output format).
- [Coverage]: `BadgeToolbar @keyframes` flake fix uses `await act(async () => {})` scheduler drain. If it recurs, suspect the component's finally block or another async state update path.
- [Cost Analyst]: No cost-path changes this cycle. P2-1 carry unchanged at cycle 8.
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

<!-- ENTRY:START agent=coverage timestamp=2026-05-06T02:00:00Z -->
## Coverage Agent — 2026-05-06
- **Status**: GREEN
- Overall coverage: **96.63% stmts** (8956/9268), 92.53% branches, 95.34% funcs, 97.65% lines
- Test suite: 444 files, 7559 tests (+22 vs 2026-05-05). Duration 97s with coverage.
- Delta vs 2026-05-05: stmts +0.14pp, branches +0.03pp, funcs +0.16pp, lines +0.16pp — stable growth.
- Critical paths GREEN: lib/impact 99.6%, lib/render 100%, lib/db 96.5%, app/api 97.5%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/bitbucket 97.7%, lib/codeberg 98.0%, lib/email 97.6%, lib/analytics 97.3%, lib/history 98.3%, lib/profile 100%, lib/insights 100%, lib/async 100%, lib/log 100%, lib/env 100%.
- **P2 RETIRED**: `app/verify/page.tsx` → 100% (was 55.6%), `app/about/scoring` → 100% (was 76.9%), `app/about/verification` → 100% (was 78.6%), `app/cli/authorize/page.tsx` → 100% (was 78.9%). All May 5 triage fixes confirmed.
- **P2 active**: `app/archetypes/artificer/page.tsx` + `emerging/page.tsx` 0% stmts (source-string tests only, v8 requires runtime imports); 5 other archetype pages 80% stmts/50% funcs (`generateMetadata` untested as runtime); `app/cli/authorize/error.tsx` 0% stmts (no test); `lib/i18n/detect.ts` 75% branches (one branch still uncovered).
- **Flaky tests: 0** — all 3 consecutive runs clean (7559/7559 each). `BadgeToolbar > strips @keyframes` did NOT recur — May 5 `await act(async () => {})` drain fix is holding. Monitor one more cycle before closing.
- **P3 carried (accepted)**: experiments/** Canvas/JSDOM-blocked, `HolographicOverlay.tsx` 50% stmts, `ParticleBackground.tsx` 90.4%/77.8% funcs (Canvas), `GlobalCommandBarLazy`/`ClientInstrumentation`/`SharePageOwnerContentLazy` 60–67% stmts (next/dynamic lazy wrappers, no testable logic), archetypeDemoData/demoData 50% branches (TS overload signatures), `lib/i18n/lang-sync.tsx` 50% branches (SSR guard).

**Cross-agent recommendations:**
- [Security]: lib/analytics 97.3% stmts / 89.5% branches stable. SENSITIVE_PATTERNS redaction paths unchanged. No new security-relevant gaps.
- [QA]: BadgeToolbar flake appears resolved — 3 clean runs. Recommend one more cycle of monitoring before dropping the watch.
- [Triage]: P2 items: 7 archetype pages need runtime generateMetadata tests (not source-string), `cli/authorize/error.tsx` needs one test, `lib/i18n/detect.ts` needs one branch test. All are small one-test fixes.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-05-05T02:00:00Z -->
## Coverage Agent — 2026-05-05
- **Status**: GREEN
- Overall coverage: **96.49% stmts** (8943/9268), 92.5% branches, 95.18% funcs, 97.49% lines
- Test suite: 440 files, 7537 tests (+243 tests, +28 files vs 2026-05-01). Duration 113s with coverage.
- Delta vs 2026-05-01: stmts +3.10pp, branches +2.58pp, funcs +4.29pp, lines +3.06pp — driven by i18n command-description and share-menu tests added in recent commits.
- Critical paths GREEN: lib/impact 99.6%, lib/render 100%, lib/db 96.5%, app/api 97.5%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/bitbucket 97.7%, lib/codeberg 98.0%, lib/email 97.6%, lib/analytics 97.3%, lib/history 98.3%, lib/profile 100%, lib/insights 100%, lib/async 100%, lib/log 100%, lib/env 100%.
- **P2 active**: `app/verify/page.tsx` 55.6% stmts/50% funcs (both render paths + `generateMetadata` untested); `app/about/scoring/page.tsx` 76.9% stmts; `app/about/verification/page.tsx` 78.6% stmts; `app/cli/authorize/page.tsx` 78.9% stmts/50% funcs; `lib/i18n/detect.ts` 68.8% branches; `app/archetypes/artificer` + `emerging` 0% stmts (shell pages, no tests).
- **Flaky test — RECURRED**: `BadgeToolbar > strips @keyframes` failed in run 2 of 3. May 2 triage fix (synchronous MockImage callbacks) did not hold — now in 4th confirmed cycle.
- **P3 carried (accepted)**: experiments/** Canvas/JSDOM-blocked, `HolographicOverlay.tsx` 50% stmts (Canvas), `ParticleBackground.tsx` 90.4% stmts/77.8% funcs (Canvas), `archetypeDemoData/demoData` 50% branches (TS overload signatures), `lib/env.ts` 87.5% branches (one ternary), `lib/http/client-ip.ts` 75% branches.

**Cross-agent recommendations:**
- [Security]: lib/analytics 97.3% stmts / 89.5% branches — SENSITIVE_PATTERNS redaction paths stable. `lib/http/client-ip.ts` 75% branches — one IP-extraction fallback untested; low risk but security-adjacent.
- [QA]: `BadgeToolbar > strips @keyframes` is in its 4th confirmed flake cycle. Synchronous MockImage fix insufficient — recommend full rewrite using `vi.spyOn(Image.prototype)` or a proper fetch interceptor pattern.
- [Triage]: New P2 items: verify page 55.6%, about/scoring 76.9%, about/verification 78.6%, cli/authorize 78.9% — all `generateMetadata` + locale-branch patterns, one-test fixes each. Flaky test requires escalation.
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

<!-- ENTRY:START agent=coverage_agent timestamp=2026-05-05T00:10:44Z -->
## Coverage Agent — 2026-05-05
- **Status**: GREEN
- Overall coverage: **96.49% stmts** (8943/9268), 92.5% branches, 95.18% funcs, 97.49% lines
- Test suite: 440 files, 7537 tests (+243 tests, +28 files vs 2026-05-01). Duration 113s with coverage.
- Delta vs 2026-05-01: stmts +3.10pp, branches +2.58pp, funcs +4.29pp, lines +3.06pp — driven by i18n tests added in recent commits.
- Critical paths: lib/impact 99.6%, lib/render 100%, lib/db 96.5%, app/api 97.5%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/bitbucket 97.7%, lib/codeberg 98.0%, lib/email 97.6%, lib/analytics 97.3%, lib/history 98.3%, lib/profile 100%, lib/insights 100%, lib/async 100%, lib/log 100%, lib/env 100%.
- Critical gaps: `app/verify/page.tsx` 55.6% stmts (P2), `app/about/scoring/page.tsx` 76.9% stmts (P2), `app/about/verification/page.tsx` 78.6% stmts (P2), `app/cli/authorize/page.tsx` 78.9% stmts (P2), `lib/i18n/detect.ts` 68.8% branches (P2), `app/archetypes/artificer` + `emerging` 0% stmts (P2 minor).
- Flaky tests: 1 — `BadgeToolbar > strips @keyframes` recurred in run 2 of 3 despite May 2 triage fix.

**Cross-agent recommendations:**
- [Security]: lib/analytics 97.3% stmts / 89.5% branches — SENSITIVE_PATTERNS redaction paths stable. `lib/http/client-ip.ts` 75% branches — one IP-extraction fallback untested; low risk but security-adjacent.
- [QA]: `BadgeToolbar > strips @keyframes` flake is now in its 4th confirmed cycle (April 30, May 1, May 2 fix, May 5 recurrence). The synchronous MockImage callback fix did not hold. Recommend escalating to a full rewrite of the MockImage stub using a proper fetch interceptor or `vi.spyOn(Image.prototype)`.
- [Triage]: No retired P2 items this cycle (all were cleared in May 2 triage). New P2 items: verify page 55.6%, about/scoring 76.9%, about/verification 78.6%, cli/authorize 78.9% — all `generateMetadata` + locale-branch patterns, likely one-test fixes each. Flaky BadgeToolbar test requires escalation.
<!-- ENTRY:END -->
