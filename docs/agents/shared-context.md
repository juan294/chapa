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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-07T03:00:00Z -->
## Cost Analyst — 2026-05-07
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- Redis: **28 distinct prefixes**, TTL coverage 25/28 (89%). 3 persistent singletons unchanged. Growth risk: LOW. Full re-audit — zero changes vs prior cycle.
- **Commits this cycle** (3d344cda, 1ff1c9e2, 34062680, 6e496747, ba1b1568): CI metadata fix + test additions + Dependabot patch bump (jsdom 29.1.0→29.1.1, @supabase/supabase-js 2.105.0→2.105.1, posthog-js 1.372.3→1.372.6). Zero Redis writes, zero new external API calls, zero new Supabase queries. posthog-js bump removed ~28 protobufjs transitive deps — slight bundle consolidation.
- **P2 ESCALATED (2nd cycle) — Badge route `maxDuration`**: `app/u/[handle]/badge.svg/route.ts` still has no `export const maxDuration`. Vercel defaults to 10s; internal `INFLIGHT_TIMEOUT_MS=30s` exceeds this — cold-path badge fetches silently killed. Fix: `export const maxDuration = 35;`.
- **P2-1 CARRIED (10th cycle)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation (`lib/db/campaigns.ts:727-765`). Threshold-gated at >5K sends/campaign. Not triggered.
- **MONITOR M7 CARRIED**: `config:` key TTL = 1yr per user (`/api/studio/config/route.ts:73`). Negligible at current scale.
- GitHub API: cache-first unchanged. 100% timeout coverage. `_inflight` Map bounded by 30s + `.finally()` clear (`lib/github/client.ts:28-84`).
- Supabase: **11 tables** confirmed, singleton lazy client at `lib/db/supabase.ts:14`. 0 N+1 patterns. No new tables.
- Feature flags: `unstable_cache` revalidate=300s confirmed in place (`lib/feature-flags.ts:84-93`). No regression.
- **P1s: NONE. P2s: 2 active (badge maxDuration escalated, P2-1 threshold-gated).**
- **MONITORS M1–M5 CARRIED** unchanged.

**Cross-agent recommendations:**
- [Performance]: Badge route `maxDuration` still missing — escalated to P2 (2nd cycle). Add `export const maxDuration = 35` at top of `app/u/[handle]/badge.svg/route.ts`. Without this, Vercel's 10s default kills badge generation on cold paths before the 30s internal timeout.
- [Security]: Fetch timeouts 100%. Fail-open rate limiter intact. Resend webhook 3-layer defense intact. Supabase singleton confirmed at `lib/db/supabase.ts:14`.
- [Coverage]: `app/api` 97.5%, `lib/db` 96.5%, `lib/cache` 98.1% — stable. No cost-path coverage gaps this cycle. Badge route cold-path (maxDuration gap) has no specific test; low priority to add.
<!-- ENTRY:END -->

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




<!-- ENTRY:START agent=triage timestamp=2026-05-09T07:30:00Z -->
## Triage — 2026-05-09
- **Reports processed**: 3 (cc-rpi-update GREEN, coverage GREEN, cost-analyst GREEN)
- **Action items resolved**: 3 of 3 — all implemented
- **Summary**: All overnight reports GREEN — no P2s, no failures, no Dependabot PRs. (1) Added `isStudioEnabledSync` describe block (4 tests) to `lib/feature-flags.test.ts` — only sync flag function without test coverage; mirrors existing `isBitbucketEnabledSync` pattern. (2) Added 2 tests to `lib/dashboard/generate-insights.test.ts`: identity-fallback path (default `t = (key) => key` parameter, never called in prior tests) and unknown-archetype lowercased-key fallback (`?? archetype.toLowerCase()` branch). (3) Added `CHAPA_ALERT_WEBHOOK_URL` to `CLAUDE.md` env-vars block — operationally critical P1 alert webhook (`lib/env.ts:59`), documented in README + runbook but missing from canonical project file. Final test count: 7587 (+6 vs last cycle). All 445 test files green.
- **Skipped with reason**: Cost-analyst P2-1 (`dbGetCampaignStats` GROUP BY RPC) — threshold-gated at >5K sends/campaign; carry cycle 11. Bundle watch deferred (informational monitor, no action needed this cycle).

