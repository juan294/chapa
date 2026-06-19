# Pre-Launch Codebase Audit
> Generated on 2026-06-19 | Branch: `develop` | 8 parallel specialists
> Focus: comprehensive

## 1. Executive Summary

Chapa is a mature, well-architected codebase that is close to launch-ready. The pnpm monorepo is clean (zero circular deps across 730 files, zero unused files/exports per knip, zero `any`/`ts-ignore`), the test posture is exceptional (7,738 tests across 454 files, 100% pass, typecheck + lint clean), and the security baseline is strong (AES-256-GCM sessions + tokens, OAuth CSRF state with constant-time compare, full SVG escaping, SSRF-guarded avatar fetch). The dominant systemic risks are **operational, not structural**: the production CI gate on `main` is misconfigured (required-check contexts don't match the actual check names), multi-platform pagination silently corrupts scores on rate-limit, and a recurring i18n leak ships English into the Spanish-default UI on the highest-traffic public surfaces.

**Top 3 strengths (evidence-backed):**
1. Test & type health — 7,738 passing tests, every critical path (scoring, SVG, OAuth callback, cache) covered including failure modes; typecheck + lint clean (QA Domain Model).
2. Architecture hygiene — no circular deps, env access funneled through `lib/env.ts`, `packages/shared` a pure leaf, zero `any` (AR Domain Model).
3. Security defense-in-depth — CSRF state + single-use nonce + `timingSafeEqual`, encrypted sessions/tokens, escaped SVG, fail-secure admin/cron/webhook auth (SE Domain Model).

**Top 5 risks (by blast radius):**
1. **DO-B1** — production merge gate is not actually enforcing today's CI (context-name mismatch) + `enforce_admins:false`.
2. **BE-H1** — rate-limit (429/5xx) mid-pagination is cached as a successful empty result → silently deflated scores persisted to permanent snapshots.
3. **BE-H2** — PAT-fallback auth lets bogus Bearer tokens burn the shared GitHub quota (resource amplification).
4. **FE-H1/FE-H2** — every content/SEO page is `force-dynamic` (no CDN cache) and both full i18n dictionaries ship to every client.
5. **UX-H1/H2/H3** — English leaks into Spanish UI on archetype pages, share social cards, and the public dashboard a11y tree.

**Verdict: NOT READY** — one launch-blocker (DO-B1) makes the production gate unreliable. Per the operator directive, ALL findings (all severities) are being remediated pre-launch rather than deferred to post-launch waves.

## 2. System Architecture Overview

pnpm monorepo: `apps/web` (Next.js App Router, ~48 `route.ts` handlers + page components) + `packages/shared` (pure-logic leaf: types, scoring constants, aggregation; zero reverse deps). `apps/web/lib` (141 files) is domain-layered: `auth`, `github`/`gitlab`/`bitbucket`/`codeberg` (data acquisition), `cache` (Upstash Redis, fail-open), `impact` (pure scoring), `render` (React-to-SVG), `db` (Supabase service-role access, per-entity modules), `history`, `email`/`campaigns`, `i18n`. Env access is centralized behind ~36 typed accessors in `lib/env.ts`. Data flow: public read routes serve cached data (Redis hot path → Supabase durable fallback); the badge SVG hot path converges on `materializeProfile` (concurrent `Promise.allSettled` reads → pure `computeImpactV6` → React-to-SVG), defended by a full-response SVG cache, in-flight dedup, and a Redis render-lock.

**Systemic architecture concerns:** (a) strong invariants (no circular deps, env centralization, pure leaf) are maintained by convention, not enforced gates (AR-S1); (b) service-role-only DB access makes route-handler authz the sole security boundary with no DB-level backstop (BE-S1).

## 3. End-to-End Flow Analysis

**Core conversion flow:** landing (`/`) → `/api/auth/login` (OAuth) → `/api/auth/callback` → `/generating/[handle]` → `/u/[handle]` (share). **Badge embed flow:** `/u/[handle]/badge.svg` (embedded in READMEs, fetched via GitHub Camo proxy which under-honors `s-maxage`, so origin hit rate is elevated). **Integration risks:** (1) content pages forced dynamic defeat CDN caching at the highest-traffic entry points (FE-H1); (2) multi-platform stats fetch returns partial data as success on rate-limit, corrupting cached scores (BE-H1); (3) the badge hot path pays a Redis rate-limit round-trip before the cache read (PE-M1).

## 4. Frontend / UI Findings (Staff Frontend Engineer)

#### FE-H1 All marketing/content pages are `force-dynamic`, defeating CDN caching under launch load
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/lib/i18n/server.ts:11-18, apps/web/components/Navbar.tsx:20-23, apps/web/app/about/page.tsx:8, apps/web/app/archetypes/builder/page.tsx:5, apps/web/app/privacy/page.tsx:7, apps/web/app/terms/page.tsx:7, apps/web/app/about/scoring/page.tsx:8, apps/web/app/page.tsx:1
- **What's happening:** Every content page declares `dynamic='force-dynamic'` because `getServerLocale()` calls `cookies()`+`headers()` and server `Navbar` calls `headers()`. These pages have zero per-user data.
- **Why it matters:** Every landing/SEO visit hits origin instead of CDN edge, multiplying cold-start latency and cost and hurting TTFB exactly under traffic spikes.
- **Recommendation:** Decouple locale from request-time APIs for static pages (render default locale statically + hydrate locale client-side as the share page already does); use `NavbarClient` on content pages; drop `force-dynamic` for `revalidate` ISR/static.
- **Expected impact:** Content/SEO pages served from edge; large TTFB + cost reduction. **Effort:** M

#### FE-H2 Both full i18n dictionaries ship to every client bundle
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/lib/i18n/provider.tsx:11-16, apps/web/lib/i18n/use-translation.ts:5, apps/web/lib/i18n/dictionaries/en.ts (1005 lines), es.ts (1005 lines)
- **What's happening:** `LanguageProvider` statically imports both `en` and `es`; it wraps the whole app, so both ~1000-line trees ship in shared client JS for every route.
- **Why it matters:** Dead weight in First Load JS for 100% of users; grows with every copy addition; worst on the landing page where bundle size affects conversion.
- **Recommendation:** Ship only the active locale (props from server, or `next/dynamic` import of the non-default locale on switch; `setLocale` already `router.refresh()`es).
- **Expected impact:** ~Halves the i18n payload. **Effort:** M

#### FE-M1 Over-broad `"use client"` — 86% of components are client components
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** apps/web/components (117/136 non-test files), apps/web/app/about/loading.tsx:1, apps/web/app/archetypes/loading.tsx:1
- **What's happening:** Many presentational pieces (skeletons, static fragments) marked client unnecessarily.
- **Why it matters:** Inflates hydration tree + shared bundle.
- **Recommendation:** Push `"use client"` to smallest interactive leaf; `loading.tsx` doesn't need it unless using hooks. **Effort:** L

#### FE-M2 Landing page is `force-dynamic` despite a static server-rendered demo SVG
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/page.tsx:1, :16-19
- **What's happening:** Landing's only per-request input is `error`/`lang` query; demo SVG is computed once at module load, but `force-dynamic` + `getServerLocale()` re-renders per request.
- **Recommendation:** Render landing statically/ISR (same fix as FE-H1); read `error`/`lang` client-side. **Effort:** M

#### FE-M3 `UserMenu` eagerly fires 3 platform-status fetches on mount even when disabled
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/components/UserMenu.tsx:189-217
- **What's happening:** Unconditional `useEffect` fires `/api/auth/{bitbucket,codeberg,gitlab}/status` on every authenticated navbar render, for flag-gated-off platforms, before the menu is opened.
- **Recommendation:** Gate fetch behind `useClientFeatureFlags` and/or defer until dropdown opens. **Effort:** S

#### FE-M4 `UserMenu` is a 712-line client component mixing four unrelated flows
- **Severity:** medium | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** apps/web/components/UserMenu.tsx:46-282
- **What's happening:** 15+ `useState`, three near-identical platform link/unlink flows (copy-paste), insights upload+recalc, toast/confirm — all hydrated in the navbar everywhere.
- **Recommendation:** Extract `usePlatformLink(platform)` hook; lazily import the insights-import child. **Effort:** L

#### FE-L1 Archetype pages assert `force-dynamic` in a test named "ISR" — intent/impl mismatch
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/archetypes/archetypes-isr.test.ts:17-22, apps/web/app/archetypes/builder/page.tsx:5
- **What's happening:** Test enforces `force-dynamic` on static content pages, locking in the FE-H1 anti-pattern.
- **Recommendation:** Update to assert ISR/static when fixing FE-H1; rename. **Effort:** S

#### FE-L2 `Date.now()`/`new Date()`/localStorage in `useState` initializers risk hydration drift
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** apps/web/components/UserMenu.tsx:90, :91-101
- **Recommendation:** Initialize to deterministic defaults; populate from `localStorage`/`Date.now()` in `useEffect`. **Effort:** S

#### FE-L3 Sparse memoization on data-derived dashboard rows (verify before acting)
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** apps/web/components/dashboard/ImpactDashboard.tsx:26-65, DimensionCardsRow.tsx, StatsGrid.tsx
- **Recommendation:** Profile first; if material, `useMemo` profileText + `React.memo` pure rows. **Effort:** S

#### FE-S1 No client bundle budget / analyzer gate in CI
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** apps/web (117/136 client components); bundle analyzer is manual (`ANALYZE=true`)
- **Recommendation:** CI step asserting per-route First Load JS under a budget; fail on regression. **Effort:** M

## 5. Backend / API / Data Findings (Staff Backend Engineer)

#### BE-H1 GitLab/Bitbucket/Codeberg pagination treats rate-limit (429/5xx) as successful empty results — silent score corruption
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/lib/gitlab/queries.ts:206-211, apps/web/lib/bitbucket/queries.ts:~188, apps/web/lib/codeberg/queries.ts:~166
- **What's happening:** In `fetchPaginated`, `if (401||403) return null` then `if (!res.ok) return items` — a 429/5xx mid-pagination returns partial/empty `items` as a complete success. That truncated data is scored, cached, and snapshotted permanently.
- **Why it matters:** Under launch load these limits will be hit → silently deflated Impact scores in permanent `metrics_snapshots`, violating "serve cached or try-later, never wrong data."
- **Recommendation:** Treat 429 (and 5xx) like 401/403: return `null` to fall back to stale cache. Apply across all three REST platforms. **Effort:** S

#### BE-H2 PAT-fallback auth lets unauthenticated requests trigger outbound GitHub calls (resource amplification)
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/lib/auth/resolve-request-auth.ts:49-60, apps/web/app/api/supplemental/route.ts:47-59, apps/web/app/api/insights/route.ts:27, apps/web/app/api/recalculate/route.ts:24
- **What's happening:** `resolveHandle` verifies any non-CLI Bearer by calling `fetchGitHubUser(token)`; `/recalculate` + `/insights` call `resolveRequestAuth` before any rate-limit; `/supplemental` rate-limits by attacker-chosen `targetHandle`. A stream of bogus tokens burns the shared GitHub quota.
- **Recommendation:** Rate-limit by IP before `resolveRequestAuth` on `/recalculate` + `/insights`; verify ownership before consuming per-handle quota on `/supplemental`; cheap structural token pre-check before the GitHub call. **Effort:** M

#### BE-M1 `getClientIp` collapses to a single `"unknown"` bucket, defeating IP rate limiting
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/lib/http/client-ip.ts:12-27
- **What's happening:** Missing forwarded-for headers → literal `"unknown"`, so all such requests share one rate-limit key; `x-forwarded-for` rightmost-hop trust is overstated.
- **Recommendation:** Fail safe (strict global cap/deny) when no trusted IP header; document trusted-proxy assumption. **Effort:** S

#### BE-M2 CLI device-auth poll is unauthenticated, bound only to a UUID `sessionId`
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cli/auth/poll/route.ts:13-69, apps/web/app/api/cli/auth/approve/route.ts:38-48
- **What's happening:** No separate high-entropy `device_code`; whoever learns the `sessionId` before the device polls gets a 90-day token (one-time issuance limits but doesn't prevent theft).
- **Recommendation:** RFC 8628 split — secret `device_code` (device-only) required for poll; `sessionId`/user_code only for approve. **Effort:** M

