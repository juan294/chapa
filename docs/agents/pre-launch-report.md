# Pre-Launch Codebase Audit
> Generated on 2026-06-25 | Branch: `develop` | 8 parallel specialists
> Focus: comprehensive

---

## 1. Executive Summary

Chapa is a well-engineered product with a mature testing culture, clean architecture, and a strong security posture. The 8-specialist audit found **zero launch-blockers**, but surfaced **4 high-severity findings** — two data-durability gaps in the backend and two i18n/a11y failures in the dashboard — all marked **Before launch**. The remaining 39 findings span medium, low, and strategic categories. The verdict is **CONDITIONAL**: these 4 high-severity items plus 6 medium/low Before-launch items (10 total Wave 1 items) must be resolved before the release PR targets `main`.

**Top 3 strengths:**
1. **Exceptional test coverage** — 470 test files, 8,037 tests, all passing in ~32s. Every one of 49 API routes has a colocated `route.test.ts`. Redis fail-open, graceful-degradation, and supplemental-stats fallback paths are explicitly exercised.
2. **Security depth** — `pnpm audit` is clean. HMAC-signed sessions, CSRF double-layer (cookie + Redis nonce), timing-safe secret comparisons, `escapeXml` on all SVG user input, SSRF-guarded avatar fetch, and centralized `assertHandleOwnership` gating are all in place.
3. **Architecture rigour** — strict TypeScript everywhere, zero circular dependencies (899 files), zero dead exports (knip clean), `process.env` access banished to a single enforced boundary, and the `@chapa/shared` alias held without a lint rule.

**Top 5 risks (blast-radius order):**
1. **BE-H1** — Studio config lives only in Redis (no durable store). An eviction, flush, or TTL boundary silently destroys a user's entire badge customization with no recovery path.
2. **BE-H2** — Supplemental dual-write returns `{ success: true }` even when the durable Supabase write fails. EMU users see a momentary score update that silently regresses a day later.
3. **UX-H1/UX-H2** — Every dashboard tooltip and screen-reader aria-label on core impact dimensions is hardcoded English in an app whose default locale is Spanish. Primary audience sees English explanations for the product's core value proposition.
4. **DO-M2** — Migrations are applied manually with no pre-deploy check. A forgotten migration on a production release silently degrades features (new columns read as null) with no CI signal.
5. **DO-M1** — CI has three conflicting bundle budgets (350 KB in `ci.yml`, 500 KB in `bundle-size.yml`, 500 KB in `CLAUDE.md`), producing contradictory red/green signals on the same PR.

**Verdict: CONDITIONAL** — No launch-blockers, but the two high-severity data-durability defects (BE-H1, BE-H2) create real user-facing data-loss scenarios and the two i18n/a11y high-severity items (UX-H1, UX-H2) violate a documented, mandatory product requirement. All four are M-or-smaller fixes. The 6 remaining Before-launch items are S-effort each. Total Wave 1 effort is well within one focused sprint.

---

## 2. System Architecture Overview

Chapa is a pnpm monorepo with two workspaces: `apps/web` (Next.js 16 App Router, React 19) and `packages/shared` (pure scoring/types/constants, zero runtime deps). The shared package is consumed exclusively via the `@chapa/shared` workspace alias — zero relative-path imports exist, and an ESLint `no-process-env` rule enforces the centralized `lib/env.ts` boundary.

**Major modules and responsibilities:**

| Module | Responsibility |
|--------|----------------|
| `app/api/**/route.ts` (49 files) | Route handlers — auth, generate, refresh, cron, admin, CLI, webhooks |
| `lib/github/`, `lib/bitbucket/`, `lib/gitlab/`, `lib/codeberg/` | Platform stat fetch + aggregation |
| `lib/impact/v6.ts` + `packages/shared/src/scoring.ts` | Pure impact scoring (ImpactV6Result) |
| `lib/profile/` | Score-write orchestration (materialize → persist → invalidate) |
| `lib/render/` | React-to-SVG badge rendering + resvg OG images |
| `lib/cache/redis.ts` | Upstash Redis singleton (42 importers) |
| `lib/db/` | Supabase Postgres access (snapshots, users, campaigns, supplemental) |
| `lib/auth/` | HMAC-signed session cookies, OAuth state validation |
| `lib/i18n/` | Locale detection, dictionary loading (es default / en secondary) |
| `components/dashboard/` | Impact dimension cards, sub-metric panels, sparklines |
| `packages/shared/src/types.ts` | StatsData, ImpactV6Result, BadgeConfig, MetricsSnapshot |

**Data/control flow (badge generation core path):**
1. **Fetch** — GitHub GraphQL → `StatsData`; linked platforms via `fetchLinkedPlatformStats`; supplemental EMU merge via `mergeStats`.
2. **Score** — `computeImpactV6` (pure, deterministic) → `ImpactV6Result`.
3. **Materialize** — `materializeProfile` applies EMA smoothing, dirty-marker bypass, confidence clamping.
4. **Persist** — `dbInsertSnapshot` / `dbReplaceSnapshot` (Supabase UPSERT) + Redis cache refresh.
5. **Render** — `renderBadgeSvg` (React-to-string SVG) + `writeBadgeSvgCache` (Redis + ISR side-effects via `after()`).

**Architecture concerns:**
- The platform aggregation layer (`buildStatsFrom{Bitbucket,Gitlab,Codeberg}`) duplicates a 10-step computation skeleton that the fetch-orchestration layer already factored out. See AR-M1.
- Score-write paths span DB + cache + ISR invalidation with no transactional envelope — convention today, structural risk tomorrow. See BE-S1.

---

## 3. End-to-End Flow Analysis

**Key user flows reviewed:**
1. **Badge embed** (`/u/:handle/badge.svg`) — SVG cache hit → Redis (6h s-maxage CDN) → inflight dedup (in-memory) → Redis render lock → stale-yesterday serve → fresh render. Multi-tier, well-defended. Minor: avatar fetch is inline on miss path with 5s ceiling (PE-L2).
2. **OAuth login** (`/` → `/api/auth/login` → GitHub → `/api/auth/callback` → `/generating/:handle`) — double-submit CSRF, single-use Redis nonce, token stored encrypted, `isSafeRedirect` allow-list. Solid.
3. **Creator Studio** (`/studio` PUT `/api/studio/config`) — reads/writes Redis only. **Data-loss risk** (BE-H1).
4. **CLI supplemental upload** (`POST /api/supplemental`) — dual-write Redis + Supabase, but `Promise.all` results are not inspected. A Supabase failure returns 200. **Correctness bug** (BE-H2).
5. **Dashboard view** (`/u/:handle`) — share page loads correctly, but dimension tooltips and all data-viz aria-labels are hardcoded English regardless of locale. **Comprehension failure** (UX-H1, UX-H2).

**Integration and boundary risks:**
- Studio config durability gap is the largest integration risk — studio was deliberately built after the supplemental-stats durable-write pattern but never received the same Supabase backing.
- The aggregation pipeline across 4 platforms shares no code — drift is silent (AR-M1, AR-S1).
- ISR/dynamic-rendering inconsistency: `/` forces dynamic while all other content pages stay static, contradicting the documented ISR-first strategy (FE-M1).