**Cross-agent recommendations:**
- [Coverage]: `lib/feature-flags.ts` now at 100% funcs. `lib/dashboard/generate-insights.ts` locale-fallback branches now covered. All modules at or above 94% stmts. No new gaps to watch.
- [Cost Analyst]: No cost-path changes this cycle. P2-1 carry unchanged at cycle 11.
- [Documentation]: `CHAPA_ALERT_WEBHOOK_URL` now in CLAUDE.md env-vars block — operationally complete.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-05-08T09:22:00Z -->
## Triage — 2026-05-08
- **Reports processed**: 5 (cc-rpi-update, cost-analyst, coverage, performance, qa)
- **Action items resolved**: 7 of 7 — all implemented
- **Summary**: (1) Added `export const maxDuration = 35` to `app/u/[handle]/badge.svg/route.ts` — P2 escalated across cost+performance reports (2nd cycle): Vercel 10s default killed cold badge renders before the 30s internal timeout. (2) Added `aria-label={\`Campaign: ${c.name}\`}` to `<tr role="button">` in `campaigns-dashboard.tsx` — a11y gap flagged by QA. (3) Added 7-archetype default-export wrapper tests via `it.each` in `archetypes-component.render.test.tsx` — closed 50% funcs coverage gap. Key insight: RTL can't render async Server Components directly; call `.type` as a function, await JSX, then render. (4) Added branch-coverage tests for `sanitizeUnknown` null/number/boolean and array paths in `server-errors.test.ts` — OR-chain branch counting. (5) Extracted `stripBadgeAnimations` as `export function` from `BadgeToolbar.tsx` — replaced 5-line inline block. (6) Rewrote flaky `BadgeToolbar > download strips SVG animations` test (5th cycle): replaced MockImage-based component test with 6 pure deterministic unit tests on `stripBadgeAnimations` directly — no async, no mocking, no scheduler races. Final test count: 7581 (+5 vs last cycle). All 445 test files green.
- **Skipped with reason**: Cost-analyst P2-1 (`dbGetCampaignStats` GROUP BY RPC) — threshold-gated at >5K sends/campaign; carry cycle 10. cc-rpi validation confirmed holding.

**Cross-agent recommendations:**
- [Coverage]: `BadgeToolbar` flake permanently resolved via pure function extraction. `archetypes` default-export coverage now complete. `sanitizeUnknown` branches fully covered. Monitor for new P2 gaps next cycle.
- [Performance]: Badge route `maxDuration=35` added — cold-path badge render no longer silently killed by Vercel 10s default. P2 closed.
- [QA]: Campaigns table `<tr>` a11y gap closed. No new accessibility regressions found.
- [Cost Analyst]: No cost-path changes this cycle. P2-1 carry unchanged at cycle 10.
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

<!-- ENTRY:START agent=performance timestamp=2026-05-07T09:00:00Z -->
## Performance Engineer — 2026-05-07
- **Status**: YELLOW
- Build: Next.js 16.2.4 (Turbopack), compiled 5.9s, 0 TypeScript errors. 86 routes (4 static, 82 dynamic).
- Total client JS: **2,266 KB raw / 706.5 KB gzipped** — +389 KB (+20.7%) vs Apr 30 (1,877 KB), +584 KB (+34.7%) vs Apr 9 (1,682 KB). 79 chunks, no chunk >500 KB. Sustained 4-week upward trend.
- Largest chunks: 320 KB, 228 KB, 176 KB, 156 KB, 112 KB, 100 KB. All vendor/framework — no single chunk ≥500 KB.
- Knip `--production`: **~35 findings** — ~12 unused exported functions (insights/parser.ts, render/avatar.ts, verification/hmac.ts, profile/materialize-profile.ts) + 23 unused exported types. Prior "8 false positives" from security agent are a subset; verify before removing.
- `"use client"` audit: 109 non-test files (+15 vs Apr 30). All appropriate — error boundaries, experiments, interactive UI, hooks. Key public pages remain server components.
- ISR regression: **RESOLVED** — `lib/feature-flags.ts:84-94` wraps `dbGetFeatureFlag` in `unstable_cache()` (revalidate=300s). 13 pages eligible for CDN caching again.
- **P2 (3rd cycle) — Badge `maxDuration` missing**: `app/u/[handle]/badge.svg/route.ts` has no `export const maxDuration`. Vercel defaults 10s; `INFLIGHT_TIMEOUT_MS=30s` exceeds this — cold-path badge renders silently killed. Fix: `export const maxDuration = 35;`.
- Dynamic imports: all heavy modules lazy-loaded (`next/dynamic`). Font loading optimal (`next/font/google`). CLS risks: none. `prefers-reduced-motion`: supported.
- Bundle growth source unknown — `ANALYZE=true pnpm run build` needed to identify culprit packages.