#### BE-M3 No retry/backoff on any external API call
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/queries.ts, gitlab/queries.ts, bitbucket/queries.ts, codeberg/queries.ts, auth/gitlab.ts:172-204
- **Recommendation:** Bounded jittered retry (1-2) for idempotent reads only; never token exchange/writes. **Effort:** M

#### BE-M4 Upstream error response body logged verbatim (token-leak-into-logs risk)
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [inference]
- **Files:** apps/web/lib/github/queries.ts:64
- **Recommendation:** Log status + truncated/sanitized snippet only; same across platforms. **Effort:** S

#### BE-M5 Unvalidated external JSON shape — assumed fields can throw 500s
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** apps/web/lib/github/queries.ts:~90, gitlab/queries.ts:226-231, bitbucket/queries.ts:193-194, codeberg/queries.ts:143-144
- **Recommendation:** Minimal runtime guards at deserialization boundary; on mismatch return null/empty for graceful fallback. **Effort:** M

#### BE-L1 GitLab `fetchReviewsCount` issues O(n) per-MR follow-up calls with no aggregate cap
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/lib/gitlab/queries.ts:252-279
- **Recommendation:** Cap per-MR approver lookups / short-circuit after K consecutive nulls. **Effort:** S

#### BE-L2 Webhook dedup is fail-open under Redis outage / TOCTOU near TTL
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** apps/web/app/api/webhooks/resend/route.ts:97-104
- **Recommendation:** Distinguish `"unavailable"` from `"exists"`; decide explicitly on unavailable. **Effort:** S