---

## 4. Frontend / UI Findings (Staff Frontend Engineer)

### Domain Model
App Router with static root layout (rendered at `DEFAULT_LOCALE` `es`, never reads cookies, preserves ISR). Three rendering tiers: (1) static/ISR pages (`/about/*`, `/archetypes/*`, `/u/[handle]`), (2) `force-dynamic` pages (`/studio`, `/admin`, `/experiments/*`, `/`), (3) badge SVG / OG image / `.txt` route handlers. ~154 `"use client"` files. Heavy canvas effects, PostHog, admin dashboards, and command bar are all `next/dynamic`-split. Interactive floating UI correctly uses `createPortal`. No middleware — auth gated per page.

### Findings

#### FE-M1 Landing page is `force-dynamic`, losing ISR/CDN caching for highest-traffic route
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/page.tsx:60-71, apps/web/lib/i18n/server.ts
- **What's happening:** Root layout was deliberately kept static (avoids `cookies()`/`headers()`) but the landing page calls `await getServerLocale(lang)` which reads the locale cookie, forcing `/` into dynamic rendering on every request.
- **Why it matters:** Highest-traffic route has no CDN HTML cache; TTFB tied to server render per visit instead of edge cache.
- **Recommendation:** Render at `DEFAULT_LOCALE` statically; let `LocaleSync` apply runtime locale client-side, matching the pattern used on all other ISR pages.
- **Expected impact:** `/` becomes CDN-cacheable, dropping TTFB and server load.
- **Effort estimate:** M

#### FE-M2 In-memory inflight badge render Map provides near-zero dedup benefit on serverless
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:42, :170-180, :192-196, :289
- **What's happening:** `inflightBadgeRenders` Map coalesces same-instance concurrent badge requests. On Vercel per-invocation isolation, concurrent requests usually land on different instances, so the in-memory dedup rarely fires — the Redis render-lock is the real coalescing mechanism.
- **Why it matters:** Not a correctness bug, but adds complexity and a `finally` cleanup path (route.ts:289) for a benefit that mostly doesn't materialize in production.
- **Recommendation:** Evaluate removing the in-memory Map in favour of the Redis lock + stale-serve alone; if kept, document its scope explicitly.
- **Expected impact:** Simpler hot-path code; no functional change.
- **Effort estimate:** M

#### FE-L1 BadgeOverlay annotation panels use `position: absolute` inside `overflow-hidden`, risking clip
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/components/BadgeOverlay.tsx:306-314, :113-210; apps/web/app/page.tsx:159
- **What's happening:** Demo-badge annotation panels are positioned `absolute` inside an `overflow-hidden` ancestor. Unlike interactive tooltips (which correctly use `createPortal`), top-anchored panels near the badge's upper edge can clip.
- **Why it matters:** Decorative and desktop-only (`hidden md:contents`), but a clipped annotation on the hero badge is a visible polish issue on the most-seen page.
- **Recommendation:** Confirm no top-anchored panels clip at standard widths; apply the portal + `position: fixed` pattern if any do.
- **Expected impact:** Annotation panels remain fully visible regardless of hotspot position.
- **Effort estimate:** S

#### FE-L2 `page.tsx` casts every i18n subtree via `as unknown as` (~30 casts)
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/app/page.tsx:73-99
- **What's happening:** Structured i18n data is extracted via `as unknown as Array<...>` / `Record<...>` casts. TypeScript won't catch a dictionary key rename at these call sites.
- **Why it matters:** Latent correctness gap on the marquee page; `parity.test.ts` checks key existence but not shape-at-usage.
- **Recommendation:** Introduce a typed `tObject<T>()` / `tArray<T>()` accessor that centralizes the cast.
- **Expected impact:** Compile-time safety for structured i18n access.
- **Effort estimate:** M

#### FE-S1 No `middleware.ts` — per-page auth/locale gating won't scale to cross-cutting policies
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/page.tsx:62-74, apps/web/app/admin/page.tsx:17-19, apps/web/app/cli/authorize/page.tsx:55-64
- **What's happening:** Auth gates and feature-flag gates are inline in every gated page component. Deliberate and correct today (preserves ISR). No single enforcement point exists for future cross-cutting policies.
- **Why it matters:** Forward-looking only — as gated surfaces grow, every new protected route must independently implement the gate.
- **Recommendation:** Document the "why no middleware" decision in `docs/decisions/` to prevent a future contributor from adding middleware and silently breaking ISR.
- **Expected impact:** Preserves deliberate ISR architecture; prevents accidental regression.
- **Effort estimate:** S

---

## 5. Backend / API / Data Findings (Staff Backend Engineer)

### Domain Model
49 `route.ts` handlers backed by GitHub GraphQL, Upstash Redis, and Supabase Postgres. Core write path: `materializeOrchestratedProfile` → `computeImpactV6` → `persistOrchestratedSnapshot` → `invalidateProfileReadModels` → `revalidatePath`. Auth tiers: session cookie (`requireSession`), Bearer CLI token (`resolveRequestAuth`), admin shared secret (`verifyAdminSecret`, timing-safe), cron secret (`verifyCronSecret`, timing-safe). Validation: hand-rolled type guards in `lib/validation.ts`.

### Findings

#### BE-H1 Studio config persisted only in Redis — no durable backing store
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/studio/config/route.ts:34, :73
- **What's happening:** User badge customizations are written with `cacheSet(\`config:${session.login}\`, body, 31536000)` — Redis only, 365-day TTL. No `studio_configs` Supabase table exists. Every other user-authored artifact (snapshots, supplemental stats, tool insights) has Redis as hot path + Supabase as durable source. Studio config is the lone exception.
- **Why it matters:** Upstash eviction under memory pressure, a key flush, or the TTL boundary permanently destroys a user's badge design with no recovery path.
- **Recommendation:** Mirror the supplemental-stats pattern: add `studio_configs` table (one row per handle), write-through to Supabase + Redis on PUT, fall back to Supabase → rehydrate Redis on GET cache miss.
- **Expected impact:** Customizations survive Redis eviction/flush/TTL; durability parity with all other write paths.
- **Effort estimate:** M

#### BE-H2 Supplemental dual-write not atomic — Supabase failure returns `{ success: true }`
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/supplemental/route.ts:101, apps/web/lib/db/snapshots.ts:262
- **What's happening:** `await Promise.all([cacheSet(...), dbUpsertSupplemental(...)])` results are never inspected. `dbUpsertSupplemental` returns `false` and `console.error`s on failure. If Supabase write fails but Redis write succeeds, the route returns 200 `{ success: true }`.
- **Why it matters:** An HTTP 200 that didn't durably persist is a lie to the client. EMU users see a momentarily-updated score from the 24h Redis copy that silently vanishes on next cache miss, with no error surfaced anywhere but server logs.
- **Recommendation:** Capture the `dbUpsertSupplemental` boolean; on failure return 5xx rather than `{ success: true }`. Treat Redis write as best-effort, Supabase write as the success criterion.
- **Expected impact:** Failed uploads report failure → retries happen → scores don't silently regress.
- **Effort estimate:** S