**Cross-agent recommendations:**
- [Cost Analyst]: Badge `maxDuration` P2 still unresolved (3rd cycle). Bundle +34.7% in 4 weeks may be increasing Vercel cold-start memory. Recommend running bundle analyzer to identify source before next cost cycle.
- [Security]: Knip reports ~35 previously-unseen unused exports — verify `fetchAvatarBase64` (`lib/render/avatar.ts`), `computeHash`, `buildPayload` (`lib/verification/hmac.ts`) before removing; these are security-path functions that knip may not trace through server-only imports.
- [QA]: No CLS regressions. ISR regression confirmed resolved — archetype/about pages should now hit CDN cache. If LCP regression was observed on those pages after Apr 30, it should be recovered.
- [Coverage]: No new performance-coverage gaps. Badge cold-path (maxDuration gap) has no specific test — low priority to add.
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

<!-- ENTRY:START agent=qa timestamp=2026-05-06T09:00:00Z -->
## QA Agent — 2026-05-06
- **Status**: GREEN
- Tests: 7567/7567 passed across 445 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 1 low-severity — `<tr role="button" tabIndex={0}>` in campaigns table (`app/admin/campaigns/campaigns-dashboard.tsx:900`) missing `aria-label`. Admin-only surface. All other `<img>` tags have alt, focus-visible in globals.css + 4 production components, heading hierarchy correct, 13 error boundaries, 13 loading states.
- Design system: **0 violations** in production components. Accepted exceptions unchanged: `global-error.tsx`, `apple-icon.tsx`, `icon.tsx` static assets, `experiments/**` Canvas/WebGL.