#### BE-L3 `gitlab/client.ts` proceeds with empty-string OAuth credentials instead of failing fast
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/lib/gitlab/client.ts:44-45, :~75
- **Recommendation:** Short-circuit refresh when client id/secret absent; clear unconfigured result. **Effort:** S

#### BE-S1 Service-role-only DB access makes route-handler authz the sole gate
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** apps/web/lib/db/supabase.ts:29-31, supabase/migrations/018_fix_tool_insights_rls.sql
- **Recommendation:** Centralize ownership checks into one audited helper used by every write route; add handler-level cross-handle-rejection tests. **Effort:** L

## 6. Performance and Scalability Findings (Performance Engineer)

#### PE-M1 Rate-limit Redis round-trip precedes the SVG cache hit on the hottest path
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:137-164
- **What's happening:** `checkBadgeRateLimit` (Redis INCR+EXPIRE) runs before the full-response SVG cache read; warm-cache badges still pay a sequential rate-limit round-trip.
- **Recommendation:** Read SVG cache first; rate-limit only on the miss branch, or fold INCR into the same pipeline. **Effort:** S

#### PE-M2 In-memory inflight dedup + render-lock poll are per-instance / serverless-ineffective
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:41,166-197, apps/web/lib/github/client.ts:29,63-66
- **Recommendation:** Document in-memory maps as best-effort; for lock-losers return stale SVG immediately rather than ~1.85s poll, or shorten the schedule. **Effort:** M