#### BE-M1 No runtime cap on supplemental stats field magnitudes
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/api/supplemental/route.ts:69, apps/web/lib/validation.ts:48
- **What's happening:** `isValidStatsShape` validates structure but not value ranges. A self-owned token can submit structurally-valid supplemental with arbitrarily large `linesAdded`/`prsMergedWeight`, which flow into `computeImpactV6` and persist into snapshots and history.
- **Why it matters:** Scoring caps clamp dimension scores to 0–100, limiting blast radius, but unbounded raw magnitudes pollute lifetime history and score-diff analytics.
- **Recommendation:** Add per-field numeric range validation (non-negative, sane upper bounds) in `isValidStatsShape`.
- **Expected impact:** Snapshot/history stays within plausible bounds; defense-in-depth beyond scoring caps.
- **Effort estimate:** S

#### BE-M2 No structured request-body schema layer — hand-rolled guards vary in rigor
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/validation.ts:20, apps/web/app/api/admin/feature-flags/route.ts:23, apps/web/app/api/admin/campaigns/route.ts:28
- **What's happening:** No zod dependency. Admin routes (`feature-flags`, `campaigns`, `agents/run`) `await request.json()` then access fields with ad-hoc checks, while high-traffic routes have thorough guards. Rigor varies route-to-route with no enforced contract.
- **Why it matters:** Hand-rolled guards drift — a new payload field is easy to forget to validate; no compile-time link between TS type and runtime check.
- **Recommendation:** Adopt zod for new mutation routes; migrate admin routes first, deriving types from schemas.
- **Expected impact:** Uniform validation rigor; type/guard divergence becomes impossible.
- **Effort estimate:** L

#### BE-M3 `bulk-recalculate` partial-resume relies on fragile implicit prefix invariant
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/api/admin/bulk-recalculate/route.ts:119, :171
- **What's happening:** `pending: handles.slice(completed.length)` is correct only because `completed` is a dense prefix of `handles`. The invariant is implicit/undocumented. A future parallelization refactor would silently produce wrong `pending` arrays.
- **Why it matters:** This is the resumability mechanism for the heaviest admin operation; silent breakage drops handles on resume.
- **Recommendation:** Compute `pending` via `handles.filter(h => !completedSet.has(h))` and add a comment/test asserting the prefix property.
- **Expected impact:** Resume robust to batching changes; no silent skips.
- **Effort estimate:** S

#### BE-M4 CLI device-auth legacy path: token issuable without confirmed device code
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cli/auth/poll/route.ts:99, :150
- **What's happening:** The route's own comment (lines 99–103) documents the residual: until an updated CLI that always sends `device_code` ships, a passive attacker who learns the `sessionId` before confirmation can still redeem via the legacy path.
- **Why it matters:** Device-authorization flows exist to prevent exactly this token-theft window.
- **Recommendation:** Track the CLI-release dependency with a hard cutoff to flip enforcement mandatory and remove the legacy fallback. Consider shortening the unconfirmed-session window in the interim.
- **Expected impact:** Closes passive-sniff redemption window once CLI ships.
- **Effort estimate:** M (backend gated on external CLI)

#### BE-L1 Snapshot retention cleanup deletes only 1000 rows per daily cron run
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/db/snapshots.ts:410, apps/web/app/api/cron/warm-cache/route.ts:31
- **What's happening:** `dbCleanOldSnapshots` deletes at most `SNAPSHOT_CLEANUP_BATCH_SIZE = 1000` rows per call, invoked once per daily warm-cache cron. The table can only shrink by 1000 rows/day regardless of how many are eligible.
- **Why it matters:** Fine at current scale, but an unbounded-growth risk as user base grows.
- **Recommendation:** Loop the delete until it returns < batch size, or run cleanup on a dedicated cron.
- **Expected impact:** Retention cleanup scales past 1000 eligible rows/day.
- **Effort estimate:** S

#### BE-L2 `pingSupabase` health probe couples "DB healthy" to a named application table
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/lib/db/supabase.ts:47, apps/web/app/api/health/route.ts:82
- **What's happening:** Supabase health check runs `db.from("users").select("id").limit(1)`. A migration renaming/dropping `users` or an RLS misconfig flips health to degraded even if the DB is healthy.
- **Why it matters:** A false-negative health check triggers a P1 `health_degraded` alert and pages on-call for a non-outage.
- **Recommendation:** Use a schema-agnostic connectivity probe (`select 1`) instead of querying a named application table.
- **Expected impact:** Health reflects DB connectivity, not coupling to one table.
- **Effort estimate:** S

#### BE-S1 Score-write paths have no transactional envelope across DB + cache + ISR invalidation
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/lib/profile/orchestrated-profile.ts:30, apps/web/app/api/refresh/route.ts:86
- **What's happening:** Write sequence (Supabase write → cache update → `invalidateProfileReadModels` → `revalidatePath`) consists of independent awaited steps with no compensating action. A crash between DB write and cache invalidation leaves stale caches serving the old score until TTL or next write. 6 write paths reimplement variants of this sequence.
- **Why it matters:** Low impact today (24h TTLs self-heal), but structurally fragile as more write paths are added.
- **Recommendation:** Centralize the entire post-write sequence behind one function in `orchestrated-profile`; consider an outbox/marker so a failed invalidation is retried.
- **Expected impact:** Single enforced consistency contract for all score writes; no per-route drift.
- **Effort estimate:** M

---

## 6. Performance and Scalability Findings (Performance Engineer)

