# Pre-Launch Codebase Audit
> Generated on 2026-08-18 | Branch: `develop` | 8 parallel specialists (Opus 5)
> Focus: comprehensive

## 1. Executive Summary

Chapa is a genuinely well-built codebase for a solo-maintained project — a clean layered architecture with zero circular dependencies across 982 files, a fully green 8,770-test suite at 96.6% statement coverage, zero hardcoded secrets, a sound four-provider OAuth implementation, and a scoring-integrity contract (#1004/#1060/#1061) that the Backend and Performance specialists independently verified holds exactly as documented. The gaps this audit found are not signs of a rushed or careless codebase — they are the specific, non-obvious failure modes that only show up when eight domain experts each spend hours reading the code adversarially. Several are the same *shape* of bug that has already bitten this project before (`vercel.json` in the wrong directory for five months, `pnpm audit` silently scanning zero packages): configuration or a code path that fails silently, with a green check mark on top.

**Top 3 strengths:**
- **Scoring-data integrity contract holds exactly as documented.** Both the Backend and Performance specialists independently traced `_fetchAndCache`/`_loadOverlays`/`assessRawFetchIntegrity` and confirmed the three-boundary contract (fetch/cache/persist) from CLAUDE.md is real, not aspirational — GitHub-derived guards never see composed overlay data, and the scope-rank cache-downgrade protection is correctly implemented.
- **Test suite is large, fast, and genuinely well-targeted.** 8,770 tests, 100% pass rate, 96.6%/92.5%/95.8%/97.9% coverage, with the two highest-blast-radius modules (`lib/impact/**`, `stats-integrity.ts`) exceeding their strict per-path floors. Degradation branches (Redis down, GitHub rate-limited, Supabase unavailable) are concretely exercised, not assumed.
- **Security posture is sound at the boundaries that matter.** All four OAuth providers share one hardened, audited factory with correct nonce/state handling; every user-controlled field reaching SVG is escaped; all 11 Supabase tables have RLS forced; platform tokens are encrypted at rest; vulnerability and license scans are clean.

**Top 5 risks (by blast radius):**
1. **Silent alerting failure with no gate.** `CHAPA_ALERT_WEBHOOK_URL` unset disables 100% of operational alerting with no log, no health-check failure, and no external monitor to catch it independently (DO-H1, DO-H2) — the exact "config nobody reads" shape that caused the #1052 cron incident, applied to the system that would have caught #1052-shaped incidents.
2. **Persist-boundary integrity gate covers 1 of 4 snapshot writers.** The hourly warm-cache cron, `/api/refresh`, `/api/recalculate`, and bulk-recalculate all bypass the `statsComplete` check that the badge path enforces — this is the precise mechanism that already poisoned production snapshot rows once (BE-H1).
3. **Badge cache-miss path has no end-to-end deadline.** Component timeouts sum to ~34 seconds against a documented 3000ms SLO; the only real ceiling is the platform's 35s function limit (PE-H1). Compounded by a second finding that the two most expensive network legs run serially instead of concurrently (PE-H2).
4. **CLI device-code binding is silently destroyed at approval**, the exact moment it's supposed to protect a 90-day token — independently found and identically diagnosed by both the Backend and Security specialists (BE-H3/SE-H1), which is itself a strong confidence signal.
5. **Systemic silent-failure UX on the acquisition funnel.** OAuth account-linking failures redirect to a page that renders no error (UX-H1); the badge-generation loading screen has no timeout and can hang indefinitely with zero error state reachable (UX-H2); ~15 strings bypass the Spanish-default i18n system on the most-visible surfaces (UX-H3).

**Verdict: CONDITIONAL** — No launch-blocking finding was raised by any specialist. However, 17 `high`-severity findings across all eight domains are marked `Before launch`, several sharing the identical "silent failure behind a green check" root cause this project has already been burned by twice. None require large rewrites — the large majority are S/M effort — but they should be closed before public launch rather than accepted as post-launch risk.

---

## 2. System Architecture Overview

Chapa is a pnpm workspace with three TypeScript projects: `apps/web` (Next.js 16 App Router, ~980 tracked files), `packages/shared` (a zero-dependency domain package holding `StatsData`/`ImpactV6Result`/`BadgeConfig` and pure scoring primitives), and an unnamed repo-root project holding CI-gate and release tooling under `scripts/`. Dependencies flow strictly downward inside `apps/web` (`app/` → `components/` → `lib/<subsystem>` → `@chapa/shared`) with zero violating edges and zero circular dependencies across 982 non-test modules. Three non-GitHub platform integrations (Bitbucket, Codeberg, GitLab) share an identical, genuinely well-factored 5-file shape.

**Major modules and responsibilities:**
- **Scoring pipeline** (`lib/impact/*` → `lib/github/stats-integrity.ts` → `lib/github/merge.ts` → `lib/profile/*` → `lib/render/*` → badge route): the three-boundary integrity contract (fetch/cache/persist) verified sound end-to-end.
- **Frontend** (`apps/web/app/**`): three rendering regimes — locale-segmented static content (9 pages, `app/[locale]/*`), per-request dynamic pages (`/u/[handle]`, `/studio`, `/admin`), and client-only interactive surfaces (Studio terminal, `/experiments/*`).
- **Persistence** (`lib/db/*`, `lib/profile/snapshot-write.ts`): a tri-state saga (`reconcileSnapshotWrite`) over Supabase + Redis mirror, sound in its own logic but inconsistently *called* across writers (BE-H1).
- **Deployment/observability**: single Vercel project, four crons, `/api/health` matching every claim CLAUDE.md makes for it, an unusually complete runbook set for a solo project — undermined by the alerting-silently-off gap (DO-H1/H2).
- **Repo-root `scripts/`**: 48 TypeScript files including all five release CI gates and two production-mutation tools (`delete-user.ts`, `heal-poisoned-stats.ts`) — invisible to typecheck, lint, and coverage (AR-H1), the one structural blind spot in an otherwise clean dependency graph.

**How the pieces connect:** `getStats()` is the single funnel for scoring data, deduping in-flight fetches and running the three integrity boundaries before any value reaches cache or the scoring pipeline. `materializeProfile` produces a `MaterializedProfile` consumed by two writer families (badge-path gated, cron/refresh/recalculate ungated) that both bottom out in `reconcileSnapshotWrite`. Redis is best-effort everywhere except `rateLimitStrict`; Supabase is the durable store with every accessor failing open to a default.

**Architecture concerns (cross-specialist, systemic only):**
- **The "config nobody verifies" pattern recurs at least four times independently**: `tsconfig.madge.json`'s deprecated options that will silently stop the circular-dependency gate under TypeScript 7 (AR-M1); `check:vercel-config` pinning a repo constant rather than querying the actual Vercel dashboard state (DO-H3); the alerting webhook (DO-H2); and the persist-boundary gate applied to one writer instead of four (BE-H1). Each independently discovered, each the same underlying failure mode the project has already been burned by via #1052 and #1008.
- **Repo-root `scripts/` sits entirely outside every quality gate** (AR-H1) while containing the highest-consequence code in the repository by blast radius per line — the tools that decide release safety and the tools that delete production data.
- **Locale resolution is implemented five times across three runtimes** (FE-S1) with coordination carried by a DOM side-channel — not a defect today, but a fragility class that has already produced four numbered regressions (#1020, #1023, #1026, plus the language-picker history in project memory).

---

## 3. End-to-End Flow Analysis

**Onboarding flow (OAuth → generate → share):** Login redirects through the hardened OAuth factory (verified sound for all four providers) to `/generating/:handle`, which performs a single unguarded fetch with no timeout and collapses every failure mode (429/401/5xx) into one generic message (UX-H2) — the narrowest point of the funnel has no error-recovery path. A successful generation lands on `/u/:handle`, which pays every ISR trade-off (locale hardcoded to `"es"`, session deferred to a client fetch, no cookie read) while being rendered fully dynamically on every request due to an unconditional `searchParams` await (FE-H2) — the product's highest-traffic route gets neither caching benefit nor dynamic-rendering correctness.

**Badge request flow:** Cache-hit is lean — one bounded Redis read, respond. Cache-miss walks ~15-18 Redis round-trips, 4-6 Supabase queries, 1 GitHub GraphQL call, and up to 3 platform API calls with every *individual* step bounded but no bound on their *sum* (PE-H1) — worst-case ~34s against a declared 3000ms budget. The two most expensive legs (GitHub fetch, platform-overlay fetch) run serially despite having no data dependency on each other (PE-H2). The daily UTC rollover guarantees a cold miss for every handle because the warm-cache cron never renders/writes the SVG it has everything needed to produce (PE-M2).

**Scoring-data integrity flow:** Verified end-to-end as sound — the fetch/cache/persist three-boundary contract holds exactly as CLAUDE.md documents, independently confirmed by both Backend and Performance. The one gap is downstream of the contract itself: the *persist* boundary's completeness gate is enforced on the badge-path writer only, not the three other writers that feed permanent snapshot history (BE-H1), which is how the juan294 poisoned-snapshot incident (#1003, closed only for one path) could recur through the other three.

**Integration and boundary risks:** The share page — the artifact the entire product exists to produce — carries the largest cluster of unresolved boundary issues: it leaks owner-only confidence data into the public RSC payload (FE-M1), is the one significant page still locale-flashing after the #1023 migration (UX-M3), disables all page keyboard shortcuts until the command bar is manually summoned (FE-M2), and awaits a durable Supabase write inside its render path that #1013 already moved out of the badge route but never backported here (PE-M6).

---

## 4. Frontend / UI Findings (Staff Frontend Engineer)

#### FE-H1 Every page except the share page declares the site root as its canonical URL
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/layout.tsx:76-78`, `apps/web/app/u/[handle]/page.tsx:86-88`, `apps/web/app/sitemap.ts:19-60`
- **What's happening:** The root layout sets `alternates: { canonical: BASE_URL }`. Only `/u/[handle]` overrides it. Build output confirms `.next/server/app/en/about.html`, `.next/server/app/es/privacy.html`, `.next/server/app/en.html`, `.next/server/app/verify.html` all contain `<link rel="canonical" href="http://localhost:3001"/>` — the bare origin, not the page's own URL. In production this becomes the bare domain on `/about`, `/about/scoring`, `/about/verification`, `/privacy`, `/terms`, all 7 `/archetypes/*` pages, `/verify`, `/studio`, `/coming-soon`.
- **Why it matters:** A canonical tag pointing elsewhere instructs search engines to drop the page and consolidate signals into the target. Twelve of these pages are advertised in `sitemap.ts` with explicit priorities — the site simultaneously asks to be indexed and tells crawlers not to. This silently negates the entire content-SEO acquisition surface (archetype guides, scoring methodology).
- **Recommendation:** Remove `alternates.canonical` from the root layout; add a per-page `alternates: { canonical: <page's public URL> }` in each `generateMetadata`, using the **unprefixed** path for locale-segmented pages. Add `alternates.languages` (hreflang es/en) while there.
- **Regression risk:** The canonical for a locale-segmented page must be the canonical *public* path, never the internal `/[locale]/...` path. `metadataBase` must stay set. The share page's existing absolute-URL override must not be changed to relative.
- **Expected impact:** All 12 sitemap-listed pages become independently indexable.
- **Effort estimate:** S

#### FE-H2 The share page pays every ISR trade-off but is rendered dynamically on every request
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/u/[handle]/page.tsx:1,61,94-96,133-135`, `apps/web/components/NavbarClient.tsx:14-27`
- **What's happening:** `page.tsx:1` declares `revalidate = 3600` with explicit ISR commentary, but both `generateMetadata` and the page component unconditionally `await searchParams`, opting the route out of static rendering entirely. Confirmed via build output: `/u/[handle]` has no ISR entry in `.next/prerender-manifest.json`. `revalidate = 3600` is inert. Meanwhile the ISR-motivated design choices remain in force: locale hardcoded to `"es"` unless `?lang=` present, session deferred to a client fetch.
- **Why it matters:** The product's highest-traffic HTML route renders per request with no CDN caching, while a returning English-locale user still gets Spanish server HTML and a post-hydration swap. The team absorbs the cost of both models and the benefit of neither.
- **Recommendation:** Decide the model and make the code say so. Prefer (a) commit to dynamic: delete `revalidate`/ISR comments, read `chapa-locale` via `cookies()` (free now that the route is already dynamic) so the correct locale server-renders.
- **Regression risk:** `?lang=` must keep precedence over the cookie (#1020 contract). `generateMetadata` must resolve the same locale as the body. The `__chapa_smoke` param must not move client-side (would break the smoke-test contract).
- **Expected impact:** Either a genuinely CDN-cached share page, or an honest dynamic one rendering correct language/session on first paint.
- **Effort estimate:** M

#### FE-M1 Owner-only confidence data is serialized into the RSC payload for every visitor
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/u/[handle]/page.tsx:299-306`, `apps/web/components/SharePageOwnerContent.tsx:105-109,151-160`, `apps/web/components/dashboard/ScoreExplanationPanel.tsx:218-258`, `packages/shared/src/types.ts:95-96`
- **What's happening:** The full `ImpactV6Result` (including `confidence`/`confidencePenalties`) crosses the client boundary into `SharePageOwnerContentLazy`; ownership is checked client-side and gates the *display* only. The values are already in any visitor's view-source. `/api/profile/[handle]` and JSON-LD correctly omit the field — this is the one leak path.
- **Why it matters:** CLAUDE.md's acceptance criteria state confidence is hidden from visitors. The penalty flags are the most sensitive field in the model. The gate is the structurally weakest possible enforcement point.
- **Recommendation:** Resolve ownership server-side (FE-H2 already establishes the route is dynamic) and pass a redacted projection to visitors.
- **Regression risk:** Redaction must be a projection, not a mutation — `materializePublicProfile`'s result also feeds the snapshot/HMAC record in the same request. `adjustedComposite` must survive redaction.
- **Expected impact:** The documented owner-only guarantee becomes structurally true.
- **Effort estimate:** M

#### FE-M2 All keyboard shortcuts are inert on the share page until the command bar is summoned
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/CommandBarHint.tsx:62-64`, `apps/web/components/GlobalCommandBar.tsx:135`, `apps/web/components/SharePageShortcuts.tsx:22`, `apps/web/components/KeyboardShortcutsListener.tsx:86-98`
- **What's happening:** `KeyboardShortcutsListener` mounts only inside `GlobalCommandBar` (behind a click/`/` gate) or `/studio`. Until summoned on the share page, `useKeyboardShortcutsContext()` returns a no-op store, so the `?` cheat sheet and `copy-embed`/`download-svg`/`refresh-badge` are all inert.
- **Why it matters:** The share page is where these shortcuts are most useful and the only page advertising them via a hint. `?` for the cheat sheet — the discovery affordance for the whole system — does nothing.
- **Recommendation:** Decouple the listener from the command bar; mount it directly from `CommandBarHint` regardless of `summoned`.
- **Regression risk:** The listener must mount exactly once per page — a double mount's cleanup would kill the survivor's registrations.
- **Expected impact:** Cheat sheet and shortcuts work from first paint on the page that advertises them.
- **Effort estimate:** S

#### FE-M3 The mandated tooltip-portal pattern is not universally applied, and the docs claim it is
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/BadgeOverlay.tsx:302-314,248-249`, `apps/web/app/LandingContent.tsx:145`, `apps/web/components/NavbarShell.tsx:57`
- **What's happening:** CLAUDE.md names `BadgeOverlay.tsx` as compliant with the portal pattern; the desktop panel is not — inline `absolute` positioning, no `createPortal`, no `getBoundingClientRect`. Its `z-[99999]` is ineffective because it sits inside a stacking context that can never paint above the fixed navbar.
- **Why it matters:** The mandate exists because this exact bug class recurred (#1021); documentation now asserts compliance for a file that doesn't comply.
- **Recommendation:** Port the desktop panel to the `InfoTooltip` pattern, or document it as an explicit exception with reasoning.
- **Regression risk:** The panel's position is tied to the badge's `viewBox` coordinate space via leader lines; portaling decouples panel and line unless both recompute from the same live rect.
- **Expected impact:** The mandate becomes true everywhere or explicitly scoped.
- **Effort estimate:** M

#### FE-M4 A single failed session fetch is cached as "logged out" for the rest of the page's life
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/hooks/useSession.ts:26-49`, `apps/web/app/api/auth/session/route.ts:11-15`, `apps/web/lib/cache/redis.ts:228-248`
- **What's happening:** `useSession` memoizes the session fetch permanently with no TTL and no success/failure distinction. `/api/auth/session` is fail-closed (`rateLimitStrict`), and any Redis blip yields a 429 that resolves to a permanently-cached `{user: null}`.
- **Why it matters:** A Redis blip turns "every logged-in user silently becomes a visitor, permanently, until hard-reload" — Refresh, owner panel, and admin nav all vanish with no error surfaced.
- **Recommendation:** Distinguish transport failure from a negative answer; clear the cache on failure so the next mount retries.
- **Regression risk:** Must preserve request dedup (don't let N mounted consumers each retry) and the hydration-safety property that every mount starts from `loading: true`.
- **Expected impact:** Transient failures stop presenting as silent unrecoverable logout.
- **Effort estimate:** S

#### FE-M5 The full i18n dictionary is serialized twice into the share page's RSC payload
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/layout.tsx:115-116,166`, `apps/web/app/u/[handle]/page.tsx:104-107`, `apps/web/app/verify/[hash]/page.tsx:92`
- **What's happening:** The root layout serializes one dictionary; `/u/[handle]` and `/verify/[hash]` nest a second full dictionary because they need a per-request locale the static root can't resolve. Both ship in the same response.
- **Why it matters:** Compounds directly with FE-H2 — re-serialized on every uncached share-page view, the route carrying the badge-latency SLO.
- **Recommendation:** Let `LanguageProvider` reuse an ancestor's dictionary when locales match; lazy-load otherwise.
- **Regression risk:** Must preserve server/client dictionary parity to avoid regressing the #1020 flash fix.
- **Expected impact:** Roughly halves the i18n share of the hottest route's RSC payload.
- **Effort estimate:** M

#### FE-L1 Four call sites reach into the DOM by a hardcoded English aria-label instead of the existing ref API
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/GlobalCommandBar.tsx:119-120`, `apps/web/components/KeyboardShortcutsListener.tsx:176-177`, `apps/web/app/studio/StudioClient.tsx:211-212,231-232`, `apps/web/components/CommandBarHint.tsx:55-57`, `apps/web/components/terminal/TerminalInput.tsx:5-8,124`
- **What's happening:** Five `document.querySelector('input[aria-label="Terminal command input"]')` calls depend on a literal English string that is the one `aria-label` in the codebase not sourced from dictionary keys, despite `TerminalInputHandle` already existing with proper refs.
- **Why it matters:** The moment an a11y pass translates that label (as UX-H3 recommends), all five selectors silently stop matching under the default `es` locale.
- **Recommendation:** Extend `TerminalInputHandle` with `setValue()`; route through refs, not DOM queries.
- **Regression risk:** The native-setter hack exists because a capture-phase `stopPropagation` blocks the normal handler — the fix must preserve `historyIndex`/`onPartialChange` behavior.
- **Expected impact:** Removes a silent-breakage tripwire between the i18n and a11y workstreams.
- **Effort estimate:** S

#### FE-L2 `mountedRef` is never re-set on mount, so a remount permanently disables the badge refresh
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/BadgeToolbar.tsx:38-41,53-68`
- **What's happening:** `mountedRef` is initialized `true` and flipped `false` on cleanup, but never re-set `true` on (re)mount — under StrictMode's mount/cleanup/mount cycle it's `false` from the first render, silently disabling `router.refresh()` after a successful refresh.
- **Why it matters:** Behaves differently in dev vs. prod for its primary action — the classic condition under which a real bug hides.
- **Recommendation:** Set the ref `true` in the effect body, or replace with an `AbortController`.
- **Regression risk:** Must keep timers cleared on unmount, not merely re-arm the flag.
- **Expected impact:** Refresh behaves identically in dev and prod.
- **Effort estimate:** S

#### FE-L3 Small dead-code and cleanup residue in the dashboard and generation flow
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/dashboard/ImpactDashboard.tsx:20,38-44`, `apps/web/components/SharePageOwnerContent.tsx:141`, `apps/web/app/generating/[handle]/GeneratingProgress.tsx:31-48`
- **What's happening:** A `handle` prop is threaded through but dropped in destructuring; three `setTimeout` calls in `completeRemainingSteps` retain no handles so the effect's cleanup can't cancel them.
- **Why it matters:** Neither is user-visible today, but an uncancellable timer chain ending in `router.push` is the shape of a future navigation bug.
- **Recommendation:** Delete the dead prop; collect timer ids and clear them in cleanup.
- **Regression risk:** Confirm `handle` isn't reintroduced elsewhere; timer cleanup must cancel, not collapse, the staggered sequence.
- **Expected impact:** Removes a misleading prop contract and an uncancellable timer chain.
- **Effort estimate:** S

#### FE-L4 `/about/verification` is a live proxied content page but is absent from the sitemap
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/sitemap.ts:20-47`, `apps/web/proxy.ts:70-73`, `apps/web/app/[locale]/about/verification/page.tsx:11-12`
- **What's happening:** Both locale variants are pre-rendered and proxy-matched, but `sitemap.ts`'s `staticPages` array omits the entry.
- **Why it matters:** The badge-verification explainer — the page justifying the product's cryptographic trust claim — is built and unreachable via the sitemap.
- **Recommendation:** Add the entry; derive both the proxy matcher and sitemap list from one shared constant.
- **Regression risk:** The proxy `matcher` must stay a literal array (Next statically analyzes it) — any shared constant must be inlined, not imported.
- **Expected impact:** All 13 public content pages become discoverable.
- **Effort estimate:** S

#### FE-S1 Locale resolution is implemented four times across three runtimes
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `apps/web/proxy.ts:17-30`, `apps/web/lib/i18n/server.ts`, `apps/web/lib/i18n/provider.tsx:130-152`, `apps/web/lib/i18n/locale-sync.tsx:23-41`, `apps/web/app/u/[handle]/page.tsx:96`
- **What's happening:** The `?lang=` → cookie → `Accept-Language` → default priority chain is independently reimplemented in the Edge proxy, server components, the client provider, and `LocaleSync`, coordinated via a DOM side channel and a custom window event.
- **Why it matters:** Fragile in a way git history already shows (#1020, #1023, #1026 all touch this seam); every new locale-aware route must pick which of five variants to use.
- **Recommendation:** Extract the pure decision function `(query, cookie, acceptLanguage) => Locale` into a runtime-agnostic module; reduce all call sites to thin adapters.
- **Regression risk:** The priority order is load-bearing and asymmetric; the proxy's function must stay free of any transitive `next/headers` import.
- **Expected impact:** One readable locale contract.
- **Effort estimate:** L

---

## 5. Backend / API / Data Findings (Staff Backend Engineer)

#### BE-H1 Persist-boundary completeness gate is enforced on only one of four snapshot writers
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/profile/orchestrated-profile.ts:29`, `apps/web/lib/profile/public-profile.ts:104`, `apps/web/app/api/cron/warm-cache/route.ts:330`, `apps/web/app/api/refresh/route.ts:88`, `apps/web/app/api/recalculate/route.ts:67`, `apps/web/app/api/admin/bulk-recalculate/route.ts:150`
- **What's happening:** `persistProfileSnapshot` (badge path) refuses to write when `statsComplete` is false. `persistOrchestratedSnapshot` — used by warm-cache, `/api/refresh`, `/api/recalculate`, `/api/admin/bulk-recalculate` — never reads it.
- **Why it matters:** CLAUDE.md states the persist boundary gates snapshot history on stats completeness. Three of four writers bypass it; this is the exact mechanism that produced three poisoned snapshot rows for juan294 (#1003 closed only the badge path). Warm-cache runs hourly against every handle.
- **Recommendation:** Move the `statsComplete` check into `persistOrchestratedSnapshot` (or `reconcileSnapshotWrite` so every writer inherits it).
- **Regression risk:** `/api/refresh`/`/api/recalculate` return 500 when `persisted` is false — gating there converts a silent bad write into a user-visible 500; return a distinct `stats_incomplete` response instead of a generic 500.
- **Expected impact:** The documented three-boundary contract holds for every writer.
- **Effort estimate:** S

#### BE-H2 Resend webhook marks a delivery de-duplicated before it has been forwarded, permanently dropping the email on any transient failure
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/webhooks/resend/route.ts:113,120,137`
- **What's happening:** `cacheSetNxStatus(dedupeKey, 7 days)` is set *before* `fetchReceivedEmail`/`forwardEmail`. Both return 502 specifically so Resend retries — but the retry hits the dedup key and returns `already_processed`/200. The key is never released on failure.
- **Why it matters:** Every 502 this route deliberately returns for retry is unrecoverable in practice — the first transient blip silently discards an inbound support email for 7 days while telling Resend it succeeded. The exact "durable operation fails but reports success" class the project rule targets.
- **Recommendation:** Release the dedupe key on both 502 branches before returning.
- **Regression risk:** Reopens a narrow duplicate-forward window on concurrent retries — bounded by Resend's finite retry budget, strictly less harmful than a lost email.
- **Expected impact:** Resend's retry actually recovers transient failures.
- **Effort estimate:** S

#### BE-H3 CLI approval overwrites the device session, discarding `device_code` and disabling RFC 8628 binding on every real flow
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/cli/auth/approve/route.ts:48`, `apps/web/app/api/cli/auth/poll/route.ts:109,123,157`
- **What's happening:** Approve writes a full object replacement dropping `deviceCode`/`deviceCodeConfirmed`. The poll route's enforcement is guarded by `if (session.deviceCode)`, which is now false, so a 90-day token issues to anyone presenting the bare `sessionId`.
- **Why it matters:** Independently found by the Security specialist (SE-H1) — see that entry for the full exploit path. The "confirmed flows are not affected" residual-risk claim in the code comment does not hold.
- **Recommendation:** Make approve a read-modify-write preserving `deviceCode`/`deviceCodeConfirmed`.
- **Regression risk:** A legacy CLI that echoes `device_code` during polling but omits it on the final poll would newly 401 — verify against the external CLI binary's actual behavior before shipping.
- **Expected impact:** A leaked `sessionId` alone stops being redeemable for a CLI token.
- **Effort estimate:** S

#### BE-H4 Unpaginated Supabase selects silently truncate at `max_rows = 1000`, corrupting campaign completion and shrinking cron coverage
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `supabase/config.toml:18`, `apps/web/lib/db/campaigns/sends.ts:289`, `apps/web/lib/db/users.ts:84,132`, `apps/web/lib/email/campaigns.ts:199`
- **What's happening:** `dbGetCampaignStats`, `dbGetUsersWithEmail`, and the no-opts `dbGetUsers()` issue selects with no `.range()`/pagination and no error on truncation.
- **Why it matters:** `dbGetCampaignStats` drives the campaign terminal-state decision — past 1000 send rows, a campaign can be marked complete with recipients never emailed. `dbGetUsers` truncation silently drops the earliest-registered users from warm-cache rotation forever.
- **Recommendation:** Replace the campaign-stats fetch with a grouped-count RPC; add pagination loops to the user accessors, or assert/log when the cap is hit.
- **Regression risk:** A counting RPC changes the campaign-completion decision surface — needs a contract test against local Supabase, since unit tests mock the query builder.
- **Expected impact:** Campaign lifecycle and cron coverage stay correct past 1000 rows.
- **Effort estimate:** M

#### BE-M1 `/api/telemetry` client-error branch runs before every rate limit and has no body-size cap
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/telemetry/route.ts:14,21,43`
- **What's happening:** The client-error payload branch returns before all three rate limiters execute, and parses with no size cap (unlike sibling write routes).
- **Why it matters:** Any anonymous caller can flood the PostHog sink at unlimited rate and submit arbitrarily large bodies. Independently found by the Security specialist (SE-M1).
- **Recommendation:** Move IP-based limiters above the client-error branch; adopt the `request.text()` + byte-length pattern used elsewhere.
- **Regression risk:** A busy shared IP could start being rate-limited on genuine client errors — consider a separate, more generous bucket.
- **Expected impact:** The route's abuse protections apply to all payload shapes.
- **Effort estimate:** S

#### BE-M2 Badge SVG is never cached for any handle whose avatar fetch fails or is absent
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/u/[handle]/badge.svg/route.ts:329,339,375`, `apps/web/lib/render/avatar.ts:59`
- **What's happening:** The SVG cache write is gated on `avatarResolved`, which conflates "temporarily slow" with "permanently absent" — both a missing `avatarUrl` and a hard 404 leave the gate permanently false.
- **Why it matters:** Every request for an affected handle performs a full materialize + render, permanently on the cache-miss side of the SLO. Independently corroborated by the Performance specialist (PE-M1) with latency framing.
- **Recommendation:** Distinguish "no URL to fetch" (cache normally) from "fetch actually timed out" (withhold write).
- **Regression risk:** Must gate strictly on "the deadline fired," not "the fetch returned nothing," or a handle that would succeed on retry gets a bad placeholder cached for 24h.
- **Expected impact:** Avatarless/broken-avatar handles get normal cache-hit economics.
- **Effort estimate:** S

#### BE-M3 Snapshot day-guard is claimed before the durable write, so a failed write forfeits the badge path's snapshot for the rest of the day
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/profile/public-profile.ts:123,133,146`
- **What's happening:** The SETNX day-guard is acquired before `reconcileSnapshotWrite`. On a `"failed"` outcome, the error is escalated (satisfying observability) but the guard is left in place, so every subsequent badge request today returns early without retrying.
- **Why it matters:** One transient Supabase failure costs the badge path that handle's entire day; recovery depends entirely on the 50-handle warm-cache rotation.
- **Recommendation:** Release the guard key on `"failed"`, alongside the existing `captureServerError`.
- **Regression risk:** Reopens the concurrent-write window during a sustained outage — bounded by the write being in `after()` and the `UNIQUE(handle, date)` constraint.
- **Expected impact:** A transient failure self-heals on the next badge request instead of waiting for the cron.
- **Effort estimate:** S

#### BE-M4 `/api/challenge` returns `success: true` when the dispute email was not sent
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/challenge/route.ts:89`
- **What's happening:** On a failed `sendChallengeEmail`, the route logs and captures the error but still returns `{success: true}`, after already consuming one of the user's 3 daily attempts.
- **Why it matters:** The dispute is stored nowhere — email is the only delivery mechanism. The user is told it worked while nothing reached anyone, and burns a scarce retry.
- **Recommendation:** Return `{success: false, error: "delivery_failed"}` with 502; skip or refund the quota on delivery failure.
- **Regression risk:** The client's challenge form must have a sensible failure path before this ships.
- **Expected impact:** Users learn when a dispute didn't go through.
- **Effort estimate:** S

#### BE-M5 `/api/profile/[handle]` performs a read-only materialize that fetches GitHub but can never populate the cache
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/profile/[handle]/route.ts:33,96`, `apps/web/lib/github/client.ts:393,475`
- **What's happening:** `readOnly` mode still issues a real GitHub GraphQL request on a cold key and then discards the result — the next request repeats it.
- **Why it matters:** This public, CORS-enabled endpoint is rate-limited only at 60/IP/min with no per-handle limit; once the 6h TTL lapses, sustained traffic converts directly into GitHub API calls against the shared server token.
- **Recommendation:** Either serve fresh-headline-or-null from the composed cache only, or let this path write back to `stats:v2:merged:` on the accepted-fetch path.
- **Regression risk:** A write-back must stay on the accepted-fetch path so it can't downgrade a better-scoped cache entry (the exact invariant #1050 protects).
- **Expected impact:** Bounded GitHub API consumption from an unauthenticated endpoint.
- **Effort estimate:** M

#### BE-L1 The write-registration gate's known-write-GET list is hand-maintained and already misses a cron route
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `scripts/check-write-registration.ts:30`, `apps/web/app/api/cron/latency-check/route.ts:99`
- **What's happening:** `/api/cron/latency-check` writes a Redis heartbeat but is in neither the known-write-GET set nor the exemption map — invisible to the gate rather than reported.
- **Why it matters:** A gate whose guarantee depends on a hand-edited constant is only as current as that constant; this has already happened once.
- **Recommendation:** Invert the default — treat a GET as a write when it references a mutating helper, requiring explicit exemption to opt out.
- **Regression risk:** Heuristic discovery will pull in read-mostly GETs that happen to touch a cache-write helper — one-time triage needed.
- **Expected impact:** New write endpoints can't escape the payload-matrix contract by being GETs.
- **Effort estimate:** S

#### BE-L2 `bulk-recalculate` marks failed handles as completed, so cursor-resume skips them
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/admin/bulk-recalculate/route.ts:117,173`
- **What's happening:** `completed.push(...batch)` includes handles that also landed in `errors`, so they're excluded from the resume's `pending` list.
- **Why it matters:** A partial run's own resume contract silently drops exactly the handles that need re-running.
- **Recommendation:** Push to `completed` only in the success branch.
- **Regression risk:** Minimal — response-only, not persisted.
- **Expected impact:** Resuming a partial run actually covers the handles it missed.
- **Effort estimate:** S

#### BE-L3 Expired-lease recovery ignores `p_limit`, so a recovered batch can exceed remaining daily quota and stall until the counter resets
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** `supabase/migrations/031_reject_whitespace_campaign_lease_tokens.sql:52`, `apps/web/lib/email/campaigns.ts:188,248`
- **What's happening:** A recovered expired-lease group is deliberately returned whole (correct, for idempotency-key stability), but when it exceeds remaining quota the reservation fails and rows are re-leased under a fresh 10-minute window, repeating the cycle.
- **Why it matters:** The batch can't progress until the UTC-day quota resets, burning cron invocations and deferring every other active campaign in the same run.
- **Recommendation:** Release the lease back to `pending` rather than re-leasing when quota can't cover it, preserving group identity via a separate token.
- **Regression risk:** Must preserve "recovered as one indivisible group" or provider-side idempotency dedup breaks.
- **Expected impact:** A quota-blocked recovery stops re-leasing and starving sibling campaigns.
- **Effort estimate:** M

#### BE-L4 `warm_cache_ceiling_approached` fires a P2 alert on every hourly run once the user count reaches 50
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/cron/warm-cache/route.ts:213`
- **What's happening:** The condition is a raw count with no suppression — fires 24 identical P2 alerts per day, permanently, once past 50 users.
- **Why it matters:** Trains operators to ignore the channel, degrading genuinely actionable alerts sharing it. Directly related to DO-M1's alert-flooding finding.
- **Recommendation:** Gate on a staleness bound (`rotationHours`) with a once-per-day suppression key.
- **Regression risk:** Pair the raised threshold with the `rotationHours` value staying visible in alert properties.
- **Expected impact:** The alert channel stays credible as the user base grows.
- **Effort estimate:** S

---

## 6. Performance and Scalability Findings (Performance Engineer)

#### PE-H1 Badge cache-miss path has no end-to-end deadline; component ceilings sum to ~34s against a 3000ms SLO
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/u/[handle]/badge.svg/route.ts:300`, `apps/web/lib/github/client.ts:27`, `apps/web/lib/github/queries.ts:13`, `apps/web/lib/platform/fetch-linked-platform.ts:15`, `apps/web/lib/monitoring/latency-slo.ts:23`
- **What's happening:** Every individual step is bounded but nothing bounds their sum. Materialize (30s inflight cap) → GitHub fetch (15s) → platform fetch (8s each) plus route-level ceilings sum to ~34s; the only real ceiling is `maxDuration = 35`.
- **Why it matters:** The declared SLO is aspirational, not enforced. A single slow upstream response turns a badge embed into a 10-20s hanging `<img>` in someone else's README.
- **Recommendation:** Wrap the whole materialize call in a hard deadline (~2200ms); on expiry, fall back to yesterday's SVG or the existing fallback SVG while letting materialize continue under `after()`.
- **Regression risk:** A too-tight deadline would starve genuinely-new handles with no stale key to fall back to — apply the deadline only when a fallback exists.
- **Expected impact:** Bounds p99 badge latency at roughly the SLO ceiling instead of ~34s.
- **Effort estimate:** M

#### PE-H2 Linked-platform + supplemental overlay loading is serialized after the GitHub fetch despite being independent of it
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/github/client.ts:393-395,246-335`, `apps/web/lib/platform/fetch-linked-platform.ts:15`
- **What's happening:** `_loadOverlays` has zero data dependency on the GitHub fetch's result but runs strictly after it, then serializes its own internals into four further waves.
- **Why it matters:** The two most expensive network legs run back-to-back instead of concurrently — the single largest recoverable chunk of the miss-path budget.
- **Recommendation:** `Promise.all([fetchStats(...), _loadOverlays(...)])`; collapse `_loadOverlays`'s internal waves.
- **Regression risk:** Substantive — touches the #1060/#1061 integrity boundary. Must not change which value the guards inspect or the write ordering of `stats:stale:v2:`. Run the integrity contract test suite before/after.
- **Expected impact:** Removes up to 8000ms from the worst case, 200-600ms typically, for linked-platform users.
- **Effort estimate:** M

#### PE-M1 A handle whose avatar never resolves can never populate the badge SVG cache, so every request is a full cache miss forever
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence] for the code path, [inference] for population frequency
- **Files:** `apps/web/app/u/[handle]/badge.svg/route.ts:329-340,375-376`, `apps/web/app/u/[handle]/page.tsx:175-205`, `packages/shared/src/types.ts:13`
- **What's happening:** Same root cause as BE-M2 — `avatarResolved` conflates permanent absence with transient timeout, gating the SVG cache write shut for both.
- **Why it matters:** A README embed with real traffic drives a full materialize per request for affected handles, with only the 30s render lock between it and a stampede.
- **Recommendation:** Cache a short-TTL placeholder (15-30 min) for permanent absence, reserving the no-write behavior for genuine race-timeout only.
- **Regression risk:** The gate was deliberately added (#800/#1029) — a short-TTL write must not shadow a later good render or exceed the daily key rollover.
- **Expected impact:** Converts affected handles from permanent cache-miss to normal cache-hit economics.
- **Effort estimate:** S

#### PE-M2 The warm-cache cron warms stats and avatars but never the badge SVG, guaranteeing a cold miss for every handle at each UTC date rollover
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/cron/warm-cache/route.ts:297-324`, `apps/web/lib/render/badge-svg-cache.ts:54-56`
- **What's happening:** `warmHandle` materializes and prewarms the avatar but never renders/writes the SVG. The cache key embeds today's date, so every handle's key changes at 00:00 UTC and the first real visitor pays a full miss.
- **Why it matters:** The cron already holds everything needed; the render itself costs under a millisecond. Real user traffic exercises the expensive miss path daily instead of a cron with a 300s budget.
- **Recommendation:** Render and write the badge in `warmHandle` after the avatar prewarm resolves (await it, not fire-and-forget).
- **Regression risk:** Must apply the same quality gates as the request path (`avatarResolved && verification`, `statsComplete`) or a degraded cron fetch publishes a lower-quality badge for 24h.
- **Expected impact:** Converts the daily rollover miss into a hit for all warmed handles.
- **Effort estimate:** M

#### PE-M3 The latency monitor classifies lock-loser stale/poll responses as cache hits, judging a ~950ms path against the 800ms cache-hit budget
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/monitoring/latency-slo.ts:91`, `apps/web/app/u/[handle]/badge.svg/route.ts:281,294`, `apps/web/app/api/cron/latency-check/route.ts:57-77`
- **What's happening:** The hit-detection regex matches `stale`/`poll` Server-Timing markers too, so a ~950ms lock-loser response is judged against the 800ms hit budget as a false breach. Separately, one daily sample is evaluated against a p95 budget.
- **Why it matters:** Produces false-positive P2 pages exactly when the render lock is working correctly under concurrency, training on-call to ignore the alert.
- **Recommendation:** Narrow the predicate to the true hit path; give `stale`/`poll` their own budget class.
- **Regression risk:** Tightening will surface previously-hidden genuine breaches — expect alert volume to rise before it falls.
- **Expected impact:** Removes false-positive alerts; makes the SLO measurable.
- **Effort estimate:** S

#### PE-M4 Redis deadline coverage is limited to the badge SVG cache; ~15 other reads on the miss path are unbounded
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/cache/redis.ts:61-72`, `apps/web/lib/render/badge-svg-cache.ts:19`, `apps/web/lib/github/client.ts:77,273`, `apps/web/lib/cache/snapshot-cache.ts:38-43`, `apps/web/lib/cache/craft-cache.ts:40-45`, `apps/web/lib/cache/dirty-stats.ts:27-30`, `apps/web/lib/render/avatar.ts:66`
- **What's happening:** `cacheGet` applies no timeout by default; timeouts exist only where each caller added one (the SVG cache at 500ms). Roughly 15 other reads on the miss path are unbounded.
- **Why it matters:** #1014 established Redis tail latency is a real, observed condition here, and fixed exactly one of ~15 affected reads.
- **Recommendation:** Push a default deadline into the `cacheGet`/`cacheSet` primitives, overridable per call site.
- **Regression risk:** A timeout must resolve to the same fail-open value as an error, not throw; size the deadline from observed Upstash latency, not intuition.
- **Expected impact:** Bounds Redis's contribution to p99 on the miss path.
- **Effort estimate:** M

#### PE-M5 `svgToPng` is synchronous and blocks the event loop; its 10s `withTimeout` cannot fire
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/render/svg-to-png.ts:103-114`, `apps/web/app/u/[handle]/og-image/route.ts:94-98`
- **What's happening:** Rasterization runs synchronously with no yield, so the `withTimeout` wrapper's timer can never be serviced — the `TimeoutError` branch is dead code.
- **Why it matters:** Blocks the Node event loop for the full rasterization duration, stalling any concurrent request on the same warm instance — including an otherwise-fast `badge.svg` cache hit.
- **Recommendation:** Move rasterization off the main thread (`worker_threads` or a small pool).
- **Regression risk:** Must not reload font buffers per invocation; worker cold-start could make first OG requests slower.
- **Expected impact:** Removes a multi-hundred-ms event-loop stall taxing co-located badge requests.
- **Effort estimate:** M

#### PE-M6 The share page awaits a durable Supabase snapshot write inside the render path
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/u/[handle]/page.tsx:200-207`, `apps/web/lib/profile/public-profile.ts:95-159`
- **What's happening:** `persistProfileSnapshot` is awaited before the `after()` block rather than inside it — #1013 moved the equivalent call in the badge route into `after()`; the share page was never updated to match.
- **Why it matters:** Nothing in the rendered HTML depends on the snapshot, so the await holds TTFB open for a Supabase + Redis round-trip for no benefit.
- **Recommendation:** Move the call inside the existing `after()` block, structurally identical to the badge route.
- **Regression risk:** Must adopt the same `captureServerError` escalation the badge route uses, or a durable write failure becomes silent (violates the CLAUDE.md observability rule).
- **Expected impact:** Removes one Supabase and one Redis round-trip from share-page TTFB.
- **Effort estimate:** S

#### PE-L1 Per-platform positive and negative cache lookups are two serial Redis round-trips where an MGET exists
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/platform/fetch-linked-platform.ts:90-94`, `apps/web/lib/cache/redis.ts:124-136`
- **What's happening:** Two sequential `cacheGet` calls per platform where a single `cacheMGet` (already implemented, unused here) would do.
- **Why it matters:** One avoidable round-trip per platform per stats cache miss.
- **Recommendation:** Replace with `cacheMGet([cacheKey, negKey])`.
- **Regression risk:** `cacheMGet` returns `[]` on unavailability, not `[null, null]` — destructuring must treat a short array as "both miss."
- **Expected impact:** Halves platform-cache round-trips on the miss path.
- **Effort estimate:** S

#### PE-L2 `_loadOverlays` re-queries `dbGetLinkedPlatform` for platforms whose stats fetch already succeeded
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/github/client.ts:290-306,317-321`
- **What's happening:** The same row is deliberately skipped in wave one for platforms that fetched successfully, then fetched again in wave three.
- **Why it matters:** One extra Supabase query per successfully-fetched linked platform, in an extra serial wave, on every stats miss.
- **Recommendation:** Fetch the link row unconditionally in wave one; fold into the PE-H2 restructuring.
- **Regression risk:** Must preserve the OR-semantics that keep a platform in Data Sources even when its stats fetch fails (#632).
- **Expected impact:** Removes up to 3 Supabase queries and one serial wave per miss.
- **Effort estimate:** S

#### PE-L3 OG PNGs are stored in Redis as base64, inflating each cached value ~33%
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** `apps/web/app/u/[handle]/og-image/route.ts:100-104,45-47`
- **What's happening:** The rasterized PNG is base64-encoded before `cacheSet`, adding ~33% overhead at a 48h TTL per handle.
- **Why it matters:** Upstash bills on bandwidth and enforces a per-value size limit; a write past that limit fails silently and degrades to permanent OG cache miss (compounding PE-M5).
- **Recommendation:** Measure actual PNG size first; if material, reduce rasterization width or move to blob/CDN storage. At minimum, log a silent `cacheSet` failure.
- **Regression risk:** Low for observability; reducing width should be checked against social-card requirements.
- **Expected impact:** Lower Redis bandwidth/storage; removes a silent-failure path.
- **Effort estimate:** S

---

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

#### DO-H1 Every alert path executes inside the application being monitored; there is no external uptime monitor
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/analytics/server-errors.ts:120-146`, `apps/web/app/api/health/route.ts:253-261`, `apps/web/app/api/cron/latency-check/route.ts:77-97`, `docs/runbooks/incident-response.md:16-32`, `.github/workflows/nightly-prod-probe.yml:4-5`
- **What's happening:** All alert signals are raised by code running inside the Vercel deployment itself. The one external observer, a nightly probe, notifies only via GitHub Actions' default failing-workflow email and isn't even listed in the incident-response runbook's Detection section.
- **Why it matters:** A total production outage has a worst-case MTTD of ~24 hours, realistically depending on a user report — every other alert is conditioned on the app being alive enough to send it.
- **Recommendation:** Add a third-party synthetic monitor (Better Stack/UptimeRobot/Checkly free tier) polling `/api/health` every 1-5 minutes, alerting into the same channel; add a failure step to the nightly probe that pages instead of emailing.
- **Regression risk:** Low — read-only external GET against an already-public, rate-limited endpoint.
- **Expected impact:** Outage MTTD drops from ~24h to minutes.
- **Effort estimate:** S

#### DO-H2 An unset `CHAPA_ALERT_WEBHOOK_URL` silently disables all alerting, and nothing gates on it
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/analytics/server-errors.ts:123-125`, `apps/web/app/api/health/route.ts:241-251`, `docs/runbooks/deployment-smoke.md:51-60`
- **What's happening:** `captureOperationalAlert` returns silently with no log if the webhook URL is unset. `/api/health` reports `alertWebhook: "skipped"` in its dependencies object but this does not affect overall `status`, so `/api/health` returns `ok` regardless.
- **Why it matters:** The exact same silent-config-nobody-reads shape as #1052, applied to the system that would have caught #1052-shaped incidents. A typo or an env var scoped to Preview-only leaves production with zero alerting and every gate green.
- **Recommendation:** Fold `alertWebhook` into `/api/health`'s `isHealthy` chain in production; emit a `captureServerEvent` on the early return so the gap is visible in PostHog even when the webhook itself can't carry it.
- **Regression risk:** Verify `CHAPA_ALERT_WEBHOOK_URL` is actually set in Vercel Production *before* shipping the gate, or the first deploy trips the release-required health probe.
- **Expected impact:** The alerting configuration becomes verifiable rather than assumed.
- **Effort estimate:** S

#### DO-H3 Vercel project settings remain unverified dashboard state — `check:vercel-config` pins a repo constant, not the actual setting
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** `scripts/check-vercel-config.ts:37-44`, `.github/workflows/ci.yml:35-37`
- **What's happening:** The #1052 gate verifies repo-side state only — that `vercel.json` exists and resolves — and cannot observe the actual Vercel dashboard. The script's own comment acknowledges the coupling must be kept in sync manually. Whether the four crons are actually *registered*, whether Production Branch is `main`, and the build Node version are all unasserted dashboard facts.
- **Why it matters:** #1052's root cause — repo and dashboard state diverging with no error surface — remains possible in three other dimensions the current gate cannot see.
- **Recommendation:** Extend the gate (or a scheduled job) to call the Vercel REST API with a read-scoped token, asserting `rootDirectory`, production branch, and registered cron paths/schedules match the repo.
- **Regression risk:** Requires a Vercel API token in CI; must fail closed on a missing token for scheduled runs, or become another silently-skipping gate.
- **Expected impact:** Closes the #1052 class of failure, not just the #1052 instance.
- **Effort estimate:** M

#### DO-M1 Operational alerts have no deduplication or throttling — a P1 incident produces one webhook POST per request
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/analytics/server-errors.ts:89-146`, `apps/web/app/api/health/route.ts:253-261`, `docs/runbooks/incident-response.md:20-25`
- **What's happening:** No cooldown key, in-flight suppression, or sampling exists anywhere in the module. Every 5xx on the badge route maps to a P1; every degraded `/api/health` response fires `health_degraded`.
- **Why it matters:** A badge outage on the highest-traffic route generates one webhook POST per failing request; Discord/Slack rate-limit aggressively and the channel saturates precisely during the incident it exists to report.
- **Recommendation:** Add a Redis-backed suppression key per signal (SETNX + 5-15min TTL), fail *open* (send the alert) if Redis is unavailable.
- **Regression risk:** Must key on `signal` (and route), never a single global lock, so unrelated concurrent incidents don't suppress each other.
- **Expected impact:** The alert channel stays usable during an incident.
- **Effort estimate:** M

#### DO-M2 `warm-cache` has no wall-clock budget, and a timeout leaves the rotation offset permanently stuck
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/cron/warm-cache/route.ts:31,55,58,140-163,257`, contrast `apps/web/app/api/cron/process-campaigns/route.ts:13-17`
- **What's happening:** Unlike `process-campaigns`, which reserves a 30s buffer against `maxDuration`, `warm-cache` has no elapsed-time check. A hard platform timeout mid-run means the rotation offset and heartbeat never get written — and isn't a thrown error, so no `cron_failure` alert fires.
- **Why it matters:** If runs consistently time out as the user base grows, the rotation offset freezes forever — the first ~50 handles get re-warmed hourly and everyone past the offset never warms again, silently.
- **Recommendation:** Mirror the `process-campaigns` time-budget pattern; on exhaustion, persist `nextOffset` for handles actually completed and alert.
- **Regression risk:** Directly touches the #750 invariant ("never advance past handles never warmed") — the offset must advance only to the genuinely-completed boundary.
- **Expected impact:** Warm-cache degrades gracefully under load instead of wedging.
- **Effort estimate:** M

#### DO-M3 No Node.js version pinning — CI builds on Node 20, Vercel builds on whatever its dashboard default currently is
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `package.json:3`, `.github/workflows/ci.yml:26,99,128,428,513,638,755` (Node 20), `:324` (Node 24 for contract)
- **What's happening:** Node is pinned only inside workflow YAML — no `engines` field, no `.nvmrc`. Vercel selects its build Node from a dashboard setting that auto-bumps over time with no repo constraint.
- **Why it matters:** The same failure shape as #1052 at one remove — a build-critical setting living only in a dashboard, changing without a commit. The project already knows it's sensitive to Node major (the contract job pins 24 specifically).
- **Recommendation:** Add `engines` to root `package.json` and an `.nvmrc`; set the Vercel project's Node version explicitly to match.
- **Regression risk:** An `engines` field warns by default (safe); confirm `engine-strict` isn't set before tightening. Changing the Vercel Node version is a production build change needing preview verification first.
- **Expected impact:** Tested and production build environments become verifiably the same.
- **Effort estimate:** S

#### DO-M4 Five workflows declare no `permissions:` block, and `ci.yml` injects the Actions token into the E2E app-under-test environment
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence] for the gaps, [inference] for the token's actual write-capability
- **Files:** `.github/workflows/ci.yml` (no `permissions:`), `security.yml`, `knip.yml`, `lighthouse.yml`, `nightly-prod-probe.yml`; `ci.yml:507` (`GITHUB_TOKEN` in `e2e-shard` job env)
- **What's happening:** Four workflows correctly scope their token; five inherit the repo-wide default. `e2e-shard` additionally places `secrets.GITHUB_TOKEN` into the job environment visible to the application and test code under test.
- **Why it matters:** A least-privilege default bounds damage from a compromised transitive dependency; the app under test doesn't need an Actions token at all — its own `GITHUB_TOKEN` env var means something entirely different (the server PAT for GitHub API calls).
- **Recommendation:** Add `permissions: contents: read` at the top of all five workflows; remove or dummy-out the `GITHUB_TOKEN` line in `e2e-shard` after confirming no E2E test needs a live GitHub call.
- **Regression risk:** Over-tightening can break jobs that write silently today — verify `upload-artifact`/`download-artifact` work under `contents: read` before merging.
- **Expected impact:** CI credential blast radius bounded to what each job actually needs.
- **Effort estimate:** S

#### DO-M5 Secret-rotation runbook omits the three highest-consequence credentials, including the one whose silent degradation the pipeline is built around
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `docs/runbooks/secret-rotation.md`, `apps/web/lib/env.ts:112-114,222-225,236-244`
- **What's happening:** `SUPABASE_SERVICE_ROLE_KEY` (highest-privilege credential, bypasses RLS), `GITHUB_TOKEN` (the server PAT the entire scoring-integrity design depends on), and Resend credentials all lack rotation procedures.
- **Why it matters:** The runbook's own trigger list includes "a secret is committed to the repository" — if that happens to the service-role key or server PAT, the operator has no procedure for the two most costly credentials. `GITHUB_TOKEN` rotation has a specific non-obvious trap: a replacement without `repo` scope authenticates fine and blinds every badge (the exact failure #1047/#1050 exist to catch).
- **Recommendation:** Add sections for all three; make the `GITHUB_TOKEN` post-rotation scope-verification step (`curl .../api/health | jq '.dependencies.github'` must be `"ok"`) mandatory and explicit.
- **Regression risk:** Documentation-only; the only substantive risk is writing a `GITHUB_TOKEN` procedure that omits the scope-verification step.
- **Expected impact:** The three most consequence-prone credentials gain a tested rotation procedure.
- **Effort estimate:** S

#### DO-M6 The badge latency SLO monitor takes one sample per day and evaluates it against a p95 budget
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/cron/latency-check/route.ts:52-97`, `apps/web/vercel.json`, `apps/web/lib/monitoring/latency-slo.ts`
- **What's happening:** One `fetch` per 24 hours, compared to a p95 budget. One sample cannot estimate a percentile.
- **Why it matters:** A single unlucky cold start pages P2 for nothing; conversely a genuine p95 regression has a good chance of sampling below budget and reporting `ok`. Jointly owned with PE-M3, which found the same monitor's cache-hit classification bug.
- **Recommendation:** Take N samples per run and evaluate a percentile, or derive the SLO from the `Server-Timing` header already on every real badge response.
- **Regression risk:** More samples means more real badge requests — stay well inside `maxDuration = 60` and keep the smoke param.
- **Expected impact:** The latency alert starts meaning what its name claims.
- **Effort estimate:** M

#### DO-M7 No durable log retention — the observability runbook's log-drain checklist is entirely unchecked
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `docs/runbooks/observability.md:11-26,39-42,136-144`
- **What's happening:** Vercel's built-in retention is roughly one hour on lower plans; the runbook documents a complete Axiom-drain setup and every checklist item, including confirming the alert webhook is set, remains unticked.
- **Why it matters:** Composes badly with DO-H1 — by the time a nightly probe surfaces a failure, the logs explaining it have already expired. Post-mortems become unwriteable.
- **Recommendation:** Complete the documented Axiom integration; tick the checklist, starting with confirming the alert webhook (which DO-H2 shows nothing else verifies).
- **Regression risk:** None to the application — no code change.
- **Expected impact:** Incidents become investigable after the fact.
- **Effort estimate:** S

#### DO-L1 The `deployment-smoke` job on `main` races the deployment it is meant to verify and asserts no identity
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `.github/workflows/ci.yml:613-671,620-624`, `docs/runbooks/deployment-smoke.md:8-18`
- **What's happening:** The job runs against the production URL concurrently with the actual deployment, asserting no `/api/version` identity match — it most likely exercises the previous build and reports green regardless.
- **Why it matters:** A green "Deployment Smoke" check reads as "production is verified" to anyone not steeped in the E2E Pro distinction, even though the authoritative identity check lives elsewhere (`release-playbook.md`).
- **Recommendation:** Add an `/api/version` identity poll with a bounded timeout, or rename the job to make clear it's identity-blind by design.
- **Regression risk:** An identity poll converts a currently-always-green check into one that can block `main` CI — choose the timeout and advisory/blocking status deliberately.
- **Expected impact:** A green check means what a reader assumes it means.
- **Effort estimate:** S

#### DO-L2 CI installs two unpinned third-party tools at runtime, one without checksum verification
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `package.json:38` (`pnpm dlx madge`), `.github/workflows/security.yml:30-34` (osv-scanner)
- **What's happening:** `madge` resolves to whatever is latest at CI-run time, not lockfile-pinned. The osv-scanner download is version-pinned but has no checksum verification.
- **Why it matters:** A new madge major can silently change circular-detection semantics or break the trunk workflow with no commit to blame.
- **Recommendation:** Move `madge` to a pinned devDependency called via `pnpm exec`; add SHA-256 verification to the osv-scanner download.
- **Regression risk:** Pinning may surface (or hide) pre-existing cycles the floating version happens not to flag — verify locally before merging.
- **Expected impact:** CI gates become reproducible from the lockfile.
- **Effort estimate:** S

#### DO-L3 Stale in-repo comments claim the pending-migrations secrets do not exist, contradicting `accepted-risks.md`
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `.github/workflows/ci.yml:735-740`, `docs/runbooks/migrations.md:152-160`, contrast `docs/accepted-risks.md:22`
- **What's happening:** Workflow comments assert the pending-migrations secrets are unconfigured and the job self-skips; `accepted-risks.md` states the gate ran against production on a recent release PR, which requires those exact credentials. The underlying fail-safe design (a skip blocks release per the playbook) is sound either way.
- **Why it matters:** A comprehension gap, not a control gap — an operator reading `ci.yml` mid-release may wrongly conclude the gate is inactive.
- **Recommendation:** Run `gh secret list` and reconcile whichever document is stale; make the skip reason self-documenting in the evidence artifact.
- **Regression risk:** None — documentation reconciliation only.
- **Expected impact:** One fewer contradiction for an operator to resolve under release pressure.
- **Effort estimate:** S

---

## 8. Security / Privacy Findings (Security Reviewer)

#### SE-H1 CLI approval overwrites the device session, destroying the confirmed device_code binding
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/cli/auth/approve/route.ts:48-52`, `apps/web/app/api/cli/auth/poll/route.ts:92-93,102-106,123,145-176`
- **What's happening:** `/api/cli/auth/approve` writes `cacheSet('cli:device:<id>', {status: "approved", handle}, 300)` — a plain Redis `SET`, not a merge — so the confirmed `deviceCode`/`deviceCodeConfirmed` fields are dropped. Every enforcement branch in poll is guarded on `if (session.deviceCode)`, now false, so the branch that requires the code is skipped entirely on the redeeming poll.
- **Why it matters:** The code's own comment claims "confirmed flows are not affected" — that does not hold. Anyone who learns the 36-char `sessionId` (displayed to the user, in the `/cli/authorize` URL, reachable via shell history/screen shares/logs) can poll with sessionId alone during the 300s window and receive a 90-day CLI token for that handle, authorizing writes to `/api/supplemental`, `/api/insights`, `/api/recalculate`. No test covers the approve→poll sequence — every existing test constructs the session object directly rather than through the real approve handler.
- **Recommendation:** Make approval a read-modify-write that preserves the binding fields. Add a regression test asserting a confirmed session still 401s without `device_code` after approval.
- **Regression risk:** Legacy CLIs that never send `device_code` keep working (nothing to preserve). A CLI that echoes the code pre-approval but omits it on the redeeming poll would newly break — verify the external CLI binary's actual behavior before merging, since its source isn't in this repo.
- **Expected impact:** The RFC 8628 possession guarantee holds end-to-end; sessionId disclosure stops being sufficient to steal a token.
- **Effort estimate:** S

#### SE-M1 `/api/telemetry` client-error branch returns before every rate limit
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/telemetry/route.ts:21-31,43,53,63`
- **What's happening:** The unauthenticated route's client-error branch calls `captureServerEvent` and returns before any of the three rate limiters run.
- **Why it matters:** Unlimited PostHog capture volume from a single IP with a trivially-shaped body, and poisoning of the server-error stream with attacker-chosen fields indistinguishable from genuine errors during an incident.
- **Recommendation:** Move the per-IP limiters above the client-error check; consider a dedicated, tighter bucket for it.
- **Regression risk:** Low — confirm legitimate browser error bursts don't self-throttle in a way that silently drops real reports.
- **Expected impact:** Closes an unauthenticated, unbounded write into the analytics/alerting pipeline.
- **Effort estimate:** S

#### SE-L1 `/api/auth/login` rate limit fails open while `/api/auth/callback` fails closed
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/auth/login/route.ts:35`, `apps/web/app/api/auth/callback/route.ts:87`, `apps/web/lib/auth/platform-oauth.ts:184-190,251,384`
- **What's happening:** Login uses fail-open `rateLimit`; every analogous auth-initiating route (the callback, and all 12 platform OAuth handlers) uses fail-closed `rateLimitStrict`.
- **Why it matters:** A consistency gap in a deliberately-designed policy, not an exploitable hole on its own — login performs no write and no token exchange.
- **Recommendation:** Either switch to `rateLimitStrict`, or add a comment stating why login is deliberately fail-open.
- **Regression risk:** Switching means a Redis outage blocks all new logins — a real tradeoff, so make it a decision rather than a default.
- **Expected impact:** The fail-open/fail-closed boundary becomes fully self-documenting.
- **Effort estimate:** S

#### SE-L2 `NO_TRUSTED_IP` sentinel unhandled at most `getClientIp` call sites
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** `apps/web/lib/http/client-ip.ts:18-31`, `apps/web/lib/auth/platform-oauth.ts:189-190`, `apps/web/app/api/profile/[handle]/route.ts:70`, `apps/web/app/api/verify/[hash]/route.ts:30`
- **What's happening:** The module's own docs require callers to detect and specially handle the `NO_TRUSTED_IP` sentinel; only 5 of 57 call sites do, including none of the 12 `rateLimitStrict`-protected OAuth handlers.
- **Why it matters:** Unverified as reachable in production — Vercel injects the trusted header on every request, so this is framed by the module's own docs as a non-Vercel/local concern.
- **Recommendation:** Push the policy into the limiter itself rather than patching 50 call sites.
- **Regression risk:** Centralizing changes the effective limit for any route already branching on the sentinel manually.
- **Expected impact:** A documented invariant becomes structurally enforced.
- **Effort estimate:** M

#### SE-L3 `/api/insights/:handle` is documented as authenticated but is public
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/api/insights/[handle]/route.ts:8-11,37`, CLAUDE.md ("Authenticated API")
- **What's happening:** CLAUDE.md lists the route under Authenticated API; the handler's own docstring and code say the opposite — public, no auth, no raw data exposed.
- **Why it matters:** No leak today, but a future reviewer trusting CLAUDE.md could add a field to the response shape believing it's session-gated.
- **Recommendation:** Move the route to CLAUDE.md's Public API section.
- **Regression risk:** None for the doc fix.
- **Expected impact:** The route inventory becomes trustworthy as an authorization reference.
- **Effort estimate:** S

---

## 9. Code Quality / Maintainability Findings (Principal Architect)

#### AR-H1 Repo-root `scripts/` is invisible to typecheck, lint, and coverage — including every CI gate and both destructive production tools
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `tsconfig.json:3`, `package.json:9-10`, `.github/workflows/ci.yml:29-31`, `vitest.config.ts:21-26`, `scripts/delete-user.ts:99-100`, `scripts/heal-poisoned-stats.ts:144-145`, `scripts/quality/collect-playwright-evidence.ts:134-140`, `scripts/quality/prepare-release-run.ts:145`, `scripts/validate-migrations.ts:55`, `scripts/test-contract-local.ts:38`
- **What's happening:** `pnpm run typecheck`/`lint` are both `pnpm -r run ...`, reaching only `apps/web`/`packages/shared` — never the repo root. 24 non-test modules under `scripts/`, including all five `check:*` release gates and both production-mutation tools, are compiled only by `tsx`, which strips types without checking them. Compiling the tree under the project's own strict settings surfaces 12 genuine violations, including unguarded regex-capture indexing in `delete-user.ts` and `heal-poisoned-stats.ts`.
- **Why it matters:** This is the highest-consequence code in the repo by blast radius per line — `delete-user.ts`/`heal-poisoned-stats.ts` issue deletes against production Supabase/Redis, and the `check:*` scripts decide release safety. The project has already been burned twice by exactly this class of failure (#1052, #1008).
- **Recommendation:** Add a root `tsconfig.scripts.json`, wire it into `typecheck`, add a root ESLint config, fix the 12 errors, and add `scripts/**` to `vitest.config.ts`'s coverage include.
- **Regression risk:** Adding coverage measurement moves the global denominator against the 75/70/65/75 floor — measure before wiring in, or use a separate per-path floor.
- **Expected impact:** The release gates and production-mutation tools gain the same compile-time guarantees as the rest of the codebase.
- **Effort estimate:** M

#### AR-M1 `tsconfig.madge.json` uses two options TypeScript 7 removes, silently jeopardizing the `check:circular` gate
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `tsconfig.madge.json:4,9`, `package.json:32`, `.github/workflows/ci.yml:31`
- **What's happening:** `baseUrl` and `moduleResolution: "node"` are both deprecated and will stop functioning in TypeScript 7 (already published, project on 6.0.3, no open tracking issue). Madge already silently *skips* unresolvable imports rather than erroring — confirmed today with an unrelated skipped import while still reporting a green "no circular dependency" result.
- **Why it matters:** When TypeScript is bumped, the most likely outcome is not a red CI job but a green one that has stopped examining most of the graph.
- **Recommendation:** Express `paths` relative to the config file; switch `moduleResolution` to `"bundler"`; verify by deliberately introducing a cycle and confirming the detector fires.
- **Regression risk:** Madge's resolver is not `tsc` — confirm `"bundler"` actually resolves `@/*` under madge before trusting the change; do not silence with `ignoreDeprecations`.
- **Expected impact:** The no-circular-dependency invariant survives the TypeScript 7 upgrade instead of quietly ceasing to be checked.
- **Effort estimate:** S

#### AR-M2 Repo-root scripts reach into `apps/web/lib/**` internals by relative path, with no boundary rule guarding the seam
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `scripts/heal-poisoned-stats.ts:62`, `scripts/backfill-parsers.ts:8-9`, `scripts/lib/print-default-prompt.ts:8`, `scripts/generate-badge-reference.test.ts:14-16`, `apps/web/eslint.config.mjs:94-102`
- **What's happening:** Six imports cross from `scripts/` into `apps/web/lib/**` by relative path, most consequentially `heal-poisoned-stats.ts` importing `isPoisonedStats`/`isScopeBlindedStats` from `stats-integrity.ts` — the module carrying the codebase's tightest coverage floor. The existing `@chapa/shared` boundary rule doesn't apply to this direction.
- **Why it matters:** A refactor inside `stats-integrity.ts` that keeps `apps/web` and CI green can silently change what the maintenance script classifies as poison, with nothing typechecking or linting the script to catch it.
- **Recommendation:** Promote the shared predicates into `@chapa/shared` (they're pure functions over `StatsData`), or make the coupling explicit via a `no-restricted-imports` allowlist.
- **Regression risk:** Moving the predicates requires retargeting the coverage floor to the new path in the same change, or the gate silently stops protecting the module.
- **Expected impact:** The dependency from production-mutation tooling onto the integrity guards becomes an explicit, checked contract.
- **Effort estimate:** M

#### AR-M3 `packages/shared` build step exists and works, but is never invoked — and two architecture documents still describe it as absent
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `packages/shared/package.json:6-7,14`, `packages/shared/tsconfig.build.json:1-13`, `package.json:7`, `docs/accepted-risks.md:200-205`, `docs/decisions/2026-06-20-package-extraction-roadmap.md:72-79,97-99`
- **What's happening:** The build script works cleanly when run directly, but nothing in the repo invokes it — root `build` filters to `@chapa/web` only. Meanwhile `accepted-risks.md` and the package-extraction ADR both still assert the build step doesn't exist, even though its own stated blocker has been cleared.
- **Why it matters:** An unexercised build rots silently. More importantly, a stale entry in the file CLAUDE.md designates as the source of truth for what's intentional actively misleads future reviewers.
- **Recommendation:** Wire the build into the root script or a CI step; correct both documents to reflect the resolved state.
- **Regression risk:** Do not flip `main`/`types` to `dist/` — every consumer resolves `src/` today via `transpilePackages`, and switching introduces a staleness class that trade-off was correctly designed to avoid.
- **Expected impact:** The build path gains a regression signal; architecture docs describe the system as it actually is.
- **Effort estimate:** S

#### AR-M4 Identical env-bootstrap and config blocks duplicated across the two production-mutation scripts, with no shared module for `scripts/`
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `scripts/delete-user.ts:92-113`, `scripts/heal-poisoned-stats.ts:137-158`, `scripts/lib/`
- **What's happening:** `delete-user.ts` and `heal-poisoned-stats.ts` contain byte-identical credential-loading and config code, including the same latent strict-mode violations noted in AR-H1.
- **Why it matters:** These are the two scripts that delete production data. A safety fix applied to one silently does not apply to the other, and nothing automated currently flags the divergence.
- **Recommendation:** Extract into `scripts/lib/env.ts`, imported by both.
- **Regression risk:** Both scripts are dry-run-by-default with companion tests exercising the pure helpers — confirm the dry-run/apply gating and env-override precedence survive extraction unchanged.
- **Expected impact:** One place to fix credential-loading and safety behavior for both production-mutation tools.
- **Effort estimate:** S

#### AR-L1 `apps/web/hooks/` sits outside the module map and outside coverage measurement despite being fully tested
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/hooks/` (7 modules), `vitest.config.ts:21-26`
- **What's happening:** 7 hooks with real fan-in (including `useSession`, which gates owner-only UI) all have running tests, but the directory sits outside `coverage.include` and outside CLAUDE.md's ownership map.
- **Why it matters:** A measurement gap, not a testing gap — but an invisible one, following from directory placement rather than a documented decision.
- **Recommendation:** Add `apps/web/hooks/**` to `coverage.include`; add the directory to CLAUDE.md's ownership map.
- **Regression risk:** Measure the effect on the global coverage denominator in the same change.
- **Expected impact:** Seven fan-in-heavy hooks enter the coverage gate they're already tested for.
- **Effort estimate:** S

#### AR-L2 CLAUDE.md's module ownership map covers half the `lib/` subsystems
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `CLAUDE.md:177` ("Code ownership areas"), `apps/web/lib/email/`, `lib/effects/`, `lib/insights/`, `lib/agents/`, `lib/verification/`, `lib/campaigns/`, `lib/analytics/`
- **What's happening:** 14 of 28 `lib/` subdirectories are unmapped, including `lib/verification` (implements badge-verification HMAC, goal #6) and `lib/analytics/server-errors.ts` (56 importers, the #3 fan-in module in the codebase).
- **Why it matters:** CLAUDE.md directs readers to "go directly to these paths — never search for them"; a half-complete map fails quietly for exactly the tasks it exists to route.
- **Recommendation:** Extend the table, prioritizing `lib/verification`, `lib/analytics`, `lib/email`, `lib/insights`.
- **Regression risk:** None to runtime behavior — documentation only.
- **Expected impact:** The documented module map matches the actual module structure.
- **Effort estimate:** S

#### AR-L3 Orphaned doc with an untypeable non-ASCII filename, and a tracked coverage artifact
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `docs/evolving-developer-metrics-in-the-ai‑assisted-era.md:1` (filename itself is the defect), `coverage-self-agent/coverage-summary.json:1`
- **What's happening:** The doc filename contains a non-breaking hyphen (U+2011) instead of ASCII, with zero inbound references anywhere in the repo. Separately, a coverage-output artifact is tracked in git, unlike the correctly-gitignored `coverage/`.
- **Why it matters:** An untypeable filename cannot be reliably linked; a tracked coverage snapshot will be misread as current.
- **Recommendation:** `git mv` the doc to an ASCII filename and link it, or delete if superseded; confirm with the owner whether the coverage artifact is intentionally tracked.
- **Regression risk:** Grep the full tree including untracked report files before renaming — external links could reference the current name.
- **Expected impact:** Documentation is reachable by its own name.
- **Effort estimate:** S

#### AR-S1 Two major dev-tooling upgrades are due with no open tracking, and one of them breaks a CI gate
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `packages/shared/package.json:19-21`, `apps/web/package.json` (devDependencies), `tsconfig.madge.json:4,9`
- **What's happening:** ESLint 10 and TypeScript 7 are both due with zero open tracking issues (ESLint 10's #531 is closed while the dep remains on 9). Runtime dependency health is otherwise genuinely good — zero major drift on anything shipped to users.
- **Why it matters:** The TypeScript 7 bump is the exact trigger for AR-M1's silent gate degradation; taking it as part of a routine batched update would make that easy to miss.
- **Recommendation:** File tracking issues for both; sequence AR-M1's fix before the TypeScript bump; take ESLint 10 as its own isolated PR verifying all four `no-restricted-syntax` selectors still fire.
- **Regression risk:** A green CI run after a batched bump is weak evidence if the gates themselves changed behavior — verify gates fire, don't just observe green.
- **Expected impact:** Both upgrades happen deliberately instead of as a side effect of a batched bump.
- **Effort estimate:** L

---

## 10. Testing / QA Findings (QA / Reliability Lead)

**Headline results:** Total tests: **8,770** across 518 test files. **Pass rate: 100%** (0 failed, 0 skipped), confirmed on two independent full runs. `pnpm run typecheck` and `pnpm run lint` both clean. Coverage: **96.62%/92.49%/95.84%/97.91%** (stmt/branch/fn/line), all thresholds passing. Both configured per-path floors genuinely exceeded, not merely met (`lib/impact/**` at 99.6/98.7/100/99.5 vs. a 95/90/95/95 floor; `stats-integrity.ts` at 100/100/100/100 vs. 90/85/90/90). Not included: 30 contract-test files (separate lane, requires local Supabase) and 13 Playwright specs.

#### QA-H1 Test suite is order-dependent — 16-25 tests across 12 files fail under shuffled execution
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/bitbucket/stats.test.ts:28`, `apps/web/app/icons.render.test.tsx:42`, `apps/web/lib/auth/resolve-request-auth.test.ts:87`, `apps/web/components/PostHogProvider.render.test.tsx:62`, `apps/web/lib/auth/oauth-state.redis.test.ts:40`, `vitest.config.ts:5-17`
- **What's happening:** `vitest run --sequence.shuffle` fails 16-25 tests across 3 tested seeds, reproducing deterministically and even in single-file isolation. Root cause: no mock-clearing config default, and 108 of 282 mock-using test files contain no mock-clearing call. Concrete example: an assertion that a mock "was not called" passes only because of declaration order, not because the guard it protects is correct.
- **Why it matters:** These assertions do not test what their names claim — the highest-leverage class of false confidence in an otherwise very strong suite, sitting on real guards including auth token rejection and OAuth state single-consume. Doesn't break CI today because sharding splits by file, keeping within-file order stable — precisely why it's gone unnoticed.
- **Recommendation:** Fix per-file (a blanket `clearMocks: true` config change was empirically tested and makes things worse — 41 failures — because many files rely on `beforeAll` setup); add `beforeEach(() => vi.clearAllMocks())` to the 12 implicated files first, then work through the remaining 108 incrementally. Add a nightly shuffled CI lane to prevent regression.
- **Regression risk:** Moving setup from `beforeAll` to `beforeEach` will surface further latent dependencies as genuine (not new) failures. No production code changes.
- **Expected impact:** Assertions start proving what they claim; a shuffled CI lane makes this class of defect self-reporting.
- **Effort estimate:** M

#### QA-M1 Contract tests — the project's own Seam-Bug Standard suite — do not run in `pnpm run test` or pre-commit
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `vitest.config.ts:15`, `.husky/pre-commit:20`, `.github/workflows/ci.yml:346`
- **What's happening:** The 30 contract-test files — including payload-matrix suites for every write endpoint — are excluded from the default lane and run only in CI's `contract` job. CLAUDE.md's own instruction to "run the full test suite locally before pushing" doesn't actually cover them.
- **Why it matters:** A change that breaks a durable-write contract passes typecheck, lint, all 8,770 tests, and pre-commit, and is caught minutes later in CI at best.
- **Recommendation:** Add a `pre-push` hook that runs the contract lane when a local Supabase stack is detected, and skips loudly (not silently) when it isn't — not pre-commit, which would get bypassed if it required a running database on every commit.
- **Regression risk:** Low — a loudly-skipping hook cannot block work.
- **Expected impact:** The documented workflow becomes actually true; seam regressions are caught locally.
- **Effort estimate:** S

#### QA-M2 Per-path coverage floors guard 2 modules; the other high-blast-radius modules fall back to a floor ~25 points below actual
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `vitest.config.ts:48-90`
- **What's happening:** The config's own stated rationale — the global floor is far below measured coverage, so a regression could gut a critical module without failing CI — is applied to only 2 of many high-blast-radius modules. `lib/auth/**`, `lib/cache/**`, `lib/profile/**`, `lib/db/**`, `app/api/**` all measure 93-100% but are guarded only by the 75/70/65/75 global floor.
- **Why it matters:** Deleting the entire test file for the durable-write saga, the fail-open/fail-closed rate limiter, or any OAuth callback handler would leave global numbers well above the floor and CI green.
- **Recommendation:** Extend the existing per-path block with floors for the 5 named subsystems, set a few points under measured (matching the calibration already used for the 2 existing entries).
- **Regression risk:** Set floors too tight and a legitimate refactor trips them, training developers to override — calibrate with the same margin already proven on the 2 existing entries.
- **Expected impact:** The anti-regression guarantee the config already articulates extends to the rest of the critical path.
- **Effort estimate:** S

#### QA-M3 Journey E2E silently skips on missing env, and CI writes "passed" release evidence from a fully-skipped run
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/e2e/journey.spec.ts:6-10,39`, `.github/workflows/ci.yml:349,355-390`
- **What's happening:** A fully-skipped Playwright run exits 0; the evidence generator derives `STATUS="passed"` purely from step outcome, emitting a release-evidence artifact certifying two scenarios that never executed a single assertion.
- **Why it matters:** A green artifact that certifies scenarios which never ran is worse than a missing one, since the release process consumes it as evidence.
- **Recommendation:** Gate evidence-writing on the executed-test count being greater than zero, not on exit code.
- **Regression risk:** Low — confined to CI wiring; worst case is a job that fails when it should skip, which is the safe direction.
- **Expected impact:** Release evidence reflects executed assertions rather than an exit code.
- **Effort estimate:** S

#### QA-M4 1,898 assertions across 136 files test source text rather than behavior
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/u/[handle]/page.test.ts:5-20,122`, plus 135 further files
- **What's happening:** 136 test files `readFileSync` their own source and pattern-match against the string; some (like the share page's h1 test) perform zero rendering. 83 of 136 have a behavioral sibling covering the same ground — largely duplicative rather than the sole guard.
- **Why it matters:** Where no behavioral sibling exists, false confidence; more corrosively, these break on any refactor that changes nothing observable, training the team to treat failures as noise.
- **Recommendation:** Triage, don't bulk-delete — where a behavioral sibling exists, delete the duplicate; where it doesn't, convert to a render-and-query assertion.
- **Regression risk:** Deleting a source-text assertion that's the only guard for a property silently removes coverage — identify the behavioral sibling before each deletion.
- **Expected impact:** Test failures start meaning "behavior changed" rather than "text moved."
- **Effort estimate:** L

#### QA-L1 Playwright retries mask flakes with no detection or reporting
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/playwright.config.ts:25`
- **What's happening:** `retries: 2` in CI with no flaky-count surfaced anywhere.
- **Why it matters:** The first visible symptom of an accumulating flake problem is a job that fails all three attempts, by which point the cause is much older.
- **Recommendation:** Add `--fail-on-flaky-tests` on the nightly prod-probe lane only, not PR runs.
- **Regression risk:** Low, provided it stays off PR runs.
- **Expected impact:** Flake accumulation becomes observable before it becomes a hard failure.
- **Effort estimate:** S

#### QA-L2 `fetchWithRetry` retries 5xx responses but not transient network-level throws
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/utils/fetch-retry.ts:41-64`, plus all four platform query modules
- **What's happening:** No `try`/`catch` around the `fetch` call itself, so a rejected fetch (connection reset, DNS failure, timeout abort) propagates on the first attempt with no retry.
- **Why it matters:** Bounded impact — callers already handle the throw and serve last-known-good cache — but costs an unnecessary 6h staleness window on what a single retry would have fixed.
- **Recommendation:** Wrap in `try`/`catch`; retry on throw except `AbortError` from the timeout signal (retrying that would double worst-case latency against the badge SLO).
- **Regression risk:** The `AbortError` carve-out is not optional given the 3000ms cache-miss budget.
- **Expected impact:** Transient network blips stop costing a full staleness cycle.
- **Effort estimate:** S

#### QA-L3 No regression test asserts confidence is excluded from public JSON-LD
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/u/[handle]/page.tsx:223-234`, `apps/web/app/u/[handle]/page.test.ts:122`, `apps/web/lib/jsonld.test.ts`
- **What's happening:** The only related assertion checks that a function call exists in the source text, not what the resulting object contains. Nothing fails if `confidence` were added to `personJsonLd`.
- **Why it matters:** The one place QA-M4's source-text pattern is load-bearing rather than duplicative, protecting a deliberate privacy boundary that's durable and public once leaked (JSON-LD is search-engine-consumed).
- **Recommendation:** Add a behavioral test asserting `confidence`/`confidenceReasons` are absent from the rendered `application/ld+json` script content.
- **Regression risk:** Low — test-only if done via the existing render-test sibling.
- **Expected impact:** A documented privacy boundary gains an actual guard.
- **Effort estimate:** S

---

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

**Verified as compliant, not reported as findings:** `prefers-reduced-motion` handled thoroughly (global override + explicit kill list + per-component utilities); zero hardcoded hex in `components/**`; no icon libraries, no `Inter`/`Roboto`, no italic monospace; `rounded-full` never on CTAs; all decorative SVGs `aria-hidden`; no `onClick` on unlabeled divs; global focus-visible ring; correct modal focus trapping; visible body copy fully routes through `t()`.

#### UX-H1 Platform OAuth failures redirect to a page that renders no error, producing a silent failure
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/lib/auth/platform-oauth.ts:264-342`, `apps/web/app/u/[handle]/page.tsx:92-97`, `apps/web/app/LandingUrlEffects.tsx:42-47`
- **What's happening:** Every platform-OAuth failure branch (6 codes × 3 providers) redirects to the user's own share page with `?error=...`, but the share page never reads that param, and the only `ErrorBanner` consumer is mounted on the landing page only. A failed "Connect GitLab" click lands the user back on their share page with no message at all. Blast radius is gated on the three providers' feature flags, disabled by default per CLAUDE.md.
- **Why it matters:** A user-initiated action failing with zero feedback is the worst class of UX failure — account linking is a trust-establishing moment that directly changes badge content.
- **Recommendation:** Mount an error-surfacing leaf on the share page (client-side, mirroring `LandingUrlEffects`'s proven `useSyncExternalStore` pattern); extend the error-message map with platform-aware copy.
- **Regression risk:** A server-side `searchParams` read on the share page can opt it further out of ISR — prefer the client-side pattern specifically built to avoid that (#982).
- **Expected impact:** Account-linking failures become recoverable instead of invisible.
- **Effort estimate:** S

#### UX-H2 Generation screen has no timeout, no elapsed feedback, and collapses every failure mode into one generic message
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/generating/[handle]/GeneratingProgress.tsx:50-86,196-209`
- **What's happening:** A single fetch with no `AbortSignal.timeout` and no cancel affordance; if the request stalls at the network layer, neither the error branch nor the catch ever runs — the user is pinned indefinitely. `!res.ok` collapses 429/401/5xx into one message, and the 401 case offers a same-URL "retry" that will fail identically every time since it doesn't re-authenticate.
- **Why it matters:** This is the single screen between OAuth consent and first sight of the badge — the narrowest point of the funnel and the highest-abandonment-risk moment. A cold-cache generation is routinely multi-second, so long waits are the normal case.
- **Recommendation:** Add a timeout sized from observed p99 of `/api/generate`; show elapsed-time feedback; branch on status (429 → try-later copy, 401 → sign-in-again link, 5xx → generic).
- **Regression risk:** A too-aggressive timeout would abort legitimately-slow first generations for large contribution histories — size from real p99, not the badge SLO.
- **Expected impact:** No unbounded hangs on the primary onboarding path.
- **Effort estimate:** M

#### UX-H3 Systemic i18n gap: ~15 user-facing strings bypass the dictionary on a Spanish-default site
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/terminal/TerminalInput.tsx:123-124`, `apps/web/app/layout.tsx:163`, `apps/web/lib/auth/error-messages.ts:20-33`, `apps/web/components/BadgeOverlay.tsx:316-317,345`, plus 8 further files
- **What's happening:** Despite thorough dictionary coverage of visible body copy (650+ keys, CI parity gate), several strings never got wired in — most visibly the terminal input's placeholder (the primary interaction affordance on landing/Studio/share) and the badge overlay's desktop panel headings (raw English "ARCHETYPE"/"HEATMAP" above fully-translated Spanish tooltip bodies). All 5 OAuth error messages are English literals. The skip link — rendered outside `LanguageProvider`, the first thing a keyboard/screen-reader user encounters — is hardcoded English, as are 5 route-loading `aria-label`s.
- **Why it matters:** The project treats bilingual support as first-class (a whole route-segmentation migration in #1023 to eliminate a flash); against that bar, an English placeholder on the main input and English badge-overlay headings are a visible quality break for the default-locale majority.
- **Recommendation:** Add the missing keys to both dictionaries (parity test enforces completeness). **Critical ordering constraint:** switch the `TerminalInput` selector to a stable `data-testid` *before* translating its `aria-label` — four separate files use that exact English string as a CSS selector for focus routing (see FE-L1) and translating first silently breaks keyboard shortcuts.
- **Regression risk:** The `querySelector` coupling is the sharp edge — sequencing matters. Hoisting `LanguageProvider` above the skip link touches the root layout; verify it doesn't force the layout out of static rendering.
- **Expected impact:** The default-locale experience becomes consistent end to end, including the first keyboard stop and a login failure.
- **Effort estimate:** M

#### UX-M1 Badge overlay's desktop tooltip panel deviates from the mandated portal-rendered tooltip pattern
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/BadgeOverlay.tsx:302-322`, `apps/web/app/u/[handle]/page.tsx:263-266`
- **What's happening:** Same underlying issue as FE-M3, from the design-system-compliance angle. Four other components correctly use the portal pattern; the badge overlay's desktop panel does not, sitting inside a transformed, animated ancestor with no flip guard.
- **Why it matters:** This is the one place the project's most emphatically-stated UI invariant doesn't hold, on its most prominent interactive surface — panels near the badge's top edge can clip above the viewport fold with no fallback.
- **Recommendation:** Either portal the panel and draw the leader line from a body-level fixed SVG overlay, or document it as a deliberate, bounded exception in `docs/accepted-risks.md` with an added top-edge flip.
- **Regression risk:** Portaling breaks the shared `viewBox` coordinate space between panel and leader line unless both move to the same coordinate system — a wide visual regression surface (11 hotspots × 2 anchor modes).
- **Expected impact:** The invariant holds everywhere, or the exception is documented so it isn't re-litigated.
- **Effort estimate:** M

#### UX-M2 Terminal input font-size triggers iOS Safari auto-zoom on the primary interaction surface
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** `apps/web/components/terminal/TerminalInput.tsx:109,115-127`
- **What's happening:** The input inherits a 14px computed font-size; iOS Safari auto-zooms any focused control below 16px and doesn't zoom back out on blur.
- **Why it matters:** The terminal input is the signature interaction of the product, appearing on landing, Studio, and the share page — on iPhone, tapping it zooms the page and leaves the user zoomed into a horizontally-scrolled layout on first interaction.
- **Recommendation:** Set an explicit ≥16px font-size on the input for small viewports only, keeping the 14px terminal look on desktop.
- **Regression risk:** Must keep the prompt and input baselines aligned if their sizes diverge.
- **Expected impact:** Removes a first-touch impression of brokenness on the highest-traffic device class.
- **Effort estimate:** S

#### UX-M3 The share page — the product's most-shared artifact — is the one page still locale-flashing after #1023
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/u/[handle]/page.tsx:1,95-96,104-110`
- **What's happening:** Locale resolution is a hardcoded `"es"` literal (not even `DEFAULT_LOCALE`) with no cookie/`Accept-Language` consideration, corrected client-side post-hydration — exactly the flash pattern #1023 fixed for 9 lower-traffic pages, but the share page falls outside both that migration's scope and the accepted-risk's stated residual.
- **Why it matters:** The share page is the artifact the product exists to produce and the most likely first-ever impression from an inbound visitor — the prioritization of what got fixed is inverted relative to value.
- **Recommendation:** Apply the proven `[locale]` route-segment + proxy-matcher pattern from #1023, or at minimum replace the `"es"` literal with the `DEFAULT_LOCALE` constant.
- **Regression risk:** Materially higher than the original migration — this route is dynamic per handle so `generateStaticParams` can't enumerate it; doubling the ISR cache key space by locale pressures the badge/share latency budget directly.
- **Expected impact:** The primary shared page renders correct copy on first paint for both locales.
- **Effort estimate:** L

#### UX-M4 Insight cards duplicate their entire visible text into `aria-label`, causing double announcement
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/dashboard/InsightCard.tsx:235,272,311,377,405`
- **What's happening:** All five card variants set `aria-label` to the exact concatenation of the headline and body they also render as visible children — a screen reader announces the content twice.
- **Why it matters:** Insight cards are the dashboard's interpretive layer; hearing every insight twice across up to five cards makes the highest-value content the most tedious to consume.
- **Recommendation:** Drop the `aria-label`; let visible content provide the accessible name, or use `role="group"` + `aria-labelledby` pointing at the headline only.
- **Regression risk:** Update any render tests asserting via `getByLabelText(headline + body)`.
- **Expected impact:** Dashboard insights are announced once.
- **Effort estimate:** S

#### UX-M5 Generation progress live region re-announces all four steps on every state change
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/generating/[handle]/GeneratingProgress.tsx:113-117,31-47`
- **What's happening:** A single `aria-live="polite"` region wraps all four step rows; three transitions fire in 300ms succession, producing a rapid burst covering the whole list rather than one announcement per step.
- **Why it matters:** A mandatory onboarding waypoint's key reassurance signal becomes a burst of repeated text a screen-reader user can't skip.
- **Recommendation:** Move the live region to a single visually-hidden status line updated once per transition; mark the visual step list `aria-hidden`.
- **Regression risk:** Keep `data-step`/`data-status` attributes intact for existing render-test assertions; confirm the separate error `role="alert"` still announces.
- **Expected impact:** One clear spoken update per real step.
- **Effort estimate:** S

#### UX-L1 Global error boundary is dark-only and declares `lang="en"` on bilingual content
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/app/global-error.tsx:33,36-37`
- **What's happening:** Hardcoded dark-palette inline colors mean a light-mode user's fatal error renders as a full-screen black page; `lang="en"` wraps genuinely bilingual copy ("Algo salió mal / Something went wrong").
- **Why it matters:** Small, but this is the last thing a user sees before abandoning — the theme inversion undercuts the "something recoverable happened" framing.
- **Recommendation:** Use an inline `prefers-color-scheme` `<style>` block (available without Tailwind); wrap each language's text with its own `lang` span, or match `lang` to `DEFAULT_LOCALE`.
- **Regression risk:** Minimal — the file is deliberately isolated and imports nothing but React.
- **Expected impact:** The fatal-error page stops fighting the user's theme.
- **Effort estimate:** S

#### UX-L2 Eleven badge hotspots are `role="group"` with `tabIndex={0}`, adding non-widget stops to the share page tab order
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/BadgeOverlay.tsx:329-346,47-208`
- **What's happening:** 11 structural (non-widget) elements are in the keyboard tab order; the information they carry is already exposed via always-present `sr-only` descriptions.
- **Why it matters:** A keyboard user passes 11 silent, non-actionable stops before reaching the page's real actions (toolbar, embed snippet).
- **Recommendation:** Drop `tabIndex={0}` — the `sr-only` descriptions already expose the content to assistive tech in reading order.
- **Regression risk:** `onFocus`/`onBlur` currently drive the leader-line reveal for keyboard users — confirm the `sr-only` path is genuinely sufficient before removing.
- **Expected impact:** Faster keyboard traversal to the page's real actions.
- **Effort estimate:** S

#### UX-L3 Author attribution pill is a `<button>` that does nothing
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** `apps/web/components/AuthorTypewriter.tsx:167-204`
- **What's happening:** A `<button>` with `cursor-default` and no `onClick`; the popover it fronts opens purely via CSS hover/focus-within, so Enter/Space on the "button" does nothing.
- **Why it matters:** Cosmetic, low-traffic — a control that announces as actionable and isn't is a small trust cost for assistive-tech users.
- **Recommendation:** Either wire Enter/Space to toggle a sticky-open state, or change the element to a focusable `<span>`.
- **Regression risk:** Very low — confirm the component is never rendered inside a `<form>` before dropping the implicit `type="button"` guard.
- **Expected impact:** Button semantics match button behavior.
- **Effort estimate:** S

---

## 12. Prioritized Action Plan

| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|---|---|---|---|---|---|---|
| BE-H1 | BE | Persist-boundary gate on 1 of 4 writers | high | Before launch | S | Prevents recurrence of #1003 poisoned snapshots |
| BE-H2 | BE | Resend dedup key set before delivery succeeds | high | Before launch | S | Recovers currently-lost support emails |
| BE-H3 / SE-H1 | BE/SE | CLI device_code clobbered at approval | high | Before launch | S | Closes a 90-day-token theft path |
| BE-H4 | BE | Unpaginated Supabase selects truncate at 1000 rows | high | Before launch | M | Fixes campaign completion + cron coverage |
| DO-H1 | DO | No external uptime monitor | high | Before launch | S | Outage MTTD ~24h → minutes |
| DO-H2 | DO | Unset alert webhook silently disables all alerting | high | Before launch | S | Closes the #1052-shaped blind spot |
| DO-H3 | DO | Vercel dashboard state unverified | high | Before launch | M | Closes the #1052 class, not just the instance |
| PE-H1 | PE | Badge miss path has no end-to-end deadline (~34s vs 3000ms) | high | Before launch | M | Bounds worst-case badge latency |
| PE-H2 | PE | Overlay fetch serialized after GitHub fetch | high | Before launch | M | Removes up to 8s from miss path |
| FE-H1 | FE | Wrong canonical URL on 12 pages | high | Before launch | S | Restores content-SEO indexability |
| FE-H2 | FE | Share page dynamic despite ISR intent | high | Before launch | M | Fixes caching or locale/session correctness |
| QA-H1 | QA | Suite is order-dependent (16-25 tests) | high | Before launch | M | Removes false-confidence assertions |
| UX-H1 | UX | Silent OAuth linking failure | high | Before launch | S | Recoverable account-linking errors |
| UX-H2 | UX | Generation screen can hang indefinitely | high | Before launch | M | Removes onboarding-funnel dead end |
| UX-H3 | UX | ~15 strings bypass i18n on Spanish-default site | high | Before launch | M | Consistent default-locale experience |
| AR-H1 | AR | scripts/ invisible to typecheck/lint/coverage | high | Before launch | M | Guards release gates + prod-mutation tools |
| DO-M7 | DO | No durable log retention configured | medium | Before launch | S | Makes incidents investigable |
| DO-M1 | DO | No alert dedup/throttling | medium | Before launch | M | Keeps alert channel usable during incidents |
| DO-M2 | DO | warm-cache rotation can wedge on timeout | medium | Before launch | M | Prevents silent permanent staleness |
| DO-M3 | DO | No Node version pinning | medium | Before launch | S | Tested/prod environments verifiably match |
| DO-M4 | DO | Missing workflow permissions + token injection | medium | Before launch | S | Bounds CI credential blast radius |
| DO-M5 | DO | Secret-rotation runbook omits top 3 credentials | medium | Before launch | S | Procedure for highest-consequence secrets |
| BE-M1 / SE-M1 | BE/SE | Telemetry rate limit bypass | medium | Before launch | S | Closes unbounded analytics-sink write |
| BE-M2 / PE-M1 | BE/PE | Avatar failure permanently blocks SVG caching | medium | Before launch | S | Restores cache-hit economics |
| BE-M4 | BE | Challenge endpoint reports success on email failure | medium | Before launch | S | Users learn disputes actually failed |
| PE-M2 | PE | warm-cache never renders badge SVG | medium | Before launch | M | Removes daily rollover cold miss |
| PE-M3 / DO-M6 | PE/DO | Latency monitor misclassifies + undersamples | medium | Before launch | S/M | Makes the SLO alert trustworthy |
| PE-M4 | PE | ~15 unbounded Redis reads on miss path | medium | Before launch | M | Bounds Redis contribution to p99 |
| FE-M1 | FE | Confidence data leaks into RSC payload | medium | Before launch | M | Owner-only guarantee becomes real |
| FE-M2 | FE | Share-page shortcuts inert until summoned | medium | Before launch | S | Cheat sheet works from first paint |
| FE-M3 / UX-M1 | FE/UX | Badge overlay tooltip breaks portal mandate | medium | Before launch | M | Invariant holds or is documented |
| FE-M4 | FE | Session fetch failure cached as permanent logout | medium | Before launch | S | Transient failures stop looking permanent |
| QA-M1 | QA | Contract tests don't run pre-push | medium | Before launch | S | Seam bugs caught locally |
| QA-M2 | QA | Coverage floors guard 2 of ~7 critical modules | medium | Before launch | S | Anti-regression extends to critical path |
| QA-M3 | QA | Journey E2E skip reported as "passed" | medium | Before launch | S | Release evidence reflects reality |
| UX-M2 | UX | Terminal input triggers iOS auto-zoom | medium | Before launch | S | Fixes primary interaction on mobile |
| AR-M1 | AR | madge config uses TS7-deprecated options | medium | Before launch | S | Circular-dep gate survives TS7 upgrade |
| AR-M2 | AR | scripts/ reach into stats-integrity by relative path | medium | Before launch | M | Makes an implicit dependency explicit |
| FE-L4 | FE | /about/verification missing from sitemap | low | Before launch | S | Closes proxy/sitemap drift |
| PE-M5 | PE | svgToPng blocks event loop | medium | After launch | M | Removes cross-route latency stall |
| PE-M6 | PE | Share page awaits durable write in render path | medium | After launch | S | Removes unnecessary TTFB cost |
| FE-M5 | FE | i18n dictionary serialized twice | medium | After launch | M | Halves i18n share-page payload |
| UX-M3 | UX | Share page still locale-flashes | medium | After launch | L | Fixes highest-value page's first paint |
| UX-M4 | UX | Insight cards double-announce content | medium | After launch | S | Halves screen-reader traversal time |
| UX-M5 | UX | Generation progress over-announces | medium | After launch | S | One clear update per step |
| AR-M3 | AR | packages/shared build never invoked | medium | After launch | S | Build path gains a regression signal |
| AR-M4 | AR | Duplicated credential-loading code | medium | After launch | S | One place to fix prod-mutation safety |
| BE-M3 | BE | Snapshot day-guard blocks retry on failure | medium | After launch | S | Self-heals same day instead of next cron |
| BE-M5 | BE | Read-only profile endpoint still fetches GitHub | medium | After launch | M | Bounds unauthenticated API consumption |
| QA-M4 | QA | 1,898 source-text test assertions | medium | After launch | L | Test failures mean behavior changed |
| *(remaining low/strategic items)* | — | See Section 14 | low/strategic | After launch / Later | S-L | Incremental hardening |

---

## 13. Top 10 Highest-ROI Improvements

1. **BE-H1** — Fixes the exact mechanism that already poisoned production data once, for a few hours of work.
2. **DO-H2** — A one-line silent-failure gap in the system that exists specifically to catch silent failures.
3. **BE-H3 / SE-H1** — Closes an active token-theft path, independently discovered by two specialists, fixable in an afternoon.
4. **DO-H1** — Cuts worst-case outage detection time from ~24 hours to minutes for the cost of a free-tier third-party monitor.
5. **PE-H1** — Turns an unenforced "aspirational" SLO into a real one; the fallback mechanism it needs already exists in the codebase.
6. **FE-H1** — A five-line metadata fix that restores SEO indexability to 12 built, deployed, currently-invisible pages.
7. **UX-H1** — Converts a currently-invisible account-linking failure into a recoverable one using a pattern already proven elsewhere in the codebase.
8. **QA-H1** — Restores the truth value of security-relevant test assertions (auth token rejection, OAuth state consumption) that currently pass partly by declaration order.
9. **UX-H2** — Removes an indefinite-hang failure mode from the single narrowest point of the onboarding funnel.
10. **PE-H2 / BE-H4** — Two independent, moderate-effort fixes with outsized effect: PE-H2 removes up to 8 seconds from the badge miss path for linked-platform users; BE-H4 fixes silent data corruption in campaign completion tracking past 1,000 rows.

---

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)
- AR-H1: scripts/ invisible to typecheck, lint, coverage
- AR-M1: madge config uses TS7-deprecated options
- AR-M2: scripts/ reach into stats-integrity by relative path
- FE-H1: Wrong canonical URL on 12 pages
- FE-H2: Share page dynamic despite ISR intent
- FE-M1: Confidence data leaks into RSC payload
- FE-M2: Share-page keyboard shortcuts inert until summoned
- FE-M3: Badge overlay tooltip breaks portal mandate
- FE-M4: Session fetch failure cached as permanent logout
- FE-L4: /about/verification missing from sitemap
- BE-H1: Persist-boundary gate on 1 of 4 writers
- BE-H2: Resend dedup key set before delivery succeeds
- BE-H3: CLI device_code clobbered at approval
- BE-H4: Unpaginated Supabase selects truncate at 1000 rows
- BE-M1: Telemetry rate limit bypass
- BE-M2: Avatar failure permanently blocks SVG caching
- BE-M4: Challenge endpoint reports success on email failure
- PE-H1: Badge miss path has no end-to-end deadline
- PE-H2: Overlay fetch serialized after GitHub fetch
- PE-M1: Avatar-absent handle never cache-hits
- PE-M2: warm-cache never renders badge SVG
- PE-M3: Latency monitor misclassifies stale/poll as hits
- PE-M4: ~15 unbounded Redis reads on miss path
- DO-H1: No external uptime monitor
- DO-H2: Unset alert webhook silently disables alerting
- DO-H3: Vercel dashboard state unverified
- DO-M1: No alert dedup/throttling
- DO-M2: warm-cache rotation can wedge on timeout
- DO-M3: No Node version pinning
- DO-M4: Missing workflow permissions + token injection
- DO-M5: Secret-rotation runbook omits top 3 credentials
- DO-M7: No durable log retention configured
- SE-H1: CLI device_code clobbered at approval (security angle)
- SE-M1: Telemetry rate limit bypass (security angle)
- QA-H1: Suite is order-dependent
- QA-M1: Contract tests don't run pre-push
- QA-M2: Coverage floors guard 2 of ~7 critical modules
- QA-M3: Journey E2E skip reported as "passed"
- UX-H1: Silent OAuth linking failure
- UX-H2: Generation screen can hang indefinitely
- UX-H3: ~15 strings bypass i18n on Spanish-default site
- UX-M1: Badge overlay tooltip breaks portal mandate (UX angle)
- UX-M2: Terminal input triggers iOS auto-zoom

### After launch (Wave 2)
- AR-M3: packages/shared build never invoked
- AR-M4: Duplicated credential-loading code
- FE-M5: i18n dictionary serialized twice
- FE-L1: Hardcoded aria-label DOM coupling
- FE-L2: mountedRef never re-set on mount
- FE-L3: Dead prop + uncancellable timers
- BE-M3: Snapshot day-guard blocks retry on failure
- BE-M5: Read-only profile endpoint still fetches GitHub
- BE-L1: Write-registration gate misses a cron route
- BE-L2: bulk-recalculate resume skips failed handles
- BE-L3: Expired-lease recovery ignores quota limit
- BE-L4: warm_cache_ceiling_approached alert floods
- PE-M5: svgToPng blocks event loop
- PE-M6: Share page awaits durable write in render path
- DO-M6: Latency monitor undersamples (n=1/day)
- DO-L1: deployment-smoke asserts no identity
- DO-L2: CI installs unpinned/unverified tools
- DO-L3: Stale comments contradict accepted-risks.md
- SE-L1: Login rate limit inconsistent with sibling routes
- SE-L3: /api/insights documented wrong in CLAUDE.md
- QA-M4: 1,898 source-text test assertions
- QA-L3: No test guards confidence exclusion from JSON-LD
- UX-M3: Share page still locale-flashes
- UX-M4: Insight cards double-announce content
- UX-M5: Generation progress over-announces
- UX-L1: Global error boundary dark-only + wrong lang
- UX-L2: Badge hotspots add non-widget tab stops
- AR-L1: apps/web/hooks/ outside coverage measurement
- AR-L2: Module ownership map covers half of lib/
- AR-L3: Orphaned doc + tracked coverage artifact

### Later / strategic (Wave 3)
- AR-S1: ESLint 10 / TypeScript 7 upgrades untracked
- FE-S1: Locale resolution implemented 5 times
- PE-L1: Serial platform cache reads where MGET exists
- PE-L2: Redundant linked-platform DB re-query
- PE-L3: OG PNGs base64-inflated in Redis
- SE-L2: NO_TRUSTED_IP sentinel unhandled at most call sites
- QA-L1: Playwright retries mask flakes with no reporting
- QA-L2: fetchWithRetry doesn't retry network-level throws
- UX-L3: Author attribution pill is a no-op button

---

## 15. Open Questions / Assumptions

- **GitHub API rate limits were exhausted mid-audit** (shared across all specialists' sessions), so `gh secret list`, branch-protection queries, and default-workflow-permission queries could not run. Findings depending on those are explicitly labeled `[inference]` (DO-H3, part of DO-M4, DO-L3) rather than asserted as fact — these need a human `gh` check to confirm before treating as launch-blocking.
- **Whether `CHAPA_ALERT_WEBHOOK_URL` is currently set in Vercel Production** could not be verified read-only from this session. DO-H2's recommended fix (fold it into `/api/health`'s status) should not ship until this is confirmed set, or the first deploy will trip the release-required health probe.
- **The external Chapa CLI binary's exact polling behavior** (whether it echoes `device_code` on every poll including the redeeming one) is outside this repo and could not be verified. BE-H3/SE-H1's fix should be checked against the actual CLI before merging.
- **Actual rendered PNG size for OG images** (PE-L3) was not measured — the encoding overhead is certain, but whether it's material enough to prioritize is not.
- **Whether the three platform OAuth integrations (Bitbucket/Codeberg/GitLab) are currently flag-enabled in production** was not verified — this determines whether UX-H1's blast radius is live or latent today.
- **Bitbucket/Codeberg/GitLab OAuth flows were all independently verified as correctly implementing the #1027 hardening** (per-platform state cookie, single-use nonce, timing-safe comparison) — this was confirmed for all four providers, not assumed from the GitHub case alone, contradicting a plausible a priori assumption that non-primary providers might be less hardened.

---

## 16. Final Verdict

- **Verdict: CONDITIONAL**
- **What would most worry you about shipping today?** The DO-H1/DO-H2 pairing — the alerting system that's supposed to catch problems has no independent verification that it's actually configured, and no external observer if the whole application goes dark. Combined with BE-H1 (poisoned data can silently re-enter permanent history from 3 of 4 write paths) and PE-H1 (the badge SLO is aspirational, not enforced), the pattern across all three is the same: careful, well-reasoned protective mechanisms that don't quite cover 100% of the paths they're meant to protect, with nothing watching the gap.
- **What gives you confidence?** The scoring-integrity contract — the most carefully-reasoned code in the repository — was independently traced by two specialists and holds exactly as documented. The test suite is large, fast, and genuinely well-targeted at the highest-risk modules. Security fundamentals (OAuth across all four providers, SVG escaping, RLS, secret hygiene) are sound. Zero circular dependencies, zero `any`/`@ts-ignore` outside test code, zero launch-blocking findings from any of the eight specialists. This is a codebase where the failure modes found are the kind that only surface under adversarial, expert-level scrutiny — not the kind that surface under normal use.
- **Next 5 actions (ordered):**
  1. Confirm `CHAPA_ALERT_WEBHOOK_URL` is actually set in Vercel Production, then close DO-H1/DO-H2 (external monitor + health-check gate) — this is the fix that would catch problems with everything else on this list.
  2. Fix BE-H1 (persist-boundary gate on all four writers) and BE-H3/SE-H1 (CLI device-code binding) — both S-effort, both close mechanisms that have either already caused an incident or actively enable one.
  3. Fix the acquisition-funnel silent failures: UX-H1 (OAuth linking), UX-H2 (generation hang), FE-H1 (canonical URLs) — all S/M effort, all directly affect new-user conversion.
  4. Address PE-H1/PE-H2 (badge latency deadline + overlay-fetch parallelization) together, since they touch the same code path and PE-H2's fix directly reduces the deadline PE-H1 needs to enforce.
  5. Run `/remediate` against this report's Section 14 to drive the three-wave fix process, starting with Wave 1's 41 Before-launch items.