#### PE-L1 OG-image rate limit uses the same Redis-before-cache ordering as PE-M1
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/og-image/route.ts:35-65
- **Recommendation:** Apply same cache-first reordering. **Effort:** S

#### PE-L2 `_enrichWithLogins` adds N parallel DB reads on every stats cache hit
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/client.ts:58-59,94-114
- **Recommendation:** Write enriched stats back to the stats cache key so subsequent hits skip the DB. **Effort:** S

#### PE-L3 resvg re-reads four TTF font files from disk on every OG-image cache miss
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** apps/web/lib/render/svg-to-png.ts:71-81, :30-35
- **Recommendation:** Read font buffers once at module scope; pass buffers to resvg. **Effort:** S

#### PE-L4 Share page may double-fetch on cold cache via `<img>` fallback
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** apps/web/app/u/[handle]/page.tsx:119-146,219-240
- **Recommendation:** Acceptable as failure-branch fallback (img benefits from badge route caching); no action required. **Effort:** S

#### PE-S1 Per-day badge cache key forces a full recompute for every handle at UTC midnight
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:159-160, apps/web/lib/render/badge-svg-cache.ts
- **Recommendation:** Rolling per-handle 24h TTL or per-handle jittered expiry (hash(handle)→offset) to spread recompute load. **Effort:** M

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

#### DO-B1 Branch-protection required-status-check contexts don't match CI check names — production gate broken
- **Severity:** launch-blocker | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** .github/workflows/ci.yml:11,28,113,142 (names `Lint & Typecheck`, `Test`, `Build`, `E2E Tests`); branch protection contexts = `["test","lint-typecheck","build","e2e"]`
- **What's happening:** Required contexts never match the reported check-run names, so the gate sits on phantom contexts and the real green checks aren't the ones being enforced. With `enforce_admins:false`, a maintainer can merge a red build to prod.
- **Recommendation:** Set required contexts to exact names (`Test`, `Lint & Typecheck`, `Build`, `E2E Tests`); set `enforce_admins:true`. Verify post-change. **Effort:** S

#### DO-H1 `develop` integration branch has no branch protection
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [inference]
- **Files:** branch-protection confirmed for `main` only; all dev + Dependabot land on `develop`
- **Recommendation:** Protect `develop` with the same correctly-named contexts. **Effort:** S

#### DO-M1 `CHAPA_ALERT_WEBHOOK_URL` missing from `.env.example` — alerting silently disabled if unset
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** .env.example (no entry), apps/web/lib/analytics/server-errors.ts:124-125, apps/web/lib/env.ts:59-61
- **Recommendation:** Add to `.env.example` + release-checklist; optional one-time startup warn in prod when unset. **Effort:** S

#### DO-M2 No automated migration application / drift detection
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** scripts/validate-migrations.ts (sequence-only), docs/runbooks/migrations.md, supabase/migrations/001-026, no CI migration step
- **Recommendation:** Release-checklist gate (or CI) asserting all committed migrations applied to prod before promoting to `main`. **Effort:** M

#### DO-M3 `pnpm audit` / license-check / gitleaks not in `main` required checks
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** protection contexts = test/lint-typecheck/build/e2e only; .github/workflows/security.yml:8,22, gitleaks.yml
- **Recommendation:** Add `Gitleaks` + `License compliance` to required contexts; treat `pnpm audit` as required or accepted-risk. **Effort:** S

#### DO-M4 `enforce_admins` disabled on `main` — production protection bypassable
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** branch protection `enforce_admins:{enabled:false}`
- **Recommendation:** Set `enforce_admins:true` once DO-B1 is fixed (do together). **Effort:** S

