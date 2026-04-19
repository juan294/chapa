# Pre-Launch Codebase Audit
> Generated on 2026-04-19 | Branch: `develop` | 8 parallel specialists
> Focus: comprehensive

---

## 1. Executive Summary

Chapa's codebase is structurally sound: 6,901 tests pass, TypeScript is clean, lint is clean, zero known npm vulnerabilities, and the scoring pipeline is well-tested. The architecture is coherent and the security fundamentals (OAuth, session encryption, SVG XSS) are implemented correctly. However, three backend blockers — all S-effort — prevent a responsible launch: unauthenticated cron endpoints that any attacker can trigger, an unprotected unsubscribe endpoint that lets anyone silence any user's notifications, and rate limits that trust client-supplied IP headers and are trivially bypassed. Beyond blockers, the most critical operational gap is near-zero server-side observability: only 5 of 44 API routes wire up `captureServerError`, and there are no runbooks, no alerting, and no structured logging. Performance is tight: the embeddable badge SVG is re-rendered on every CDN cache miss with no full-response cache, and bundle size exceeds the 500 KB target on every route.

**Top 3 strengths:**
1. **Test coverage depth** — 94% line coverage across 394 test files with 6,901 tests; all critical paths (scoring, SVG, OAuth callback) are covered.
2. **Security fundamentals** — Auth chain (HMAC-SHA256 CLI tokens, AES-256-GCM sessions, timing-safe compares, `escapeXml` in SVG, host-allowlisted avatars, CSP) is solid; `pnpm audit` returns 0 vulnerabilities.
3. **Codebase hygiene** — zero circular dependencies, zero knip dead code, zero typecheck or lint errors; pure scoring functions make the engine testable and deterministic.

**Top 5 risks:**
1. Three S-effort blockers (cron open, unsubscribe open, IP bypass) that together let an attacker drain GitHub quota, trigger email campaigns, and neutralize all rate-limiting.
2. Near-zero server observability: silent 500s, no structured logs, no runbooks — a production incident will be entirely blind.
3. Badge SVG re-rendered + four Supabase writes fired on every CDN cache miss; will produce thundering-herd DB load on launch.
4. First Load JS ~700 KB on every route, exceeding the declared 500 KB budget and risking poor Core Web Vitals on the badge's primary embed surface.
5. Develop is 41 commits ahead of main with a Next.js major upgrade in the batch — rollback would require bisecting through a 15-day range.

**Verdict: NOT READY**
Three launch-blockers exist in the backend (BE-B1, BE-B2, BE-B3). All are S-effort fixes (≤1 day combined). The intent is not to block the release but to ensure these are fixed before the PR from `develop` → `main` is merged. Everything else is hardening.

---

## 2. System Architecture Overview

Chapa is a pnpm monorepo with two TypeScript workspaces: `apps/web` (Next.js 16.2.4 App Router + React 19.2.5) and `packages/shared` (pure types + scoring helpers). Vercel handles hosting with three cron jobs declared in `vercel.json`.

**Major modules:**
- `lib/impact/` — pure V6 scoring pipeline; dimension → archetype → composite → confidence → tier
- `lib/github/`, `lib/bitbucket/`, `lib/codeberg/` — parallel platform fetch stacks with cache-first + stale fallback + in-flight deduplication
- `lib/cache/` — Upstash Redis wrappers (fail-open rate limiter, HyperLogLog, snapshot/craft caches)
- `lib/db/` — Supabase service-role singleton with 10 table-access modules; all fail-open on error
- `lib/auth/` — GitHub OAuth + AES-256-GCM sessions; shared `platform-oauth.ts` for Bitbucket/Codeberg
- `lib/profile/` — orchestrates stats → craft → snapshot → scoring → side-effect fan-out
- `lib/render/` — React-to-SVG pipeline (BadgeSvg, heatmap, radar, verification strip)
- `lib/effects/` — Studio visual effects (Aurora, Particles, Gradient, Holographic)

**Data flow (hot path `/u/:handle/badge.svg`):**
`NextRequest → rateLimit(Redis) → optional session → materializePublicProfile → getAvatarBase64 → verificationCode → renderBadgeSvg → after(4 side effects) → NextResponse (s-maxage=21600)`

**Architecture concerns:** The `lib/` tree is approaching 48k LOC across 26 directories; Bitbucket/Codeberg platform stacks are deeply duplicated; `packages/shared` ships raw TypeScript with no build step; no React Context exists (three diverging module-level store patterns instead).

---

## 3. End-to-End Flow Analysis

**Badge embed flow:** User adds `![badge](chapa.thecreativetoken.com/u/handle/badge.svg)` to README → GitHub camo proxy fetches badge → Vercel edge serves from CDN (6h s-maxage) → on CDN miss, origin fetches stats from Redis → renders SVG → fires 4 Supabase/Redis writes in `after()`. **Risk:** camo proxy pools IPs so all camo requests share one rate-limit bucket (BE-H6); every cache miss fires redundant DB writes (PE-H2); the SVG itself is not cached so every miss re-renders (PE-H1).

**OAuth login flow:** Landing → `/api/auth/login` (CSRF state via 16-byte random cookie) → GitHub → `/api/auth/callback` (state validate → token exchange → user fetch → `dbUpsertUser` + `addContact` fire-and-forget with swallowed errors) → session AES-256-GCM cookie set. **Risk:** `dbUpsertUser` failure is silent — user appears logged in but is never registered (BE-H11).

**Unsubscribe flow:** Resend campaign email → unsubscribe link `/api/notifications/unsubscribe?handle=X` → `dbUpdateEmailNotifications(handle, false)` + Resend unsubscribe. **Risk:** no ownership check; anyone can unsubscribe anyone (BE-B2).

**Cron flows:** Three daily crons (`warm-cache`, `sync-audience`, `process-campaigns`) call `verifyCronSecret()` which passes when `CRON_SECRET` is unset. **Risk:** any anonymous caller can trigger GitHub quota drain + email campaign sends (BE-B1).

---

## 4. Frontend / UI Findings (Staff Frontend Engineer)

### Domain Model

Next.js 16 App Router with three primary surfaces: landing (ISR 3600s), share page (ISR 3600s), and studio (`force-dynamic`). No React Context — state flows via module-level promise caches (`useSession`), pub/sub with `useSyncExternalStore` (keyboard shortcuts), and mutable module objects (platform status). Heavy client component presence: 44 `"use client"` files in `components/`, additional 13 under `experiments/`.

### Findings

#### FE-B1 Client-side `useTrendData` waterfall on every authenticated share-page view
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/hooks/use-trend-data.ts:37, apps/web/components/dashboard/ImpactDashboard.tsx:30, apps/web/components/SharePageOwnerContent.tsx:86
- **What's happening:** The owner share page already has `impact` + `stats` from SSR, but `ImpactDashboard` fires a fresh `GET /api/history/:handle` on mount for trend data. Combined with `useOwnerCacheWarm` (POST `/api/refresh` → `router.refresh()`), every authenticated share-page view triggers 3 serial network calls post-document, causing sparkline/delta pop-in and inflating `/api/history` QPS.
- **Why it matters:** Inflates backend QPS at launch exactly when traffic peaks; degrades owner dashboard perceived performance.
- **Recommendation:** Add a module-level promise cache to `useTrendData` mirroring `useSession`, or pass trend data from SSR through props.
- **Expected impact:** One less network round-trip, eliminates late sparkline pop-in, ~50% reduction in `/api/history` QPS.
- **Effort estimate:** M