### Domain Model
Next.js 16 (Turbopack), badge SVG route is highest-volume (embedded in READMEs globally). CI enforces **350 KB uncompressed per-chunk** budget (CLAUDE.md's "500 KB" is stale — confirmed). Build succeeds: largest chunk 233 KB raw / 73 KB gz (React framework). PostHog (195 KB raw / 64 KB gz) is deferred behind interaction-gating. `@vercel/analytics` + `speed-insights` are `dynamic({ ssr: false })`. `canvas-confetti` is `await import()`-split. Performance is launch-ready with no high/medium findings.

### Findings

#### PE-L1 No `optimizePackageImports` for heavy client-bundled packages
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/next.config.ts:89-120
- **What's happening:** No `experimental.optimizePackageImports` configured. `posthog-js` (195 KB raw / 64 KB gz) is already deferred behind interaction-gating, so practical First-Load impact is minimal; this is cheap insurance against future barrel-import bloat.
- **Why it matters:** Low — heavy packages are already lazy-loaded.
- **Recommendation:** Add `experimental: { optimizePackageImports: ["posthog-js"] }` to `next.config.ts`.
- **Expected impact:** Marginally smaller deferred chunks; guards against future bloat.
- **Effort estimate:** S

#### PE-L2 Avatar fetch awaited inline on badge cache-miss path — 5s ceiling on p99
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:244-246, apps/web/lib/render/avatar.ts:29-30
- **What's happening:** On cache miss, `await getAvatarBase64(...)` runs before `renderBadgeSvg` with a 5s `AbortSignal.timeout` and `.catch(() => undefined)` fallback.
- **Why it matters:** Only on cache miss (rare, deduped by Redis lock), but 5s is generous for one CDN image on an `maxDuration=35` route.
- **Recommendation:** Tighten avatar timeout to ~2–2.5s; optionally pre-warm avatars in `warm-cache` cron.
- **Expected impact:** Lower p99 on first-render-of-day when GitHub CDN is slow.
- **Effort estimate:** S

#### PE-L3 In-memory inflight map provides no cross-instance dedup on serverless (documented, acceptable)
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:42, :170-180
- **What's happening:** `inflightBadgeRenders` is a module-level Map. On Vercel serverless each instance has its own map; Redis SETNX lock + stale-yesterday serve cap the blast radius. In-code comments already document this.
- **Why it matters:** No action required; residual is bounded and documented.
- **Recommendation:** Add to `docs/accepted-risks.md` if not already documented.
- **Expected impact:** Documentation only.
- **Effort estimate:** S

#### PE-S1 Per-route First Load JS not gated in CI — chunk-level check can miss route-level creep
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** scripts/check-bundle-size.sh:3-8, .github/workflows/bundle-size.yml:20-22
- **What's happening:** CI asserts no individual chunk file exceeds 350 KB. A regression bloating a route's composed First Load JS (many medium chunks) without any single chunk crossing 350 KB would pass. Turbopack doesn't emit per-route First Load JS that the script can parse.
- **Why it matters:** Strategic — current sizes healthy (largest 233 KB); no live problem.
- **Recommendation:** Track per-route First Load JS vs. a committed baseline; fail on % regression.
- **Expected impact:** Catches gradual route-level bundle creep.
- **Effort estimate:** M

---

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

### Domain Model
7 CI workflows (ci.yml, bundle-size.yml, security.yml, gitleaks.yml, knip.yml, lighthouse.yml, claude-review.yml). Deploys via Vercel from `main` only. `vercel.json` declares 3 crons. Health endpoint probes Redis + Supabase + GitHub in parallel; `health_degraded` triggers P1 alert. 26 forward-only migrations applied manually. 8 runbooks in `docs/runbooks/`. All 5 latest CI runs on `develop` are green.

### Findings

#### DO-M1 Bundle-size budget is inconsistent across three CI authorities
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/ci.yml:165, .github/workflows/bundle-size.yml, scripts/check-bundle-size.sh:7, CLAUDE.md
- **What's happening:** `ci.yml` enforces 350 KB; `bundle-size.yml` enforces 500 KB; CLAUDE.md documents 500 KB. A chunk between 350–500 KB fails `ci.yml` but passes `bundle-size.yml`, producing contradictory signals on the same PR.
- **Why it matters:** Conflicting gates erode trust in CI; makes the "real" budget ambiguous.
- **Recommendation:** Set `bundle-size.yml` `BUDGET_KB` to 350 and update CLAUDE.md to "350 KB".
- **Expected impact:** Single authoritative budget; no contradictory CI signals.
- **Effort estimate:** S

#### DO-M2 No automated production migration check — schema/code drift undetectable at deploy time
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/runbooks/migrations.md, vercel.json, .github/workflows/ci.yml:14
- **What's happening:** Migrations are applied manually via Supabase dashboard/CLI, decoupled from deploys. CI validates only filename sequencing, never that production schema matches `supabase/migrations/`.
- **Why it matters:** A forgotten manual migration silently degrades features; graceful degradation is the only safety net.
- **Recommendation:** Add a `git diff main..develop -- supabase/migrations/` check to the release-checklist runbook; optionally add a schema-presence probe to `/api/health`.
- **Expected impact:** Schema/code drift becomes observable before it hits users.
- **Effort estimate:** M

#### DO-M3 Cron `maxDuration=300` requires Vercel Pro — requirement not explicit in config
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:31, apps/web/app/api/cron/sync-audience/route.ts:17, apps/web/app/api/cron/process-campaigns/route.ts:7, vercel.json
- **What's happening:** Four routes export `maxDuration = 300`. Vercel Hobby caps functions at 60s. No `functions` block in `vercel.json` documents the Pro-plan dependency.
- **Why it matters:** Silent platform kill truncates warm-cache mid-batch; `warm_cache_high_failure_rate` alert doesn't catch a hard platform timeout.
- **Recommendation:** Add a `functions` entry to `vercel.json` documenting the 300s/memory expectation; note Pro-plan dependency in the deployment runbook.
- **Expected impact:** Duration expectations explicit and reviewable; plan changes surface as config diffs.
- **Effort estimate:** S

#### DO-L1 `CHAPA_ALERT_WEBHOOK_URL` optional — all P1/P2 alerting silently no-ops if unset
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/lib/env.ts:73, .env.example, apps/web/app/api/health/route.ts:109
- **What's happening:** All operational alerts are gated on `CHAPA_ALERT_WEBHOOK_URL`. The var is optional with no startup/health assertion. A missing or malformed value means every `health_degraded`, `badge_5xx`, `oauth_callback_failure`, and `cron_failure` event silently no-ops.
- **Why it matters:** Entire incident-detection layer depends on one optional env var with no guardrail.
- **Recommendation:** Have `/api/health` report `alertWebhook: "skipped"` when the var is missing; add to release-checklist env verification.
- **Expected impact:** Missing alert wiring caught by smoke/health before it matters.
- **Effort estimate:** S

#### DO-L2 Working tree not clean — two modified tracked files
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/agents/performance-report.md:1, docs/agents/shared-context.md:1
- **What's happening:** `git status` shows two modified tracked files. Release gate expects a clean working tree.
- **Why it matters:** Uncommitted tracked changes risk polluting the release commit.
- **Recommendation:** Commit the agent docs before cutting the release PR.
- **Expected impact:** Clean, intentional release commits.
- **Effort estimate:** S

#### DO-L3 CSP relies on `script-src 'unsafe-inline'` in production
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/next.config.ts:22-26
- **What's happening:** Production `script-src` includes `'unsafe-inline'` (Next.js App Router hydration requirement without nonce support). `'unsafe-eval'` is correctly dev-only.
- **Why it matters:** `'unsafe-inline'` weakens CSP — primary XSS surface (SVG user input) is separately escaped.
- **Recommendation:** Track Next.js nonce-CSP support; record in `docs/accepted-risks.md` until then.
- **Expected impact:** Stronger CSP once framework support lands.
- **Effort estimate:** M

#### DO-S1 Warm-cache has no staggered strategy beyond 50 handles/run
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:34, :186-194
- **What's happening:** `MAX_HANDLES = 50` per daily run. P2 alert fires when `allHandles.length >= 50`. Beyond 50 active users, cache refresh becomes less than daily.
- **Why it matters:** Not a launch blocker, but post-launch growth directly degrades badge freshness.
- **Recommendation:** Introduce staggered cron schedules or tiered freshness.
- **Expected impact:** Badge freshness holds as user base scales.
- **Effort estimate:** L

#### DO-S2 No down-migrations / schema-rollback path for destructive changes
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** supabase/migrations/001_create_tables.sql:1, docs/runbooks/rollback.md:1
- **What's happening:** All 26 migrations are forward-only. `rollback.md` covers code rollback but has no schema-rollback procedure.
- **Why it matters:** A future destructive migration paired with a code rollback has no documented reversal.
- **Recommendation:** Adopt expand/contract convention for destructive migrations; add schema-rollback section to `rollback.md`.
- **Expected impact:** Destructive schema changes become reversible without data loss.
- **Effort estimate:** M

---

## 8. Security / Privacy Findings (Security Reviewer)

### Domain Model
Mature security posture. `pnpm audit` clean. HMAC-signed session cookie; OAuth CSRF via double-submit cookie + Redis single-use nonce. SVG user input escaped via `escapeXml`. SSRF guarded on avatar fetch (host allow-list + content-type validation + 5s timeout). All `NEXT_PUBLIC_*` variables are non-sensitive. No SQL string-building (Supabase client). Strong security headers (HSTS preload, CSP, nosniff, frame-deny, Permissions-Policy) in `next.config.ts`.

### Findings

#### SE-L1 CSP relies on `script-src 'unsafe-inline'` in production
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/next.config.ts:18-27
- **What's happening:** Production CSP `script-src` includes `'unsafe-inline'` — commented as a Next.js App Router requirement. `'unsafe-eval'` is correctly dev-only.
- **Why it matters:** `'unsafe-inline'` is the largest weakener of an otherwise strong CSP; mitigated by thorough `escapeXml` and no untrusted HTML sinks.
- **Recommendation:** Track Next.js nonce-based CSP support; migrate when feasible.
- **Expected impact:** CSP becomes a real second line against script injection.
- **Effort estimate:** L

#### SE-L2 Rate limiter is fail-open; auth and write routes lose protection during Redis outage
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/cache/redis.ts:184, :195, :215, :233, :236; apps/web/app/api/auth/callback/route.ts:86
- **What's happening:** `rateLimit()` returns `{ allowed: true }` when Redis is unavailable. Documented as availability-first accepted risk (correct for badge read path). The same limiter also fronts auth (`/api/auth/callback`, 10/15min), supplemental, and insights routes.
- **Why it matters:** During a Redis outage, brute-force/abuse protection on auth and write endpoints silently disappears.
- **Recommendation:** Consider a stricter posture (fail-closed or low in-memory global cap) specifically for auth and write routes while keeping fail-open for public badge reads.
- **Expected impact:** Abuse protection on highest-value routes survives a cache outage.
- **Effort estimate:** M

#### SE-L3 `@img/sharp-libvips-darwin-arm64` is LGPL-3.0, deviating from documented allow-list
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** LICENSE-THIRD-PARTY.md:21-25
- **What's happening:** `@img/sharp-libvips-darwin-arm64` (LGPL-3.0-or-later) is documented in `LICENSE-THIRD-PARTY.md`. Project policy (CLAUDE.md) is "MIT, Apache-2.0, BSD, ISC only."
- **Why it matters:** Practical risk low (dynamically-linked unmodified binary), but it's a deviation from the documented allow-list without a formal rationale.
- **Recommendation:** Confirm `sharp` is actually used vs `@resvg/resvg-js`; if unused, drop it. Otherwise add an explicit LGPL-3.0 rationale to `LICENSE-THIRD-PARTY.md`.
- **Expected impact:** License posture matches policy; no implicit copyleft exposure.
- **Effort estimate:** S

---

## 9. Code Quality / Maintainability Findings (Principal Architect)

### Domain Model
pnpm monorepo, two workspaces. Typecheck: clean both. Circular deps: none (899 files). knip: zero dead-code issues. `pnpm outdated`: only 3 dev-only patch/minor bumps. `no-process-env` ESLint rule enforces `lib/env.ts` boundary; `@chapa/shared` alias held without a lint rule (zero violations). No god-modules. Largest non-dictionary source file: `lib/auth/github.ts` (465 lines).

### Findings

#### AR-M1 Per-platform `buildStatsFrom*` aggregators duplicate a 10-step computation skeleton
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/bitbucket/stats-aggregation.ts:9, apps/web/lib/gitlab/stats-aggregation.ts:16, apps/web/lib/codeberg/stats-aggregation.ts:1, apps/web/lib/github/stats.ts
- **What's happening:** `buildStatsFromBitbucket`, `buildStatsFromGitlab`, and `buildStatsFromCodeberg` each implement an identical 10-step pipeline. Only steps 1, 4, and 10 (source-shape extraction) genuinely diverge. The fetch layer was correctly factored into `fetchLinkedPlatformStats` (#744); the aggregation layer was not.
- **Why it matters:** Any change to a shared heuristic must be applied in 3–4 places; divergence is silent — exactly the "integration gap" failure class that caused v2.7.x craft bugs.
- **Recommendation:** Extract platform-invariant steps into a shared helper in `packages/shared`; each platform function reduces to source-shape extraction + the shared call.
- **Expected impact:** Single source of truth for cross-platform heuristics; one file to change, one test to update.
- **Effort estimate:** M

#### AR-L1 `escapeXml` doc comment references stale location for `escapeHtml`
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/render/escape.ts:10, apps/web/lib/utils/escape.ts:6, apps/web/lib/email/resend.ts:14
- **What's happening:** `escapeXml`'s JSDoc says it is "intentionally separate from `escapeHtml` in `lib/email/resend.ts`." `escapeHtml` was moved to `lib/utils/escape.ts`; the pointer is stale.
- **Why it matters:** A future reader consolidating escapers will look in the wrong file.
- **Recommendation:** Update the comment to point at `lib/utils/escape.ts`.
- **Expected impact:** Comment matches reality.
- **Effort estimate:** S

#### AR-L2 `packages/shared` import boundary documented as CI-enforced but has no lint rule
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/eslint.config.mjs:14, CLAUDE.md
- **What's happening:** CLAUDE.md lists the `packages/shared` import boundary as a CI gate. No `no-restricted-imports` rule blocks relative `../../packages/shared` paths. Convention holds (zero violations), but it's discipline-only.
- **Why it matters:** A drive-by relative import would pass CI despite the documented prohibition.
- **Recommendation:** Add a `no-restricted-imports` ESLint rule blocking `**/packages/shared/**` from `apps/web`.
- **Expected impact:** Documented boundary becomes machine-enforced.
- **Effort estimate:** S

#### AR-L3 `madge` circular-dep scan ingests `.next` generated artifacts
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** package.json, tsconfig.madge.json:1
- **What's happening:** `pnpm run check:circular` scans `apps/web/` without excluding `.next/`, processing generated files.
- **Why it matters:** Slower scans, noisier output, risk of future generated-file false-positive cycles blocking CI.
- **Recommendation:** Add `.next` to madge's `excludeRegExp` config.
- **Expected impact:** Faster, deterministic circular-dep gate scoped to real source.
- **Effort estimate:** S

#### AR-S1 No cross-platform aggregation parity test — divergence is silent
- **Severity:** strategic
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/lib/bitbucket/stats-aggregation.ts:9, apps/web/lib/gitlab/stats-aggregation.ts:16, apps/web/lib/codeberg/stats-aggregation.ts:1
- **What's happening:** Each platform aggregator has its own unit test but no single test asserts invariant steps behave identically across platforms given equivalent inputs.
- **Why it matters:** Without a parity guard, AR-M1 duplication can drift undetected.
- **Recommendation:** When extracting the shared aggregator (AR-M1), add one parity/golden test in `packages/shared` asserting identical invariant fields across platforms.
- **Expected impact:** Cross-platform scoring drift becomes a test failure instead of a production surprise.
- **Effort estimate:** M

---

## 10. Testing / QA Findings (QA / Reliability Lead)

### Domain Model
Vitest with v8 coverage (75% statements, 70% branches, 65% functions, 75% lines). 470 test files, 8,037 tests, all passing in ~32s. No `.skip`/`.only`/`.todo`/`xdescribe` anywhere. 49 API routes, 49 colocated `route.test.ts` files (1:1 coverage). Redis fail-open and graceful-degradation paths are explicitly tested. Typecheck and lint are clean.

### Findings

#### QA-L1 Duplicated `localStorage` polyfill block in `vitest.setup.ts`
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** vitest.setup.ts:82-96, vitest.setup.ts:102-116
- **What's happening:** The `localStorage` polyfill block (including the comment) is written twice verbatim. The second guard is always false — the first already defines `globalThis.localStorage`.
- **Why it matters:** Dead code in global test setup; risks divergent edits to one copy.
- **Recommendation:** Delete the second block (lines ~102-116 including its duplicate comment).
- **Expected impact:** -19 lines of dead setup code; clearer setup file.
- **Effort estimate:** S

#### QA-L2 `fetch-retry.ts` retry/idempotency primitive has no direct unit test
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/utils/fetch-retry.ts:41-66, :76-84
- **What's happening:** `fetchWithRetry` and `sanitizeLogBody` are exercised only transitively via platform query tests. The module ships a `_setRetryDelayFn` seam specifically for unit testing, yet no test uses it directly.
- **Why it matters:** Shared retry infra for every external platform read; boundary behavior could regress with no direct guard.
- **Recommendation:** Add `apps/web/lib/utils/fetch-retry.test.ts` asserting: 5xx → 2 attempts, 429 → 1 attempt, 2xx → 1 attempt, sanitizer truncates at 200 chars.
- **Expected impact:** Direct contract coverage for shared retry logic.
- **Effort estimate:** S

#### QA-S1 Coverage gate not exercised by `pnpm run test` — only by `test:coverage`
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** vitest.config.ts:42-47, package.json
- **What's happening:** `pnpm run test` runs without `--coverage`, so per-module thresholds are never enforced in the default test command. If CI invokes bare `test`, the documented coverage floor is never enforced.
- **Why it matters:** Coverage floor could silently erode without CI catching it.
- **Recommendation:** Confirm the CI workflow runs `pnpm run test:coverage`; if it runs bare `test`, switch it.
- **Expected impact:** Documented coverage floor becomes a real, enforced gate.
- **Effort estimate:** S

---

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

### Domain Model
Terminal-first aesthetic. Design system: mature token layer in `globals.css`, dual-theme via `[data-theme]`, global `*:focus-visible` outline, `prefers-reduced-motion` block, named-animation library. 653 token usages, 436 font-class usages, 0 hardcoded hex in component bodies. 13 `loading.tsx`, 13 `error.tsx`, 1 `not-found.tsx`, 1 `global-error.tsx`. 206 `aria-*` usages; 0 `onClick` on bare `<div>`. i18n-driven throughout — except for a cluster of dashboard/data-viz strings.

### Findings

#### UX-H1 Dashboard dimension tooltips are hardcoded English in a Spanish-default app
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/DimensionCard.tsx:45-76, :149, :168; apps/web/lib/i18n/dictionaries/es.ts:1057-1075
- **What's happening:** `DIMENSION_TOOLTIPS` and `SOLO_QUALITY_TOOLTIP`/`SOLO_QUALITY_SUBTITLE` are hardcoded English literals passed straight into `<InfoTooltip content={tooltip.tip} />`. No `tip` key exists in `es.ts` or `en.ts`. Default locale is `es`.
- **Why it matters:** CLAUDE.md mandates Spanish-default content. These tooltips are the primary explainer for each impact dimension — the core comprehension surface — shown in English to the default audience.
- **Recommendation:** Add `dimensions.<dim>.tip` keys to both `es.ts` and `en.ts`; resolve via `t(\`dimensions.${dimension}.tip\`)`. Parity test enforces sync.
- **Expected impact:** Dimension explanations render in the user's locale.
- **Effort estimate:** M

#### UX-H2 Data-viz aria-labels are hardcoded English, producing mixed-language screen-reader output
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/DimensionCard.tsx:158, :182; apps/web/components/dashboard/SubMetricPanel.tsx:61; apps/web/components/ImpactBreakdown.tsx:267
- **What's happening:** Accessible names built from English template literals: `` `${label} dimension score: ${score}` `` (DimensionCard:158), `` `${label} score` `` (:182), `` `${label} dimension breakdown` `` (SubMetricPanel:61). The visible `label` is translated, but connective words stay English.
- **Why it matters:** Spanish-locale screen-reader users hear mixed-language announcements ("Entrega dimension score: 72"). Both an a11y and i18n consistency defect.
- **Recommendation:** Move announcement templates into the dictionary with interpolation (e.g. `aria.dimensionScore` = `"{label}: puntuación {score}"`); resolve via `t()`.
- **Expected impact:** Consistent localized screen-reader announcements.
- **Effort estimate:** M

#### UX-M1 Avatar `alt` text is hardcoded English possessive across components
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/admin/AdminUserTable.tsx:36; apps/web/components/UserMenu.tsx:390, :431; apps/web/components/badge/BadgeContent.tsx:123; apps/web/components/SharePageOwnerContent.tsx:112
- **What's happening:** Avatars use `` alt={`${handle}'s avatar`} `` — hardcoded English in 5 components. The `SharePageOwnerContent:112` instance also bakes English alt text into the embed HTML snippet users copy to their own sites.
- **Why it matters:** Inconsistent localization; embed snippet propagates English alt text into third-party pages.
- **Recommendation:** Add `aria.avatarAlt` key (`"avatar de {handle}"` / `"{handle}'s avatar"`) and interpolate; localize the embed snippet per page locale.
- **Expected impact:** Localized, consistent alt text; cleaner copied embed markup.
- **Effort estimate:** S

#### UX-M2 Experiment pages emit hardcoded English aria-labels on score visuals
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/experiments/number-counters/page.tsx:240; apps/web/app/experiments/metallic-shimmer/page.tsx:334
- **What's happening:** `` `Impact score: ${hero.value}` `` and `` `Impact score ${score}, tier ${tier}` `` are hardcoded English.
- **Why it matters:** Lower severity — `/experiments/*` is feature-flagged off by default. Still an a11y/i18n inconsistency if the flag is ever enabled.
- **Recommendation:** Route through `t()`, or document as accepted in `docs/accepted-risks.md`.
- **Expected impact:** Consistency if/when experiments ship.
- **Effort estimate:** S

#### UX-L1 `InfoTooltip` in animated `DimensionCard` must use `createPortal` — unverified
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/components/dashboard/DimensionCard.tsx:159-161, :168; apps/web/components/InfoTooltip.tsx
- **What's happening:** `DimensionCard` renders `<InfoTooltip>` inside a card with `animate-fade-in-up` + `animationDelay`. Per the project's mandatory tooltip rule, a transformed ancestor breaks `position: fixed`. InfoTooltip.tsx internals were not audited this pass.
- **Why it matters:** If InfoTooltip doesn't portal, dimension tooltips can clip at the card edge.
- **Recommendation:** Confirm InfoTooltip renders through `createPortal(document.body)` with `position: fixed` + `z-index: 99999`; fix if not.
- **Expected impact:** Dimension tooltips never clipped inside animated cards.
- **Effort estimate:** S

#### UX-S1 Terminal-first metaphor may add friction for non-developer share-page visitors
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/app/page.tsx:108-421; apps/web/app/u/[handle]/page.tsx:96-100
- **What's happening:** Landing structured as a simulated terminal session. Share page already demotes the command bar to opt-in (CommandBarHint, #783) — the right instinct.
- **Why it matters:** The share page is the primary conversion/credibility surface for non-developers.
- **Recommendation:** No code change required now. Continue prioritizing plain badge legibility on the share page.
- **Expected impact:** Clearer value comprehension for non-developer audience.
- **Effort estimate:** M

---

## 12. Prioritized Action Plan

| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|----|--------|-------|----------|-------------|--------|--------|
| BE-H1 | Backend | Studio config Redis-only, no durable store | high | Before launch | M | Data loss prevention |
| BE-H2 | Backend | Supplemental dual-write returns false success | high | Before launch | S | Correctness on EMU writes |
| UX-H1 | UX | Dashboard tooltips hardcoded English | high | Before launch | M | i18n compliance on core surface |
| UX-H2 | UX | Data-viz aria-labels hardcoded English | high | Before launch | M | a11y + i18n compliance |
| UX-M1 | UX | Avatar alt text hardcoded English | medium | Before launch | S | i18n compliance + embed snippet |
| DO-M1 | DevOps | Bundle budget inconsistent (350 vs 500 KB) | medium | Before launch | S | CI trust |
| DO-M2 | DevOps | No automated migration check at deploy | medium | Before launch | M | Schema/code drift prevention |
| DO-M3 | DevOps | Cron maxDuration Pro requirement undocumented | medium | Before launch | S | Operational clarity |
| DO-L1 | DevOps | Alert webhook optional, alerting silently no-ops | low | Before launch | S | Incident detection |
| DO-L2 | DevOps | Working tree not clean (2 modified files) | low | Before launch | S | Clean release commit |
| FE-M1 | Frontend | Landing page force-dynamic, losing ISR | medium | After launch | M | TTFB for highest-traffic route |
| FE-M2 | Frontend | In-memory inflight Map near-zero benefit | medium | After launch | M | Code simplicity |
| AR-M1 | Architect | Per-platform aggregators duplicate skeleton | medium | After launch | M | Cross-platform scoring parity |
| UX-M2 | UX | Experiments hardcoded English aria-labels | medium | After launch | S | a11y consistency |
| BE-M1 | Backend | No magnitude caps on supplemental stats fields | medium | After launch | S | History integrity |
| BE-M2 | Backend | No structured schema layer (no zod) | medium | After launch | L | Validation uniformity |
| BE-M3 | Backend | bulk-recalculate resume fragile | medium | After launch | S | Admin op correctness |
| BE-M4 | Backend | CLI device-auth legacy path open | medium | After launch | M | Auth correctness (CLI gated) |
| SE-L2 | Security | Rate limiter fail-open on auth/write routes | low | After launch | M | Abuse protection resilience |
| QA-L1 | QA | Duplicate localStorage polyfill | low | After launch | S | Setup file clarity |
| QA-L2 | QA | fetch-retry.ts has no direct unit test | low | After launch | S | Retry contract coverage |
| UX-L1 | UX | InfoTooltip portal pattern in animated card | low | After launch | S | Tooltip visibility |
| FE-L1 | Frontend | BadgeOverlay absolute positioning clip risk | low | After launch | S | Hero badge visual polish |
| AR-L2 | Architect | shared import boundary not lint-enforced | low | After launch | S | Boundary enforcement |
| DO-L3 | DevOps | CSP `unsafe-inline` in production | low | After launch | M | Defense-in-depth |
| PE-L1 | Perf | No optimizePackageImports | low | After launch | S | Bundle insurance |
| PE-L2 | Perf | Avatar fetch 5s ceiling on cache-miss path | low | After launch | S | p99 badge latency |
| AR-S1 | Architect | No cross-platform parity test | strategic | After launch | M | Drift detection |
| SE-L1 | Security | CSP `unsafe-inline` (later, framework blocked) | low | Later | L | Defense-in-depth |
| SE-L3 | Security | Sharp LGPL-3.0 license deviation | low | Later | S | License compliance |
| QA-S1 | QA | Coverage gate not exercised by default command | strategic | Later | S | Gate enforcement |
| UX-S1 | UX | Terminal metaphor friction for non-devs | strategic | Later | M | UX positioning |
| DO-S1 | DevOps | No staggered warm-cache strategy | strategic | Later | L | Scale readiness |
| DO-S2 | DevOps | No down-migrations / schema rollback | strategic | Later | M | Disaster recovery |
| AR-L1 | Architect | escapeXml stale doc comment | low | Later | S | Docs accuracy |
| AR-L3 | Architect | madge scans .next artifacts | low | Later | S | CI reliability |
| FE-L2 | Frontend | page.tsx i18n casts (30x `as unknown as`) | low | Later | M | Type safety |
| FE-S1 | Frontend | No middleware.ts decision documented | strategic | Later | S | Architecture docs |
| PE-L3 | Perf | In-memory inflight map accepted risk | low | Later | S | Accepted risk doc |
| PE-S1 | Perf | No per-route First Load JS gate | strategic | Later | M | Bundle regression |
| BE-L1 | Backend | Snapshot retention capped at 1000/day | low | Later | S | Scale readiness |
| BE-L2 | Backend | pingSupabase coupled to named table | low | Later | S | Health probe accuracy |
| BE-S1 | Backend | Score-write no transactional envelope | strategic | Later | M | Consistency architecture |

---

## 13. Top 10 Highest-ROI Improvements

1. **BE-H2** — Fix supplemental dual-write to fail on durable-write failure. S effort, prevents silent score corruption for EMU users.
2. **BE-H1** — Add `studio_configs` Supabase table + write-through. M effort, prevents permanent loss of user badge customizations.
3. **UX-H1** — Add `dimensions.<dim>.tip` i18n keys + resolve via `t()`. M effort, fixes the primary comprehension surface for the default Spanish audience.
4. **UX-H2** — Localize data-viz aria-label templates. M effort, fixes mixed-language screen-reader output on core data visualization.
5. **DO-M1** — Align bundle budget to 350 KB in all three locations. S effort, eliminates contradictory CI red/green signals.
6. **UX-M1** — Localize avatar alt text (5 components + embed snippet). S effort, fixes i18n gap and embed-snippet propagation.
7. **DO-L2** — Commit the 2 modified agent docs. S effort, prerequisite for a clean release commit.
8. **DO-M3** — Document Vercel Pro requirement in `vercel.json` `functions` block. S effort, prevents silent cron truncation on plan changes.
9. **DO-L1** — Have `/api/health` surface missing alert webhook. S effort, closes a blind spot in incident detection.
10. **AR-L2** — Add `no-restricted-imports` ESLint rule for `packages/shared`. S effort, makes a documented CI gate actually enforced.

---

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)
- BE-H1: Studio config persisted only in Redis — no durable backing store
- BE-H2: Supplemental dual-write not atomic — Supabase failure returns success
- UX-H1: Dashboard dimension tooltips are hardcoded English
- UX-H2: Data-viz aria-labels are hardcoded English, mixed-language for screen readers
- UX-M1: Avatar alt text is hardcoded English possessive across components
- DO-M1: Bundle-size budget is inconsistent across three CI authorities
- DO-M2: No automated production migration check — schema/code drift undetectable
- DO-M3: Cron `maxDuration=300` requires Vercel Pro — undocumented in config
- DO-L1: `CHAPA_ALERT_WEBHOOK_URL` optional — all alerting silently no-ops if unset
- DO-L2: Working tree not clean — two modified tracked files

### After launch (Wave 2)
- FE-M1: Landing page is `force-dynamic`, losing ISR for highest-traffic route
- FE-M2: In-memory inflight badge render Map near-zero benefit on serverless
- FE-L1: BadgeOverlay annotation panels use `position: absolute`, clipping risk
- AR-M1: Per-platform `buildStatsFrom*` aggregators duplicate 10-step skeleton
- AR-L2: `packages/shared` import boundary documented but not lint-enforced
- AR-S1: No cross-platform aggregation parity test — divergence is silent
- BE-M1: No runtime cap on supplemental stats field magnitudes
- BE-M2: No structured request-body schema layer (no zod)
- BE-M3: `bulk-recalculate` partial-resume relies on fragile prefix invariant
- BE-M4: CLI device-auth legacy sessionId-only path still open
- SE-L2: Rate limiter fail-open; auth/write routes lose protection during Redis outage
- QA-L1: Duplicated `localStorage` polyfill block in `vitest.setup.ts`
- QA-L2: `fetch-retry.ts` retry primitive has no direct unit test
- UX-M2: Experiment pages hardcoded English aria-labels
- UX-L1: `InfoTooltip` portal pattern in animated `DimensionCard` — unverified
- DO-L3: CSP relies on `script-src 'unsafe-inline'` in production
- PE-L1: No `optimizePackageImports` for heavy client-bundled packages
- PE-L2: Avatar fetch awaited inline, 5s ceiling on badge cache-miss path

### Later / strategic (Wave 3)
- SE-L1: CSP `unsafe-inline` — track Next.js nonce-CSP support
- SE-L3: `@img/sharp-libvips-darwin-arm64` LGPL-3.0 deviates from allow-list
- QA-S1: Coverage gate not exercised by default `pnpm run test` command
- UX-S1: Terminal-first metaphor adds friction for non-developer share-page visitors
- DO-S1: No staggered/tiered warm-cache strategy beyond 50 handles/run
- DO-S2: No down-migrations / schema-rollback path for destructive changes
- AR-L1: `escapeXml` doc comment references stale location for `escapeHtml`
- AR-L3: `madge` circular-dep scan ingests `.next` generated artifacts
- FE-L2: `page.tsx` casts every i18n subtree via `as unknown as` (~30 casts)
- FE-S1: No `middleware.ts` — per-page auth gating won't scale to cross-cutting policies
- PE-L3: In-memory inflight map serverless dedup is documented-acceptable
- PE-S1: No automated per-route First Load JS regression gate
- BE-L1: Snapshot retention cleanup capped at 1000 rows per daily cron
- BE-L2: `pingSupabase` health probe coupled to named `users` table
- BE-S1: Score-write paths have no transactional envelope across DB + cache + ISR

---

## 15. Open Questions / Assumptions

- **Vercel plan**: DO-M3 assumes `maxDuration=300` requires Pro. Assumed Pro is active; verify via Vercel dashboard.
- **Sharp usage**: SE-L3 notes `@img/sharp-libvips-darwin-arm64` in `LICENSE-THIRD-PARTY.md`. Unclear whether `sharp` is actively imported vs. `@resvg/resvg-js`. If unused, drop it.
- **CLI release timeline**: BE-M4 depends on a CLI update that sends `device_code` — backend residual closes only when the CLI ships.
- **InfoTooltip portal**: UX-L1 is [inference] — InfoTooltip.tsx internals were not read. Confirm whether it uses `createPortal`.
- **CI test command**: QA-S1 is [inference] — the CI workflow may already invoke `test:coverage`. Verify `ci.yml` test step command.
- **CHAPA_ALERT_WEBHOOK_URL in production**: DO-L1 assumes this may not be set. Verify in Vercel production env vars before launch.

---

## 16. Final Verdict

**Verdict: CONDITIONAL**

**What would most worry you about shipping today?**
Two data-durability defects are the primary concern: `BE-H1` means Creator Studio users can silently lose their entire badge customization on the first Redis eviction or TTL boundary with no recovery path. `BE-H2` means EMU/supplemental users receive an HTTP 200 that didn't durably persist, followed by a silent score regression a day later. The i18n failures (`UX-H1`, `UX-H2`) are a close second — the primary Spanish-speaking audience sees English explanations on the product's core value proposition, violating a documented mandatory requirement.

**What gives you confidence?**
The test suite is exceptional (8,037 tests, all passing, 1:1 API route coverage). Security posture is mature with multiple defence layers. Architecture is clean (strict TypeScript everywhere, zero circular deps, zero dead code, enforced module boundaries). CI is green on `develop`. All 10 Wave 1 items are S-to-M effort and well within one sprint.

**Next 5 actions (ordered):**
1. Fix **BE-H2** (S effort, highest blast-radius correctness bug): make supplemental route fail on durable-write failure.
2. Fix **BE-H1** (M effort): add `studio_configs` Supabase table + write-through pattern.
3. Fix **UX-H1** + **UX-H2** + **UX-M1** together (M+M+S effort): add i18n keys for dimension tooltips and localize all data-viz aria-labels and avatar alt text in one pass.
4. Fix **DO-M1** + **DO-M3** + **DO-L1** + **DO-L2** (all S effort): align bundle budget, document Vercel Pro requirement, expose alert webhook in health response, commit agent docs.
5. Address **DO-M2** (M effort): add migration-diff check to release-checklist runbook.