#### DO-L1 No per-cron failure visibility for "200 with all-failures"; no synthetic external uptime check
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** vercel.json:7-10, apps/web/lib/analytics/server-errors.ts:109-115, apps/web/app/api/cron/warm-cache/route.ts:160-164,296-298
- **Recommendation:** External uptime monitor on `/api/health` + a known badge URL; emit P2 from warm-cache when failures exceed a threshold. **Effort:** M

#### DO-L2 `not-found.tsx` and `global-error.tsx` are English-only despite Spanish default
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/not-found.tsx:10-13, apps/web/app/global-error.tsx:44,53
- **Recommendation:** Localize `not-found.tsx` via translation; bilingual static copy for `global-error.tsx`. (Overlaps UX-M3.) **Effort:** S

#### DO-L3 No CHANGELOG/version-bump verification tied to release
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** CHANGELOG.md, apps/web/package.json (2.10.0), no CI link
- **Recommendation:** Release-checklist item (or lightweight CI on develop→main PRs) requiring CHANGELOG entry + version bump. **Effort:** S

#### DO-S1 Cron concentration + GitHub-rate-limit-bound warm-cache caps scalable growth
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:33 (MAX_HANDLES=50), :30 (maxDuration=300), vercel.json:3-14
- **Recommendation:** Plan scaling path (staggered invocations, larger token pool, tiered freshness); alert when active users approach the 50/day ceiling. **Effort:** L

## 8. Security / Privacy Findings (Security Reviewer)

#### SE-H1 Multiple high-severity advisories in transitive `undici` (via dev-only `jsdom`)
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** pnpm-lock.yaml (`.>jsdom>undici`), `pnpm audit` (7 advisories: 3 high, 2 moderate, 2 low; undici `>=7.0.0 <7.28.0`)
- **What's happening:** TLS cert bypass (GHSA-vmh5-mc38-953g), WebSocket DoS, SOCKS5 pool cross-origin routing. `jsdom` is dev/test-only (vitest DOM env) so runtime exploitability is low, but a public launch should not ship 3 unresolved highs in-tree.
- **Recommendation:** Confirm `jsdom` is dev-only; add a pnpm override forcing `undici >=7.28.0` (same pattern as `js-yaml` in commit b7b33ace); re-run `pnpm audit` to zero. **Effort:** S

#### SE-L1 Session cookies have no server-side revocation (24h lifetime only)
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** apps/web/lib/auth/github.ts:338-345, :389-409
- **Recommendation:** Optionally embed `iat`, reject sessions older than Max-Age server-side; revocation list on logout if surfaces grow. Acceptable for launch. **Effort:** M

#### SE-L2 Supplemental rate-limit bucket keyed on `targetHandle` before token-ownership check
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/api/supplemental/route.ts:47 vs :56-63
- **Recommendation:** Move ownership check (`auth.handle === targetHandle`) ahead of the per-handle rate-limit increment, or key on authenticated handle. (Overlaps BE-H2.) **Effort:** S

## 9. Code Quality / Maintainability Findings (Principal Architect)

#### AR-M1 `.worktrees/` is gitignored but not excluded from TypeScript/build scope
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/tsconfig.json:39-46 (include `**/*.ts(x)`, exclude only node_modules)
- **What's happening:** The mandated `.worktrees/short-name` background-agent workflow lands inside the project; the moment populated, `tsc`/`next build` recurse into it, double-compiling and risking phantom typecheck errors → non-deterministic CI.
- **Recommendation:** Add `".worktrees"` to `exclude` in apps/web + root tsconfig; add to eslint ignores; confirm `next build` outputFileTracing skips it. **Effort:** S

#### AR-M2 knip `ignoreDependencies` list is over-broad, masking real dead-dep detection
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** knip.json (11 runtime deps ignored; knip emits 13 "remove from ignoreDependencies" hints)
- **Recommendation:** Remove each entry, re-run knip, confirm used (delete ignore) or unused (remove dep); replace blanket ignores with scoped plugin config + comment. **Effort:** S

#### AR-L1 `lib/db/campaigns.ts` is an outsized single-file data module (835 lines, 22 exports)
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** apps/web/lib/db/campaigns.ts:1-835
- **Recommendation:** Split along responsibility seams (crud/send/recipients) per the per-entity db convention. **Effort:** M

#### AR-S1 Strong architecture rests on convention, not enforced gates
- **Severity:** strategic | **Time horizon:** Later | **Evidence type:** [inference]
- **Files:** package.json check:circular (not CI-wired), apps/web/lib/env.ts:36-265, knip.json
- **Recommendation:** Wire madge `check:circular` into CI; eslint `no-process-env` allowlisting only `lib/env.ts`; eslint `no-restricted-imports` preventing `packages/shared`→`apps/web`; knip as CI gate after AR-M2. **Effort:** M