#### FE-H2 `"use client"` on purely presentational components creates unnecessary client boundaries
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/InsightCard.tsx:1, apps/web/components/dashboard/StatsGrid.tsx:1, apps/web/components/dashboard/DimensionCardsRow.tsx:1
- **What's happening:** `InsightCard`, `StatsGrid`, and `DimensionCardsRow` are marked `"use client"` but contain no hooks or browser APIs. They're rendered under an already-client parent (`ImpactDashboard`) so behavior is unchanged, but they cannot be reused in server-rendered surfaces.
- **Why it matters:** Forecloses server-rendering reuse; inflates client bundle.
- **Recommendation:** Remove `"use client"` from these three components.
- **Expected impact:** ~10–15 KB client bundle reduction; opens server-rendering reuse.
- **Effort estimate:** S

#### FE-H3 44 `"use client"` files in `components/` — "client by default" anti-pattern
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/ (44 client files), apps/web/app/experiments/ (13 client pages)
- **What's happening:** Large client components (`UserMenu.tsx` 609 LOC, `BadgeOverlay.tsx` 364 LOC, `ActivityHeatmap.tsx` 556 LOC, `AuthorTypewriter.tsx` 215 LOC) are all in the client bundle for every authenticated page.
- **Why it matters:** Contributes to the ~700 KB First Load JS budget breach; delays TTI on the badge/share pages.
- **Recommendation:** Dynamic-import `AuthorTypewriter` and `UserMenu` dropdown body behind `next/dynamic({ ssr: false })`; gate experiment pages with 404 in production.
- **Expected impact:** Measurable first-load reduction on `/` and `/u/:handle`.
- **Effort estimate:** M

#### FE-H4 `useSyncExternalStore` hydration workaround duplicated in two places
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/components/ThemeToggle.tsx:6-12, apps/web/app/studio/StudioClient.tsx:29-49
- **What's happening:** Two separate `useSyncExternalStore` with no-op subscribe + `getServerSnapshot: () => false` patterns for hydration detection exist independently.
- **Recommendation:** Extract into a shared `useIsClient` hook in `lib/hooks/`.
- **Effort estimate:** S

#### FE-H5 JSON-LD `dangerouslySetInnerHTML` escaping is asymmetric between layout and share page
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/layout.tsx:87-118, apps/web/app/u/[handle]/page.tsx:170-175
- **What's happening:** Share page escapes `<` via `\u003c` replacement; layout JSON-LD relies solely on `JSON.stringify` (safe today since it's static, but asymmetric).
- **Recommendation:** Extract a `renderJsonLd(obj)` helper used by both callers with consistent escaping.
- **Expected impact:** Removes future XSS regression vector.
- **Effort estimate:** S

#### FE-H6 Module-level caches not invalidated on logout
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/hooks/useSession.ts:25-43, apps/web/hooks/useOwnerCacheWarm.ts:8-40, apps/web/components/UserMenu.tsx:13-29
- **What's happening:** Three module-level caches (session, owner-cache-warm, platform status) are not cleared by `POST /api/auth/logout`. Sign-out → sign-in as different handle can show previous user's avatar or platform links.
- **Why it matters:** Data leak across sessions in the same tab.
- **Recommendation:** Have the logout client handler call explicit invalidators before redirect.
- **Effort estimate:** S

#### FE-M1 `RadarChartInteractive` rAF loop replays animation on every scroll-back
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/RadarChartInteractive.tsx:105-137
- **Recommendation:** Track `hasAnimated` ref and skip re-animation after first view.
- **Effort estimate:** S

#### FE-M5 `ShareBadgePreviewLazy` fixed height skeleton causes CLS
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/ShareBadgePreviewLazy.tsx:8
- **What's happening:** Fixed `h-[400px]` skeleton does not match badge aspect ratio (1200×630 ≈ 471px at max-w-4xl).
- **Recommendation:** Replace with `aspect-[1200/630]` container.
- **Effort estimate:** S

#### FE-S1 Three diverging module-level store patterns with no shared primitive
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/hooks/useSession.ts, apps/web/components/KeyboardShortcutsListener.tsx, apps/web/components/UserMenu.tsx
- **Recommendation:** Write an ADR and a `createModuleStore<T>()` helper; migrate all three post-launch.
- **Effort estimate:** M

---

## 5. Backend / API / Data Findings (Staff Backend Engineer)

### Domain Model

44 API routes across three auth tiers: public read (rate-limited by IP), session-authenticated user, and privileged admin (session+ADMIN_HANDLES or bearer ADMIN_SECRET). Three daily crons bearer-authenticated via `verifyCronSecret()`. Data: Upstash Redis (stats cache, rate limits, HLL), Supabase (users, snapshots, campaigns), GitHub/Bitbucket/Codeberg GraphQL APIs.

### Findings

#### BE-B1 Cron endpoints fail-open when `CRON_SECRET` is not set
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/auth/cron.ts:20-37, apps/web/app/api/cron/warm-cache/route.ts:54-57, apps/web/app/api/cron/process-campaigns/route.ts:8-12, apps/web/app/api/cron/sync-audience/route.ts:81-83
- **What's happening:** `verifyCronSecret()` returns `null` (success) when `process.env.CRON_SECRET` is empty, emitting only `console.warn`. All three cron routes treat this as auth-passed. An anonymous attacker can trigger `warm-cache` (50 GitHub GraphQL calls + Supabase writes), `process-campaigns` (batch email sends), and `sync-audience` (Resend audience mutation) without any credentials.
- **Why it matters:** Drains GitHub API quota (5,000 req/hr shared), triggers unintended email sends, burns Supabase/Resend billing capacity. Inconsistent with `verifyAdminSecret` which fails-secure (503).
- **Recommendation:** Mirror `verifyAdminSecret`: when `CRON_SECRET` is unset in production, return 503. Add unit test.
- **Expected impact:** Cron endpoints require explicit configuration; eliminates anonymous abuse vector.
- **Effort estimate:** S

#### BE-B2 `/api/notifications/unsubscribe` accepts arbitrary handles with no ownership proof
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/notifications/unsubscribe/route.ts:19-53
- **What's happening:** `handle` is read from the query string; `dbUpdateEmailNotifications(handle, false)` is called with no session check, no HMAC token, no ownership verification. Anyone can unsubscribe any user.
- **Why it matters:** A single script iterating public handles can silence the entire notification system. Email prefetchers (Outlook Safe Links) can trigger self-unsubscribes.
- **Recommendation:** Embed HMAC-signed token in the email link (sign `handle` + purpose with `NEXTAUTH_SECRET`); validate with `timingSafeEqual` in the route. Pattern exists at `lib/auth/cli-token.ts:32-42`.
- **Expected impact:** Removes cross-user denial-of-notifications attack.
- **Effort estimate:** S