**Cross-agent recommendations:**
- [Coverage]: Prior P2s (verify, about/scoring, about/verification, cli/authorize pages) confirmed resolved per coverage-agent May 6. Remaining P2s: 7 archetype pages `generateMetadata` runtime tests, `cli/authorize/error.tsx` 0% stmts, `lib/i18n/detect.ts` ~75% branches.
- [Security]: No security-related quality issues. Campaigns `<tr role="button">` missing `aria-label` is a11y only — no data exposure. All XSS vectors and interactive elements covered.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-05-07T02:00:00Z -->
## Coverage Agent — 2026-05-07
- **Status**: YELLOW
- Overall coverage: **96.75% stmts** (8964/9265), 92.6% branches, 95.49% funcs, 97.78% lines
- Test suite: 445 files, 7567 tests. Duration 103s with coverage.
- Delta vs 2026-05-06: stmts +0.12pp, branches +0.07pp, funcs +0.15pp, lines +0.13pp — stable.
- Critical paths GREEN: lib/impact 99.6%, lib/render 100%, lib/db 96.5%, app/api 97.5%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/analytics 97.3%.
- **RESOLVED since last cycle**: `cli/authorize/error.tsx` → 100%, `lib/i18n/detect.ts` → 100% branches, `og-image/route.ts` → 100% funcs. All May 6 triage gaps confirmed closed.
- **P2 active**: (1) 7 archetype pages (`artificer`, `balanced`, `builder`, `emerging`, `guardian`, `marathoner`, `polymath`) at 80% stmts / 50% funcs — `generateMetadata` export untested at runtime. (2) `lib/analytics/server-errors.ts` 88.23% branches — SENSITIVE_PATTERNS token-scrubbing branches untested (security-adjacent, 2nd carry cycle).
- **FLAKY TEST ESCALATED**: `BadgeToolbar > strips @keyframes` failed **2/3 runs** (5th cycle). `await act(async () => {})` drain not holding. Failure rate up from 1/3. Full test rewrite required — not another teardown patch.
- **P3 carried (accepted)**: experiments/** Canvas/JSDOM-blocked, `HolographicOverlay.tsx` 50% stmts, `ParticleBackground.tsx` 77.77% funcs (Canvas), lazy wrapper components (33–50% funcs), `lang-sync.tsx` 50% branches (SSR guard), `archetypeDemoData/demoData` 50% branches (TS overloads).

**Cross-agent recommendations:**
- [Security]: `lib/analytics/server-errors.ts` 88.23% branches — SENSITIVE_PATTERNS scrubbing (9 token types: password, token, secret, key, credential, api_key, client_secret, client_id, access_token) untested. Credential-logging-to-PostHog prevention guards. P2 security risk, 2nd carry cycle.
- [QA]: `BadgeToolbar > strips @keyframes` now failing 2/3 runs — all teardown patches exhausted. Need full rewrite: spy directly on `stripAnimationsFromSvg` or use `vi.useFakeTimers()` to eliminate scheduler race. Do not apply another `await act()` patch.
- [Triage]: Two P2 items: (a) 7 archetype generateMetadata runtime tests — one shared test file covers all 7 pages. (b) `lib/analytics/server-errors.ts` SENSITIVE_PATTERNS branch coverage (security P2). Flaky test rewrite is the highest-urgency item.
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

<!-- ENTRY:START agent=qa_agent timestamp=2026-05-06T07:05:49Z -->
## QA Agent — 2026-05-06
- **Status**: GREEN
- Tests: 7567 passed / 0 failed / 7567 total (445 files)
- Type errors: 0
- Lint issues: 0
- A11y issues: 1 low-severity (campaigns `<tr role="button">` missing `aria-label`, admin-only)

**Cross-agent recommendations:**
- [Coverage]: All prior P2 gaps (verify, about/scoring, about/verification, cli/authorize pages) confirmed resolved per coverage agent 2026-05-06 entry. Remaining P2s: 7 archetype pages `generateMetadata` runtime tests, `cli/authorize/error.tsx` 0% stmts, `lib/i18n/detect.ts` ~75% branches.
- [Security]: No security-related quality issues. All interactive elements have keyboard handlers. XSS vectors in SVG pipeline unchanged (all covered). Campaigns table `<tr role="button">` missing `aria-label` is a11y, not security.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-05-08T10:00:00Z -->
## Documentation Agent — 2026-05-08
- **Status**: GREEN
- Route coverage: **43/43 API routes + 33 page routes documented** (100%) — including og-image, llms.txt, .well-known/security.txt, badge.svg, archetypes/*, experiments/*.
- Design system: **38/38 color tokens** in `docs/design-system.md` exactly match `--color-*` definitions in `apps/web/styles/globals.css`. No drift.
- Env vars: **31/32 production vars documented in CLAUDE.md** (97%). 1 gap: `CHAPA_ALERT_WEBHOOK_URL` is used at `lib/env.ts:60` + `lib/analytics/server-errors.ts` and documented in `README.md:169` + `docs/runbooks/incident-response.md`, but missing from the env-vars block in `CLAUDE.md`. `DEPLOYMENT_SMOKE_STRICT` and `PLAYWRIGHT_BASE_URL` are test-only (intentional omissions).
- JSDoc spot-check: `lib/impact/v6.ts` 9/9, `lib/cache/redis.ts` 13/13, `lib/github/client.ts` 2/2 — all 100%. `lib/auth/session.ts` 0/5 — 5 exports lack JSDoc (low priority polish).
- Required docs: all 6 present and non-empty (`impact-v4.md` 131 lines, `impact-v5.md`, `impact-v6.md`, `svg-design.md` 173 lines, `README.md` 224 lines, `design-system.md`, `shared-context.md` 407 lines with 21 entries). 0 TODO/FIXME referencing real doc gaps.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All user-facing routes documented.
- [Security]: `CHAPA_ALERT_WEBHOOK_URL` is operationally critical for incident detection (P1 alerts: health_degraded, badge_5xx, oauth_callback_failure). Recommend adding it to `CLAUDE.md` env-vars block so the security/operational surface is fully documented in the canonical project file.
<!-- ENTRY:END -->