## 10. Testing / QA Findings (QA / Reliability Lead)

#### QA-M1 No CI gate on coverage thresholds
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [inference]
- **Files:** .github/workflows/ci.yml (no coverage step), package.json:test (`vitest run`, no thresholds)
- **Recommendation:** Add vitest coverage thresholds (start at current level minus margin) + run `test:coverage` in CI; `coverage.exclude` type-only/helpers. **Effort:** S

#### QA-L1 Four behavior-bearing pages untested (admin gating, CLI authorize, verify, generating)
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/admin/page.tsx, verify/[hash]/page.tsx, generating/[handle]/page.tsx, cli/authorize/page.tsx
- **Recommendation:** Add render/smoke tests asserting auth gating + primary state. Static content pages stay with e2e. **Effort:** S

#### QA-L2 `feature-flags-sync.ts` is the only non-trivial untested lib module
- **Severity:** low | **Time horizon:** Later | **Evidence type:** [evidence]
- **Files:** apps/web/lib/feature-flags-sync.ts:1-63
- **Recommendation:** Test each helper returns `true` only for `"true"` (incl. whitespace/casing edge cases). **Effort:** S

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

#### UX-H1 "Dominant dimension:" leaks English on all 7 Spanish archetype pages
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/archetypes/_components/ArchetypePage.tsx:87
- **Recommendation:** Add `archetypes.dominantDimensionLabel` to en/es; render `{t(...)}`. **Effort:** S

#### UX-H2 Share-page social metadata (OG/Twitter) hardcoded English
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/page.tsx:62,:68,:69
- **What's happening:** OG description, Twitter title + description hardcoded English even though dictionary keys exist; `generateMetadata` uses `getServerT("en")` at ISR build time.
- **Recommendation:** Move all three into the dictionary; render the social card in the primary-audience locale (es) or make the route locale-aware. **Effort:** M

#### UX-H3 Public dashboard/share components ship English-only aria-labels
- **Severity:** high | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/ActivityHeatmap.tsx:148,:253,:562, StatsGrid.tsx:102, DimensionCard.tsx:213, apps/web/components/ShortcutCheatSheet.tsx:93,:104
- **Recommendation:** Route all aria-labels through `t()` `aria.*` keys; interpolated key for heatmap day (count+date). **Effort:** M

#### UX-M1 Archetype-list connector "or"/"o" hardcoded, inverted per page
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/about/page.tsx:73 (", or"), apps/web/app/page.tsx:262,:307 (" o ")
- **Recommendation:** Move connector to a dictionary key (`common.orConnector`) or build list from array + localized separator. **Effort:** S

#### UX-M2 verify/[hash] mixes Spanish and English labels side-by-side
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/verify/[hash]/page.tsx:185 ("Commits"), :227 ("Hash"); `verifyDetail.reviews`="Reviews" in both dicts
- **Recommendation:** Add `verifyDetail.commits` + `verifyDetail.hashLabel`; translate `verifyDetail.reviews`→"Revisiones". **Effort:** S

#### UX-M3 Root 404 page is English-only despite Spanish default
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/not-found.tsx:10-18
- **Recommendation:** Convert to client component using `useTranslation()` (mirror error.tsx) or read locale cookie; add `notFound.*` keys. (Overlaps DO-L2.) **Effort:** S

#### UX-M4 about.scoring CTA uses English verb in Spanish
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/lib/i18n/dictionaries/es.ts:814 (`about.scoring.ctaEmail`="Email …")
- **Recommendation:** Translate es value (keep address, localize verb → "Escríbenos a…"). **Effort:** S

#### UX-M5 Hardcoded rgba border breaks theming on empty heatmap cells
- **Severity:** medium | **Time horizon:** Before launch | **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/ActivityHeatmap.tsx:574 (`border:"1px solid rgba(139,92,246,0.15)"`)
- **Recommendation:** Replace with a token (`var(--color-stroke)` or a purple-tint border token defined both themes). **Effort:** S

#### UX-M6 Studio page entirely unlocalized (metadata, nav, terminal seed)
- **Severity:** medium | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/page.tsx:51-55,:88-91, apps/web/app/studio/StudioClient.tsx:68-69
- **Recommendation:** Localize via `getServerT`/`useTranslation`; add `studio.*` keys. **Effort:** M

#### UX-L1 On-page radar colors non-tokenized; error toast announces politely not assertively
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]/[inference]
- **Files:** apps/web/components/badge/BadgeContent.tsx:177,:182,:183,:187, apps/web/components/Toast.tsx:120-121
- **Recommendation:** Confirm BadgeContent intended theme (may be intentionally dark like the embed SVG); if themed, tokenize. Give error toasts `role="alert"`/`aria-live="assertive"`. **Effort:** S