#### BE-B3 `getClientIp()` trusts client-controlled `x-real-ip` — all IP rate limits are bypassable
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/http/client-ip.ts:5-16, apps/web/app/api/profile/[handle]/route.ts:32-33, apps/web/app/u/[handle]/badge.svg/route.ts:45-55 (14+ other routes)
- **What's happening:** `getClientIp` returns whatever the client puts in `x-real-ip` or the first `x-forwarded-for` hop. Vercel does not strip incoming `x-real-ip`. An attacker can rotate `x-real-ip: <spoofed>` per request, bypassing every IP-bucketed rate limit.
- **Why it matters:** All rate limits are unenforceable; GitHub API quota can be exhausted by a single attacker.
- **Recommendation:** Use `x-vercel-forwarded-for` (set by Vercel's proxy, not forwarded from clients) or validate only the rightmost-trusted hop of `x-forwarded-for`.
- **Expected impact:** Rate limits become enforceable.
- **Effort estimate:** S

#### BE-H4 `/api/admin/campaigns/[id]` PATCH accepts raw client body — mass-assignment
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/admin/campaigns/[id]/route.ts:42-49, apps/web/lib/db/campaigns.ts:196-253
- **What's happening:** Handler forwards entire `request.json()` to `dbUpdateCampaign`. An admin can set `status: "sending"` directly, bypassing `initiateCampaign()`, leaving a campaign in sending state with zero `campaign_sends` rows.
- **Recommendation:** Whitelist allowed fields: `name`, `subject`, `previewText`, `headline`, `bodyText`, `features`, `ctaText`, `ctaUrl` only.
- **Effort estimate:** S

#### BE-H5 Admin search injects unescaped wildcards into Supabase ILIKE
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/db/admin-users.ts:185-188
- **What's happening:** Search escapes `%` but not `_` (SQL wildcard) or PostgREST OR-syntax delimiters (`,`, `.`, `)`). A search term like `,handle.eq.juan)` can inject predicates.
- **Recommendation:** Escape both `%` and `_`; use `.ilike()` builder chained instead of raw `or()` string interpolation.
- **Effort estimate:** S

#### BE-H6 Badge SVG rate limit keyed by IP only — camo proxy IPs are shared across all users
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:45-55, apps/web/app/api/profile/[handle]/route.ts:31-44
- **What's happening:** GitHub's camo proxy serves all embedded badges from a small IP pool. All camo requests share one rate-limit bucket, causing 429s for unrelated users on launch.
- **Recommendation:** Key badge SVG rate limit on `(ip, handle)` together; or rely solely on `s-maxage=21600` CDN caching and remove the IP-based limit on this route.
- **Effort estimate:** S

#### BE-H7 `/api/admin/bulk-recalculate` has no resumability
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/admin/bulk-recalculate/route.ts:31-105
- **What's happening:** Recalculates all users in one 300s window. A 504 mid-run leaves half the users unrecalculated with no cursor to resume; retry double-burns GitHub quota.
- **Recommendation:** Add a cursor (`?after=<handle>`) so each invocation picks up where it left off.
- **Effort estimate:** M

#### BE-H8 Badge route fires 4 Supabase writes on every CDN cache miss
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:90-92, apps/web/lib/profile/public-profile.ts:61-100
- **What's happening:** `runPublicProfileSideEffects` fires `storeVerificationRecord`, `trackBadgeGenerated`, `notifyFirstBadge`, `dbInsertSnapshot`, `dbUpsertUser` on every origin request. `dbInsertSnapshot` uses `ON CONFLICT DO NOTHING` but still consumes a Supabase write unit. Hot handles generate continuous writes during CDN miss windows.
- **Recommendation:** Add Redis SETNX guard keyed `sideeffects:done:<handle>:<YYYY-MM-DD>` (24h TTL); skip heavy writes when flag is set.
- **Effort estimate:** S

#### BE-H9 `/api/admin/bulk-recalculate` rate-limits before auth — anonymous callers can lock out admins
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/admin/bulk-recalculate/route.ts:32-44
- **What's happening:** `rateLimit()` runs before `verifyAdminSecret`. Unauthenticated callers can exhaust the per-IP bucket, blocking the legitimate admin.
- **Recommendation:** Perform auth first, then rate-limit; or key rate limit on the validated token.
- **Effort estimate:** S

#### BE-H10 `/api/admin/agents/run` uses module-level state — broken under multi-instance Vercel
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/admin/agents/run/route.ts:33
- **What's happening:** `let currentRun: RunState | null = null` module variable. Each Vercel lambda instance has its own memory; DELETE landing on a different instance sees `null` and cannot terminate the spawned process.
- **Recommendation:** Hard-restrict the route to `VERCEL_ENV !== "production"` regardless of `ALLOW_AGENT_RUN`.
- **Effort estimate:** S

#### BE-H11 OAuth callback silently swallows `dbUpsertUser` and `addContact` failures
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/auth/callback/route.ts:118-132
- **What's happening:** `void dbUpsertUser(...).catch(() => {})` and `void addContact(...).catch(() => {})` — errors are silently discarded. On Supabase blip during login, user appears logged in but is never registered.
- **Recommendation:** Replace empty catch with `captureServerError(...)` calls; optionally await `dbUpsertUser`.
- **Effort estimate:** S

#### BE-H12 GitHub GraphQL partial errors used as valid data — poisons cache
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/queries.ts:67-126
- **What's happening:** `if (json.errors) console.error(...)` then proceeds to use `json.data?.user`. A rate-limited sub-query (e.g., `repositories.nodes` returning null) produces zero stars/forks/watchers, causing score drops cached for 6h.
- **Recommendation:** When `json.errors` contains `RATE_LIMITED` or `FORBIDDEN`, treat entire fetch as failed; serve stale cache instead.
- **Effort estimate:** S

#### BE-M13 Insights validation error leaks full schema to callers
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/insights/route.ts:37-43
- **Recommendation:** Log detailed reason server-side; return generic `{ error: "Invalid insights data" }` to clients.
- **Effort estimate:** S

#### BE-M14 `_inflight` map can grow unbounded on hung promises
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/client.ts:24-72
- **Recommendation:** Wrap inflight promise with `withTimeout(30_000)` (already exists at `lib/async/with-timeout.ts`).
- **Effort estimate:** S

#### BE-M15 `processInBatches` errors don't surface which handles failed
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/async/process-in-batches.ts:6-18, apps/web/app/api/cron/warm-cache/route.ts:117-140
- **Recommendation:** Return `{ handle, reason }` on failure; aggregate into `failures[]` array in cron response.
- **Effort estimate:** S

#### BE-M16 Telemetry endpoint always returns `{ ok: true }` even on DB failure
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/telemetry/route.ts:50-55
- **Recommendation:** Either genuinely fire-and-forget (don't await), or return `{ ok: false }` on insert failure.
- **Effort estimate:** S

#### BE-M17 Campaign cache not invalidated on PATCH edit
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/db/campaigns.ts:255-296
- **Recommendation:** Call `cacheDel("campaign:active-engagement")` in the PATCH route after successful update.
- **Effort estimate:** S

#### BE-M18 Rotation offset written before work completes
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:98-103
- **Recommendation:** Move `cacheSet(ROTATION_KEY, nextOffset)` after `processInBatches`.
- **Effort estimate:** S

#### BE-M19 Redirect cookie not restricted to allow-list of paths
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/api/auth/callback/route.ts:48-61
- **Recommendation:** Restrict `chapa_redirect` to explicit allow-list: `/u/`, `/studio`, `/about`, `/`.
- **Effort estimate:** S

#### BE-L20 `safeEqual` needs length pre-check to avoid 500 on unequal-length tokens
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/lib/auth/admin.ts:46, apps/web/lib/auth/cron.ts:32
- **Recommendation:** Add length pre-check in `lib/crypto/safe-equal.ts`.
- **Effort estimate:** S

---

## 6. Performance and Scalability Findings (Performance Engineer)

### Domain Model

Hot path: `GET /u/:handle/badge.svg` with CDN cache (6h s-maxage). Stats cached in Redis (6h primary, 7d stale). SVG re-rendered on every CDN miss. OG image cached via Redis (48h). Share page ISR (3600s). Bundle: ~620 KB shared shell; route pages add 50–120 KB; total first load ~700 KB uncompressed.

### Findings

#### PE-H1 Badge SVG has no full-response cache — re-rendered on every CDN miss
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:38-100
- **What's happening:** Stats, craft, avatar are Redis-cached, but the final rendered SVG string is not. Every CDN miss re-executes `materializePublicProfile` + `renderBadgeSvg` (91 heatmap `<rect>` nodes, radar polygon math, ~100 string interpolations).
- **Why it matters:** Thundering herd on launch: CDN cache fills trigger N identical origin renders. Vercel function duration billed per-ms.
- **Recommendation:** Cache rendered SVG in Redis under `svg:badge:<handle>:<YYYY-MM-DD>` (24h TTL). Invalidate on refresh/new snapshot.
- **Expected impact:** 70–90% reduction in origin CPU per badge request.
- **Effort estimate:** S

#### PE-H2 Four Supabase/Redis writes fire in `after()` on every badge origin request
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:90-92, apps/web/lib/profile/public-profile.ts:61-100
- **What's happening:** `storeVerificationRecord`, `trackBadgeGenerated`, `notifyFirstBadge`, `dbInsertSnapshot`, `dbUpsertUser` fire on every cache-miss origin request. `dbInsertSnapshot` is idempotent but still consumes a Supabase write per call.
- **Why it matters:** Hot handles with many CDN misses generate continuous DB writes; burns Supabase connection pool on no-ops.
- **Recommendation:** Redis SETNX guard `sideeffects:done:<handle>:<date>` (24h TTL) before Supabase writes. (Same fix as BE-H8.)
- **Effort estimate:** S

#### PE-H3 First Load JS ~700 KB uncompressed exceeds 500 KB target on every route
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/.next/diagnostics/route-bundle-stats.json:1-111, apps/web/app/layout.tsx:1-135
- **What's happening:** Shared shell is ~620 KB uncompressed. Heaviest routes: `/u/[handle]` 743 KB, `/studio` 732 KB, `/admin` 697 KB. Root layout force-loads `ThemeProvider`, `PostHogProvider`, `KeyboardShortcutsListener`, `ClientAnalytics` on every route.
- **Why it matters:** CLAUDE.md perf target is 500 KB. Every public route exceeds it.
- **Recommendation:** Dynamic-import `KeyboardShortcutsListener` and `ClientAnalytics`; lazy-load `AuthorTypewriter` and `UserMenu` dropdown body. Run `ANALYZE=true pnpm run build`.
- **Expected impact:** Target 450 KB on `/` and `/u/:handle`.
- **Effort estimate:** M

#### PE-M1 Share page re-renders full badge SVG during SSR, duplicating badge.svg route work
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/page.tsx:103-141
- **Recommendation:** Once PE-H1 SVG cache lands, share page should read cached SVG instead of re-rendering.
- **Effort estimate:** S

#### PE-M2 Bitbucket/Codeberg paths add unconditional DB reads on every cache miss
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/client.ts:124-170, 192-330
- **What's happening:** On stats cache miss, both platform helpers always fire: Redis read → feature-flag check (Supabase) → `dbGetLinkedPlatform` — even for 99% of users who haven't linked either platform.
- **Recommendation:** Short-circuit if no `linkedPlatforms` in stale stats; cache a per-handle `platforms:<handle>` Redis flag.
- **Effort estimate:** M

#### PE-M3 Avatar base64 inlines ~40 KB per SVG response
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/lib/render/avatar.ts:55-74
- **Recommendation:** Swap to `<image href="${avatarUrl}">` for badge SVG; keep base64 only for OG image (resvg needs bytes).
- **Expected impact:** ~30 KB smaller badge SVG.
- **Effort estimate:** S

#### PE-M5 Heatmap SVG emits 91 SMIL `<animate>` elements — invisible in `<img>` embeds
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/render/heatmap.ts:72-81
- **What's happening:** SMIL animation is deprecated on Chromium; SVG embedded via `<img>` in READMEs may leave cells invisible (opacity=0, fill="freeze" may not fire).
- **Recommendation:** Add `disableAnimation` flag; render cells with `opacity="1"` for `<img>` embeds.
- **Effort estimate:** S

---

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

### Domain Model

Vercel hosting, 7 GitHub Actions workflows. `develop` → preview; `main` → production. Three cron jobs. No middleware.ts. Health endpoint checks Redis + Supabase only.

### Findings

#### DO-H1 Server error capture wired into only ~10% of API routes
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/analytics/server-errors.ts:59, apps/web/app/api/profile/[handle]/route.ts:92-98 (and 35+ other unwired routes)
- **What's happening:** `captureServerError()` is only called from 5 of 44 routes. All others only `console.error` on failure.
- **Why it matters:** Silent 500 spikes will be invisible until users complain. No alerting primitive exists.
- **Recommendation:** Add a `withErrorCapture(route, handler)` wrapper and apply to all routes; or use Next.js `instrumentation.ts` `onRequestError` hook.
- **Expected impact:** 100% server-error visibility; enables 5xx spike alerting.
- **Effort estimate:** M

#### DO-H2 No incident-response or rollback runbooks in repo
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/ (no runbooks directory)
- **What's happening:** No rollback procedure, no secret-rotation guide, no Redis/Supabase/GitHub outage playbook, no incident response template.
- **Recommendation:** Add `docs/runbooks/` with Vercel rollback steps, secret rotation procedures, outage playbooks, incident response template.
- **Effort estimate:** M

#### DO-H3 Health endpoint doesn't probe GitHub API dependency
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/health/route.ts:22-32
- **What's happening:** `/api/health` checks Redis + Supabase but not GitHub's GraphQL API — the upstream whose failure most directly causes badge failures.
- **Recommendation:** Add `GET https://api.github.com/rate_limit` probe (keyed on `GITHUB_TOKEN`; "skipped" if absent).
- **Effort estimate:** S

#### DO-H4 Develop is 41 commits and 15 days ahead of main — release batch is too large
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** git log main..develop (41 commits including Next.js 16.2.4 upgrade)
- **What's happening:** Next.js major bump + dep upgrades + profile refactors batched into one release. If something regresses, bisect spans 15 days.
- **Recommendation:** Verify on Vercel preview for 24–48h before merging to main.
- **Effort estimate:** M

#### DO-M1 `WARM_CACHE_PRIORITY_HANDLES` missing from `.env.example`
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:195, .env.example
- **Recommendation:** Add `WARM_CACHE_PRIORITY_HANDLES=` with comment to `.env.example`.
- **Effort estimate:** S

#### DO-M2 No structured logger; no request-ID correlation across routes
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/profile/[handle]/route.ts:93 (and all other routes)
- **Recommendation:** Add a 30-line `lib/log.ts` emitting JSON with `{ts, level, route, requestId, msg}`; thread `x-vercel-id` as `requestId`.
- **Effort estimate:** M

#### DO-M3 No `CODEOWNERS` and no branch protection config in repo
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .github/ (no CODEOWNERS)
- **Recommendation:** Add `.github/CODEOWNERS` (`* @juan294`); document expected branch protection state.
- **Effort estimate:** S

#### DO-M4 No migration runner and no pre-deploy migration check
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** supabase/migrations/ (001-020), no CI migration job
- **Recommendation:** Add `scripts/validate-migrations.ts` in CI; surface schema drift in `/api/health`; document manual apply procedure.
- **Effort estimate:** M

#### DO-M5 Cron metrics not emitted — degradation is silent
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:112-140
- **Recommendation:** Emit `cron_run` PostHog event with counters + duration; add alert on `failed/warmed > 0.3`.
- **Effort estimate:** S

#### DO-M6 `ALLOW_AGENT_RUN` enables `spawn()` in production with no environment guard
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/admin/agents/run/route.ts:45-55
- **What's happening:** No assertion prevents enabling `spawn()` in `VERCEL_ENV=production`. If admin auth is compromised, this is RCE-adjacent.
- **Recommendation:** Hard-assert `VERCEL_ENV !== "production"` regardless of `ALLOW_AGENT_RUN`.
- **Effort estimate:** S

#### DO-L1 No Vercel Log Drain configured
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** vercel.json
- **Recommendation:** Configure Axiom (free tier) Log Drain; document in `docs/runbooks/observability.md`.
- **Effort estimate:** S

#### DO-L2 Lighthouse CI is `continue-on-error: true` and doesn't cover `/u/:handle`
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/lighthouse.yml:26, lighthouserc.json:7-11
- **Recommendation:** Add `/u/juan294` to Lighthouse URLs; flip accessibility to error threshold.
- **Effort estimate:** S

#### DO-L3 E2E tests run against build artifact, not Vercel preview deployment
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/ci.yml:133-190
- **Recommendation:** Add post-deploy smoke test workflow against Vercel preview URL.
- **Effort estimate:** M

#### DO-S1 No ADR for the production stack selection
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** docs/decisions/ (one ADR only)
- **Recommendation:** Add `docs/decisions/2026-04-XX-deployment-stack.md`.
- **Effort estimate:** S

---

## 8. Security / Privacy Findings (Security Reviewer)

### Domain Model

Strong auth fundamentals: AES-256-GCM sessions, HMAC-SHA256 CLI tokens, timing-safe compares, `escapeXml()` on all SVG user-controlled text, host-allowlisted avatars, strict CSP per route. `pnpm audit: 0 vulnerabilities`.

### Findings

#### SE-M1 Cron endpoints fail-open when `CRON_SECRET` is unset (see BE-B1)
- **Severity:** medium (elevated to launch-blocker by BE specialist — see BE-B1)
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/auth/cron.ts:20-37
- See BE-B1 for full details and fix.

#### SE-M2 Telemetry endpoint rate-limited only by attacker-controlled `targetHandle`
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/telemetry/route.ts:42-48
- **What's happening:** Rate limit key is `ratelimit:telemetry:${payload.targetHandle}` — a value from the request body. An attacker rotating `targetHandle` per request bypasses the limit entirely and inserts unlimited Supabase rows.
- **Recommendation:** Add IP-based floor rate limit (`ratelimit:telemetry-ip:${ip}`, 60/min); validate `targetHandle` with `isValidHandle()` before using as Redis key.
- **Effort estimate:** S

#### SE-L1 Admin campaign `ctaUrl` lacks URL-scheme validation
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/admin/campaigns/route.ts:31-58, apps/web/lib/email/templates/announcement.ts:58
- **Recommendation:** Parse with `new URL()` and require `protocol === "https:" || "http:"`.
- **Effort estimate:** S

#### SE-L2 Unsubscribe URL interpolates handle without `encodeURIComponent`
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/email/templates/announcement.ts:60-62
- **Recommendation:** Wrap `data.handle` in `encodeURIComponent()`.
- **Effort estimate:** S

#### SE-L3 Bulk recalculate doesn't validate handle shape before fan-out
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/admin/bulk-recalculate/route.ts:47-60
- **Recommendation:** Filter with `isValidHandle(h)` in addition to type check.
- **Effort estimate:** S

#### SE-L4 CSP `'unsafe-inline'` on `script-src` — post-launch hardening target
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/next.config.ts:18-28
- **Recommendation:** Post-launch, implement per-request nonce via middleware.
- **Effort estimate:** M

---

## 9. Code Quality / Maintainability Findings (Principal Architect)

### Domain Model

pnpm monorepo, two TypeScript workspaces. Zero circular deps, zero knip dead code, zero typecheck/lint errors, 6,901 tests passing. `packages/shared` ships raw TypeScript (no build step). `lib/` is 48k LOC across 26 directories.

### Findings

#### AR-H1 `typescript-eslint` 8.55 declares `typescript <6` peer; project uses 6.0.2
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** pnpm-lock.yaml:1244-1274, apps/web/package.json:42, packages/shared/package.json:13
- **What's happening:** All `@typescript-eslint/*` packages at 8.55.0 declare `peerDependencies.typescript: '>=4.8.4 <6.0.0'`. ESLint is currently green by coincidence — not by supported contract.
- **Recommendation:** Upgrade `typescript-eslint` / `eslint-config-next` to a version supporting TS 6, or temporarily pin TS to `^5.x`.
- **Effort estimate:** S

#### AR-H2 Bitbucket and Codeberg platform fetch stacks are ~70% duplicated code
- **Severity:** high
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/client.ts:192-331, apps/web/lib/bitbucket/stats-aggregation.ts, apps/web/lib/codeberg/stats-aggregation.ts
- **What's happening:** `_fetchBitbucketIfLinked` and `_fetchCodebergIfLinked` are ~60 lines each differing only in platform-specific constants. Both `stats-aggregation.ts` files are 95% identical. Root cause of prior platform scoring divergence bugs.
- **Recommendation:** Introduce `PlatformFetcher` interface; unify both into `_fetchLinkedPlatform(fetcher, handle)`. Mirrors `platform-oauth.ts` pattern.
- **Effort estimate:** L

#### AR-M1 React hook files split across two directories with different naming conventions
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/hooks/ (4 files, camelCase), apps/web/lib/hooks/ (1 file, kebab-case)
- **Recommendation:** Consolidate to `apps/web/hooks/`; update import sites.
- **Effort estimate:** S

#### AR-M4 Four `tsconfig.json` files with no shared base; `apps/web` targets ES2017
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** tsconfig.json, apps/web/tsconfig.json:3, packages/shared/tsconfig.json, tsconfig.madge.json
- **Recommendation:** Add `tsconfig.base.json` at root; all others `extends` it. Bump `apps/web` to ES2022.
- **Effort estimate:** S

#### AR-M5 `StatsData` defaults scattered across 3 platform aggregators + scoring code
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** packages/shared/src/types.ts:10-41, apps/web/lib/bitbucket/stats-aggregation.ts:73-94, apps/web/lib/codeberg/stats-aggregation.ts:84-105
- **What's happening:** Three aggregators construct `StatsData` independently; defaults (e.g. `batchSizeScore ?? 0.3`) are spread across scoring files. Root cause of the v2.7.x craft bugs documented in user memory.
- **Recommendation:** Add `normalizeStats(raw: PartialStatsData): StatsData` in `@chapa/shared`; all aggregators run output through it.
- **Effort estimate:** M

#### AR-M6 `packages/shared` ships raw TypeScript with no build step
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** packages/shared/package.json:6-7
- **Recommendation:** Add `tsc -b` build step outputting to `dist/`; update `main`/`types`/`exports`. Or document the posture in `src/index.ts`.
- **Effort estimate:** S

#### AR-L3 20+ env vars read ad-hoc at call sites instead of via typed `lib/env.ts`
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/env.ts:1-13 (only exposes `getBaseUrl()`); 20+ direct `process.env.*` reads elsewhere
- **Recommendation:** Expand `lib/env.ts` into typed getters; each `.trim()`s once. Or adopt `t3-env`.
- **Effort estimate:** M

#### AR-S1 `lib/` approaching 50k LOC — package extraction roadmap needed
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/lib/ (48k LOC, 26 subdirectories)
- **Recommendation:** Post-launch, plan `packages/impact-engine` and `packages/badge-renderer`; document in `docs/decisions/`.
- **Effort estimate:** XL

---

## 10. Testing / QA Findings (QA / Reliability Lead)

### Domain Model

Vitest 4.1.4, v8 coverage, jsdom. 394 test files, 6,901 tests. Coverage: 94.06% lines, 93% statements, 89.47% branches — well above thresholds. 1:1 mapping of test files to API routes. Playwright E2E: 8 specs, not wired into `pnpm test`.

### Findings

#### QA-M1 Server component pages tested via source-string grep, not behavior
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/admin/page.test.ts:1-30, apps/web/app/studio/page.test.ts:1-30, apps/web/app/experiments/hexmap/page.test.tsx:1-10
- **What's happening:** Tests read source file with `fs.readFileSync()` and assert on strings — no import, render, or invocation. Coverage is 0% runtime for these pages' auth/redirect logic.
- **Recommendation:** Replace with real server-component tests: mock `next/headers`, session helpers; `await AdminPage()` and assert redirect targets.
- **Effort estimate:** M

#### QA-M2 E2E suite not included in `pnpm test` — integration-level regressions invisible to CI
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/playwright.config.ts:23-29, package.json:7
- **What's happening:** Playwright specs (badge-endpoint, share-page, integration smokes) only run via `pnpm test:e2e`. CI can be green while the badge SVG route is broken.
- **Recommendation:** Add a CI job that runs `pnpm test:e2e` against a production build and blocks merges on failure.
- **Effort estimate:** M

#### QA-M3 E2E badge-endpoint assertions accept 5xx — test cannot detect outage
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/e2e/badge-endpoint.spec.ts:9-16, 28-36
- **What's happening:** Positive assertion is inside `if (response.ok())` so a full 500 crash produces a green test.
- **Recommendation:** Assert specific status codes unconditionally; verify Content-Type and SVG payload presence.
- **Effort estimate:** S

#### QA-L1 `app/experiments/hexmap/page.tsx` — 123 lines, 0% coverage, ships in bundle
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/experiments/hexmap/page.tsx, apps/web/app/experiments/hexmap/page.test.tsx
- **Recommendation:** Dynamic-import behind flag OR add render smoke test OR document in `docs/accepted-risks.md`.
- **Effort estimate:** S

#### QA-L3 `app/api/cron/warm-cache/route.ts` — 82% line coverage, failure paths uncovered
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:54-187
- **Recommendation:** Add tests for rotation wrap-around, each cleanup function throwing, `warmHandle` returning null.
- **Effort estimate:** S

#### QA-L5 17 jsdom navigation warnings per test run obscure real warnings
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** Test output (UserMenu.test.tsx, BadgeToolbar.render.test.tsx, et al.)
- **Recommendation:** Mock `window.location.assign`/`href` or filter in `vitest.setup.ts`.
- **Effort estimate:** S

---

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

### Domain Model

Landing (terminal-style ISR), Share page (ISR, inline SVG + owner dashboard), Studio (force-dynamic). Global tokens in `globals.css`. `prefers-reduced-motion` kill-switch applied globally. `InfoTooltip` uses portal + fixed positioning.

### Findings

#### UX-H1 BadgeOverlay tooltip says "Six types" — Artificer is missing
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/BadgeOverlay.tsx:48
- **What's happening:** Tooltip reads "Six types: Builder, Quality Champion, Marathoner, Polymath, Balanced, Emerging." Every other surface (landing, about, scoring docs) correctly lists 7 including Artificer. This is the hero interactive tooltip on the badge.
- **Why it matters:** Factual error on the product's marquee onboarding moment.
- **Recommendation:** Update string to include Artificer; add regression test asserting tooltip matches the archetype list in `archetypeDemoData`.
- **Effort estimate:** S

#### UX-H2 Tooltip z-index inconsistency: `InfoTooltip` uses `z-[9999]` vs. mandatory `z-[99999]`
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/InfoTooltip.tsx:84, apps/web/components/InfoTooltip.render.test.tsx:76, apps/web/components/dashboard/ActivityHeatmap.tsx:408
- **What's happening:** Project rule mandates `z-index: 99999` for all portaled tooltips. `ActivityHeatmap.ChartTooltip` follows this; `InfoTooltip` uses `z-[9999]`. When both open simultaneously, `InfoTooltip` is hidden behind `ChartTooltip`. Test at line 76 encodes the wrong constant.
- **Recommendation:** Standardize `InfoTooltip` to `z-[99999]`; update test assertion.
- **Effort estimate:** S

#### UX-H3 Avatar in `BadgeContent` missing `.img-outline` — design system violation
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/badge/BadgeContent.tsx:121-127
- **What's happening:** Avatar uses `ring-2 ring-amber/30` but not `.img-outline`. Design system mandates `.img-outline` on all avatars. `UserMenu.tsx:252` and `AdminUserTable.tsx:39` apply it correctly.
- **Recommendation:** Add `img-outline` to avatar className in `BadgeContent`.
- **Effort estimate:** S

#### UX-H4 Activity heatmap day dots have no keyboard accessibility
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/ActivityHeatmap.tsx:524-546
- **What's happening:** Day dots have `onMouseEnter`/`onMouseLeave` but no `tabIndex`, `role="button"`, `onFocus`/`onBlur`. CLAUDE.md acceptance criteria state: "Badge and breakdown elements have explanatory tooltips (hover/tap/keyboard accessible)." Violates acceptance criteria directly.
- **Recommendation:** Add `tabIndex={0} role="button" aria-label={date + contribution summary}`; add `onFocus`/`onBlur` calling the same tooltip setters.
- **Effort estimate:** M

#### UX-M1 `ErrorBanner` uses amber accent color instead of `text-terminal-red`
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/ErrorBanner.tsx:23-39
- **Recommendation:** Restyle in terminal-red tokens (`border-terminal-red/30`, `bg-terminal-red/10`, `text-terminal-red`).
- **Effort estimate:** S

#### UX-M3 Verification flow color semantics inconsistent end-to-end
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/verify/page.tsx:27, apps/web/app/page.tsx:181
- **Recommendation:** Audit all verification surfaces; document "every verification UI element uses complement tokens" in `docs/design-system.md`.
- **Effort estimate:** S

#### UX-M4 Landing section headings are `sr-only` — no visual section hierarchy
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/page.tsx:250, 271, 330, 411, 435
- **Recommendation:** Add a small visible section label per section (tiny uppercase above each command row).
- **Effort estimate:** S

#### UX-M5 `BadgeToolbar` buttons missing `focus-visible:` hover-state styles
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/components/BadgeToolbar.tsx:140-141
- **Recommendation:** Add `focus-visible:text-text-primary focus-visible:bg-amber/[0.06]` to `btnClass`.
- **Effort estimate:** S

#### UX-M7 Owner empty state has no retry action
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/SharePageOwnerContent.tsx:90-97
- **What's happening:** "Could not load impact data. Try again later." — no retry button, no contact link.
- **Recommendation:** Add "Regenerate" button (POST `/api/refresh`) and support email link.
- **Effort estimate:** S

#### UX-M6 BadgeOverlay annotation panels hidden on mobile
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/BadgeOverlay.tsx:299, 358
- **Recommendation:** Make InfoTooltip pills always visible on mobile; or auto-cycle a hint on first view.
- **Effort estimate:** M

#### UX-L3 `window.location.reload()` in `BadgeToolbar` refresh breaks SPA navigation
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/BadgeToolbar.tsx:39
- **Recommendation:** Replace with `router.refresh()` from `next/navigation`.
- **Effort estimate:** S

#### UX-S1 Terminal metaphor is load-bearing; no escape hatch for non-dev visitors
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/app/page.tsx (whole), apps/web/app/u/[handle]/page.tsx
- **Recommendation:** Audit whether `GlobalCommandBar` belongs on visitor-view share page; consider a simpler share page for non-authed visitors.
- **Effort estimate:** L

---

## 12. Prioritized Action Plan

| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|---|---|---|---|---|---|---|
| BE-B1 | BE | Cron endpoints fail-open | launch-blocker | Before launch | S | Critical |
| BE-B2 | BE | Unsubscribe no ownership proof | launch-blocker | Before launch | S | Critical |
| BE-B3 | BE | IP rate limit bypass | launch-blocker | Before launch | S | Critical |
| PE-H1 | PE | No badge SVG cache | high | Before launch | S | High |
| PE-H2 | PE | 4 DB writes every badge cache miss | high | Before launch | S | High |
| BE-H11 | BE | OAuth callback swallows failures | high | Before launch | S | High |
| BE-H12 | BE | GraphQL partial errors poison cache | high | Before launch | S | High |
| DO-H3 | DO | Health missing GitHub probe | high | Before launch | S | High |
| DO-M6 | DO | ALLOW_AGENT_RUN no production guard | medium | Before launch | S | High |
| UX-H1 | UX | "Six types" in tooltip | high | Before launch | S | High |
| UX-H2 | UX | Tooltip z-index 9999 vs 99999 | high | Before launch | S | High |
| UX-H3 | UX | Missing img-outline on BadgeContent | high | Before launch | S | High |
| AR-H1 | AR | typescript-eslint peer constraint drift | high | Before launch | S | High |
| SE-M2 | SE | Telemetry rate limit bypassable | medium | Before launch | S | Medium |
| SE-L1 | SE | Campaign ctaUrl scheme validation | low | Before launch | S | Medium |
| DO-M1 | DO | WARM_CACHE_PRIORITY_HANDLES missing from .env.example | medium | Before launch | S | Medium |
| DO-M5 | DO | Cron metrics not emitted | medium | Before launch | S | Medium |
| BE-H4 | BE | Campaign PATCH mass-assignment | high | Before launch | S | Medium |
| BE-H5 | BE | Admin search ILIKE injection | high | Before launch | S | Medium |
| BE-H6 | BE | Badge rate limit camo IP bucket | high | Before launch | S | High |
| BE-H8 | BE | Snapshot writes on every cache miss | high | Before launch | S | High |
| BE-H9 | BE | Bulk recalculate auth/rate-limit ordering | high | Before launch | S | Medium |
| BE-H10 | BE | Agent run in-memory state | high | Before launch | S | Medium |
| BE-M14 | BE | Inflight map unbounded | medium | Before launch | S | Medium |
| BE-M17 | BE | Campaign cache not invalidated on edit | medium | Before launch | S | Medium |
| BE-M19 | BE | Redirect cookie unrestricted | medium | Before launch | S | Low |
| BE-M13 | BE | Insights validation leaks schema | medium | Before launch | S | Low |
| BE-M15 | BE | processInBatches hides errors | medium | Before launch | S | Low |
| BE-M16 | BE | Telemetry always returns ok | medium | Before launch | S | Low |
| BE-L20 | BE | safeEqual length pre-check | low | Before launch | S | Low |
| UX-M1 | UX | ErrorBanner wrong color | medium | Before launch | S | Low |
| UX-M3 | UX | Verify flow color inconsistency | medium | Before launch | S | Low |
| UX-M4 | UX | Landing section headings sr-only | medium | Before launch | S | Low |
| UX-M5 | UX | BadgeToolbar missing focus-visible | medium | Before launch | S | Low |
| UX-M7 | UX | Empty state no retry action | medium | Before launch | S | Medium |
| FE-H2 | FE | use client on presentational components | medium | Before launch | S | Low |
| FE-H4 | FE | useSyncExternalStore pattern duplicated | medium | Before launch | S | Low |
| FE-H5 | FE | JSON-LD escaping asymmetry | low | Before launch | S | Low |
| FE-M1 | FE | RadarChart rAF replays on scroll | low | Before launch | S | Low |
| FE-M5 | FE | ShareBadgePreviewLazy CLS | low | Before launch | S | Low |
| FE-H6 | FE | Module caches not invalidated on logout | medium | Before launch | S | High |
| UX-H4 | UX | Heatmap dots not keyboard accessible | high | Before launch | M | High |
| FE-B1 | FE | useTrendData waterfall | high | Before launch | M | Medium |
| FE-H3 | FE | 44 use client components | medium | Before launch | M | Medium |
| PE-H3 | PE | Bundle 700KB > 500KB | high | Before launch | M | Medium |
| QA-M3 | QA | E2E badge assertions too permissive | medium | Before launch | M | Medium |
| DO-H1 | DO | Server error capture 10% of routes | high | Before launch | M | High |
| DO-H2 | DO | No runbooks | high | Before launch | M | High |
| DO-H4 | DO | 41 commits, no staged release | high | Before launch | M | High |
| DO-M2 | DO | No structured logger | medium | Before launch | M | Medium |
| DO-M3 | DO | No CODEOWNERS | medium | Before launch | M | Medium |
| DO-M4 | DO | No migration runner | medium | Before launch | M | Medium |
| BE-H7 | BE | Bulk recalculate not resumable | high | Before launch | M | Medium |
| QA-M2 | QA | E2E not in pnpm test | medium | Before launch | M | High |
| PE-M1 | PE | Share page re-renders SVG | medium | Before launch | M | Medium |
| AR-M5 | AR | StatsData defaults scattered | medium | After launch | M | High |
| AR-H2 | AR | Platform stacks duplicated | high | After launch | L | High |
| BE-M18 | BE | Rotation offset before work | medium | After launch | S | Medium |
| QA-M1 | QA | Source-grep tests | medium | After launch | M | Medium |
| SE-L2 | SE | Unsubscribe URL encoding | low | After launch | S | Low |
| SE-L3 | SE | Bulk recalculate handle validation | low | After launch | S | Low |
| DO-L1 | DO | No Vercel Log Drain | low | After launch | S | Medium |
| DO-L2 | DO | Lighthouse CI gaps | low | After launch | S | Low |
| DO-L3 | DO | E2E not against preview deployment | low | After launch | M | Medium |
| PE-M2 | PE | Bitbucket/Codeberg unconditional DB reads | medium | After launch | M | Medium |
| PE-M3 | PE | Avatar base64 inline | medium | After launch | S | Medium |
| PE-M5 | PE | SMIL animation invisible in img embeds | medium | After launch | S | High |
| UX-M6 | UX | BadgeOverlay invisible on mobile | medium | After launch | M | High |
| AR-M1 | AR | Two hook directories | medium | After launch | S | Low |
| AR-M4 | AR | Four tsconfig files | medium | After launch | S | Low |
| AR-M6 | AR | packages/shared no build step | medium | After launch | S | Low |
| QA-L1 | QA | hexmap 0% coverage | low | After launch | S | Low |
| QA-L3 | QA | warm-cache cron coverage gaps | low | After launch | S | Low |
| QA-L5 | QA | jsdom navigation warnings | low | After launch | S | Low |
| SE-L4 | SE | CSP unsafe-inline | low | Later | M | Low |
| PE-S1 | PE | Badge SVG string monolithic | strategic | Later | L | Medium |
| UX-S1 | UX | Terminal metaphor no escape hatch | strategic | Later | L | Medium |
| FE-S1 | FE | Three module-level store patterns | strategic | Later | M | Low |
| AR-S1 | AR | lib/ needs package extraction roadmap | strategic | Later | XL | High |
| DO-S1 | DO | No ADR for deploy stack | strategic | Later | S | Low |
| UX-L3 | UX | window.location.reload in BadgeToolbar | low | Later | S | Low |

---

## 13. Top 10 Highest-ROI Improvements

1. **BE-B1** — Cron fail-open: S effort, eliminates anonymous quota drain + email campaign abuse
2. **BE-B2** — Unauthenticated unsubscribe: S effort, prevents cross-user notification attack and prefetch-induced self-unsubscribes
3. **BE-B3** — IP rate limit bypass: S effort, makes all rate limiting enforceable with one `getClientIp()` fix
4. **PE-H1** — Badge SVG cache: S effort, 70–90% reduction in origin CPU; biggest single perf win available
5. **PE-H2 / BE-H8** — Sideeffect guard (same Redis SETNX fix): S effort, ~95% reduction in Supabase writes from badge/share paths
6. **BE-H12** — GraphQL partial errors: S effort, prevents score-correctness regressions cached 6h
7. **BE-H11** — OAuth callback error swallowing: S effort, prevents silent user registration data loss at login
8. **DO-H1** — Server error capture: M effort, converts 90% of production 500s from invisible to alertable
9. **UX-H1** — "Six types" tooltip: S effort, removes a public factual error on the hero element
10. **FE-H6** — Module cache logout invalidation: S effort, prevents previous-user data leaking into new session

---

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)
- BE-B1: Cron endpoints fail-open
- BE-B2: Unsubscribe no ownership proof
- BE-B3: IP rate limit bypass
- BE-H4: Campaign PATCH mass-assignment
- BE-H5: Admin search ILIKE injection
- BE-H6: Badge rate limit camo IP bucket
- BE-H7: Bulk recalculate not resumable
- BE-H8: Badge route Supabase writes every cache miss
- BE-H9: Bulk recalculate auth/rate-limit ordering
- BE-H10: Agent run in-memory state
- BE-H11: OAuth callback swallows failures
- BE-H12: GraphQL partial errors poison cache
- BE-M13: Insights validation leaks schema
- BE-M14: Inflight map unbounded
- BE-M15: processInBatches hides errors
- BE-M16: Telemetry always returns ok
- BE-M17: Campaign cache not invalidated on edit
- BE-M19: Redirect cookie unrestricted
- BE-L20: safeEqual length pre-check
- DO-H1: Server error capture 10%
- DO-H2: No runbooks
- DO-H3: Health missing GitHub probe
- DO-H4: Release batch too large
- DO-M1: WARM_CACHE_PRIORITY_HANDLES missing from .env.example
- DO-M2: No structured logger
- DO-M3: No CODEOWNERS
- DO-M4: No migration runner
- DO-M5: Cron metrics not emitted
- DO-M6: ALLOW_AGENT_RUN no production guard
- PE-H1: No badge SVG cache
- PE-H2: 4 DB writes every badge cache miss
- PE-H3: Bundle 700KB > 500KB
- PE-M1: Share page re-renders SVG
- QA-M2: E2E not in pnpm test
- QA-M3: E2E badge assertions too permissive
- SE-M1: Cron fail-open (same as BE-B1)
- SE-M2: Telemetry rate limit bypassable
- SE-L1: Campaign ctaUrl scheme validation
- AR-H1: typescript-eslint peer constraint drift
- FE-B1: useTrendData waterfall
- FE-H2: use client on presentational components
- FE-H3: 44 use client components
- FE-H4: useSyncExternalStore pattern duplicated
- FE-H5: JSON-LD escaping asymmetry
- FE-H6: Module caches not invalidated on logout
- FE-M1: RadarChart rAF replays on scroll
- FE-M5: ShareBadgePreviewLazy CLS
- UX-H1: "Six types" tooltip
- UX-H2: Tooltip z-index inconsistency
- UX-H3: Missing img-outline on BadgeContent avatar
- UX-H4: Heatmap dots not keyboard accessible
- UX-M1: ErrorBanner wrong color
- UX-M3: Verify flow color inconsistency
- UX-M4: Landing section headings sr-only
- UX-M5: BadgeToolbar missing focus-visible
- UX-M7: Empty state no retry action

### After launch (Wave 2)
- AR-H2: Platform stacks duplicated
- AR-M1: Two hook directories
- AR-M4: Four tsconfig files
- AR-M5: StatsData defaults scattered
- AR-M6: packages/shared no build step
- AR-L3: 20+ ad-hoc env var reads
- BE-M18: Rotation offset before work
- DO-L1: No Vercel Log Drain
- DO-L2: Lighthouse CI gaps
- DO-L3: E2E not against preview
- FE-M4: KeyboardShortcutsListener store opacity
- FE-M6: Navbar ISR edge case
- FE-M7: Duplicate SVG icons
- PE-M2: Bitbucket/Codeberg unconditional DB reads
- PE-M3: Avatar base64 inline
- PE-M4: materializePublicProfile serial waits
- PE-M5: SMIL animation in img embeds
- PE-L2: dbGetUsers no pagination
- QA-L1: hexmap 0% coverage
- QA-L3: warm-cache cron coverage gaps
- QA-L5: jsdom navigation warnings
- QA-M1: Source-grep tests
- SE-L2: Unsubscribe URL encoding
- SE-L3: Bulk recalculate handle validation
- UX-L3: window.location.reload in BadgeToolbar
- UX-M6: BadgeOverlay invisible on mobile
- UX-M8: Landing CTA no progress UX

### Later / strategic (Wave 3)
- AR-S1: lib/ needs package extraction roadmap
- AR-M4: tsconfig ES2017 target (part of shared-base work)
- DO-S1: No ADR for deploy stack
- FE-S1: Three module-level store patterns
- PE-L1: Supabase client 180KB
- PE-S1: Badge SVG string monolithic
- QA-L2: Coverage report stale
- SE-L4: CSP unsafe-inline
- UX-L1: Archetype link hover inconsistency
- UX-L2: rounded-full on text content
- UX-L4: Enterprise example same color 3 rows
- UX-L5: Copyright year caching
- UX-S1: Terminal metaphor no escape hatch

---

## 15. Open Questions / Assumptions

- **VERCEL_ENV in production:** DO-M6 and BE-B1 reference `VERCEL_ENV === "production"` — confirm this variable is reliably injected by Vercel and cannot be spoofed.
- **GitHub camo proxy IP range:** BE-H6 assumes a small pool of camo IPs causes rate-limit collisions. Verify against the observed rate-limit hit pattern in production.
- **Preview deploys and CRON_SECRET:** Confirm whether Vercel preview deploys inherit `CRON_SECRET` from production or need it set separately.
- **ISR + server session on landing page:** FE-M6 flags potential auth-state bake-in during ISR regeneration. Confirm `getOptionalServerSessionFromHeaders` returns null on the ISR regeneration request.
- **Supabase migrations applied:** Confirm all 20 migrations (001–020) are applied to production before merging to main.
- **Next.js 16.2.4 preview verification:** The 41-commit batch should be verified on a preview deployment for at least 24h before the main PR is created.

---

## 16. Final Verdict

**Verdict: NOT READY**

**What would most worry me about shipping today?** The three backend blockers (BE-B1, BE-B2, BE-B3) are all S-effort but expose critical attack surfaces: an anonymous attacker can drain the GitHub API quota by triggering cron endpoints, silence any user's notifications by hitting the unsubscribe endpoint with their handle, and bypass all rate limiting by rotating a spoofed `x-real-ip` header. On the operational side, the near-total absence of server-side observability (DO-H1) means the first production incident will be diagnosed entirely by users complaining, not by monitoring alerts.

**What gives confidence?** 6,901 tests pass, typecheck and lint are clean, pnpm audit is clean, the scoring pipeline is pure and well-tested, OAuth/session/SVG security is correctly implemented, and the three blockers are all S-effort fixes (≤1 day total). The codebase is production-quality — this is a launch-readiness check, not a rewrite directive.

**Next 5 actions (ordered):**
1. Fix BE-B1 (`verifyCronSecret` fail-secure), BE-B2 (HMAC token on unsubscribe URL), BE-B3 (`x-vercel-forwarded-for` in `getClientIp`) — all S effort, clear the launch-blocker status.
2. Fix PE-H1 (SVG cache) and BE-H8/PE-H2 (sideeffect SETNX guard) — both S effort, prevent launch-day DB thundering herd.
3. Verify the 41-commit batch on a Vercel preview deployment for 24h (DO-H4).
4. Fix remaining S-effort high-severity items (UX-H1, UX-H2, UX-H3, BE-H11, BE-H12, DO-H3, DO-M6, AR-H1, FE-H6, BE-H4, BE-H5, BE-H6, BE-H9, BE-H10) as a single PR.
5. Create the release PR (`develop` → `main`) once blockers + high-severity S-effort items are merged and preview verification passes.