#### UX-L2 Form/clipboard failures are silent; verify input lacks aria-invalid linkage
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/components/BadgeToolbar.tsx:81-83,:88-142, apps/web/app/verify/VerifyForm.tsx:34-50
- **Recommendation:** Toast on clipboard/download failure; add `aria-invalid`+`aria-describedby` to verify input. **Effort:** S

#### UX-L3 `role="presentation"` element carries event handlers
- **Severity:** low | **Time horizon:** After launch | **Evidence type:** [evidence]
- **Files:** apps/web/components/AuthorTypewriter.tsx:160
- **Recommendation:** Move `stopPropagation` to a non-role wrapper or drop the role. **Effort:** S

## 12. Prioritized Action Plan

| ID | Domain | Title | Severity | Horizon | Effort |
|----|--------|-------|----------|---------|--------|
| DO-B1 | devops | Branch-protection context mismatch (prod gate broken) | launch-blocker | Before | S |
| BE-H1 | backend | Pagination 429/5xx cached as success → score corruption | high | Before | S |
| BE-H2 | backend | PAT-fallback auth amplification | high | Before | M |
| FE-H1 | frontend | Content pages force-dynamic (no CDN) | high | Before | M |
| FE-H2 | frontend | Both i18n dictionaries shipped to client | high | Before | M |
| SE-H1 | security | Transitive undici advisories | high | Before | S |
| UX-H1 | ux | "Dominant dimension" English on 7 pages | high | Before | S |
| UX-H2 | ux | Share social metadata English | high | Before | M |
| UX-H3 | ux | Public dashboard aria-labels English | high | Before | M |
| DO-H1 | devops | develop unprotected | high | Before | S |
| AR-M1 | architect | .worktrees not excluded from tsc/build | medium | Before | S |
| BE-M1 | backend | getClientIp "unknown" bucket | medium | Before | S |
| BE-M2 | backend | CLI device-auth poll unauthenticated | medium | Before | M |
| BE-M4 | backend | Verbatim upstream error body logged | medium | Before | S |
| DO-M1 | devops | Alert webhook missing from .env.example | medium | Before | S |
| DO-M2 | devops | No migration drift detection | medium | Before | M |
| DO-M4 | devops | enforce_admins disabled | medium | Before | S |
| FE-M2 | frontend | Landing force-dynamic | medium | Before | M |
| UX-M1 | ux | "or"/"o" connector hardcoded | medium | Before | S |
| UX-M2 | ux | verify/[hash] mixed language | medium | Before | S |
| UX-M3 | ux | 404 English-only | medium | Before | S |
| UX-M4 | ux | scoring CTA English verb (es) | medium | Before | S |
| UX-M5 | ux | Hardcoded rgba heatmap border | medium | Before | S |
| AR-M2 | architect | knip ignoreDependencies over-broad | medium | After | S |
| BE-M3 | backend | No retry/backoff on external calls | medium | After | M |
| BE-M5 | backend | Unvalidated external JSON shape | medium | After | M |
| PE-M1 | performance | Rate-limit before SVG cache hit | medium | After | S |
| PE-M2 | performance | Per-instance dedup / long lock poll | medium | After | M |
| DO-M3 | devops | Security checks not required on main | medium | After | S |
| QA-M1 | qa | No CI coverage gate | medium | After | S |
| UX-M6 | ux | Studio unlocalized | medium | After | M |
| FE-M1 | frontend | Over-broad use client | medium | After | L |
| FE-M3 | frontend | UserMenu eager platform fetches | medium | After | S |
| BE-L1 | backend | GitLab O(n) per-MR calls | low | After | S |
| BE-L2 | backend | Webhook dedup fail-open | low | After | S |
| BE-L3 | backend | gitlab empty-cred refresh | low | After | S |
| DO-L1 | devops | Cron failure visibility / uptime check | low | After | M |
| DO-L2 | devops | not-found/global-error English | low | After | S |
| SE-L1 | security | No session server-side revocation | low | After | M |
| SE-L2 | security | Supplemental rate-limit ordering | low | After | S |
| QA-L1 | qa | 4 behavior-bearing pages untested | low | After | S |
| UX-L1 | ux | Radar colors + toast politeness | low | After | S |
| UX-L2 | ux | Silent clipboard failures / aria-invalid | low | After | S |
| UX-L3 | ux | presentation-role handler | low | After | S |
| FE-L1 | frontend | Archetype ISR test mismatch | low | After | S |
| FE-L2 | frontend | Date.now/localStorage in useState | low | After | S |
| AR-L1 | architect | campaigns.ts oversized | low | Later | M |
| PE-L1 | performance | OG rate-limit ordering | low | Later | S |
| PE-L2 | performance | enrichWithLogins DB hits on cache hit | low | Later | S |
| PE-L3 | performance | resvg font disk re-read | low | Later | S |
| PE-L4 | performance | Share page double-fetch (accepted) | low | Later | S |
| DO-L3 | devops | No CHANGELOG/version gate | low | Later | S |
| QA-L2 | qa | feature-flags-sync untested | low | Later | S |
| FE-L3 | frontend | Sparse dashboard memoization | low | Later | S |
| AR-S1 | architect | Enforce conventions in CI | strategic | Later | M |
| BE-S1 | backend | Service-role-only authz | strategic | Later | L |
| PE-S1 | performance | Midnight cache-key herd | strategic | Later | M |
| DO-S1 | devops | Cron scaling ceiling | strategic | Later | L |
| FE-S1 | frontend | No bundle budget CI gate | strategic | Later | M |

## 13. Top 10 Highest-ROI Improvements

1. **DO-B1** — fixes the broken production gate; tiny effort, prevents shipping red builds.
2. **BE-H1** — stops silent permanent score corruption under load; one-line semantics fix across 3 files.
3. **SE-H1** — clears all 7 audit advisories with a single pnpm override.
4. **UX-H1** — removes English from 7 Spanish SEO pages by routing one label through `t()`.
5. **FE-H1/FE-M2** — converts the highest-traffic pages to CDN-cacheable, the biggest scaling + cost lever.
6. **BE-H2/SE-L2** — closes the GitHub-quota amplification + cross-user rate-limit DoS.
7. **FE-H2** — halves the i18n client payload on every route.
8. **UX-H2** — localizes the primary virality surface (social cards) for the target market.
9. **AR-M1** — eliminates non-deterministic CI from in-project worktrees.
10. **DO-H1/DO-M3/DO-M4** — locks the integration + production branches behind the real checks.

## 14. Before Launch / After Launch / Later Strategic

> **Operator override (2026-06-19):** All three waves are being executed pre-launch in a single remediation pass with one push at the end. No items are deferred. The wave index below reflects the specialists' natural ordering and is retained for traceability only.

### Before launch (Wave 1)
- DO-B1, BE-H1, BE-H2, FE-H1, FE-H2, SE-H1, UX-H1, UX-H2, UX-H3, DO-H1, AR-M1, BE-M1, BE-M2, BE-M4, DO-M1, DO-M2, DO-M4, UX-M1, UX-M2, UX-M3, UX-M4, UX-M5, FE-M2

### After launch (Wave 2)
- AR-M2, BE-M3, BE-M5, PE-M1, PE-M2, DO-M3, QA-M1, UX-M6, FE-M1, FE-M3, BE-L1, BE-L2, BE-L3, DO-L1, DO-L2, SE-L1, SE-L2, QA-L1, UX-L1, UX-L2, UX-L3, FE-L1, FE-L2

### Later / strategic (Wave 3)
- AR-L1, PE-L1, PE-L2, PE-L3, PE-L4, DO-L3, QA-L2, FE-L3, AR-S1, BE-S1, PE-S1, DO-S1, FE-S1

## 15. Open Questions / Assumptions

- **PE-L4 / share-page `<img>` fallback** and **UX-L1 / BadgeContent dark theme** were flagged as possibly-intentional; the on-page radar may be deliberately dark like the embeddable badge SVG. Confirm before changing BadgeContent colors.
- **DO-S1 cron scaling** and **BE-S1 service-role architecture** are infra/architecture decisions whose full solutions (token pools, staggered crons, DB-level authz) may exceed a single remediation pass; the fixable sub-parts (threshold alerting, centralized authz helper) are actioned.
- Branch-protection findings (DO-B1/H1/M3/M4) are GitHub repo-settings changes applied via `gh api`, sequenced so `enforce_admins` is enabled only after contexts are corrected (to avoid self-lockout during the release merge).

## 16. Final Verdict

- **Verdict: NOT READY** (one launch-blocker: DO-B1). After remediation of DO-B1 + the high-severity set, the project moves to READY.
- **What would most worry me about shipping today?** The production merge gate is not enforcing the CI it appears to (DO-B1), and multi-platform pagination can silently persist wrong scores under exactly the rate-limit conditions a launch produces (BE-H1).
- **What gives me confidence?** 7,738 green tests with real failure-mode coverage, clean architecture (no circular deps, no `any`), and a strong security baseline.
- **Next 5 actions:** (1) DO-B1 + DO-H1/M3/M4 branch-protection fixes; (2) BE-H1 pagination fix; (3) SE-H1 undici override; (4) UX-H1/H2/H3 i18n leaks; (5) FE-H1/FE-H2/FE-M2 caching + bundle.
