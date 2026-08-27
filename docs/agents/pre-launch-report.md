# Pre-Launch Codebase Audit
> Generated on 2026-08-27 | Branch: `develop` | 8 parallel specialists
> Focus: comprehensive

## 1. Executive Summary

This is a genuinely well-engineered codebase carrying two launch-blocking defects that are both *configuration and coverage gaps rather than code faults* — which is exactly the shape of problem that survives a green CI suite. Verification ran clean across the board: 8009 tests pass in 487 files with zero failures and zero skips, typecheck and lint report zero errors and zero warnings, coverage sits at 95.35% statements against a 75% floor, `osv-scanner` finds zero vulnerabilities at any severity across 680 packages, the license gate passes, no real secrets exist in the tree, no circular dependencies exist across 970 files, knip finds zero dead files or exports, and the production build succeeds with its largest chunk at 227.1 KB against a 350 KB budget. Against that, the audit found that the entire P1/P2 alert channel is inert in production because one environment variable was never set, and that the product's legal documents and navigation are reachable only from the home page. The recurring theme across domains is a gap between *what the codebase documents about itself* and *what it does*: three separate files claim the English dictionary does not ship to clients (it does, measurably); the badge SLO declares a 3000ms budget the implementation's own deadline arithmetic exceeds by 53%; the outage runbook instructs an operator toward the action that silently collapses every user's score; and `design-system.md` mandates an error-color rule that ten of thirteen error boundaries violate. None of these would be caught by a test, which is why they are still here.

**Top 3 strengths (evidence-backed)**

1. **Test and verification discipline is real, not nominal.** 8009 passing tests across 487 files, zero `.skip`/`.todo`/`xit` anywhere in the repo, zero test files lacking an `expect()` call, and layered coverage floors (95/90/95/95 on `lib/impact/**`, 90/85/90/90 on `stats-integrity.ts`) that pin the scoring pipeline specifically. The QA lead probed the four highest-consequence seams — the #1004 integrity contract, the #1086 badge materialize deadline, campaign lease/acknowledge, and visitor confidence redaction — and found each already covered at both unit and real-DB level.
2. **The security posture holds under adversarial reading.** All 52 API routes were enumerated and every one carries an appropriate guard; no IDOR, no missing auth check, no raw SQL, constant-time comparison correct in all five places, SSRF blocked by a single-host allowlist, SVG XSS closed by `escapeXml` at every user-controlled interpolation, and the #1067/#1122 confidence redaction verified holding on every traced path. The new WebMCP surface is DB-flag-gated with a kill switch that genuinely wins over the env var.
3. **The integrity contract around scoring data is a serious piece of engineering.** The three-boundary defense (#1002/#1004/#1045/#1060/#1061) is upheld where it was aimed — both guard call sites were traced and neither touches overlays — and the `_classifyScope` guard against a tokenless fetch being misclassified as private-inclusive was specifically tested and works.

**Top 5 risks (ordered by blast radius)**

1. **DO-B1** — every P1/P2 alert posts to `undefined` in production; six of the nine signals have no second delivery path. A Redis outage, a dead cron, an `insufficient_scope` token, or a badge 5xx storm is currently invisible until the next daily probe. Launch is the event that triggers the alert this hides (`warm_cache_ceiling_approached` fires at 50 users).
2. **BE-H1** — chained `mergeStats` calls corrupt `primaryReviewsSubmittedCount`, so for any user with two or more linked platforms, non-GitHub reviews drive the solo/collaborative classification that gates the Quality formula and archetype eligibility. Wrong scores reach the persisted snapshot and the HMAC verification record, so they are attested and become trend history.
3. **UX-B1** — Privacy and Terms are linked only from the landing footer. A user arriving at `/u/someone` from a README, signing in, and generating a badge never sees either document; seven archetype SEO pages × two locales end in dead ends with no signup CTA.
4. **SE-H1** — the CLI device-authorization flow has no device-code binding to the browser approval, and the resulting token is valid 90 days with no revocation path and write access to scoring inputs for the approving handle.
5. **BE-H2 / PE-H2** — the non-downgrading cache rule has a hole on its rejection path (a scope-blinded value can overwrite a better-scoped composed entry, the exact #1002/#1050 signature), and the badge cold-miss deadline stack sums to 4600ms against a declared 3000ms SLO, meaning the monitor alerts against a target the code cannot hold.

**Verdict: NOT READY.** Two launch-blockers (DO-B1, UX-B1) and fourteen high-severity findings marked Before launch. Both blockers are small in effort — DO-B1 is one environment variable plus a health-check line, UX-B1 is extracting an existing footer and passing nav links — but neither is optional: shipping without DO-B1 means launching blind to every failure mode the system knows how to detect, and shipping without UX-B1 means a public product whose legal documents are unreachable from the surfaces users act on. The high findings include one real scoring-correctness bug (BE-H1) that silently mis-scores multi-platform users.

## 2. System Architecture Overview

Chapa is a pnpm workspace with two packages: `packages/shared` (1,207 LOC, 10 files — a verified dependency-free leaf holding scoring types, constants, and platform-invariant aggregation helpers) and `apps/web` (Next.js 16 App Router, ~59,000 LOC: `lib/` 26,175, `app/` 23,836, `components/` 9,074), plus a non-workspace root `scripts/` tree (5,734 LOC) compiled by its own tsconfig.

**Major modules and responsibilities.** The core artifact pipeline runs: route handler (`app/u/[handle]/badge.svg/route.ts`, `app/u/[handle]/page.tsx`) → `lib/profile/materialize-profile.ts` → `lib/github/client.ts:getStats` (cache-first Redis, scope-aware in-flight dedup, non-downgrading cache writes, then `_compose` of linked-platform and EMU overlays) → `lib/impact/v6.ts` (pure) → `lib/render/BadgeSvg.tsx` (pure SVG string) → post-response side effects via `after()`. Around that sit four trust tiers: public/unauthenticated read surfaces (badge, share page, `/api/profile`, `/api/history`, `/api/verify`, `/api/insights/:handle`, `/api/feature-flags`, `/api/version`, `/api/telemetry`), session-authenticated write surfaces behind an AES-256-GCM stateless cookie, bearer-authenticated CLI surfaces, and privileged admin/cron surfaces.

**How the pieces connect.** Three stores back the system: GitHub GraphQL (source of truth for activity), Upstash Redis (hot cache, rate limits, leases, dedup guards), and Supabase (durable snapshots, users, campaigns, verification records, studio configs). Config lives in three places — Vercel production env vars, Supabase `feature_flags` rows (DB-authoritative with env fallback), and manually-applied migrations with no deploy runner. Observability has three layers: `/api/health`, PostHog server events, and a push alert webhook.

**Architecture concerns (systemic only).** Four boundaries are enforced structurally and hold: `@chapa/shared` via an ESLint import-path rule, `lib/env.ts` as the single env chokepoint (51 importers), `lib/cache/redis.ts` as the single Redis chokepoint (45), and `withErrorCapture` at 100% adoption across all 51 route handlers. Three are enforced only by prose and have already drifted: Redis key formats are string-duplicated across seven sites bound by comments, one of which is a rename behind (AR-M2); the `_compose` layer carries positional invariants nothing states or checks (BE-S1, the root cause of BE-H1); and the session/locale sourcing strategy is a per-page hand-made decision rather than a derived one (FE-S1, the root cause of FE-H2 and FE-M1). Separately, two independent badge implementations exist with no test binding them (AR-S1) — Creator Studio previews a DOM lookalike whose customizations have no path to the embeddable SVG.

## 3. End-to-End Flow Analysis

**Flows reviewed.** (a) Anonymous badge embed — README `<img>` → `/u/:handle/badge.svg` → CDN → Redis SVG cache → cold-miss materialize → render → response. (b) Share-page visit — `/u/:handle` RSC render with server session resolution, badge inline, owner-gated dashboard. (c) OAuth login → generate → badge. (d) CLI device authorization → token → supplemental upload. (e) Campaign send — cron → lease claim → provider → acknowledge. (f) Locale-segmented content pages via `proxy.ts` rewrite.

**Request/data/control-flow observations.** The badge cold-miss path is the most latency-sensitive and the most instrumented, and its bounded worst case (500 + 150 + 250 + 2200 + 1000 + 500 = 4600ms) exceeds its own declared 3000ms p95 budget — the #1029 reconciliation was done for the lock-loser path but never for the winner (PE-H2). The share page resolves the viewer's session server-side, computes `isOwner`, uses it for redaction, then discards it and re-fetches from three client components over a fail-closed rate-limited endpoint (FE-H2). The scoring compose chain folds `mergeStats` up to four times, which silently corrupts two fields whose semantics are "the first operand's original value" (BE-H1, BE-S1).

**Integration and boundary risks.** The newest boundary is WebMCP — profile-derived text now crosses into a visitor's browser AI agent context. It was traced end to end and is read-only, same-origin, handle-validated, and double-gated; the two gaps are an unbounded free-text field passing verbatim into agent context (SE-M2) and a trust annotation fixed at the factory rather than chosen per call site (SE-L3/BE-L3). The CLI boundary is the weakest: approval is not bound to the initiating device (SE-H1), and `cacheMergeJson` will create a session key on approve, which the poll route's own comments document as an accepted residual pending a device-code-always CLI. The campaign boundary is correct under retry but throughput-limited by loop shape (BE-M5) and treats a config outage as permanent per-recipient failure (BE-M6).

## 4. Frontend / UI Findings (Staff Frontend Engineer)

### Domain Model

Chapa's frontend is a Next.js 16 App Router tree with a single static root layout (`app/layout.tsx`) that owns `<html>`, fonts, `ThemeProvider`, a `LanguageProvider` pinned to `DEFAULT_LOCALE` ('es'), and DB-backed feature flags — deliberately never calling `cookies()`/`headers()` so ISR survives. Beneath it, three route families diverge: nine locale-segmented static content pages under `app/[locale]/**` reached through `proxy.ts`; dynamic profile/verify/studio/admin routes that resolve session and locale per request and, on three of them, nest a second `LanguageProvider` plus a `DocumentLocaleScript`; and flag-gated `/experiments/*`. Session reaches the client either server-resolved via `getOptionalServerSessionFromHeaders` or client-fetched via a module-promise-cached `useSession()`, and the choice is made per page rather than per rendering mode. Tooltips are uniformly portalled to `document.body` at `z-index: 99999`.

#### FE-H1 The English dictionary (~30.6 KB gzip) ships in the client bundle of every page, including the Spanish default
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/i18n/use-translation.ts:5, apps/web/lib/i18n/provider.tsx:20, apps/web/lib/auth/error-messages.ts:17, apps/web/app/layout.tsx:19-24, apps/web/lib/i18n/provider.tsx:69-78
- **What's happening:** Three `'use client'`-reachable modules statically import the 100 KB English dictionary, defeating the `await import()` split at provider.tsx:168-174. Verified against the checked-in build: `grep -rl "Skip to main content" .next/static/chunks/` matches exactly one chunk, `0bgde_-hqw1qe.js` (89,627 B raw / 30,572 B gzip), and `.next/server/app/es.html` — the prerendered Spanish landing page — references it 17 times including a real `<script src>`. The Spanish dictionary chunk appears zero times in `es.html`; Spanish copy arrives inline in the RSC payload.
- **Why it matters:** The codebase documents the opposite behaviour in three places ("does NOT ship in the shared client JS bundle"). This is the single largest avoidable payload on the highest-traffic route, and because it is a shared chunk it is invisible to per-route attribution — likely why it survived. It is also a correctness-of-documentation problem: future work will reason from a claim the build disproves.
- **Recommendation:** Make the `en` fallback lazy rather than static. `use-translation.ts` needs a dictionary only when no provider exists — that path can return the key. `provider.tsx`'s `dictionary ?? en` default is only exercised by tests per its own comment, so tests should pass `dictionary={en}` explicitly. `error-messages.ts`'s `defaultT` is dead in the client path — every call site already passes a translator.
- **Regression risk:** The accepted risk "useTranslation fallback locale is English" documents the fallback as intentional and test-relied-upon — removing it wholesale changes test-facing behaviour, so the fix must keep the same resolved strings for the no-provider case (pass `en` explicitly at test render sites) rather than silently returning keys. The #1108 pass-through provider depends on `dictionary` being optional, so make the fallback *source* lazy, not the prop optionality. Verify after the change that `es.html` no longer references the English chunk AND that a cookie-driven es→en switch still resolves. Trades away a synchronous first render for a genuinely provider-less client component, which no production path has.
- **Expected impact:** ~30 KB gzip off first load on every route; documentation and build agree again.
- **Effort estimate:** M

#### FE-H2 The share page resolves the viewer's session server-side, then throws it away and re-fetches it from the client
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/page.tsx:189-195, apps/web/app/u/[handle]/page.tsx:359, apps/web/app/u/[handle]/page.tsx:405-412, apps/web/components/NavbarClient.tsx:30-31, apps/web/components/NavbarShell.tsx:89-96, apps/web/components/SharePageOwnerContent.tsx:109-114, apps/web/components/BadgeToolbar.tsx:32-33, apps/web/components/Navbar.tsx:27-40
- **What's happening:** `SharePageContent` awaits `getOptionalServerSessionFromHeaders` and computes `isOwner` (line 195), using it for redaction. It then renders `<NavbarClient />` — the variant whose docblock says it exists for ISR pages — and passes stats/impact to `SharePageOwnerContentLazy` without `isOwner`. Three client components then call `useSession()` and re-derive ownership over a network round trip. `/u/[handle]` is not ISR: it awaits `searchParams` and `headers()` (#1066), so the constraint `NavbarClient` was built for does not apply. `/verify/[hash]`, `/studio`, and `/admin` correctly use the server `Navbar`.
- **Why it matters:** On the hottest page, every visit costs an extra authenticated round trip to a `rateLimitStrict` fail-closed endpoint (a Redis blip returns 429 and `useSession` resolves null), and the nav auth slot renders a grey placeholder before resolving. For the owner, `isOwner` is false during loading, so the refresh affordance and confidence section are absent on first paint and pop in; for a visitor, the acquisition CTA appears late.
- **Recommendation:** Swap `<NavbarClient />` for the server `<Navbar />` on `/u/[handle]`, and thread the already-computed `isOwner` down through `SharePageOwnerContentLazy` as a prop, keeping `useSession()` only as a fallback.
- **Regression risk:** `NavbarShell`'s loading placeholder exists specifically to avoid a login-link flash (#1025/FE-L2) — the server variant never passes `loading`, so verify `NavbarParity.render.test.tsx` still holds. `isOwner` must stay a display gate only: the server-side redaction at page.tsx:328 is the security boundary and must not be relaxed on the assumption the prop is authoritative. `useOwnerCacheWarm(handle, isOwner)` would fire `POST /api/refresh` earlier — confirm its sessionStorage debounce still de-duplicates. Props must survive the `next/dynamic` lazy split. Trades a marginal RSC payload increase for removing a request.
- **Expected impact:** One fewer authenticated request per share-page view; owner/visitor UI correct on first paint.
- **Effort estimate:** M

#### FE-M1 The DocumentLocaleScript pattern is applied to 3 of ~12 locale-aware routes, leaving `<html lang>` wrong on the other 9
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/layout.tsx:117-122, apps/web/lib/i18n/document-locale-script.tsx:7-15, apps/web/app/[locale]/about/page.tsx:43-53, apps/web/app/[locale]/privacy/page.tsx:33-45, apps/web/app/[locale]/terms/page.tsx:45, apps/web/app/[locale]/archetypes/_components/ArchetypePage.tsx:40-49, apps/web/app/u/[handle]/page.tsx:133-146
- **What's happening:** The root layout hardcodes `lang={DEFAULT_LOCALE}`. Three routes compensate with a parser-blocking `DocumentLocaleScript`. The remaining nine do not: prerendered `/en/about`, `/en/terms`, `/en/archetypes/builder`, and dynamic `/u/[handle]?lang=en` ship English body copy inside `<html lang="es">`, corrected only post-hydration by `LangSync`. The eight `app/[locale]/**` pages additionally lack a nested `LanguageProvider`, so their client chrome renders Spanish beside English page text until the root provider's mount effect swaps dictionaries.
- **Why it matters:** `lang` is what screen readers use to pick a speech synthesiser and what search engines read for language targeting — a static English page declaring `lang="es"` is wrong in the served HTML, the artefact crawlers and assistive tech consume, and hydration does not fix a crawl. The accepted risk covers a brief visual flash of shared chrome, not a wrong `lang` attribute.
- **Recommendation:** Hoist `<DocumentLocaleScript locale={locale} />` into `app/[locale]/layout.tsx`, which already receives the segment and is a pure pass-through — one edit covers all nine content pages — plus add it to `/u/[handle]`.
- **Regression risk:** `app/[locale]/layout.tsx` is a `<>{children}</>` pass-through hosting only `generateStaticParams` — adding an element must not introduce a client boundary or request-time read, or `force-static` breaks on nine pages. Three writers already target `documentElement.lang` (`DocumentLocaleScript`, `LangSync`, `LocaleSync`); confirm ordering leaves the query-locale owner authoritative, since `LangSync:15` bails only when `dataset.chapaLocaleSync` disagrees. The inline script relies on the existing CSP `'unsafe-inline'`; a future nonce migration would need these covered.
- **Expected impact:** Correct `lang` in served HTML on nine routes.
- **Effort estimate:** S

#### FE-M2 ActivityHeatmap computes the current streak from the renderer's local calendar date, risking a hydration mismatch
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/components/dashboard/activity-insights.ts:46-56, apps/web/components/dashboard/ActivityHeatmap.tsx:1, apps/web/components/SharePageOwnerContentLazy.tsx:9-12
- **What's happening:** `computeActivityInsights` builds "today" from `new Date()` using local getters and drops a zero-count today entry from the streak walk. `ActivityHeatmap` is `"use client"` but server-rendered via `next/dynamic` (default `ssr: true`). Server runs UTC; browser runs the viewer's zone. For a viewer at UTC−8 between 16:00 and 24:00 local, the two runs disagree on `today`, so `startIdx`, `currentStreak`, and the summary text differ between server HTML and first client render. The file already contains one deliberate hydration-parity fix at ActivityHeatmap.tsx:78-80.
- **Why it matters:** A text-content hydration mismatch in React 19 discards and re-renders the boundary and logs an error — on the owner's dashboard. It is intermittent and timezone-dependent, the class of bug that survives to production and resists reproduction.
- **Recommendation:** Make the "is the last entry today" decision an explicit input — pass a `today` string from the server (already computed at page.tsx:211) — or gate the trim behind `useIsClient()`.
- **Regression risk:** activity-insights.ts:50 states the local-calendar choice is deliberate, "to match GitHub's date format". GitHub's contribution dates are in the viewer's GitHub-configured timezone, not the server's, so a server-derived UTC date changes which day counts as today near a boundary and can read a genuine streak one lower. The `useIsClient()` gate is safer: it keeps local-date semantics and defers them past hydration, costing one extra client render. `computeActivityInsights` must stay pure and its unit tests meaningful.
- **Expected impact:** Removes a timezone-dependent hydration error on the owner dashboard.
- **Effort estimate:** S

#### FE-M3 Creator Studio tracks a dirty save state but nothing guards against navigating away with unsaved config
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/StudioClient.tsx:135, apps/web/app/studio/StudioClient.tsx:222-244, apps/web/app/studio/StudioClient.tsx:246-305, apps/web/app/studio/page.tsx:52-57
- **What's happening:** `handleConfigChange` sets `saveState: "dirty"` on every effective change and `handleSave` PUTs to `/api/studio/config`. Nothing consumes `dirty` to prevent loss: no `beforeunload` handler, no interception of the in-app nav links the page itself renders. A user who tweaks several of the nine categories and clicks "your badge" loses the work silently. `grep -rn 'beforeunload' apps/web` returns nothing.
- **Why it matters:** Studio's value is accumulated fiddling across nine categories; silent loss on a stray click reads as unfinished. The state needed to prevent it is already tracked and rendered in the terminal — only the guard is missing.
- **Recommendation:** Add a `beforeunload` listener registered only while `saveState.status === "dirty"`, covering reloads, tab close, and the plain `<a href>` navigations `NavLink`/`NavbarShell` emit.
- **Regression risk:** Must be scoped strictly to the dirty window or it degrades every exit with a browser confirm; register/unregister on the status transition, not on mount. Demo mode (StudioClient.tsx:262-274) never persists by design — the guard must not fire there or the judge-demo flow gets a spurious prompt. The guard cannot cover a `router.push`; Studio's links are plain anchors today, so `beforeunload` covers them — that becomes false if FE-L3 converts them to `next/link`, so sequence the two.
- **Expected impact:** Unsaved Studio work is no longer silently discarded.
- **Effort estimate:** S

#### FE-M4 Hardcoded English strings in the AI-insights import flow, inside an otherwise fully translated component
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/UserMenu.tsx:204-208, apps/web/components/UserMenu.tsx:213-218
- **What's happening:** Every other user-facing string in `UserMenu` goes through `t('userMenu.*')`. The insights-import success toast does not: message is a template literal `Craft: ${craftScore} ${craftTier}` and detail is `Score updated to ${newScore}`, with `craftTier` a raw English enum value interpolated from the API response.
- **Why it matters:** `DEFAULT_LOCALE` is 'es', so the default-locale user completes a multi-step upload and gets its only confirmation in English. `parity.test.ts` cannot catch this — it verifies the two dictionaries match each other, not that components use them — so this class of gap is invisible to CI by construction.
- **Recommendation:** Add `userMenu.insightsCraftResult` / `userMenu.insightsScoreUpdated` keys to both dictionaries with placeholders, resolved via the `interpolate()` helper this file already imports. Tier names get their own dictionary lookup rather than raw interpolation.
- **Regression risk:** Adding keys to one dictionary fails `parity.test.ts` — both must land together. Tier values arrive as server-side enum strings; a dictionary lookup keyed on them silently returns the key itself if the server adds a tier, so the lookup needs an explicit fallback to the raw value rather than rendering a bare key. Tests asserting current literal strings need updating.
- **Expected impact:** The insights flow completes in the user's language.
- **Effort estimate:** S

#### FE-L1 A file input is nested inside a button whose click handler programmatically clicks that input
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/UserMenu.tsx:483-516
- **What's happening:** The menu item is a `<button role="menuitem">` whose `onClick` calls `insightsFileRef.current?.click()`; the input it clicks is an `sr-only` child of that same button. HTML's content model forbids interactive content inside `<button>`, and `HTMLElement.click()` dispatches a bubbling event that re-enters the parent's handler, bounded only by the spec's "click in progress" flag.
- **Why it matters:** Invalid nesting is fragile under React reconciliation and browser error recovery, and the self-re-entrant click is load-bearing behaviour resting on a spec guard rather than the code's own logic.
- **Recommendation:** Hoist the input to a sibling of the button, still `sr-only`, keeping the ref and handler unchanged.
- **Regression risk:** The input is inside the dropdown container and `sr-only`, so moving it must not change focus order within `role="menu"` — `useDropdownMenu` enumerates `[role="menuitem"]` and the input carries no role, so it should be unaffected, but the keyboard walk should be re-verified. `handleInsightsFile` resets `e.target.value = ""` so re-selecting the same file still fires; that must survive the move.
- **Expected impact:** Valid markup; the file picker no longer depends on a browser re-entrancy guard.
- **Effort estimate:** S

#### FE-L2 The language switcher and theme toggle are mounted twice on mobile
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/NavbarShell.tsx:86-88, apps/web/components/MobileNav.tsx:124-127
- **What's happening:** `NavbarShell` renders `<LanguageSwitcher />` and `<ThemeToggle />` with no breakpoint gating, so they are visible at every width. `MobileNav`'s open panel renders a second copy of both. At mobile widths with `navLinks` present, opening the hamburger yields two live language switchers and two theme toggles, each with its own `role="group"`, duplicate `aria-label`, and its own document listeners.
- **Why it matters:** Duplicate landmark-labelled controls confuse screen-reader users navigating by role, and duplicate global listeners mean an outside-click closes one instance's dropdown while the other's state is untouched.
- **Recommendation:** Decide which surface owns these at mobile widths — most likely remove them from `MobileNav`.
- **Regression risk:** Pages rendering `NavbarShell` without `navLinks` never mount `MobileNav` at all, so hiding the `NavbarShell` pair at mobile widths would strip language and theme controls entirely from those pages on phones — the correct fix is almost certainly removing them from `MobileNav`, not gating `NavbarShell`. Verify against `NavbarParity.render.test.tsx` and `MobileNav.render.test.tsx`.
- **Expected impact:** One canonical language/theme control per viewport.
- **Effort estimate:** S

#### FE-L3 NavLink renders a plain anchor, so the Studio navbar's real-route links do full page reloads
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/NavLink.tsx:20-27, apps/web/app/studio/page.tsx:52-57, apps/web/components/MobileNav.tsx:114-123
- **What's happening:** `NavLink` emits `<a href>` rather than `next/link`. On the landing page every href is a hash anchor, where that is correct. Studio passes real routes, so clicking "your badge" from Studio is a full document navigation: fresh HTML, fresh JS parse, no client cache reuse.
- **Why it matters:** A needless full reload on an authenticated, JS-heavy page, and it obscures the FE-M3 unsaved-changes problem by making the navigation feel deliberate.
- **Recommendation:** Have `NavLink` branch: `next/link` for hrefs starting `/`, plain `<a>` for `#` anchors and external URLs.
- **Regression risk:** `next/link` prefetches by default — pointing it at `/u/{handle}` would prefetch a dynamic route running `materializePublicProfile` and scheduling `after()` side effects, so prefetch must be disabled on that link or the badge pipeline gets speculative traffic from every Studio page view. `NavLink` relies on `usePathname()` for `aria-current`; under the `proxy.ts` rewrite the reported pathname for `app/[locale]` routes needs re-verification. This also removes `beforeunload`'s coverage of Studio's nav links (FE-M3) — sequence accordingly.
- **Expected impact:** Client-side navigation out of Studio.
- **Effort estimate:** S

#### FE-L4 SharePageLocaleContent overwrites document.title in an effect, duplicating the metadata title template
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/SharePageLocaleContent.tsx:15-21, apps/web/app/u/[handle]/page.tsx:86, apps/web/app/layout.tsx:45-48
- **What's happening:** `generateMetadata` already sets the title from `sharePage.metadataTitle`, rendered through the root layout's `template: "%s — Chapa"`. The client component reimplements the same string in a `useEffect`, including a hardcoded `— Chapa` suffix, and assigns it imperatively.
- **Why it matters:** Two independent sources for one title. If the layout template changes, the effect keeps writing the old suffix and wins, because it runs after React's head management. The title is set outside the framework's own mechanism on the most-shared page.
- **Recommendation:** Delete the effect. `generateMetadata` resolves the same locale via the same `getServerLocale(queryLang)` call, explicitly coordinated by #1066.
- **Regression risk:** The effect's real purpose is likely the `?lang=` deep-link case where `LocaleSync` switches locale after the server rendered the title — deleting it means the tab title stays in the server-resolved locale after a client-side switch. Confirm `generateMetadata`'s `?lang=` handling covers this (it reads the same param, so it should) before removing; if a client re-title is genuinely needed, source the suffix from the same constant the layout template uses rather than a literal.
- **Expected impact:** One source of truth for the share-page title.
- **Effort estimate:** S

#### FE-L5 Route-level error boundaries report nothing; only global-error emits telemetry
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/error.tsx:7-13, apps/web/app/u/[handle]/error.tsx:7-13, apps/web/app/global-error.tsx:16-30
- **What's happening:** All eleven route/segment `error.tsx` boundaries destructure only `{ reset }` — the `error` prop is declared in the type and discarded. `global-error.tsx` POSTs to `/api/telemetry` with message, stack, and digest. The route boundaries — which catch the far more common case, since `global-error` only fires when the root layout throws — are silent.
- **Why it matters:** A render error on `/u/[handle]` shows a friendly card and leaves no trace anywhere. CLAUDE.md requires durable-write failures to be observable; the same reasoning applies to a boundary swallowing every client render error on the main product surface.
- **Recommendation:** Extract the existing `global-error` reporting body into a shared hook and call it from the route boundaries with a per-route `source`. This reuses wired infrastructure; it is not a new monitoring system.
- **Regression risk:** Per the project-scale policy, new monitoring infrastructure is out of scope; this must stay a reuse of `/api/telemetry` and `trackEvent` with no new endpoint, alert channel, or CI gate. `/api/telemetry` is a public ingestion route — a boundary firing repeatedly in a render loop would post on every `reset()`, so the reporter must fire once per error identity, not once per render. Stack traces must not carry user-identifying content.
- **Expected impact:** Client render failures on real routes become visible.
- **Effort estimate:** S

#### FE-L6 The go-profile keyboard shortcut bypasses the shared session cache
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/KeyboardShortcutsListener.tsx:152-166, apps/web/hooks/useSession.ts:26-60
- **What's happening:** `useSession` exists specifically to deduplicate `/api/auth/session` via a module-level promise. The `go-profile` handler calls `fetch("/api/auth/session")` directly, issuing a fresh request even when the answer is cached, and unlike `useSession` it does not emit `client_api_error` on a non-ok response, so a 429 from the fail-closed limiter silently does nothing.
- **Why it matters:** Small, but a second implementation of a thing with exactly one correct implementation two files away, losing the error instrumentation that implementation was given deliberately.
- **Recommendation:** Export the module-level `fetchSession()` from `hooks/useSession.ts` and call it here.
- **Regression risk:** `fetchSession()` caches its promise; a stale cache after logout would send the shortcut to the wrong profile — `handleSignOut` already calls `clearSessionCache()`, so the invariant holds provided the shortcut never runs on a page where logout happened without that path. The handler is inside a `useCallback` with `[router, studioEnabled]` deps; importing a module function does not change that. Trades away freshness: the shortcut reuses an answer up to one page-lifetime old.
- **Expected impact:** One session-fetch implementation instead of two.
- **Effort estimate:** S

#### FE-L7 ArchetypePageClient is a server component, contradicting the codebase's own *Client naming convention
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/app/[locale]/archetypes/_components/ArchetypePageClient.tsx:1, apps/web/app/verify/VerifyInputPageClient.tsx:1, apps/web/app/studio/StudioClient.tsx:1, apps/web/app/admin/AdminDashboardClient.tsx:1
- **What's happening:** Every other `*Client.tsx` in the tree is a client boundary. This one is a server component; its sibling server-only files under the same route use the `*Content` suffix. It receives `t` as a function prop from ArchetypePage.tsx:49, which only works because it is not a client component.
- **Why it matters:** The name asserts a boundary that does not exist. A maintainer trusting it could add a hook and get a confusing build error, or assume the `t` function prop is already crossing a serialization boundary and reason incorrectly about what else can be passed.
- **Recommendation:** Rename to `ArchetypePageContent`, matching the two sibling server content components.
- **Regression risk:** Pure rename across seven archetype page files plus tests; no behavioural surface. The one thing that must not change is the absence of `"use client"` — adding it would break the `t` function prop (functions are not serializable) and pull the archetype dictionaries into the client bundle, compounding FE-H1.
- **Expected impact:** Names match reality.
- **Effort estimate:** S

#### FE-S1 Session and locale each have two parallel sourcing strategies, chosen per page rather than derived from rendering mode
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/components/Navbar.tsx:27-40, apps/web/components/NavbarClient.tsx:30-53, apps/web/app/layout.tsx:117-118, apps/web/app/u/[handle]/page.tsx:133-146, apps/web/lib/i18n/provider.tsx:106-148
- **What's happening:** The static root layout cannot read cookies or headers, so both session and locale need a second per-page mechanism for dynamic routes. Two mechanisms exist for each, and which one a page uses is a hand-made decision recorded in prose comments rather than derived from anything the compiler or a test can check. FE-H2 and FE-M1 are both instances of that decision being made inconsistently. The accumulated complexity is visible in provider.tsx:116-136 — a 20-line comment explaining why a nested provider's pass-through decision must be frozen at mount.
- **Why it matters:** This is the root cause behind two of the findings above and will keep generating them: every new dynamic route is a fresh opportunity to pick the wrong navbar or forget `DocumentLocaleScript`.
- **Recommendation:** Not a refactor to schedule now. The durable step is collapsing the per-page choice into one shared boundary — e.g. a `<DynamicRouteShell locale session>` rendering `Navbar` + `DocumentLocaleScript` + nested `LanguageProvider` together — so a dynamic route gets all three or none.
- **Regression risk:** The two-variant split is load-bearing: `NavbarClient` exists precisely so the nine ISR pages avoid `headers()`, and the layout pins locale specifically to keep ISR alive (#861). Any consolidation that reads request state in a shared component used by a static page silently converts that page to dynamic rendering and kills the CDN caching the #982/#1023 work preserves. The #1108 mount-freeze must survive verbatim; it guards a duplicate-content bug that was observed, not theorised. Do this only with a prerender-manifest check confirming the nine content pages are still statically generated afterward.
- **Expected impact:** New dynamic routes get correct session and locale by construction rather than by review.
- **Effort estimate:** L

## 5. Backend / API / Data Findings (Staff Backend Engineer)

### Domain Model

Chapa's backend is a Next.js App Router service over three stores: GitHub GraphQL (source of truth for activity), Upstash Redis (hot cache, rate limits, leases, dedup guards), and Supabase (durable snapshots, users, campaigns, verification records, studio configs). The central pipeline is `getStats()` → `computeImpactV6()` → `buildSnapshot()`, fronted by `materializeProfile` and consumed by four writers (badge route `after()`, warm-cache cron, `/api/refresh`, `/api/recalculate` + bulk-recalculate). `lib/github/client.ts` implements the three-boundary integrity contract (#1004/#1045/#1060/#1061) with a hard invariant that guards see only GitHub-derived stats while platform and EMU overlays compose afterwards via `_compose`. Public reads are fail-open rate-limited; auth/write surfaces use fail-closed `rateLimitStrict`. Campaign email is a lease/saga over `campaign_sends` with Postgres RPCs and a Redis daily quota. `lib/webmcp/` is browser-side only — a hook registering read-only tool descriptors on `document.modelContext`, with no server surface.

#### BE-H1 Chained mergeStats calls corrupt primaryReviewsSubmittedCount, flipping solo→collaborative for multi-platform users
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/merge.ts:53, apps/web/lib/github/client.ts:396-412, apps/web/lib/impact/v6.ts:268-277, packages/shared/src/types.ts:19
- **What's happening:** `mergeStats` sets `primaryReviewsSubmittedCount: primary.reviewsSubmittedCount` — correct only when `primary` is the raw GitHub-derived value. `_compose` calls `mergeStats` up to four times in sequence (Bitbucket → Codeberg → GitLab → EMU supplemental), each time passing the previous merge result as `primary`. After two or more overlays the field holds GitHub + Bitbucket reviews, after three GitHub + BB + CB, and so on. `buildStatsFromRaw` never sets the field (packages/shared/src/stats-aggregation.ts:181 sets only `reviewsSubmittedCount`), so `mergeStats` is its sole writer. All three platform aggregators emit real non-zero `reviewsSubmittedCount` (bitbucket/stats-aggregation.ts:64, codeberg/stats-aggregation.ts:72, gitlab/stats-aggregation.ts:62), so the corruption is reachable, not theoretical.
- **Why it matters:** `detectProfileType` (v6.ts:272) reads exactly this field, and its documented purpose is preventing supplemental reviews from flipping a solo developer's profile to collaborative. For any user with ≥2 linked sources, non-GitHub reviews now drive that classification. `profileType` gates the Quality formula (solo vs collaborative, including the #827 cliff guard) and Quality Champion archetype eligibility — so this silently changes displayed dimension scores and archetype. It lands in the persisted snapshot and the HMAC verification record, so a wrong classification is attested and becomes trend history.
- **Recommendation:** Stop deriving the field inside `mergeStats`. Set it once in `_compose` from `githubDerived.reviewsSubmittedCount`, only when at least one overlay was applied — the same "GitHub-derived is the only guard/identity input" rule the file's #1060/#1061 header states. Keep `mergeStats` a pure two-operand merge carrying the field through from `primary` unchanged.
- **Regression risk:** The field must stay `undefined` for a plain overlay-free GitHub fetch, because v6.ts:272's `?? stats.reviewsSubmittedCount` fallback depends on it; writing `0` instead would make `detectProfileType` return "solo" unconditionally via the `reviews === 0` early return. Existing cached `stats:v2:merged:` entries carry the wrong value for up to 6h; `stats:stale:v2:` holds GitHub-derived data so it is unaffected — but persisted snapshots from before the fix keep the wrong `profile_type`, so trend/diff comparisons show a one-time archetype change on the next recalculate. `mergeStats` is also used directly by the supplemental path in tests. `hasSupplementalData` has the mirror-image ordering dependency (each linked-platform merge sets it false, only the last-position supplemental merge restores true) — fix both together.
- **Expected impact:** Solo/collaborative classification, and therefore Quality and archetype, becomes independent of how many platforms a user links.
- **Effort estimate:** S

#### BE-H2 A rejected lower-scoped fetch can still overwrite a better-scoped composed cache entry
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/client.ts:448, apps/web/lib/github/client.ts:514-543, apps/web/lib/github/client.ts:547-549
- **What's happening:** `_fetchAndCache` reads `baseline` once up front (line 448). Much later it reads `existingComposed` (line 522) and computes `bestKnownScopeRank` from both. If the fresh fetch is lower-scoped it sets `rejected = true` — but then falls back to `base = baseline ?? primary` (line 535) and writes that composed value into `cacheKey` anyway (lines 541-543). When `existingComposed` outranks `baseline`, that write is a downgrade of exactly the kind the rule prevents. Two paths reach it: the race the code's own comment describes (public and authenticated fetches dedup under separate inflight keys, so an authenticated fetch can write both keys between line 448 and 522), and no race at all — lines 542 and 548 are two separate unchecked `cacheSet` calls, so an authenticated fetch whose composed write succeeds and baseline write fails leaves the two keys at different scopes indefinitely.
- **Why it matters:** This is the #1002/#1050 failure signature — a scope-blinded value replacing a private-inclusive one — reintroduced through the rejection path rather than the acceptance path. The result is a collapsed Delivery dimension (merged-PR weight is 70% of it) served for up to the 6h TTL to every badge embed and share-page visitor, and possibly attested into a snapshot before the next authenticated fetch heals it.
- **Recommendation:** On the rejected branch, gate the `cacheKey` write on the value actually being an improvement: skip it when `scopeRank(existingComposed?.fetchScope) > scopeRank(base.fetchScope)`. The narrower alternative is re-reading the baseline right before line 535; prefer the first, which makes the write monotone by construction rather than by timing.
- **Regression risk:** The rejected-with-baseline write is load-bearing for a different reason: it refreshes `cacheKey`'s 6h TTL so a sustained scope problem doesn't refetch GitHub on every request. Skipping it entirely reintroduces that hot-loop, so the skip must be conditional on `existingComposed` being present and better-scoped — in which case `cacheKey` already has a live TTL and the anti-thrash property holds. An untagged legacy entry ranks 1, so the comparison must keep treating `undefined` as weakest or a legacy entry would block every write.
- **Expected impact:** The non-downgrading cache rule becomes a real invariant on both accept and reject paths.
- **Effort estimate:** S

#### BE-M1 Badge in-flight coalescing key ignores readOnly, so a public smoke request can serve its degraded result to a real user
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:80, apps/web/app/u/[handle]/badge.svg/route.ts:379-381, apps/web/app/u/[handle]/badge.svg/route.ts:398-408, apps/web/app/u/[handle]/badge.svg/route.ts:411-412, apps/web/lib/render/badge-svg-cache.ts:68-70
- **What's happening:** `svgCacheKey` encodes only handle/variant/date. `readOnly` is derived from the public `__chapa_smoke=1` query param but never enters the key. The in-memory `inflightBadgeRenders` map is keyed on `svgCacheKey` alone, so a `readOnly` request in flight hands its result to a concurrent normal request in the same isolate, and vice versa. A `readOnly` render skips the avatar fetch entirely, never writes the shared SVG cache, and on a cold handle `getStats({readOnly:true})` can return null, producing the "Could not load data" fallback SVG with `s-maxage=300`.
- **Why it matters:** Anyone can append the query param; a real visitor concurrent with it gets an avatar-less or fallback badge, and the miss isn't cached so the next request pays full cost again. In reverse it breaks the documented read-only safety boundary the E2E and latency-check probes rely on — the probe can be served a result produced by a full write path, making its latency sample and its "no writes" claim unsound.
- **Recommendation:** Include `readOnly` in the coalescing map key only, leaving the Redis cache key and render-lock key untouched.
- **Regression risk:** Must not leak `readOnly` into `buildBadgeSvgCacheKey` — that would fork the shared Redis SVG slot the share page also reads, and the smoke variant would populate a key nothing reads. The render-lock key derives from the cache key, so it must stay shared too, otherwise a smoke probe acquires an independent lock and doubles GitHub fetches at date rollover. Adds at most one extra concurrent render per handle, well within the existing lock/poll design.
- **Expected impact:** Smoke and real traffic stop cross-contaminating; the read-only boundary release evidence depends on becomes true.
- **Effort estimate:** S

#### BE-M2 Campaign quota refund recomputes the date key, so a batch straddling UTC midnight drives the next day's counter negative
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/email/campaigns.ts:85-90, apps/web/lib/email/campaigns.ts:182, apps/web/lib/email/campaigns.ts:272-277, apps/web/lib/email/campaigns.ts:322, apps/web/lib/email/campaigns.ts:361
- **What's happening:** `processCampaignBatch` computes `quotaKey` once at line 182 and reserves against it at 272. Every refund path calls `toDateString(new Date())` again at line 88 and increments that key by `-count`. `resend.batch.send` is wrapped in a timeout and the stats/acknowledge calls add latency, so a batch starting before 00:00 UTC and refunding after it charges day N and credits day N+1.
- **Why it matters:** The credited key becomes negative. `getDailyQuota` returns it verbatim so `available = 95 - (-50) = 145`, and `cacheReserveQuota` compares against the same negative base — so the next day's cap silently rises above the Resend free-plan ceiling the constant exists to respect. Overshooting turns into provider 429s that get classified transient and re-queued, so the error is self-amplifying rather than self-correcting.
- **Recommendation:** Thread the already-computed `quotaKey` into `refundDailyQuota(key, count)` instead of re-deriving the date. Optionally clamp reads at `Math.max(0, count)` in `getDailyQuota` as a second line of defense.
- **Regression risk:** The refund must keep an 86400s TTL on whichever key it touches — refunding a key whose TTL already expired recreates it, so passing the old day's key can resurrect a stale counter for another 24h; bound that by only refunding when the key's day still matches, or accept that a resurrected yesterday-key is harmless since nothing reads it. Clamping at read time changes `getDailyQuota`'s contract for any future caller wanting the raw signed value.
- **Expected impact:** Daily send quota stays a real ceiling across midnight boundaries.
- **Effort estimate:** S

#### BE-M3 rateLimit and rateLimitStrict set the window TTL only when the counter is exactly 1, so a lost EXPIRE locks a key out permanently
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/cache/redis.ts:289-299, apps/web/lib/cache/redis.ts:327-337, apps/web/lib/cache/redis.ts:556-575
- **What's happening:** Both limiters do `INCR`, then `if (current === 1) await redis.expire(key, windowSeconds)`. These are two separate REST round-trips with `retry: { retries: 0 }`. If the `EXPIRE` fails or the invocation is killed between the two calls, the key exists with no TTL and the counter only ever grows — the bucket never resets. `cacheIncr` in the same file already documents and avoids exactly this ("Always refresh TTL — idempotent and avoids race under concurrency"), so the omission is inconsistent rather than intentional.
- **Why it matters:** For `rateLimitStrict` this is a permanent self-inflicted denial of service on fail-closed routes: `/api/auth/session`, `/api/refresh` (keyed on handle — one poisoned key locks that user out of refresh forever), `/api/supplemental` (24h window), `/api/insights`, `/api/challenge`. There is no expiry to wait out and no code path that deletes these keys; recovery requires manual Redis surgery.
- **Recommendation:** Call `EXPIRE` unconditionally after `INCR`, matching `cacheIncr`.
- **Regression risk:** Unconditional `EXPIRE` means a key under continuous traffic never expires, so a client that trips the limit and keeps polling stays blocked longer than `windowSeconds`. That is the correct trade for fail-closed routes but changes observable behavior on the fail-open public ones (badge, profile, history), where a hammering embed stays 429'd rather than recovering on the minute boundary — verify the badge route's `checkBadgeRateLimit` fallback still degrades acceptably. A single Lua `INCR`+`EXPIRE NX` preserves exact fixed-window semantics at the cost of a script; either is acceptable, but do not leave the two-call form.
- **Expected impact:** A transient Redis hiccup can no longer permanently lock a user out of their own refresh/upload endpoints.
- **Effort estimate:** S

#### BE-M4 /api/telemetry handles client_error payloads before any of its three rate limits
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/telemetry/route.ts:12-31, apps/web/app/api/telemetry/route.ts:40-69, apps/web/app/api/telemetry/route.ts:94-118
- **What's happening:** The route is unauthenticated by design. The `isClientErrorTelemetryPayload` branch runs immediately after `request.json()` and returns `{ok:true}` before the IP/60s limit, the IP/day ceiling, and the per-handle limit. Any caller can post a matching payload at unbounded rate; each reaches `captureServerEvent` → PostHog. `category` is also forwarded without the length slice applied to every other field.
- **Why it matters:** This is not "the limits are too loose" — it is an existing, deliberately-layered control that one branch walks past. The cost lands on PostHog ingestion (metered) and log volume, from a fully anonymous public endpoint. It also makes the route's own documented trust model inaccurate for this branch, which stores nothing and emits an analytics event instead. (Found independently by Security as SE-M1.)
- **Recommendation:** Move the `client_error` branch below the IP rate-limit checks (it does not need the per-handle limit, which requires a validated `targetHandle`), and slice `category` like the neighbouring fields.
- **Regression risk:** The client-side error reporter is presumably a `sendBeacon`/fetch on the error path, so it must tolerate a 429 without retry-looping — check `lib/analytics/` callers before moving the branch. Applying the per-handle limit here would be wrong (no handle in the payload) and would silently drop genuine client errors, so only the two IP tiers should gate it.
- **Expected impact:** The endpoint's rate limiting applies to all of its inputs, not most of them.
- **Effort estimate:** S

#### BE-M5 One campaign gets at most one 50-recipient batch per daily cron run, capping throughput far below the daily quota
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/process-campaigns/route.ts:63-96, apps/web/app/api/cron/process-campaigns/route.ts:8, apps/web/app/api/cron/process-campaigns/route.ts:17, apps/web/lib/email/campaigns.ts:189
- **What's happening:** The cron iterates each active campaign exactly once and calls `processCampaignBatch(campaign.id)` a single time. That function claims at most 50 rows and returns. With a single active campaign the run sends 50 of the 95 daily allowance and exits, typically in seconds against a 270s budget. The cron is daily, so a 1,000-recipient campaign takes 20 days and permanently leaves ~47% of the daily quota unused.
- **Why it matters:** The lease/idempotency machinery around this (#1035, #1085, migrations 029-033) is engineered for correctness under retry, but the driver on top of it is throughput-limited by an accident of loop shape rather than by any constraint it tracks. An announcement campaign to a growing user base becomes weeks-long, and the deferral bookkeeping reports success while the backlog barely moves.
- **Recommendation:** Make the per-campaign call a loop: keep calling `processCampaignBatch` for the same campaign while `remaining > 0`, `remaining !== -1`, and the run is inside `TIME_BUDGET_MS` — or round-robin one batch per campaign per pass, repeating passes until budget or quota is exhausted (round-robin preserves the #1035 fairness property).
- **Regression risk:** The `remaining === -1` break and the `TIME_BUDGET_MS` check must be re-evaluated inside the new inner loop, not just around it, or a single campaign can burn the whole budget and re-starve the others #1035 fixed. Each additional batch is another `resend.batch.send` plus three Supabase round-trips, so the time-budget check must sit before each iteration. The quota reservation is what actually bounds sends — the loop must not assume `available` from a prior iteration, and the oversized-group release must stay reachable each pass. Do not raise `BATCH_SIZE` past 100 (Resend's API limit) as a shortcut.
- **Expected impact:** A campaign drains at the daily quota rate instead of at 50/day.
- **Effort estimate:** S

#### BE-M6 A missing Resend client permanently fails an entire claimed batch instead of releasing it
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/email/campaigns.ts:240-258, apps/web/lib/email/campaigns.ts:315-336
- **What's happening:** When `getResend()` returns null (missing or blank `RESEND_API_KEY`), the code calls `dbMarkSendsFailed` on up to 50 recipients, moving them to the terminal `failed` status. Nothing ever retries a failed row: `claim_campaign_sends` only selects expired `processing` or `pending`. The transient-provider branch deliberately keeps the lease so expiry recovery replays the identical group.
- **Why it matters:** A configuration problem — an unset or whitespace-damaged env var, exactly the failure mode CLAUDE.md's Environment Variable Safety section warns about — is treated as permanent per-recipient delivery failure. Those recipients are silently dropped forever, and because `dbGetCampaignStats` then reports zero pending and processing, the campaign transitions to terminal "sent" as long as one earlier row succeeded. The audit trail says "sent" for a campaign that never reached half its list.
- **Recommendation:** Treat "no Resend client" like a transient failure: release the lease via `dbReleaseCampaignSendLease` (the same call the oversized-group path uses, safe for the same reason — the provider has not been called) and return `{sent:0, failed:0, remaining}`. Reserve `dbMarkSendsFailed` for per-recipient provider rejections.
- **Regression risk:** Releasing rather than failing means a permanently-misconfigured deployment retries this batch on every run forever instead of draining. That is the correct default (data preserved, loud in `failures[]`), but it removes the implicit "give up" behavior — the campaign sits in `sending` indefinitely rather than reaching a terminal state, and any dashboard waiting for terminal status must tolerate that. Verify released rows keep their `group_token` so the next claim recovers identical membership (migration 033 guarantees this) — splitting them would break provider idempotency.
- **Expected impact:** A config outage costs a delay, not a permanently truncated recipient list labelled "sent".
- **Effort estimate:** S

#### BE-L1 Studio config cache hit always issues a Supabase revision read, so Redis removes no round-trip
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/db/studio.ts:304-387, apps/web/lib/db/studio.ts:262-301
- **What's happening:** On every Redis hit, `loadStudioConfig` calls `dbGetStudioConfigRevision` to confirm the cached revision still matches the durable row. The warm path therefore costs one Redis round-trip plus one Supabase round-trip — strictly more than reading Supabase directly. On a revision mismatch it does a third call.
- **Why it matters:** The module header states "Redis remains the hot read path"; it isn't one. The cache buys only payload-transfer savings while adding latency and a second failure mode (an unavailable durable revision returns 503 even though a valid cached config is in hand). A design cost worth naming, not a bug.
- **Recommendation:** Decide which property matters. If strict read-after-write across instances is required, drop the Redis read and query Supabase. If freshness can lag, trust the cached entry and rely on `refreshStudioConfigCache` plus the versioned write to converge. Do not keep both.
- **Regression risk:** Removing the revision check reintroduces the staleness migration 035 was built to prevent — an older instance's publication winning over a newer one. `cacheSetVersioned`'s Lua guard already rejects a lower revision, so the exposure is narrower than it looks but not zero: a failed `cacheSetVersioned` triggers a `cacheDel` whose own failure can leave a stale year-TTL value. Any simplification must keep that recovery path or drop the year-long TTL alongside it.
- **Expected impact:** One fewer network hop on the Studio load path, or one fewer cache layer to reason about.
- **Effort estimate:** M

#### BE-L2 Once-per-day side-effect guard key is case-sensitive while every other handle key is lowercased
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/profile/public-profile.ts:137-140, apps/web/lib/db/snapshots.ts:116, apps/web/lib/cache/snapshot-cache.ts:21, apps/web/lib/render/badge-svg-cache.ts:69
- **What's happening:** `persistProfileSnapshot` builds `sideeffects:done:${handle}:${today}` from the raw route param. Every other handle-derived key lowercases first. GitHub handles are case-insensitive, so `/u/JuanX/badge.svg` and `/u/juanx/badge.svg` claim two independent day guards.
- **Why it matters:** Each casing variant re-runs the deferred sequence once per day: an extra Supabase upsert (harmlessly deduped by the UNIQUE constraint), an extra `dbUpsertUser`, and an extra `trackBadgeGenerated` — which `INCR stats:badges_generated`, so the public badge counter over-counts by the number of casing variants in the wild. README embeds routinely use display casing, so this is normal traffic.
- **Recommendation:** Lowercase the handle when building `guardKey` and correspondingly in the `cacheDel(guardKey)` release.
- **Regression risk:** Changing the key shape orphans in-flight guards, so on deploy day some handles run side effects a second time — benign (the Supabase write dedupes; the notification path isn't invoked from the badge route). The `today` value here is `new Date()` while `materialized.snapshot.date` may come from an injected `options.today`; that pre-existing skew is unaffected but should not be widened.
- **Expected impact:** One deferred-work run per handle per day, and an accurate badge counter.
- **Effort estimate:** S

#### BE-L3 explain_dimension is annotated as trusted content while returning a third party's profile data on the share page
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/webmcp/shared-tools.ts:31-38, apps/web/lib/webmcp/shared-tools.ts:70, apps/web/app/u/[handle]/SharePageWebMcpTools.tsx:185-190, apps/web/app/verify/[hash]/VerifyPageWebMcpTools.tsx:66
- **What's happening:** The codebase applies a clear convention: tools returning third-party data get the untrusted annotation set, tools returning static in-repo constants get the trusted one. The verify page follows it exactly. `createExplainDimensionTool` hard-codes the trusted annotation, which is right for its Studio consumer (owner's own data) but wrong on the share page, where the same factory is fed an arbitrary handle's impact and stats and sits alongside four tools that all declare untrusted.
- **Why it matters:** No exploitable injection today — every `rawLabelParams` value in `lib/dashboard/dimension-sub-metrics.ts:65-197` is `String(number)` or `percent(number)`; no free-text field reaches the output. The defect is that the annotation is fixed at the factory rather than chosen by the caller, so the day someone adds a sub-metric carrying a repo or display name, it ships to the model as trusted content with no signal a decision was made. (Overlaps SE-L3.)
- **Recommendation:** Make `annotations` a required option on `createExplainDimensionTool` so each call site states its trust level explicitly.
- **Regression risk:** `annotations` is part of `catalogSignature`, so changing it forces re-registration of the whole catalog on next mount — correct, but any host caching tool descriptors sees a changed definition. Making the parameter required is a compile-time break across three call sites, which is the point; defaulting it would recreate the same silent-choice problem.
- **Expected impact:** Trust classification becomes a per-call-site decision instead of an inherited default.
- **Effort estimate:** S

#### BE-L4 Campaign daily-send quota is fail-open on both the read and the reservation
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/cache/redis.ts:384-408, apps/web/lib/email/campaigns.ts:79-83, apps/web/lib/email/campaigns.ts:183-187
- **What's happening:** `getDailyQuota` returns 0 when Redis is unavailable, and `cacheReserveQuota` returns `{allowed: true}` both when Redis is unconfigured and when the pipeline throws. During a Redis outage the daily cap is not enforced at all. The over-limit compensation `incrby -amount` is an unchecked second round-trip — if it fails, that quota is consumed for the rest of the day with nothing to release it.
- **Why it matters:** Unlike the request rate limiter (whose fail-open posture is an accepted risk justified by badge availability), this counter guards a paid external provider's hard limit, not request admission. There is no availability argument for sending more email during a Redis outage. Blast radius is bounded — Resend rejects past its ceiling, those rejections classify transient, and the batch is refunded and requeued — which is why this is low.
- **Recommendation:** Make `cacheReserveQuota` fail-closed for the campaign path, and log the failed compensation `incrby` rather than discarding it.
- **Regression risk:** `cacheReserveQuota` has exactly one caller today, so the flip is contained — but `campaigns.ts:278-286` maps `!allowed` to `remaining: -1`, which the cron reads as "quota exhausted, defer every remaining campaign". A Redis outage would therefore stall all campaigns for that run rather than one — intended, but it should be distinguishable in the response from genuine quota exhaustion so an operator isn't misled. This is a behavior change to a fail-open the project has otherwise standardized on, so it warrants an accepted-risks note either way.
- **Expected impact:** The daily provider cap holds even when Redis doesn't.
- **Effort estimate:** S

#### BE-L5 warm_cache_ceiling_approached P2 alert now fires on every hourly run
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:304-313, apps/web/app/api/cron/warm-cache/route.ts:288-303
- **What's happening:** The alert fires unconditionally whenever `allHandles.length >= MAX_HANDLES` (50). Its own comment documents that it predates the #1010 daily→hourly cadence change. Post-#1010 it emits 24 identical P2 webhooks per day for a condition that is static — user count doesn't change hourly.
- **Why it matters:** Not a request to build alert infrastructure — it is an existing alert whose firing rate silently increased 24x as a side effect of an unrelated change, and constant-firing P2s train the operator to ignore the channel that also carries `warm_cache_high_failure_rate` and `profile_snapshot_write_reconciliation`. The comment itself flags that the original blast-radius reasoning no longer applies. Note this becomes live only once DO-B1 is fixed.
- **Recommendation:** Gate it behind a `cacheSetNx` day-guard (the pattern already used at public-profile.ts:139) so it fires at most once per day, or drop it — the `rotationHours` figure it reports is already in the response body.
- **Regression risk:** A day-guard means a genuine step change in user count is reported up to 24h late; for a slow-moving capacity signal that's the right trade. Do not gate the sibling `warm_cache_high_failure_rate` or `warm_cache_time_budget_exceeded` the same way — those are per-run conditions where each occurrence is independently meaningful.
- **Expected impact:** The alert channel stays signal.
- **Effort estimate:** S

#### BE-L6 /webmcp-spike debug page ships in the production route manifest
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/webmcp-spike/page.tsx:13-16, apps/web/app/webmcp-spike/WebMcpSpikeClient.tsx:1-133
- **What's happening:** The page guards on `getVercelEnv() === "production"` → `notFound()` with `force-dynamic`, so it is correctly unreachable in production. But it remains a compiled route and client chunk, added as a throwaway runtime probe (commit 3156fcaa) and superseded by the real implementation.
- **Why it matters:** CLAUDE.md Development Guardrail #5 is "No dead code." The spike's `SpikeModelContext`/`SpikeTool` types now duplicate, divergently, the real `WebMcpTool` contract and the `Document.modelContext` declaration in `lib/webmcp/types.d.ts` — two sources of truth for the same browser API. It also references `border-border`/`bg-surface`, which are not tokens in the design system.
- **Recommendation:** Delete `apps/web/app/webmcp-spike/` and its two test files now that the real registration path has landed and is covered.
- **Regression risk:** Confirm the runtime-gate documentation (commits d7777e47/13bdd871, "Chrome runtime gate") doesn't treat this page as the reproduction artifact for a still-open browser-support question — if it does, it's evidence, not dead code, and should stay until that gate closes. Its two test files count toward coverage floors; removing them shifts global coverage slightly.
- **Expected impact:** One fewer duplicate definition of the WebMCP browser contract.
- **Effort estimate:** S

#### BE-S1 The integrity contract's core invariant is enforced by prose, and BE-H1 shows the compose layer has unchecked ordering invariants of its own
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/lib/github/client.ts:192-213, apps/web/lib/github/client.ts:396-425, apps/web/lib/github/merge.ts:53, apps/web/lib/github/merge.ts:86
- **What's happening:** The `client.ts` header states the rule precisely — guards only ever see `primary`; everything else composes onto whichever GitHub-derived value the guards select. That invariant is genuinely upheld (both guard call sites were traced; neither touches overlays). But `_compose` itself carries two positional invariants nothing states or checks: `primaryReviewsSubmittedCount` is only correct if `mergeStats` is called at most once (BE-H1), and `hasSupplementalData` is only correct if the supplemental merge is last in the chain. Adding a fifth platform breaks both silently, in the same shape #1060/#1061 already broke once.
- **Why it matters:** The contract hardened the boundary it was aimed at, then a second boundary with the same fragility grew immediately behind it. The pattern: `mergeStats` is a two-operand function used as a fold, and fields whose semantics are "the first operand's original value" cannot survive that. This is the class of defect, not one instance.
- **Recommendation:** Reshape `_compose` so `mergeStats` folds only genuinely additive fields, and every identity-of-the-GitHub-derived-source field (`primaryReviewsSubmittedCount`, `hasSupplementalData`, and `fetchScope`) is assigned once at the end from the original `githubDerived` value plus the overlay set. A single `_compose` unit test asserting those three fields against a three-overlay fixture would pin the property.
- **Regression risk:** This refactors the exact path #1060/#1061 stabilized, so it must not change what the guards observe — `isDegradedPrFetch` and the scope-rank comparison take `primary` and `baseline` directly and are structurally outside `_compose`; verify that stays true. `fetchScope` must keep flowing from the GitHub-derived value or the non-downgrading rule loses its input. Do this after BE-H1's narrow fix, not instead of it — the narrow fix is what ships before launch, and combining them makes a scoring delta hard to attribute if a score moves unexpectedly.
- **Expected impact:** Adding a data source becomes a `_compose` edit that either works or fails a test, rather than one that silently mis-scores multi-platform users.
- **Effort estimate:** M

## 6. Performance and Scalability Findings (Performance Engineer)

### Domain Model

The hot path is the embeddable badge: `GET /u/:handle/badge.svg` tries a full-response SVG cache in Redis (key = handle + render-variant + UTC date), and on a miss takes rate-limit → Redis SETNX render lock → `materializePublicProfile` → `getStats` → pure `computeImpactV6` → avatar fetch → `renderBadgeSvg` → SVG cache write, with snapshot persistence and telemetry pushed into `after()`. The share page reuses the same materialize and shared SVG cache; `/api/profile/:handle` composes from the baseline only (#1083); `/api/cron/warm-cache` runs hourly pre-warming 50 handles round-robin. Client-side, nine content pages are locale-segmented SSG behind a `proxy.ts` rewrite sharing a root layout with deferred PostHog and Vercel analytics. Three caching layers matter: Vercel CDN, Redis, and Next.js ISR/data cache. **Build verified this session:** `pnpm run build` exit 0, Next.js 16.2.11 Turbopack, compiled 4.1s, 80 static pages in 933ms, zero warnings or errors; largest JS chunk 227.1 KB against the 350 KB budget (PASS, 123 KB headroom); total `.next/static/chunks` 2.3 MB.

#### PE-H1 English dictionary is statically bundled into the shared client JS on every page, including /es
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/i18n/provider.tsx:20, apps/web/lib/i18n/provider.tsx:161, apps/web/lib/i18n/use-translation.ts:5, apps/web/lib/i18n/use-translation.ts:16, apps/web/app/layout.tsx:19-23
- **What's happening:** Both `provider.tsx` and `use-translation.ts` are `'use client'` modules with a top-level static import of the English dictionary, used only as an out-of-provider fallback. Measured from the build: chunk `0bgde_-hqw1qe.js` is 87 KB raw / 30,572 bytes gzipped, contains the English dictionary, and appears as a `<script src>` — not a preload — in the prerendered Spanish page `es.html`, where it is never used. The Spanish dictionary chunk is correctly lazy-only. Landing-page executed First Load JS measured at 796 KB raw / 245,637 bytes gzipped across 16 script chunks; this one dead dictionary is ~12% of the raw total. No single chunk violates the 350 KB budget — the cost is aggregate, which that budget by design does not measure. (Same defect as FE-H1, found independently.)
- **Why it matters:** Every visitor on the default locale downloads, parses, and retains a ~650-key dictionary they will never read. It is the 4th-largest chunk on the critical path and pure waste for the `es` majority.
- **Recommendation:** Remove both static `en` imports. Make the no-provider fallback return the key itself rather than the full dictionary — accepted-risks already states "No production path renders outside the provider," so the fallback exists for tests. Make `dictionary` required on the provider and have tests pass `dictionary={en}` explicitly.
- **Regression risk:** The invariant that must survive: any client component rendered outside `LanguageProvider` must not crash and must not render raw `undefined`. Tests rely on the English fallback and will need explicit dictionaries; a key-echo fallback changes assertion text in those suites. `LanguageProviderInner`'s `useState(dictionary ?? en)` initializer needs a non-optional value. Do NOT fix this by lazy-importing inside a render path: an async dictionary load on first paint reintroduces the locale flash #1023 eliminated.
- **Expected impact:** −87 KB raw / −30.6 KB gzipped from First Load JS on every page, both locales.
- **Effort estimate:** M

#### PE-H2 Badge cold-miss deadline stack sums to ~4.6s against a declared 3.0s SLO, and a Redis SVG write blocks TTFB inside it
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence] for the arithmetic and the blocking write; [inference] for the resulting production p95
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:45-46, apps/web/app/u/[handle]/badge.svg/route.ts:61, apps/web/app/u/[handle]/badge.svg/route.ts:72, apps/web/app/u/[handle]/badge.svg/route.ts:246, apps/web/app/u/[handle]/badge.svg/route.ts:553, apps/web/lib/render/badge-svg-cache.ts:19, apps/web/lib/monitoring/latency-slo.ts:23
- **What's happening:** The cache-miss winner path awaits strictly in sequence: primary SVG cache read (500ms), rate limit (150ms), render lock (250ms), materialize (2200ms), avatar race (1000ms), render, then `await writeBadgeSvgCache(...)` (another 500ms) before the response is constructed. Worst-case bounded total = 4600ms versus `BADGE_LATENCY_SLO_MS.cacheMiss = 3000`. #1029 did exactly this arithmetic for the lock-loser path and truncated its poll schedule to ~950ms; the winner path's own stack was never reconciled the same way. Separately, the final Redis write sits on the response's critical path even though nothing in the response depends on it — the route already has an `after()` block immediately below doing durable work.
- **Why it matters:** The SLO is the project's own stated contract and `/api/cron/latency-check` raises a P2 breach against it. A budget the code's own bounded worst case exceeds by 53% means the monitor measures an unreachable target — either it fires on legitimate degraded-but-working responses, or the budget is fiction. The blocking cache write is the one removable 500ms and is pure TTFB tax on the first viewer of a README badge.
- **Recommendation:** Move the `writeBadgeSvgCache` calls out of `finalizeMaterializedBadge`'s synchronous path into the route's existing `after()`. Then reconcile the remaining stack: either lower the materialize/avatar deadlines, or raise `BADGE_LATENCY_SLO_MS.cacheMiss` to a number the implementation can hold. This is budget-vs-implementation reconciliation, not new monitoring infrastructure.
- **Regression risk:** Moving the write to `after()` trades cache-population timing for latency: a second request arriving between response and `after()` completion sees a miss. The Redis render lock and the in-memory inflight map bound that blast radius, and the loser path polls for ~950ms — but that poll window must remain longer than the `after()` write latency or lock-losers start falling through to their own full render. `warmBadgeCacheInBackground` shares `finalizeMaterializedBadge`, so a return-contract change must keep the background continuation awaiting the write — cache warming is its entire purpose and it has no response to race. Do NOT lower the avatar deadline carelessly: per #1080/#1088 a timeout suppresses the cache write entirely, converting a latency win into a permanent cache-miss loop.
- **Expected impact:** ~500ms off worst-case cold-miss TTFB; an SLO number the code can actually satisfy.
- **Effort estimate:** M

#### PE-M1 /en ships the English dictionary a second time inside the RSC payload
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/[locale]/page.tsx:6, apps/web/app/[locale]/page.tsx:60, apps/web/app/layout.tsx:117-118, apps/web/app/u/[handle]/page.tsx:142, apps/web/app/verify/page.tsx:50, apps/web/app/verify/[hash]/page.tsx:118
- **What's happening:** The root layout is pinned to `DEFAULT_LOCALE` and always serializes the `es` dictionary. Every non-default-locale page therefore passes `dictionary={en}` to a nested provider, serializing the full dictionary into the RSC payload. Measured prerendered HTML: `en.html` = 373,128 bytes vs `es.html` = 277,179 bytes — a 95,949-byte delta matching one dictionary. Combined with PE-H1, an English visitor receives the same dictionary twice: once as a static JS chunk they always download, once embedded in the HTML.
- **Why it matters:** ~96 KB of extra HTML per English page load with no cross-page reuse, on top of the 87 KB static chunk. The two mechanisms are coupled: fixing PE-H1 alone makes this prop necessary; fixing this alone leaves the dead chunk. They must be reasoned about together.
- **Recommendation:** Pick one delivery mechanism. Cleanest: keep the RSC-payload path (per-locale and correct), fix PE-H1 to drop the static chunk, and accept ~96 KB inline for `en` visitors only. Better still, split the dictionary so a page serializes only the key subtrees it renders — the `t('section.key')` shape makes subtree extraction mechanical.
- **Regression risk:** Subtree splitting must not break `parity.test.ts` or `resolveTranslation`'s miss behavior of returning the key string — a missing subtree would silently render raw key paths in production rather than throwing. The #1071/#1108 pass-through freeze exists to avoid a subtree remount; a change to what `dictionary` contains must not change whether it is passed, or that frozen decision flips and the duplicate-content bug returns. Client-side locale switching still needs the full dictionary, so a split must keep the dynamic-import path whole.
- **Expected impact:** Up to ~96 KB less HTML per English page load; materially less for both locales with subtree splitting.
- **Effort estimate:** M

#### PE-M2 warm-cache re-renders and rewrites every handle's badge SVG hourly with no read-before-write
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence] for the code path, cadence, and SVG size; [inference] for total daily bandwidth
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:420-446, apps/web/app/api/cron/warm-cache/route.ts:64, apps/web/lib/render/badge-svg-cache.ts:36-37, apps/web/lib/github/client.ts:22
- **What's happening:** #1089 added badge-SVG pre-warming to `warmHandle`. It unconditionally resolves the avatar, calls `renderBadgeSvg`, and calls `writeBadgeSvgCache` with no check of whether the cache key already holds a value. The cron runs hourly over 50 handles. The stats cache TTL is 6h, so within any 6-hour window the rendered SVG is byte-identical to what Redis already holds. At 50 handles × 24 runs/day that is ~1,200 renders and ~1,200 large Redis writes per day, of which roughly 20 of every 24 per handle rewrite identical bytes.
- **Why it matters:** Upstash bills per command and per byte; this is the largest write-volume producer in the system and ~83% of it is redundant. It also consumes the cron's 270s time budget — the budget that determines how far the rotation offset advances per run.
- **Recommendation:** Read the SVG cache key first and skip render+write when already populated. The date-scoped key means the first run after UTC midnight still repopulates, which is the case #1089 actually solved.
- **Regression risk:** The #1089 invariant must hold: the first real visitor after UTC rollover must get a cache hit — a read-before-write skip preserves that. But it also means a mid-day score change (an EMU upload setting `stats:dirty:`, a linked-platform connect, `/api/recalculate`) would not reach the pre-warmed SVG until the next rollover; today the hourly rewrite incidentally masks that. Confirm whether any invalidation path deletes the badge SVG key — `invalidateSnapshotCache` and `post-write-invalidation.ts` handle the snapshot cache. If they do not also clear the badge key, this skip converts a bandwidth win into a stale-badge correctness bug, so explicit invalidation must land first.
- **Expected impact:** ~80% reduction in cron Redis write volume and badge render CPU.
- **Effort estimate:** S

#### PE-M3 Feature-flag in-process Map bypasses unstable_cache, making ISR revalidate nondeterministic across the 9 content pages
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/feature-flags.ts:44-77, apps/web/lib/feature-flags.ts:63, apps/web/lib/feature-flags.ts:66-77, apps/web/app/layout.tsx:88-102, apps/web/app/[locale]/page.tsx:18
- **What's happening:** All nine content pages declare `revalidate = 3600`. The build output disagrees with itself — verbatim from this run, `/[locale]/about/verification` resolves to 1h for `/es` and 5m for `/en`, while `/[locale]/archetypes/marathoner` resolves to 1h for `/en` and 5m for `/es`. Root cause: `checkFlag` consults a module-level `flagCache` Map before `fetchFlagFromDbCached`, an `unstable_cache` entry declared `{ revalidate: 300 }`. The root layout awaits six flag reads on every render. On a Map miss, Next registers the 300s data-cache dependency and clamps the page's ISR revalidate to 300s; on a Map hit, `unstable_cache` is never touched and the page keeps 3600s. Worker scheduling therefore decides each page's revalidate.
- **Why it matters:** Nondeterministic build output from identical source, and up to 12× more origin re-renders than declared for whichever pages land on 300s. Each re-render is a full RSC render including the ~43 KB demo badge SVG on the landing page. It also makes "did my change affect ISR?" comparisons unreliable.
- **Recommendation:** Raise the `unstable_cache` revalidate to 3600 to match its consumers. Propagation is already tag-driven — `FEATURE_FLAG_CACHE_TAG` exists and the admin flag route revalidates it — so a longer TTL does not delay flag flips.
- **Regression risk:** The Map's 5-minute TTL is currently the only staleness bound on a serverless instance that never sees a tag revalidation (tag invalidation does not reach a warm lambda's local Map). Removing the Map without confirming `revalidateTag` propagation would extend worst-case flag staleness on a long-lived instance from 5 min to 60 min. Raising the `unstable_cache` revalidate alone is the safer half and does not touch the Map. Verify `invalidateFeatureFlagCache` is called on every admin flag-mutation path before relying on tags.
- **Expected impact:** Deterministic build output; up to 12× fewer ISR regenerations on affected pages.
- **Effort estimate:** S

#### PE-M4 _fetchAndCache serializes four Redis round-trips around the GitHub fetch on the badge cold-miss path
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence] for the serialization; [inference] for the millisecond cost
- **Files:** apps/web/lib/github/client.ts:448, apps/web/lib/github/client.ts:459, apps/web/lib/github/client.ts:522, apps/web/lib/github/client.ts:542, apps/web/lib/github/client.ts:548
- **What's happening:** On a cold stats key: `await cacheGet(baselineKey)` → `await Promise.all([fetchStats, _loadOverlays])` → `await cacheGet(cacheKey)` → `await cacheSet(cacheKey, composed)` → `await cacheSet(baselineKey, primary)`. The first read has no data dependency on the GitHub fetch — the guards need `baseline` only after `primary` exists — yet it sits strictly in front of the two slowest network legs. The two trailing writes are independent of each other and run back-to-back. That is 2 avoidable serial Upstash round-trips on a path PE-H2 shows is already over budget.
- **Why it matters:** This is the badge cache-miss path and the share page's first-render path. Upstash REST round-trips from a Vercel function are typically tens of milliseconds each; two of them are a small but free slice of a 3000ms budget the code currently cannot hold.
- **Recommendation:** Fold the baseline read into the existing `Promise.all`. Leave the trailing writes alone unless their ordering is proven irrelevant.
- **Regression risk:** This is the #1004/#1060 integrity contract — the invariant that must survive is that `isDegradedPrFetch` and the scope-rank comparison see only `primary` and `baseline`, never overlays, and that `_compose` runs strictly after both. Hoisting the baseline read does not change what the guards see, but the `!primary` early-return reads `baseline` and must still get the settled value — use `Promise.all`, not `allSettled` with a null fallback that would silently disable degraded-fetch protection. For the writes: the current order means a crash between them leaves a composed value with no matching baseline, which the next fetch heals; parallelizing loses that ordering and could promote a baseline without its composed counterpart.
- **Expected impact:** One Redis round-trip removed from every cold-miss badge and share-page render.
- **Effort estimate:** S

#### PE-L1 Share page serializes the SVG cache read after the materialize wave instead of alongside it
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/page.tsx:189-194, apps/web/app/u/[handle]/page.tsx:213
- **What's happening:** `SharePageContent` correctly parallelizes session, materialize, trend, and flag reads in one `Promise.all`, then does `await readBadgeSvgCache(svgCacheKey)` as a strictly later step. That Redis read depends on nothing in the wave — only on `handle` and today's date, both known at function entry. The badge route already applies exactly this optimization to its own stale-SVG lookup.
- **Why it matters:** One serial Redis round-trip in front of share-page TTFB on every render, warm or cold.
- **Recommendation:** Kick off `readBadgeSvgCache(svgCacheKey)` before the `Promise.all` and await it after, or add it as a fifth member of the wave.
- **Regression risk:** `today`/`svgCacheKey` are computed after the wave; hoisting is semantically neutral but must use the same `toDateString(new Date())` value the later `writeBadgeSvgCache` uses — compute the date once and reuse it, or a UTC-midnight-crossing request could read one day's key and write another's. The `!cachedSvg && stats && impact` branch must keep its ordering: a cache read resolving before materialize must not skip the null checks.
- **Expected impact:** One Redis round-trip off share-page TTFB.
- **Effort estimate:** S

#### PE-L2 /api/profile/:handle reads the same snapshot key twice per request
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/profile/[handle]/route.ts:78, apps/web/app/api/profile/[handle]/route.ts:95, apps/web/lib/profile/materialize-profile.ts:195, apps/web/lib/cache/snapshot-cache.ts:33-56
- **What's happening:** The route calls `getCachedLatestSnapshot(handle)` directly, then `getDisplayHeadline(handle)` → `materializePublicProfile(readOnly: true)` → `materializeProfile` → `getCachedLatestSnapshot(handle)` again. There is no request-level memoization, so this is two identical Redis reads — or two Supabase queries on a cold snapshot key — per request on a public, CORS-enabled, externally-consumed endpoint. The route is additionally fully serial.
- **Why it matters:** Doubles snapshot-lookup cost on the one endpoint designed for third-party portfolio embeds, where request volume is least under Chapa's control. The `s-maxage=300` header limits but does not eliminate the exposure.
- **Recommendation:** Pass the already-fetched snapshot into the materialize call — the internal `materializeImpactState` already accepts `latestSnapshot`, so exposing it is a small change. Alternatively wrap `getCachedLatestSnapshot` in React's `cache()` for per-request dedup.
- **Regression risk:** `materializeProfile` uses the snapshot for EMA smoothing of the persisted trend value only (#1001), and this call site is `readOnly: true` so nothing is persisted — while `displayScore`/`displayTier` come from `displayImpact`, which per #1001 is the fresh score. Confirm that before threading the value through: if `displayImpact` is genuinely snapshot-independent on this path, the second read may be removable outright rather than deduplicated. Do NOT use `ignoreSnapshot: true` as the fix — that flag exists for admin bulk-recalculate and changes smoothing semantics.
- **Expected impact:** One Redis or Supabase read removed per public profile API request.
- **Effort estimate:** S

#### PE-L3 warm-cache avatar resolution runs with no deadline, up to 2s per handle inside the cron time budget
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:420-423, apps/web/app/api/cron/warm-cache/route.ts:77, apps/web/lib/render/avatar-outcome.ts:16-40
- **What's happening:** `resolveBadgeAvatar(handle, avatarUrl)` is called with no `options.deadlineMs`, so the only bound is the 2000ms internal abort in `lib/render/avatar.ts`. Both request paths pass explicit deadlines (badge route 1000ms, share page 250ms). With `BATCH_SIZE = 5` over 50 handles, a broadly slow avatar CDN adds up to ~20s to a 270s budget.
- **Why it matters:** The cron's time budget determines how far the rotation offset advances; time blocked on avatars is time not warming handles, and a budget-exceeded run fires a P2 alert.
- **Recommendation:** Pass an explicit deadline (e.g. 1500ms — looser than the request paths since latency is not user-facing here) so the bound is stated rather than inherited.
- **Regression risk:** A deadline produces `{ status: "timeout" }`, which the cache policy maps to "skip" — meaning no SVG is written for that handle at all that run, defeating the #1089 pre-warm this code exists for. That is correct behavior (a placeholder must not be published), but a too-tight deadline silently converts pre-warming into a no-op for slow-avatar handles. Keep the deadline comfortably above observed avatar-cache-hit latency.
- **Expected impact:** A stated, tunable bound on the cron's avatar cost.
- **Effort estimate:** S

#### PE-L4 Full posthog-js bundle (190.3 KB) loaded when only capture is used
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/components/PostHogProvider.tsx:18, apps/web/lib/analytics/posthog.ts:17-27, apps/web/next.config.ts:40
- **What's happening:** `import("posthog-js")` pulls the default entry point — measured chunk `2cz6l19i7nua_.js` at 190.3 KB raw, the second-largest chunk in the build. It is correctly not in any prerendered page's script set and loads only on first interaction or after a 5s fallback timer. The only consumer is `trackEvent` → `ph.capture(...)`, with `capture_pageview: false`. Session replay, surveys, autocapture and web-vitals machinery all ship unused.
- **Why it matters:** 190 KB of main-thread parse work on interaction. The deferred loading strategy is already correct, which is why this is low.
- **Recommendation:** Switch to a slimmer entry point (posthog-js publishes builds that drop session recording and surveys) or replace with a direct fetch to the capture endpoint, given the sole use is `capture`.
- **Regression risk:** Slim entry points change what `posthog.init` accepts and what `ph.__loaded` means; posthog.ts:23 gates on `ph.__loaded`, so verify that flag exists on the chosen build or the gate silently drops every event. `capture_pageleave: true` depends on posthog's own lifecycle listeners — confirm it survives the swap or pageleave analytics vanish with no error. Check the CSP `connect-src` still matches whatever host the slim build posts to. This is analytics, so a silent regression would go unnoticed — add an explicit smoke check of one captured event.
- **Expected impact:** Up to ~120 KB less deferred JS to parse.
- **Effort estimate:** M

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

### Domain Model

Chapa deploys from `main` to Vercel (Root Directory `apps/web`, so `apps/web/vercel.json` owns the 4 cron registrations and function `maxDuration`s), with `develop` as the integration branch; production identity at audit time is `4f6265c3` == `origin/main` == tag `v2.23.0`. Config lives in three places: Vercel production env vars, Supabase `feature_flags` rows (DB-authoritative with env fallback), and migrations applied manually with no deploy runner. Every env read funnels through `apps/web/lib/env.ts`, enforced by an ESLint rule. CI is a 9-workflow suite gated by branch protection on both branches with `strict: true`, plus an exact-SHA "already validated by PR" skip path. Observability has three layers: `/api/health` (Redis + Supabase + GitHub `repo`-scope probe + 4 cron heartbeats), PostHog server-event capture, and a push alert channel carrying 9 P1/P2 signals. **Verified live this session:** all 15 recent `develop` CI runs `success` (one intentional `skipped`); `check:vercel-config` exit 0; production `/api/health` HTTP 200 with redis/supabase/github all `ok` and all four cron heartbeats fresh; `/api/version` matches `origin/main` and `v2.23.0` exactly; branch protection `strict` on both branches with `enforce_admins` on `main`; all four cron handlers call `verifyCronSecret` first and fail secure; `error.tsx`/`global-error.tsx`/`not-found.tsx` all present plus 12 route-scoped boundaries; 36 contiguously-numbered migrations with destructive statements guarded.

#### DO-B1 The entire P1/P2 alert channel is inert in production, and /api/health deliberately does not fail on it
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/analytics/server-errors.ts:125, apps/web/app/api/health/route.ts:247, apps/web/app/api/health/route.ts:220-238, apps/web/app/api/cron/warm-cache/route.ts:306, apps/web/app/api/cron/latency-check/route.ts:78, docs/runbooks/observability.md:113
- **What's happening:** `CHAPA_ALERT_WEBHOOK_URL` is not present in Vercel Production — confirmed two ways: absent from `npx vercel env ls production` (30 vars, no such entry), and production `/api/health` returns `"alertWebhook":"skipped"` with `"status":"ok"`, HTTP 200 (fetched 2026-08-27T08:24:16Z). `captureOperationalAlert` short-circuits at server-errors.ts:125 with `if (!webhookUrl) return;`. All 9 signals — `health_degraded`, `badge_5xx`, `oauth_callback_failure`, `cron_failure`, `warm_cache_high_failure_rate`, `warm_cache_ceiling_approached`, `warm_cache_time_budget_exceeded`, `badge_latency_slo_breach`, `profile_snapshot_write_reconciliation` — are delivered nowhere. Six have no second delivery path. Separately, health/route.ts:220-222 states the design intent — "In production, skipped core dependencies indicate missing runtime configuration and must fail health" — and enforces it for redis, supabase, github; `alertWebhook` is reported in `dependencies` but excluded from the `status` expression, so the one dependency that *is* the monitoring is exempt from the missing-configuration check.
- **Why it matters:** Launch-blocker because the failure it hides is the one launch causes. `warm_cache_ceiling_approached` fires at 50 handles — a public launch crossing 50 users is precisely the trigger, and that alert is the only signal that badge data is going stale on a lengthening rotation. `health_degraded` covers Redis outage, Supabase outage, GitHub `insufficient_scope` (the #1050 silent score-collapse mode), and all four cron heartbeats. All of it currently posts to `undefined`. This is not a request to add monitoring infrastructure — it is fully built, tested, secret-scrubbed, and shipped; one environment variable is missing.
- **Recommendation:** Set `CHAPA_ALERT_WEBHOOK_URL` in Vercel Production before launch, then verify with `curl .../api/health | jq .dependencies.alertWebhook` returning `"configured"`. Separately, add `alertWebhook` to the production `isHealthy` set so the endpoint degrades when the alert path is unconfigured in production.
- **Regression risk:** Adding `alertWebhook` to the status expression makes `/api/health` return 503 in preview deployments unless the var is scoped to Preview too — gate it on `isProduction` exactly as the existing helper does, or `deployment-smoke`'s `assertCoreDependencies` will start failing preview PRs. Honor the #1052 lesson encoded in smoke.spec.ts:20-40: a health gate must never be satisfiable only by the change it blocks. Making a missing webhook degrade health is safe (setting an env var needs no deploy), but a webhook whose endpoint is down must not degrade health — check configuration presence only, never delivery success, or a Discord outage becomes a Chapa outage. Finally, once alerts deliver, `warm_cache_ceiling_approached` fires on every hourly run while user count ≥ 50 (24/day, no throttling — see BE-L5); confirm that is tolerable before launch rather than discovering it as pager noise on day one.
- **Expected impact:** Redis/Supabase/GitHub outages, dead crons, badge 5xx storms, OAuth breakage, latency SLO breaches, and the warm-cache ceiling become observable in real time instead of at the next daily CI probe or not at all.
- **Effort estimate:** S

#### DO-H1 The outage playbook tells the operator to mint a replacement GITHUB_TOKEN without stating the repo-scope requirement
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/runbooks/outage-playbook.md:70-71, docs/runbooks/secret-rotation.md:9-117, apps/web/lib/github/client.ts:244-266, apps/web/app/api/health/route.ts:52-74
- **What's happening:** outage-playbook.md:70 reads verbatim: "If the fallback `GITHUB_TOKEN` is rate-limited: it's a shared token — authenticated users have independent limits. Consider generating a new PAT with higher rate limits." It says nothing about scopes. `secret-rotation.md` has sections for nine other secrets and no `GITHUB_TOKEN` section at all. Meanwhile the codebase treats that token's `repo` scope as a load-bearing invariant: `_classifyScope` labels a tokenless fetch "authenticated" (private-inclusive) precisely because the server PAT holds `repo`, and the health probe's own comment records the measured consequence of losing it — 987 merged PRs visible with `repo`, 140 without; Delivery 100 → 58, "with no error raised anywhere".
- **Why it matters:** The one document an operator reads while firefighting a GitHub rate-limit incident actively directs them toward the action that silently corrupts every user's score, at the moment they are least likely to cross-check CLAUDE.md. GitHub's PAT creation UI defaults to no scopes selected, so the natural execution of line 70 produces a scope-blind token. Blast radius is every badge in the system, the product keeps rendering normally, and the only detector is the daily nightly probe. This is not new rotation infrastructure — it is a correction to an existing runbook instruction that is wrong, guarding a data-corruption path.
- **Recommendation:** Amend outage-playbook.md:70 to read "generate a new classic PAT with `repo` scope", and add a two-line `## GITHUB_TOKEN` entry to secret-rotation.md stating the requirement plus the verification step: after rotating, `/api/health` `.dependencies.github` must return `"ok"`, not `"insufficient_scope"`. Note the production `GITHUB_TOKEN` was created 67 days ago; if it carries an expiry, confirm it outlasts launch.
- **Regression risk:** The instruction must stay consistent with `OAUTH_SCOPES` if the OAuth app ever gains `repo` — `_classifyScope` derives its constant from that precisely so the two do not drift, and a hardcoded "repo scope required" line would become the stale copy. Reference the health probe's `insufficient_scope` status as the authority rather than restating the scope list. Documentation-only: no code path, cache boundary, or `fetchScope` ranking changes.
- **Expected impact:** Closes the one procedural path that can reintroduce the #1050 silent score collapse, at zero maintenance cost.
- **Effort estimate:** S

#### DO-M1 main branch protection does not require the pending-migrations or contract checks, and a migration is pending right now
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/ci.yml:802-803, .github/workflows/ci.yml:330, .github/workflows/ci.yml:822-824, docs/release/release-playbook.md:91, docs/runbooks/migrations.md:90, supabase/migrations/036_seed_webmcp_flags.sql:1
- **What's happening:** `gh api .../branches/main/protection` returns 11 required contexts; neither `Pending Migrations Check (release PR)` nor `Contract (real DB)` is among them. Both jobs exist and run on release PRs — the required Supabase secrets are configured, so the self-skip path is not active. Migrations are applied manually with no deploy hook, and `036_seed_webmcp_flags.sql` is on `develop` and unapplied to production — confirmed by production `/api/feature-flags`, which returns 13 flags with no `webmcp_enabled` or `studio_demo_enabled` row. The playbook gates on this at step 3.3, but step 4.1 then arms `gh pr merge --squash --auto`, which fires the instant the 11 required contexts go green regardless of the migration job's state.
- **Why it matters:** The gap between "the gate runs" and "the gate blocks" is where schema/code ordering violations ship. migrations.md:122 states migrations must be applied before the code depending on them goes live; nothing mechanically enforces that. The residual window is narrow because the operator checks at step 3.3, but auto-merge re-evaluates only required contexts, so a re-run or re-push after that check can promote a candidate whose migration status changed. With a real migration pending on the very next release, this is live rather than hypothetical.
- **Recommendation:** Add both contexts to `main`'s required status checks. This adds no new CI — both jobs already run on every release PR and already emit release evidence.
- **Regression risk:** The pending-migrations job self-skips when its Supabase secrets are absent; as a required context a skipped job reports neutral, which GitHub treats as not-success and would block the release PR outright rather than degrading to the manual checklist. That is arguably correct fail-closed behavior, but it converts a documented soft fallback into a hard stop — make the secrets' presence part of pre-release verification. `Contract (real DB)` spins up a real database and is the slowest job; requiring it means a flaky container start blocks a release. Note `develop`'s protection deliberately omits `Contract (real DB)` and that omission is load-bearing — `validate-merged-pr.yml`'s `required_checks` list does include it, so a develop merge without a green contract run correctly yields `validated_by_pr=false` and re-runs full CI. Do not harmonize the two lists.
- **Expected impact:** Schema-ahead-of-code ordering becomes mechanically enforced rather than procedurally enforced.
- **Effort estimate:** S

#### DO-M2 A uniform 26-hour staleness threshold is applied to the hourly warm-cache cron
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/health/route.ts:18, apps/web/app/api/health/route.ts:40-45, apps/web/app/api/health/route.ts:183, apps/web/app/api/cron/warm-cache/route.ts:59-66
- **What's happening:** `CRON_HEARTBEAT_TTL_MS = 26 * 60 * 60 * 1000` is applied identically to all four entries in `CRON_HEARTBEATS`. Three of those crons are daily, for which 26h is a correct one-cycle-plus-slack window. `warm-cache` runs hourly since #1010, so it must miss ~26 consecutive scheduled runs before health notices. Production heartbeats read healthy at audit time (`warm-cache` ageMs 1,312,743 ≈ 22 min).
- **Why it matters:** `warm-cache` is the highest-consequence job in the set — the private-inclusive server-token path that heals degraded stats (#1002), captures snapshots, warms badge SVGs, and sends score-bump notifications. A day-long outage degrades badge freshness and drops a day of trend history for every user while `/api/health` reports ok. The #1010 change that made it hourly did not adjust the threshold watching it, so detection is now ~26x looser than cadence — the same silent-failure shape as #1052.
- **Recommendation:** Replace the scalar with a per-cron map derived from cadence — e.g. warm-cache 3h, the other three 26h — keeping 26h as the default for any cron added later.
- **Regression risk:** The tighter window must stay comfortably above the job's own worst-case duration: `warm-cache` has `maxDuration = 300` and a 270s time budget, and writes its heartbeat on completion — a full-budget run lands well inside 3h, but do not tighten toward 1h. Critically, the grace-anchor logic at health/route.ts:121-149 uses the same constant for both per-cron staleness and the first-deploy grace window; splitting must not shorten the grace anchor, or a fresh deploy reports the daily crons dead before their first scheduled run — the exact "gate blocks its own fix" failure #1052 documented. Keep the grace window at 26h and vary only the per-cron comparison. Note this finding only pays off once DO-B1 is fixed.
- **Expected impact:** Warm-cache death is detected within one rotation instead of one day.
- **Effort estimate:** S

#### DO-L1 Two shipped feature-flag env vars are absent from both CLAUDE.md and .env.example
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/env.ts:271, apps/web/lib/env.ts:276, apps/web/lib/env.ts:22-33, apps/web/lib/feature-flags.ts:56-77, .env.example:1
- **What's happening:** Diffing both directions — every variable read via `readTrimmed`/`readBool`/`readList` (27) plus every `NEXT_PUBLIC_*` read via `clean()` (11) against `.env.example` (33 entries) and CLAUDE.md — two are read but documented nowhere: `NEXT_PUBLIC_STUDIO_DEMO_ENABLED` and `NEXT_PUBLIC_WEBMCP_ENABLED`, both added by this week's unreleased commits. There is no drift in the opposite direction. (Same defect as AR-M3.)
- **Why it matters:** Both are `NEXT_PUBLIC_*`, which env.ts documents as requiring a static literal because Next.js inlines them at build time — so unlike the DB-backed flags they cannot be flipped without a redeploy. An operator enabling WebMCP by toggling only the DB row gets correct server behavior but a client bundle built with the value already baked in, and nothing in the documented env list would tell them a second lever exists.
- **Recommendation:** Add both to `.env.example` and CLAUDE.md's Environment Variables block alongside `NEXT_PUBLIC_STUDIO_ENABLED`, noting that the DB `feature_flags` row overrides them.
- **Regression risk:** Documentation-only; no behavior change. The wording matters: `checkFlag` falls back to the env var only when the DB row is absent or the lookup times out (500ms). Documenting these as plain on/off switches would be wrong in the opposite direction and could lead someone to set the env var as a kill switch, which it is not — during a Supabase outage the env var becomes authoritative, so `NEXT_PUBLIC_WEBMCP_ENABLED=true` would keep WebMCP on precisely when the DB kill switch cannot be reached.
- **Expected impact:** Removes a two-lever gotcha from the one document an operator consults when configuring a new environment.
- **Effort estimate:** S

#### DO-L2 Orphan COMING_SOON variable in Vercel Production
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/env.ts:1, apps/web/app/coming-soon/page.tsx:1, apps/web/eslint.config.mjs:25-61
- **What's happening:** `npx vercel env ls production` lists `COMING_SOON` (Config, Production scope, created 197 days ago). Nothing reads it: no accessor in `env.ts`, and a repo-wide grep returns only unrelated `comingSoon` i18n keys and a plain static route with no env gate. The `no-process-env` rule makes it structurally impossible for it to be read outside `env.ts`.
- **Why it matters:** A production variable named `COMING_SOON` implies a maintenance/holding-page kill switch that does not exist. During an incident an operator could reasonably reach for it, discover it does nothing, and lose time.
- **Recommendation:** Remove it with `vercel env rm COMING_SOON production`, or wire it to a real accessor if a holding-page switch is wanted. Removal is a production-config change and needs explicit authorization.
- **Regression risk:** Before removing, confirm no Vercel-side mechanism outside this repo consumes it (a redirect rule, Edge Config, or a Deployment Protection setting) — the grep proves the application does not read it, not that the platform does not. Removal changes no bundle, since a var no accessor references is never inlined.
- **Expected impact:** Config surface matches what the code actually reads.
- **Effort estimate:** S

#### DO-L3 The observability runbook describes an alert path as real-time that is polled once daily
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** docs/runbooks/observability.md:113, docs/runbooks/observability.md:95-105, .github/workflows/nightly-prod-probe.yml:4-5, apps/web/e2e/helpers/deployment-probes.ts:13, apps/web/app/api/health/route.ts:253
- **What's happening:** observability.md:113 characterizes the alert webhook as "push, real-time, 'wake me up now'", and lines 95-105 present cron-heartbeat staleness as caught by `/api/health` raising `health_degraded`. But `health_degraded` is emitted only inside the `/api/health` GET handler, so it is evaluated only when something polls the endpoint. The only automated production poller is `nightly-prod-probe.yml`, scheduled `0 5 * * *` — once daily. Detection latency for a Redis outage, an `insufficient_scope` token, or a stale cron is therefore up to 24h, on top of DO-M2's 26h threshold.
- **Why it matters:** An incident responder reading this runbook will believe health degradation pages them and will not think to poll manually. Mis-set expectations during an incident are their own hazard. This is documentation accuracy, not a request for an uptime monitor.
- **Recommendation:** Correct the line to state what is true — the webhook is genuinely push for signals raised on the request path (`badge_5xx`, `oauth_callback_failure`, `cron_failure`, the `warm_cache_*` signals, `badge_latency_slo_breach`), while `health_degraded` specifically is pull-evaluated and reaches the webhook only when `/api/health` is polled, currently once daily.
- **Regression risk:** Documentation-only as recommended. If the inline-evaluation option is ever taken (the hourly warm-cache cron could evaluate the same dependency set), note that `/api/health` rate-limits and that `cachedPingGitHub` exists to bound GitHub quota consumption — an hourly self-check must reuse that caching rather than issuing a fresh probe, and must not let a health-check failure fail the warm-cache run itself, or a Redis blip converts a monitoring miss into a data-freshness outage.
- **Expected impact:** The runbook's stated detection latency matches reality.
- **Effort estimate:** S

## 8. Security / Privacy Findings (Security Reviewer)

### Domain Model

Chapa has four trust tiers. Public/unauthenticated: badge SVG, share page, `/api/profile`, `/api/history`, `/api/verify`, `/api/insights/:handle`, `/api/feature-flags`, `/api/version`, `/api/telemetry` — all IP-rate-limited via the fail-open limiter, with two deliberately wildcard-CORS'd for third-party embeds. Session-authenticated: an AES-256-GCM-encrypted stateless `chapa_session` cookie (HttpOnly/Secure/SameSite=Lax, 24h `iat`) guarding write routes, which use the fail-closed limiter and funnel per-handle targeting through a single `assertHandleOwnership()` gate. Bearer-authenticated: `resolveRequestAuth()` accepts a 90-day HMAC CLI token or a GitHub PAT. Privileged: `ADMIN_HANDLES` session checks or `ADMIN_SECRET`/`CRON_SECRET` bearer tokens compared with `timingSafeEqual`, all fail-secure when unconfigured. User-controlled data enters at the platform fetch layer, the CLI uploads, and OAuth profile fields; it is rendered into SVG (escaped by `escapeXml`), into HTML (React), and persisted to Supabase (RLS default-deny, service-role-only) and Redis. **The new trust boundary is WebMCP** — the share and verify pages register read-only tools into a visitor's browser AI agent, so profile-derived text now crosses into an agent's instruction context. **Scanner results verified this session:** `pnpm run check:vulnerabilities` PASS — "Scanned pnpm-lock.yaml and found 680 packages", "no high/critical vulnerabilities with an available fix", and since the script prints all non-blocking findings and printed none, the count of known OSV advisories is zero at every severity. `pnpm run check:licenses` PASS — 98 production packages scanned, all allowed or documented. Secret scan: 8 matches, all synthetic fixtures in `server-errors.test.ts` asserting the redaction path; no real credentials; only `.env.example` is tracked.

#### SE-H1 CLI device authorization has no device/user-code binding to the browser approval
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/cli/authorize/page.tsx:29-72, apps/web/app/cli/authorize/AuthorizeClient.tsx:12-31, apps/web/app/api/cli/auth/approve/route.ts:46-69, apps/web/lib/auth/cli-token.ts:20, apps/web/lib/auth/resolve-request-auth.ts:20-43
- **What's happening:** The device-authorization flow takes the session id purely from the URL and the approval page presents only an "Authorize CLI" button plus the viewer's own handle — there is no code shown in the terminal that the user must compare or type before approving. `POST /api/cli/auth/approve` then stamps `handle: session.login` onto whatever `sessionId` the page was loaded with, and the polling device redeems a token bearing that handle. This is the omitted half of RFC 8628: the poll route implements the `device_code` leg thoroughly so a passive observer of the session id cannot redeem, but nothing binds the *approval* to the device that started the flow. SameSite=Lax blocks a cross-site POST, so the vector is a link the victim opens themselves. The resulting token lives 90 days, has no revocation path, and is accepted on `/api/supplemental`, `/api/insights`, and `/api/recalculate`.
- **Why it matters:** A token obtained this way lets a third party write scoring inputs for someone else's handle for three months — EMU supplemental stats and craft/insights uploads both feed the public Impact score. For a product whose value proposition is an attestable, HMAC-verified score, an unrevocable write path into another person's score is a credibility problem, not just a data-integrity one. Launch is exactly when the population of users who will click an unfamiliar link stops being one person.
- **Recommendation:** Have the CLI display a short user code derived from (or stored alongside) the `deviceCode` it already receives on first poll, render that code on `/cli/authorize`, and require the user to confirm it matches before `approve` will bind the handle. Reject approvals for sessions whose `deviceCode` was never issued. Shorter-term partial mitigations: state which device/IP initiated the request, and shorten the token expiry.
- **Regression risk:** The poll route's backward-compatibility contract is load-bearing and easy to break — the legacy sessionId-only path exists because the CLI is an external binary not in this repo. A user-code requirement enforced on `approve` will hard-break every already-distributed CLI that does not print one, because approval is the CLI-agnostic half of the flow. Safe sequencing: ship the CLI change first, gate enforcement on the session actually carrying a `deviceCode` (mirroring the existing opt-in latch), and only then remove the legacy path. The invariant that must survive: `approve` must never *create* a session — if it does, the device-code binding is bypassed by calling approve before any poll.
- **Expected impact:** Closes the last unbound leg of the device flow; a phished approval link becomes useless without the code shown in the victim's own terminal.
- **Effort estimate:** M

#### SE-M1 /api/telemetry client-error branch returns before every rate limit, and its payload is shipped to PostHog unsanitized
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/telemetry/route.ts:21-31, apps/web/app/api/telemetry/route.ts:40-69, apps/web/lib/analytics/server-errors.ts:157-183
- **What's happening:** `isClientErrorTelemetryPayload(body)` is evaluated at line 21 and returns at line 30, above the IP floor limit (60/60s), the IP daily ceiling (600/24h), and the per-handle limit — all three added deliberately, with a comment explaining they exist "to prevent an attacker from rotating targetHandle to bypass per-handle limits." Any unauthenticated POST matching the two-field shape skips all of them and reaches `captureServerEvent`, which performs an outbound fetch to PostHog. Separately, `captureServerEvent` has no `sanitize()` call, unlike `captureServerError` and `captureOperationalAlert` — client-supplied `message` and `stack` are forwarded verbatim, so a token appearing in a genuine client-side error string is relayed to the analytics vendor un-redacted. (Same defect as BE-M4, found independently; this entry adds the sanitization half.)
- **Why it matters:** A bypass of controls that already exist. It gives an unauthenticated caller unmetered outbound requests from the serverless function (Vercel duration + PostHog quota) and lets arbitrary strings be injected into the analytics stream under `distinct_id: "chapa-server"`, indistinguishable from real errors — degrading the one signal used to notice production degradation. The missing sanitize is an inconsistency in a module whose stated design goal is stripping secrets.
- **Recommendation:** Move the branch below the two IP rate-limit checks (it does not need the per-handle one, which depends on a validated `targetHandle`). Add `sanitize()` to `captureServerEvent`'s properties, matching `captureServerError`.
- **Regression risk:** The branch sits above the limits partly because it precedes `isValidTelemetryPayload` and has no `targetHandle` to key on — the fix must keep it above the per-handle check while moving it below the IP checks, or client error reporting breaks for every payload lacking a target handle. Adding `sanitize()` changes what lands in PostHog: the broad `token|secret|key|password|credential|authorization|bearer` pattern will redact benign strings like `key: delivery`, so existing PostHog queries on client_error text may stop matching — that trade favors sanitization. The fix slightly reduces error-reporting availability under sustained abuse from one IP; acceptable, since the alternative is the sink being unusable.
- **Expected impact:** All telemetry ingress becomes metered; no un-redacted client strings reach the analytics vendor.
- **Effort estimate:** S

#### SE-M2 Attacker-controlled displayName flows verbatim from a public page into a browser AI agent's tool result
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/SharePageWebMcpTools.tsx:59-70, apps/web/app/u/[handle]/SharePageWebMcpTools.tsx:104-121, apps/web/lib/render/BadgeSvg.tsx:52, apps/web/lib/render/escape.ts:18-25
- **What's happening:** `publicStats()` passes `stats.displayName` through unmodified into the JSON returned by `get_impact_profile`, a tool registered on every public share page for any visitor's browser agent. `displayName` originates from the GitHub profile `name` field, which its owner sets to arbitrary text; nothing between GitHub and the tool result caps its length, strips control characters, or delimits it as data. Every other rendering path for this same value is defended — `escapeXml` for SVG, React escaping for HTML — because those sinks have a known injection grammar. The agent-context sink has one too (natural-language instructions), and it is the only sink with no treatment. The `untrustedContentHint: true` annotation is present and correct on this tool, but it is a hint to a consumer Chapa does not control, not a control Chapa enforces.
- **Why it matters:** Anyone can create a GitHub account, set a display name to instruction-shaped text, generate a badge, and publish the share-page link. A visitor whose browser agent reads that page ingests the text as tool output. Chapa cannot control what the agent does next, which is exactly why the content it emits should be bounded and neutralized at the source. This surface is new in this release and has no production exposure history to lean on.
- **Recommendation:** In `publicStats()`, cap `displayName` to a sane length (GitHub's own limit is 255) and strip newline/control characters, at minimum. Better: wrap the free-text fields in an explicit envelope so the untrusted region is structurally obvious rather than relying solely on the annotation.
- **Regression risk:** Truncation must not be applied to the SVG or share-page paths, which currently render the full name correctly — this is a projection for the tool boundary only, in the same spirit as `impactForClient` at page.tsx:337. Stripping newlines is safe (the badge renders single-line anyway); truncating at a fixed length will visibly differ from the badge for long names, so keep the limit generous. Do NOT fix this by reusing `escapeXml` — XML entities are wrong for a JSON/agent sink and would make the output worse, not safer.
- **Expected impact:** Bounds and marks the one attacker-controlled free-text field crossing into agent context, without weakening any existing render path.
- **Effort estimate:** S

#### SE-L1 Sessions issued before the 2026-06-19 iat hardening never expire server-side
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/auth/github.ts:396-406, apps/web/lib/auth/github.ts:465-479
- **What's happening:** `readSessionCookie` treats a payload with no `iat` as unconditionally unexpired — a backward-compatibility allowance added by commit 23d257a1 on 2026-06-19. Cookie `Max-Age` was already 24h then, so every legitimate no-`iat` cookie was discarded by browsers within a day of that deploy, over two months ago. What survives is the server-side acceptance: a raw cookie value captured before 2026-06-20 still decrypts, still validates, and never ages out.
- **Why it matters:** Low absolute risk (requires exfiltration during a window that closed two months ago; no evidence any occurred), but it is a permanent, unrevocable-except-by-secret-rotation credential class that the risk register believes does not exist. This does not re-raise the accepted "stateless session has no revocation" item, but it makes that entry's mitigating claim — that there is no indefinite-lifetime token in play — inaccurate as written, since its severity argument rests on a universal 24h bound. A stale mitigation claim is worse than a known gap.
- **Recommendation:** Make `iat` required in `isValidSessionPayload` and enforce the age check unconditionally. Update the accepted-risks entry so its stated bound is true without qualification.
- **Regression risk:** This invalidates any session cookie lacking `iat`, which is the intended effect — but verify no test fixture or E2E helper constructs a session payload without `iat`, or the suite fails in a way that looks like an auth regression rather than the intended tightening (`github.test.ts` has explicit backward-compat cases that will need updating; those tests were the point of the original allowance). The invariant to preserve: a valid, current session must still round-trip, so the change is to the validator's required-key set only — not to the decryption or payload-shape logic.
- **Expected impact:** Removes the last unbounded-lifetime session class and makes the documented 24h blast radius universally true.
- **Effort estimate:** S

#### SE-L2 OAuth single-use nonce consumption is disabled by two client-influenceable inputs
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence] for the cookie leg; [inference] for the host-header leg
- **Files:** apps/web/app/api/auth/callback/route.ts:69-80, apps/web/app/api/auth/callback/route.ts:105-112, apps/web/app/api/auth/callback/route.ts:27-30, apps/web/lib/auth/platform-oauth.ts:48-61, apps/web/lib/auth/platform-oauth.ts:293-300
- **What's happening:** The replay-consume added by #1027 runs only when `mustConsumeSharedState` is true, which requires both that the request host is not localhost and that a `chapa_oauth_state_store` cookie reads exactly `"shared"`. Any other cookie value — absent, or a client-planted `"fallback"` — sets `consumed = true` unconditionally and skips the nonce check entirely. The cookie is HttpOnly (not script-settable), but HttpOnly does not prevent a cookie being set by a sibling subdomain or a cookie-tossing position. The host leg depends on `request.nextUrl.hostname`, which Next.js derives from forwarded host headers; whether Vercel's edge overwrites a client-supplied `x-forwarded-host` was NOT verified and is labelled inference.
- **Why it matters:** Degrading this control does not by itself enable an attack — the double-submit CSRF state cookie check still stands, and an attacker who can already plant cookies has other options. But a security control whose enable/disable switch is carried in a request the attacker partially influences is the wrong shape, especially since the fallback branch is only needed for a genuine Redis-unavailable case the server already knows about at issue time. This is a structural point, NOT the accepted "IP extraction trusts proxy headers" item.
- **Recommendation:** Derive the store mode server-side rather than trusting the round-tripped cookie — attempt the consume unconditionally and treat "no such nonce in Redis" as a failure only when Redis is reachable, distinguishing "not found" from "store unavailable" inside `consumeOauthState`. Gate the local-dev exemption on a build-time/env signal rather than the request host.
- **Regression risk:** This is the exact code path behind the 2026-05-01 `state_already_used` production incident, and `oauth-state.ts:96-110` carries an explicit warning not to reimplement a simpler consume — Upstash read-your-writes is client-scoped, so a consume that treats a transient miss as a replay locks out every first-time login. Any change must keep the retry loop intact and must preserve the property that a genuinely unavailable Redis degrades to the CSRF-cookie-only check rather than blocking all logins. Tightening this fail-open into a fail-closed trades a narrow replay window for a total login outage during a Redis blip — do not make that trade.
- **Expected impact:** The replay defense stops being switchable from the request.
- **Effort estimate:** M

#### SE-L3 explain_dimension is the only public-page WebMCP tool without untrustedContentHint
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/webmcp/shared-tools.ts:29-37, apps/web/lib/webmcp/shared-tools.ts:70, apps/web/app/u/[handle]/SharePageWebMcpTools.tsx:108, apps/web/app/u/[handle]/SharePageWebMcpTools.tsx:185-190
- **What's happening:** `createExplainDimensionTool` hardcodes the plain read-only annotation set, and the share page cannot override it. Every other tool that page registers is marked untrusted. Tracing the output — `buildDimensionExplanation` returns dictionary strings and numbers, and the one user-controlled field in that module (platform logins) is confined to `buildPlatformProvenance`, which this tool does not call — so today the output genuinely is trusted content. The problem is that the factory is shared with Studio, an owner-only page where the plain annotation is correct, and the annotation choice is therefore invisible at the public call site. (Same defect as BE-L3.)
- **Why it matters:** Low impact now, but a latent classification error: the next sub-metric that carries a repo name, platform login, or any profile-derived string inherits the wrong annotation silently, on a public page, with no call-site signal that anything changed.
- **Recommendation:** Make the annotation set a parameter of `createExplainDimensionTool` and pass the untrusted set from the share page, the plain set from Studio.
- **Regression risk:** Marking a tool untrusted is a hint some agents use to restrict or downweight results — over-applying it on the Studio page (where the user is the data owner) could degrade the assistant experience the tools exist to provide, so the two call sites must genuinely differ rather than both being set to untrusted for simplicity. The invariant that must hold after the change: the annotation is decided by whose data the page shows, not by which factory built the tool.
- **Expected impact:** Annotation correctness becomes a property of the call site, where the trust context is known.
- **Effort estimate:** S

#### SE-L4 Migration 032 grants full CRUD on every public table to anon and authenticated; deny policies exist only for anon
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** supabase/migrations/032_reconcile_remote_schema.sql:118-220, supabase/migrations/008_add_rls_deny_policies.sql:17-50, supabase/migrations/018_fix_tool_insights_rls.sql:11-37, supabase/migrations/024_create_supplemental_stats.sql:19, supabase/migrations/027_create_studio_configs.sql:17
- **What's happening:** The schema-reconciliation migration issues table-level SELECT/INSERT/UPDATE/DELETE grants to both `anon` and `authenticated` across every table including `users` (which holds emails), `verification_records`, and `supplemental_stats`. The compensating deny policies are all scoped `TO anon` — there is no `authenticated`-targeted policy anywhere in the migration set. This is currently safe: RLS is enabled and FORCEd on these tables, and RLS with no matching permissive policy denies by default; the app uses only the service-role key and does not use Supabase Auth at all, so no `authenticated` principal exists.
- **Why it matters:** The defense rests entirely on one property — RLS default-deny — with no second layer and no explicit statement of intent for `authenticated`. The pattern established in migration 008 was "grants plus an explicit deny policy per role"; 032 broke that symmetry silently as a `db diff` artifact. If Supabase Auth is ever adopted, or a table is added without RLS, these grants are already in place and the review that would have caught it has already happened.
- **Recommendation:** Either revoke the grants no principal needs, or add `authenticated`-scoped deny policies mirroring the `anon` ones so the intent is explicit in the schema rather than implied by an absence.
- **Regression risk:** Revoking grants is the riskier option — `service_role` derives access from migration 028, not from these, but a `REVOKE ... FROM anon` on a table PostgREST introspects can change what the API surface reports and could produce schema drift that `check:pending-migrations` then flags against production on every release PR (compare the existing `admin_users` migra tolerance already accepted). Adding deny policies is additive and drift-free; prefer it. Whichever path, `feature_flags`' permissive SELECT policy must survive — `/api/feature-flags` is intentionally public and migration 008 documents that OR-ing behavior as deliberate.
- **Expected impact:** Role intent becomes explicit in the schema instead of resting on an implicit default.
- **Effort estimate:** S

#### SE-L5 CSP omits base-uri, object-src, and form-action, none of which inherit from default-src
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/next.config.ts:30-44, apps/web/app/api/notifications/unsubscribe/route.ts:73-99
- **What's happening:** `buildCsp()` emits `default-src`, `script-src`, `worker-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `frame-src`, and `frame-ancestors`. Per the CSP spec, `base-uri`, `object-src`, and `form-action` do NOT fall back to `default-src`, so all three are currently unrestricted. There is no HTML-injection primitive in the app today (React escapes everything; the one raw-HTML response interpolates a single `escapeHtml`'d handle), so this is a missing hardening directive, not a live hole. It matters because `script-src` already carries `'unsafe-inline'` as a documented accepted risk — not re-raised here, only noted that a `<base>` injection would have an unusually short path to script hijack behind it if a primitive ever appeared.
- **Why it matters:** Three one-word additions to an existing, already-maintained header materially improve the fallback posture behind an accepted `'unsafe-inline'`. This is not new infrastructure or a new gate — it completes a header the project already owns.
- **Recommendation:** Add `base-uri 'self'`, `object-src 'none'`, and `form-action 'self'` to the array in `buildCsp()`.
- **Regression risk:** `form-action 'self'` is the one with real breakage potential — the OAuth flows are all `NextResponse.redirect` (navigations, not form submissions) so they are unaffected, but any future cross-origin form POST would silently fail with only a console error. `object-src 'none'` is safe (no `<object>`/`<embed>` anywhere). Both directives also apply to the badge SVG route via `badgeHeaders`, so confirm the SVG renders identically under direct navigation — the badge is the hottest path and a CSP change there affects every embedder.
- **Expected impact:** Closes the three non-inheriting directives; strengthens the fallback behind the accepted `'unsafe-inline'`.
- **Effort estimate:** S

#### SE-L6 Two write routes use the fail-open rate limiter against the project's own documented policy
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/recalculate/route.ts:32, apps/web/app/api/recalculate/route.ts:48, apps/web/app/api/generate/route.ts:28, apps/web/lib/cache/redis.ts:302-317
- **What's happening:** `/api/recalculate` (which triggers a full profile materialization, replaces today's snapshot, and can reach GitHub) and `/api/generate` (which calls `getStats` → GitHub GraphQL) both use `rateLimit()`, which returns `{ allowed: true }` on any Redis error or missing config. The sibling write routes `/api/supplemental` and `/api/insights` correctly use `rateLimitStrict`, and `/api/refresh` does too. Both routes are authenticated, so this is not an unauthenticated exposure — but during a Redis outage an authenticated caller loses all quota enforcement on paths consuming the shared GitHub API budget. This is NOT the accepted "Rate limiter fail-open" item, which is explicitly scoped to public badge reads.
- **Why it matters:** The stated rationale for fail-open is availability of public badge reads; neither of these is a public read. During a Redis outage — precisely when the cache is cold and every request goes to GitHub — the unmetered path is the one that burns the shared GitHub quota, degrading badges for everyone.
- **Recommendation:** Switch both to `rateLimitStrict`, matching `/api/refresh`, `/api/supplemental`, and `/api/insights`.
- **Regression risk:** Real and worth weighing: `/api/generate` is called by the post-login `/generating/:handle` progress page, so failing it closed means a Redis outage blocks the first-run experience for a brand-new user immediately after OAuth — arguably a worse first impression than an unmetered recompute. If that trade is unacceptable, leave `/api/generate` fail-open and record the deviation in accepted-risks.md rather than leaving the policy silently contradicted; `/api/recalculate` has no such first-run coupling and should be switched regardless.
- **Expected impact:** Write-path quota enforcement matches the documented policy, or the deviation becomes an explicit, reviewed decision.
- **Effort estimate:** S

**Verified clean (checked this session, no finding).** The WebMCP trust boundary traced end to end: registration is DB-flag-gated with `webmcp_enabled` seeded false and the DB row winning over the env var, so the kill switch genuinely works; the share page double-gates server and client; every share-page tool is read-only and same-origin; `compare_profiles` validates `other_handle` before encoding, so no SSRF or path traversal; `verify_badge` strips `confidence` a second time client-side; Studio's mutating tools only touch local preview state and `save_badge_config` requires on-page confirmation — no agent-initiated durable write anywhere; tool lifecycle aborts registration on unmount and instrumentation cannot change tool behavior. SVG XSS: `escapeXml` applied at every user-controlled interpolation including both fallback-SVG paths. SSRF: `fetchAvatarBase64` enforces a single-host allowlist, content-type allowlist, and 2s abort. Confidence redaction (#1067/#1122) holds on every traced path — share page, `/api/history`, `/api/verify/:hash`, and the verify page's server-rendered card. Injection: no raw SQL; the only user-input-interpolated PostgREST filter is guarded by `escapeIlike`. Authorization: all 52 route files enumerated, every one carries an appropriate guard; no missing check, no IDOR. Constant-time comparison correct in all five places, all length-checked first. Open redirect: the post-login allowlist admits only four path prefixes resolved via `new URL(url, request.url)`. `/api/admin/agents/run` is hard-blocked in production on top of admin auth, with the agent key validated against both a regex and an allowlist. Supplemental composition builds an explicit allowlisted object with handle/displayName/avatarUrl always from GitHub, so a CLI upload cannot inject profile text or an avatar URL. No server-only env var is exposed to the client.

## 9. Code Quality / Maintainability Findings (Principal Architect)

### Domain Model

Chapa is a pnpm workspace with two packages: `packages/shared` (1,207 LOC, 10 files — a genuinely dependency-free leaf, verified by grep to import nothing outside its own tree) and `apps/web` (~59,000 LOC), plus a non-workspace root `scripts/` tree (5,734 LOC). The core control flow runs route handler → `materialize-profile.ts` → `client.ts:getStats` → `v6.ts` (pure) → `BadgeSvg.tsx` (pure SVG string) → post-response side effects via `after()`. Major boundaries: `@chapa/shared` (alias-enforced by an ESLint rule, verified acyclic and outward-import-free), `lib/env.ts` as the single env chokepoint (51 non-test importers), `lib/cache/redis.ts` as the single Redis chokepoint (45), `lib/analytics/server-errors` (59), and `withErrorCapture` at 100% adoption across all 51 `route.ts` files. **Verified this session:** `pnpm run typecheck` exit 0, zero errors across all three projects; `pnpm run check:circular` — 970 files processed, no circular dependency found, and madge genuinely resolves `@chapa/shared` edges so the gate is not blind to the workspace boundary; `npx knip` — zero unused files, exports, or dependencies, only two config hints; `pnpm outdated` — nothing dangerously stale, five majors (eslint, typescript, jsdom, svix, @types/node), runtime deps close to current, ~20 transitive security floors pinned via overrides.

#### AR-M1 no-process-env gate excludes all of components/**, on a rationale the codebase itself disproves
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/eslint.config.mjs:34-36, apps/web/components/PostHogProvider.tsx:8-9, apps/web/lib/env.ts:79, apps/web/lib/feature-flags-sync.ts:7-15, apps/web/components/Navbar.tsx:1-5
- **What's happening:** The `no-restricted-syntax` env rule is scoped to `app/**` and `lib/**`. `components/**` is excluded, with the stated reason that client components require direct `NEXT_PUBLIC_*` access for build-time inlining. The codebase contradicts that: `lib/env.ts:22-33` already solves inlining via its literal-call-site pattern, and `lib/feature-flags-sync.ts` — a client-safe module that IS rule-covered — reads all seven `NEXT_PUBLIC_*` flags through those getters. The exclusion's only remaining beneficiary is `PostHogProvider.tsx`, which duplicates `getPostHogKey()`/`getPostHogHost()`. Meanwhile `components/**` contains three real server components — `Navbar.tsx` (imports `next/headers`), `NavbarShell.tsx`, `StatusCallout.tsx` — for which the client-inlining rationale never applied. `PostHogProvider.tsx` is the only `process.env` reader in `components/**` today.
- **Why it matters:** The project's rule is that all env reads go through `lib/env.ts` so trimming happens exactly once — the Environment Variable Safety section exists because untrimmed Vercel values cause auth failures that look like wrong credentials. A directory containing server components is exempt, so a future server-side secret read there — untrimmed, uncentralized — passes CI silently. This closes a hole in an existing gate; it does not add one.
- **Recommendation:** Add `components/**/*.{ts,tsx}` to that rule's existing `files` array (the same array — the config's own comment correctly warns a second config object would replace rather than merge the selector list), and switch `PostHogProvider.tsx` to the two getters. Update the obsolete rationale comment.
- **Regression risk:** The invariant that must hold is that `NEXT_PUBLIC_POSTHOG_KEY`/`_HOST` still inline into the client bundle. This depends on `lib/env.ts` keeping the literal member expression at the getter call site — which env.ts documents as mandatory and which #918 already regressed on once. Verify PostHog init still fires in a production build before merging; if a getter were refactored to a dynamic `readTrimmed(name)`, browser analytics would silently go dark. Nothing else consumes `PostHogProvider`'s local key/host, so the swap is local. Expect zero other violations from the rule expansion.
- **Expected impact:** Closes the last uncovered directory in the env boundary; removes one duplicate env reader.
- **Effort estimate:** S

#### AR-M2 Redis key formats are string-duplicated across 7 sites bound only by comments, and one comment has already drifted
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/client.ts:75, apps/web/lib/github/client.ts:139, apps/web/lib/github/client.ts:281, apps/web/lib/auth/platform-oauth.ts:81, apps/web/lib/profile/post-write-invalidation.ts:32, apps/web/app/api/supplemental/route.ts:103, scripts/heal-poisoned-stats.ts:110-132, scripts/heal-poisoned-stats.ts:13
- **What's happening:** The four scoring-critical Redis keys are built as ad-hoc template literals in multiple independent modules with no shared builder. The only binding is prose — each script builder carries a comment like "Matches the literal key `getStats`/`_fetchAndCache` read/write in client.ts." That binding has already failed once: `heal-poisoned-stats.ts:13`'s header documents the script as reading `stats:stale:<handle>` while the code at :121 reads `stats:stale:v2:${handle}` — the #1060 v1→v2 rename landed in the builder but not in the doc six lines above it. Case normalization is also re-derived per site; all four currently lowercase correctly, so there is no live key mismatch.
- **Why it matters:** `stats:stale:v2:` is the protected baseline the entire degraded-fetch integrity contract depends on. A future version bump missing one call site produces no type error, no test failure, and no runtime error — it produces a cache read that silently misses and a recovery script that silently heals nothing. `heal-poisoned-stats` is the emergency tool for exactly the corruption class this project has already hit; it is the worst place for a key to be one rename behind. The stale comment is direct evidence the comment-based binding does not survive change.
- **Recommendation:** Move the four builders into `packages/shared` (e.g. `src/cache-keys.ts`) as pure `(handle: string) => string` functions that lowercase internally, and import them from all five sites. Fix the :13 header comment regardless.
- **Regression risk:** The invariant is that every emitted key string stays byte-identical — one changed key silently orphans every production cache entry under the old name (self-healing, but a score reset across all users). The recommendation depends on `packages/shared` staying runtime-free: putting these in `lib/cache/` instead would break `heal-poisoned-stats.ts`, which deliberately uses raw Upstash REST specifically to avoid importing `server-only`/the Upstash client — that property must not be traded away. Land it as a pure extract preserving the existing literals verbatim, not a redesign.
- **Expected impact:** A key rename becomes one line with a compile-time guarantee the recovery script follows.
- **Effort estimate:** S

#### AR-M3 Two feature flags shipped in the last five commits are undocumented in both CLAUDE.md and .env.example
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/env.ts:270-277, apps/web/lib/feature-flags-sync.ts:12, apps/web/lib/feature-flags-sync.ts:14, CLAUDE.md:1, .env.example:1
- **What's happening:** Diffing every env name read by `lib/env.ts` against both files, two are absent from both: `NEXT_PUBLIC_STUDIO_DEMO_ENABLED` (added by 15be8695, judge demo mode) and `NEXT_PUBLIC_WEBMCP_ENABLED` (added by the WebMCP series). Every other variable is documented in at least one place; only `VERCEL_GIT_COMMIT_SHA` is also absent, and CLAUDE.md explicitly declares `VERCEL_*` intentionally omitted. (Same defect as DO-L1, found independently.)
- **Why it matters:** Both gate externally-visible behavior — one enables an anonymous Studio demo mode, the other enables registering tools into `document.modelContext` for any visitor's agent. An operator reading CLAUDE.md's env table (which the project treats as the configuration spec, and which `lib/agents/agent-config.ts:281` instructs an audit agent to diff against actual usage) cannot learn these exist or what their production value should be. Omission defaults them off, which is the safe direction; the failure mode is discovering at launch that a demo surface is unexpectedly live or dead with no documented lever.
- **Recommendation:** Add both to CLAUDE.md's Environment Variables block and to `.env.example`, each with its intended production value stated explicitly — particularly the anonymous demo mode.
- **Regression risk:** none — documentation-only; no code path reads either file. The one thing to get right is stating the intended production value rather than transcribing a local `.env.local` value, since these two differ in risk profile from the other `NEXT_PUBLIC_*_ENABLED` flags (anonymous access, agent tool exposure) and a wrong default in the example file would propagate to any future environment set up from it.
- **Expected impact:** Configuration surface fully discoverable at launch.
- **Effort estimate:** S

#### AR-L1 Rate-limit preamble hand-rolled in 25 routes, while the codebase already has the right factory pattern elsewhere
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/profile/[handle]/route.ts:69-74, apps/web/app/api/history/[handle]/route.ts:36-41, apps/web/app/api/verify/[hash]/route.ts:33-34, apps/web/lib/auth/platform-oauth.ts:184-190, apps/web/app/api/auth/bitbucket/connect/route.ts:1-5
- **What's happening:** 25 of 51 route handlers repeat the same four-step preamble inline: import the limiter and `getClientIp`, build an ad-hoc key literal, call it, and hand-construct a 429 whose `Retry-After` is manually restated to match the window argument. All 25 were checked — every one includes `Retry-After` and the spot-checked values match their windows. **There is no live drift.** The contrast is the point: the nine platform-OAuth routes are 4-line delegations to config-driven factories that document per-handler why each is fail-closed.
- **Why it matters:** The fail-open vs fail-closed choice is a security-relevant invariant enforced only by convention and CLAUDE.md prose. The documented fail-closed set was verified currently correct in full — `/api/auth/session`, `/api/refresh`, and all nine platform OAuth routes, the last nine via the shared factory rather than inline (which is why a naive grep appears to show them missing; the follow-up disproved it). Nothing structural keeps that true: a new write route inherits whichever helper the author copy-pastes.
- **Recommendation:** Extract a `withRateLimit(config)` wrapper into `lib/http/` composing with the existing `withErrorCapture`, deriving `Retry-After` from the window argument, with the fail-open/fail-closed choice an explicit required field. Apply to new routes opportunistically, not as a 25-file sweep.
- **Regression risk:** Several routes are NOT uniform and must not be flattened: `verify/[hash]` attaches `Access-Control-Allow-Origin: *` to its 429 (an accepted-risk CORS requirement for third-party badge embeds — losing it breaks client-side verification from READMEs), `profile/[handle]` spreads a `CORS_HEADERS` object, and `supplemental`/`telemetry` key their buckets on handle rather than IP. Any wrapper must preserve per-route headers and key derivation or it trades a public integration away for tidiness. Given that and zero live drift, a pre-launch migration is not worth its risk.
- **Expected impact:** New routes get the fail-open/fail-closed decision forced rather than inherited by copy-paste.
- **Effort estimate:** M

#### AR-L2 knip.json ignoreDependencies is stale — knip reports it itself
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** knip.json:10-14
- **What's happening:** `npx knip` finds zero unused files, exports, or dependencies, but emits exactly two configuration hints: `@upstash/redis` and `@supabase/supabase-js` should be removed from the root workspace's `ignoreDependencies`. Both are now genuinely used at the root by `scripts/`, so the suppressions are dead entries masking nothing.
- **Why it matters:** Trivially small, but a suppression list that no longer describes reality is how dead-code gates decay into no-ops. It is also persistent noise on every run of an otherwise perfectly clean result.
- **Recommendation:** Delete both entries, leaving `next`.
- **Regression risk:** none — knip is asserting these are now resolvable, so removing them cannot introduce a new unused-dependency error. Re-run `npx knip` after the edit to confirm a clean exit; if it does not, the correct response is to restore that one entry, never to widen the ignore list.
- **Expected impact:** Dead-code gate returns a fully clean result.
- **Effort estimate:** S

#### AR-L3 TS strictness is above average but omits the one flag guarding this codebase's dominant pattern
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** tsconfig.base.json:4-16, apps/web/lib/profile/materialize-profile.ts:16-28, apps/web/lib/github/client.ts:70-73
- **What's happening:** `tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` — a stronger baseline than most codebases reach, inherited correctly by all three project configs. It omits `exactOptionalPropertyTypes`, `noImplicitOverride`, and `noFallthroughCasesInSwitch`. The dominant parameter style is the optional-flag option bag — exactly the shape where `exactOptionalPropertyTypes` distinguishes "absent" from "explicitly undefined". No live bug was found from this; the call sites read use `??` defaulting, which collapses both cases identically.
- **Why it matters:** Low, and honestly so. The value is prospective, as option bags accumulate flags (see AR-S2). Labeled inference because no concrete defect it would have caught was found.
- **Recommendation:** Consider `exactOptionalPropertyTypes` only if a defect of this shape actually appears. `noFallthroughCasesInSwitch` is nearly free and can be enabled independently.
- **Regression risk:** `exactOptionalPropertyTypes` is not a free win — on a 70k-line tree it typically surfaces dozens of errors whose mechanical fixes (`| undefined` in declarations) can weaken the very distinction the flag adds, and it interacts with third-party `.d.ts` shapes that `skipLibCheck: true` currently hides. Enabling it under launch pressure is the wrong trade; the invariant to protect is that a strictness flag must never be satisfied by widening types. Treat this as a deliberate non-action rather than a backlog item.
- **Expected impact:** Marginal today.
- **Effort estimate:** M

#### AR-S1 Two independent badge implementations — Studio previews an artifact the shipped renderer cannot produce
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/render/BadgeSvg.tsx:1-8, apps/web/components/badge/BadgeContent.tsx:11-19, apps/web/lib/render/heatmap.ts:1, apps/web/lib/effects/heatmap/HeatmapGrid.tsx:1, apps/web/lib/render/BadgeBranding.tsx:1, apps/web/app/studio/PreviewFooter.tsx:1, apps/web/app/studio/page.tsx:18
- **What's happening:** The canonical badge is `renderBadgeSvg()` — a pure server-side SVG-string renderer consumed by six production surfaces. Creator Studio consumes none of it: `app/studio/*` imports exactly one thing from `lib/render` — the demo fixtures — and renders a parallel client-DOM implementation. Every visual element exists twice with only the accent token shared: heatmap (344-line animated vs 105-line static), radar chart, tier treatment, footer branding (a second component existing, per CLAUDE.md, specifically to re-achieve parity), and dimension colors (marked "deliberately separate"). The nine Studio customization categories live in `lib/effects/` (1,689 LOC) which the SVG renderer cannot consume at all — CLAUDE.md states plainly that saved settings do not alter the public badge or share page.
- **Why it matters:** Not an architecture-purity complaint, which is why it is raised despite the standing scale policy. It is a product gap a launch audience will notice: goal #3 describes `/studio` as badge preview customization, and a user tuning nine visual categories is looking at a DOM lookalike whose customizations have no path to the embeddable SVG they will actually ship. Separately, every future badge change is a two-implementation change with no test binding them, and the two are already structurally divergent.
- **Recommendation:** Do NOT unify before launch. The narrow, honest action is a copy/labeling change in Studio making explicit that it previews effects for the on-page badge surfaces, not the embeddable SVG. If Studio's customizations are meant to reach the real badge, that is a product decision needing its own ADR.
- **Regression risk:** Unification trades away real properties. `renderBadgeSvg` is a pure deterministic function — that purity is a stated engineering rule, is what makes the SVG cacheable per handle/day, and is what lets `svg-to-png.ts` rasterize it for OG images; `BadgeContent` uses `useRef`, `useInView`, `useAnimatedCounter`, `useTranslation`, none of which can cross into the server renderer. The SVG path is also the XSS boundary (`escapeXml()` on all user-controlled text — an accepted-risk mitigation that three `dangerouslySetInnerHTML` call sites depend on); any shared abstraction must keep escaping on the SVG side and cannot substitute React auto-escaping. The labeling-only recommendation trades nothing.
- **Expected impact:** Removes a promise the product cannot currently keep; defers the real cost to a deliberate decision.
- **Effort estimate:** S

#### AR-S2 The scoring/cache seam has accreted ~7 interacting behavior flags with no single description of their interaction
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/profile/materialize-profile.ts:16-28, apps/web/lib/profile/materialize-profile.ts:109-155, apps/web/lib/github/client.ts:34-47, apps/web/lib/github/client.ts:88-99, apps/web/lib/github/stats-integrity.ts:56-60
- **What's happening:** `materializeProfile` and `getStats` thread seven independent behavior flags through one path: `readOnly` (#1083), `inputsChanged` (#826), `ignoreSnapshot` (#930), `policy`/`today` (EMA parameters), `statsComplete` (#1003/#1049), and `fetchScope` (#1004/#1050), with a scope-asymmetric in-flight dedup rule layered on top. Each is documented with an issue number at its definition, and materialize-profile.ts:109-125 is a genuinely excellent explanation of the #1001 display-vs-trend split. What does not exist is any artifact describing what the combinations do — the CLAUDE.md Caching section is ~15 dense paragraphs enumerating mechanisms one at a time, which is how they were built, not how they interact.
- **Why it matters:** The issue-number density on one seam (#800, #826, #930, #1001, #1002, #1003, #1004, #1045, #1049, #1050, #1060, #1061, #1083, #1086 across three files) is itself the measurement: this is where bugs have repeatedly landed, and several were regressions of a prior fix (#1050 corrected #1002's direction; #1060/#1061 corrected #1004's composition order). The risk is the next contributor reasoning about one flag in isolation and reintroducing a combination bug the way #1060 did — which BE-H1 shows has already happened again one layer down.
- **Recommendation:** One ADR containing a single table: rows = the seven flags, columns = which cache keys are read, which written, whether a live GitHub fetch may occur, whether a snapshot may persist, whether a verification record may mint. Derive it from the code, then link it from CLAUDE.md in place of some of the prose.
- **Regression risk:** none to runtime — no code changes. The real risk is the document going stale, which is the failure mode that already produced the wrong `stats:stale:` comment in AR-M2. Mitigate by keeping it a derived table rather than prose, and by replacing the corresponding CLAUDE.md paragraphs rather than adding a third place the same rules are written down — a duplicate description makes drift worse, not better. Explicitly do NOT pair this with property tests or a CI gate; the standing project-scale policy rejects that, and the value here is comprehension, not enforcement.
- **Expected impact:** The combination surface becomes reviewable in one place before the next change to it.
- **Effort estimate:** M

## 10. Testing / QA Findings (QA / Reliability Lead)

### Domain Model

The suite is a single Vitest workspace covering `apps/**`, `packages/**`, and `scripts/**`, with `**/*.contract.test.ts` excluded and routed to a separate config that runs against a live local Supabase. Tests are co-located, with a three-tier convention: `*.test.ts` (unit, module-level `vi.mock`), `*.render.test.tsx` (RSC/JSX tree inspection via props rather than DOM), and `*.contract.test.ts` (real-DB seam tests). Playwright E2E is genuinely wired into CI three ways — the full suite sharded 2×, `journey.spec.ts` against local Supabase in the contract job, and `smoke.spec.ts` nightly against production. Coverage enforcement is layered: a deliberately loose global floor (75/70/65/75) plus tight per-path floors for `lib/impact/**` (95/90/95/95) and `stats-integrity.ts` (90/85/90/90), with a documented shard carve-out so partial shards can't trip glob-keyed floors.

### Verification Run

All four commands were run to completion this session, sequentially in one chained invocation. None failed to run.

- **`pnpm run test`** — **PASS**. `Test Files 487 passed (487)`, `Tests 8009 passed (8009)`, 0 failed, 0 skipped. Duration 35.05s. Vitest v4.1.10. Accounting: 494 test files exist under `apps/`+`packages/`; 33 are contract tests (excluded), leaving 461, plus 26 `scripts/**` files = 487. Confirms contract tests are not in this number.
- **`pnpm run typecheck`** — **PASS**, 0 errors across `packages/shared`, `apps/web`, and `typecheck:scripts`.
- **`pnpm run lint`** — **PASS**, **0 errors, 0 warnings** across all three targets.
- **`pnpm run test:coverage`** — **PASS** (both threshold gates, exit 0). Main suite: Statements 95.35% (11182/11727), Branches 91.76% (6341/6910), Functions 94.73% (2266/2392), Lines 96.61% (10244/10603). Per-path floors passed. Scripts suite (26 files / 281 tests): Statements 57.35%, Branches 61.48%, Functions 72.22%, Lines 57.86% against floors of 55/60/70/55.
- **Suite hygiene** (both clean): zero test files without an `expect(` call; zero `it.skip`/`describe.skip`/`it.todo`/`xit` across the repo.

#### QA-M1 Destructive user-deletion script has no test past its pure helpers, and no atomicity across Supabase + Redis
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** scripts/delete-user.ts:180, scripts/delete-user.ts:102, scripts/delete-user.ts:148, scripts/delete-user.ts:124, scripts/delete-user.test.ts:9-73
- **What's happening:** The test file covers only pure helpers — `parseArgs`, `normalizeHandle`, `redisScanPattern`, and the table constant. Measured coverage is 21.6% statements / 28.9% branches. Nothing exercises `run()`, the SCAN cursor pagination, the PostgREST DELETE, or the count parse. `run()` is a bare sequential loop with no transaction and no resume: for each table it counts then deletes, and only afterwards deletes the Redis keys. Both `supaDelete` and the redis call throw on failure, so a failure on table 3 of N exits with tables 1–2 already destroyed and every Redis key still present. Because `stats:stale:v2:<handle>` is the protected baseline the badge path composes from, a half-deleted user is not inert — the next badge hit rehydrates from surviving Redis state against partially-missing Supabase rows. The final "Deletion complete" message is unconditional.
- **Why it matters:** This is the tool of record for erasing a user's data, i.e. the deletion-request path. A partial failure produces a silently inconsistent user that looks deleted in the console transcript, and the operator's only signal is scrollback. It is medium rather than high because it is operator-invoked and low-frequency, and because the genuinely dangerous input surface — glob/wildcard and PostgREST-injection characters in the handle — IS well tested.
- **Recommendation:** Add a `run()`-level test with a fake `fetch` asserting that the dry-run path issues zero DELETE/DEL calls, that a mid-loop rejection surfaces a message naming which tables already completed, and that SCAN pagination follows a non-"0" cursor to completion. Separately, make the post-delete verification automatic and fail loudly if either store is non-zero, so "Deletion complete" is an assertion rather than a hope.
- **Regression risk:** The invariant that must survive is that `normalizeHandle` still runs before any handle reaches a SCAN pattern or a PostgREST URL — `supaDelete` interpolates the handle unencoded into the filter, so normalization is the ONLY injection barrier; a refactor that moves verification earlier must not move normalization later. Automatic verification adds N+1 extra round-trips and will make the script fail on a successful delete if a replica lags — trading a false "complete" for a possible false "incomplete", the correct direction, but it must be documented so operators don't re-run `--delete` reflexively. Ordering Redis-before-Supabase instead would trade this failure mode for a worse one (cache gone, rows present, next fetch repopulates) — do not reorder as a shortcut.
- **Expected impact:** A partial deletion becomes diagnosable and cannot be reported as complete.
- **Effort estimate:** S

#### QA-M2 backfill-supabase.test.ts tests a different module than its name implies; the 127-line backfill itself is 0% covered
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** scripts/backfill-supabase.test.ts:2-8, scripts/backfill-supabase.ts:52, scripts/backfill-supabase.ts:113, scripts/backfill-supabase.ts:168, scripts/backfill-parsers.ts:4
- **What's happening:** The test file imports exclusively from `./backfill-parsers`, never from `./backfill-supabase`. Measured result: `backfill-parsers.ts` is 100% covered while `backfill-supabase.ts` is 0.0% statements / 0.0% branches across 127 lines. No other file imports it. The parsers were deliberately separated so tests could run without runtime deps, but the test file kept the orchestrator's name. To be explicit about what was NOT found: `backfillUsers` correctly does `if (error) throw error;` before incrementing `inserted`, so there is no "reports success on a failed durable write" bug here — this is a coverage and naming finding, not a correctness one.
- **Why it matters:** The co-location convention makes `scripts/backfill-supabase.test.ts` read as proof that the backfill is tested. It isn't. Any future reviewer applying that convention will draw the wrong conclusion about a script that writes to production Supabase. The batching, cursor pagination, and dry-run short-circuits are untested.
- **Recommendation:** Rename the file to `scripts/backfill-parsers.test.ts` to match what it imports — that alone removes the false signal at zero risk. Then, if the backfill is still live, add a fake-Redis/fake-Supabase test for the two paths that matter: dry-run issues no upsert, and an upsert returning an error increments `errors` rather than `inserted`.
- **Regression risk:** The rename must not orphan the file from the runner — `vitest.config.scripts.ts:7` globs `scripts/**/*.test.ts`, so any name ending in `.test.ts` is still collected; verify the 26-file / 281-test count is unchanged. Note the second-order effect of adding coverage: the scripts suite sits at 57.35% against a 55% floor, only ~2.4 points of headroom, so covering 127 previously-dead lines moves the global number and may make the floor's slack look larger than the risk it guards. Raise the floor deliberately or not at all.
- **Expected impact:** The test-to-source mapping stops lying; the backfill's dry-run and error-accounting branches become regression-protected.
- **Effort estimate:** S

#### QA-L1 Coverage scope includes packages/shared/dist/** build output, diluting the global metric
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** vitest.config.ts:21-47, vitest.config.ts:25, packages/shared/dist/stats-aggregation.js:1
- **What's happening:** The coverage include list contains `packages/shared/**` and the exclude list has no `dist` entry. `coverage-summary.json` accordingly reports `packages/shared/dist/stats-aggregation.js` at 0.0% statements across 70 lines — the single worst-covered file in the entire main report, and it is compiled output, not source. Accepted-risks already records that the `packages/shared` build step exists but does not drive runtime resolution.
- **Why it matters:** Purely a measurement-integrity issue at current numbers — 95.35% against a 75% floor leaves enormous headroom, so nothing is masked today. It matters only in the direction of travel: every file landing in `dist/` is counted as fully-uncovered source, so the global figure drifts down for reasons unrelated to test quality.
- **Recommendation:** Add `"packages/shared/dist/**"` to the exclude array, alongside the existing type-only and dictionary exclusions.
- **Regression risk:** The exclusion must be scoped to `dist/` specifically, never a broad `**/dist/**` or `packages/shared/*.js` pattern — the latter would silence any genuine JS source under that package. Verify after the change that the per-path floors still resolve; they are glob-keyed and unaffected by a `packages/shared` exclusion, but the merged-report step in `ci.yml:196` is where enforcement actually happens, so confirm the change there and not only from a local full run. Expect the global statement number to rise by roughly half a point; do not read that rise as improved testing.
- **Expected impact:** The global coverage number reflects source only.
- **Effort estimate:** S

#### QA-L2 pnpm run test is documented as "Run all tests" but excludes all 33 contract-test files
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** vitest.config.ts:15, CLAUDE.md:1, .github/workflows/ci.yml:329, .github/workflows/ci.yml:380-382
- **What's happening:** `vitest.config.ts:15` excludes `**/*.contract.test.ts` from the default run. 33 such files exist, covering exactly the seams designated as requiring real-stack regressions — campaign sends, scoring integrity, snapshots, and 12 write-route payload-matrix suites. The green run confirms it: 487 files = 461 non-contract app/package files + 26 script files. CI does gate them properly in a dedicated job, and `test:contract:local` is documented elsewhere — so this is a local-signal gap, not a CI gap. The inaccuracy is the one-line comment in the "Before committing" block calling `pnpm run test` "all tests".
- **Why it matters:** CLAUDE.md instructs "Run the full test suite locally before pushing", and the command it names does not run the suites that exist specifically to catch seam bugs. A developer or agent following the documented pre-commit sequence to the letter can push a change that breaks the campaign-lease or scoring-integrity contract and see nothing until the CI contract job runs minutes later.
- **Recommendation:** Change the comment from `# Run all tests` to something exact — e.g. `# Unit + script suites (contract tests: pnpm run test:contract:local)` — and cross-reference `test:contract:local` there.
- **Regression risk:** Do NOT "fix" this by folding contract tests into the default include — the exclusion is load-bearing. `vitest.config.ts` has no Supabase bootstrap, so including them would make `pnpm run test` fail on any machine without `supabase start`, and would break the CI sharding math over a 487-file set and the blob-merge coverage enforcement that depends on it. The property traded away is only that a single command tells the whole story; keeping two commands is right, and the doc should say so.
- **Expected impact:** The documented pre-commit sequence stops overstating its own coverage.
- **Effort estimate:** S

**QA's explicit no-blocker conclusion.** No launch-blocker and no high-severity QA finding — stated as a conclusion rather than an omission. The four highest-consequence seams were probed specifically and each was already covered: the scoring-data integrity contract has both unit and real-DB coverage of the #1060/#1061 compose-vs-guard correction; the badge materialize deadline (#1086) has three tests including the "don't starve a first-time handle" and "don't race a smoke request" cases, and exactly-once side effects are structurally guaranteed by an early return, not merely by convention; and the campaign send path covers the exact "provider delivered but acknowledgement write failed" seam, plus lease replay and expired-group recovery. Contrary to the audit briefing's premise, `lib/webmcp/**` is genuinely well tested — every consumer has a render test that executes the tools against a stubbed fetch rather than merely asserting registration, and the visitor-redaction seam is closed by an explicit assertion that the WebMCP host receives an impact prop with no confidence and a diff with no confidence or penalty changes.

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

### Domain Model

Chapa is a five-surface product on one shared chrome layer. Landing is a "terminal session" carrying the only full navigation, the only footer, the demo badge, and both hero CTAs. The share page is the destination artifact: inline badge SVG → toolbar → owner-only dashboard → embed snippets → visitor CTA. Creator Studio is a two-pane terminal tool: live badge preview (a React re-implementation) beside a command line with a collapsed Quick Controls panel. Trust surfaces use a teal palette to separate cryptographic proof from brand purple. Content surfaces are locale-segmented RSCs reached by a `proxy.ts` rewrite. The shared layer is `globals.css` (Tailwind v4 `@theme` tokens defined twice for light/dark), `NavbarShell` + variants, `GlobalCommandBar`, `InfoTooltip`, `StatusCallout`, `Toast`, and two 1385-line dictionaries. The badge SVG is a separate, deliberately-dark, server-rendered string pipeline with its own duplicated palette — and the only user-facing surface with no i18n at all. **The recurring fact behind most findings: the landing page got the full craft pass, and the rest of the product inherited only the navbar.**

#### UX-B1 Every page except the landing has no navigation and no footer — Privacy/Terms are unreachable from the surfaces users act on
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/LandingContent.tsx:100, apps/web/app/LandingContent.tsx:423, apps/web/app/[locale]/about/page.tsx:53, apps/web/app/[locale]/archetypes/_components/ArchetypePageClient.tsx:54, apps/web/app/[locale]/privacy/page.tsx:45, apps/web/app/[locale]/terms/page.tsx:45, apps/web/app/verify/VerifyInputPageClient.tsx:17, apps/web/app/verify/[hash]/page.tsx:66, apps/web/app/u/[handle]/page.tsx:359, apps/web/components/NavbarShell.tsx:67
- **What's happening:** LandingContent.tsx:100 is the single call site that passes `navLinks`. Every other page renders the navbar bare, so `NavbarShell`'s center nav block is skipped entirely. A repo-wide `grep -rln '<footer'` over `app/` and `components/` returns exactly one non-experiment, non-Studio hit: `LandingContent.tsx`. The result: on `/about`, all 7 `/archetypes/*`, `/privacy`, `/terms`, `/verify`, `/verify/:hash`, and `/u/:handle`, the visible chrome is logo + LanguageSwitcher + ThemeToggle + a muted `/ login` text link. Nothing else.
- **Why it matters:** Three compounding failures. (1) Legal reachability — the privacy policy and terms are linked only from the home page footer. A user who arrives at `/u/someone` from a README, signs in, and generates a badge never sees a link to either document on any screen in that flow. (2) Conversion — the `/archetypes/*` guides are long-form SEO content (7 pages × 2 locales) ending in cross-links to each other, with no signup CTA anywhere (verified: no `LoginCtaButton` or login reference in the component). Organic traffic hits a dead end. (3) Orientation — a visitor on `/verify/:hash`, arriving from someone else's badge and the highest-intent cold traffic the product gets, cannot reach `/about`, the scoring explainer, or signup without editing the URL.
- **Recommendation:** Extract the footer into `components/SiteFooter.tsx` and render it from the layout (or per page shell) so legal links exist everywhere. Pass `navLinks` from `NavbarClient` by default rather than only on the landing page — noting the landing's links are hash anchors, so inner pages need real routes instead. Add a compact signup CTA to the archetype and about page footers.
- **Regression risk:** The footer currently sits inside `LandingContent`, a client component using `useTranslation()`; moving it into `app/layout.tsx` puts it in the statically-rendered, `DEFAULT_LOCALE`-pinned root, reintroducing the locale-flash trade the #1023 migration deliberately narrowed to "small shared chrome only". Rendering it per-page from the `[locale]` segment keeps the no-flash invariant for the 9 migrated pages but leaves `/u/:handle`, `/verify`, and `/studio` on the flash-prone client path. Also: `GlobalCommandBar` is `fixed bottom-0`; a footer added under content on pages that currently reserve only `pb-16` will be occluded unless bottom padding grows with it.
- **Expected impact:** Legal documents reachable from every surface; organic archetype traffic gets a conversion path; inner pages stop being navigational dead ends.
- **Effort estimate:** M

#### UX-H1 Both hero CTAs and the terminal-dim token fail WCAG AA contrast, in both themes
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence] (token values read from source; ratios computed from those exact values — no runtime measurement, and no automated contrast check exists in the repo)
- **Files:** apps/web/styles/globals.css:20, apps/web/styles/globals.css:37, apps/web/styles/globals.css:147, apps/web/components/LoginCtaButton.tsx:95, apps/web/app/LandingContent.tsx:132, apps/web/components/NavbarShell.tsx:68, apps/web/components/ThemeToggle.tsx:21, apps/web/components/LanguageSwitcher.tsx:108, apps/web/app/studio/QuickControls.tsx:48
- **What's happening:** Computed ratios from committed token values: white on `bg-amber` #8B5CF6 = **4.06:1** (the primary CTA, 14px semibold; needs 4.5:1); white on `hover:bg-amber-light` #A78BFA = **2.72:1**; white on `bg-complement` #10B981 = **2.54:1** (the "Verify a Chapa" hero CTA); `text-terminal-dim` on `bg-bg` = **2.29:1** dark / **2.54:1** light, used for desktop nav link labels, the ThemeToggle and LanguageSwitcher icons (failing the 3:1 non-text minimum too), the Studio Quick Controls toggle, and 46 sites overall. There is no automated contrast gate — `axe-core` is only a transitive dev dependency and no e2e spec imports it.
- **Why it matters:** The two failures on the hero CTAs are on the exact pixels the conversion funnel depends on, and they fail identically in light and dark (white-on-color is theme-invariant). `terminal-dim` on nav labels means primary navigation is below the threshold at which many users can read it at all — and `design-system.md` itself sanctions this by specifying "label in `text-terminal-dim`" for nav links, so the spec, not just the code, encodes the failure.
- **Recommendation:** Darken the CTA background for white text (#7C3AED — already the `--color-amber-dark` token — reaches ≈5.4:1) or raise CTA text to `font-bold` at ≥18.66px to qualify as large text. Same for `--color-complement` on white-text surfaces. Reserve `terminal-dim` for genuinely decorative glyphs (`$`, `>`, `|`, all already `select-none`) and switch every text/icon use to `text-text-secondary`, which passes at 6.15:1 dark / 4.83:1 light. Update `design-system.md`'s nav-link rule in the same change.
- **Regression risk:** `terminal-dim` is load-bearing for the terminal aesthetic — the visual hierarchy between prompt glyphs and real content collapses if both become `text-secondary`, so the decorative/content split must be made explicitly per call site rather than by a global find-replace. Swapping `bg-amber` → `bg-amber-dark` on CTAs breaks the hover ramp, which needs re-anchoring one step darker, and `bg-amber` is used non-textually (pills, heatmap, focus rings) where the current value must stay. Fixing the token globally would shift the whole brand hue; fix it at the white-text-on-solid-fill call sites only.
- **Expected impact:** The signup and verify CTAs and the site navigation become readable for low-vision users and in bright ambient light.
- **Effort estimate:** M

#### UX-H2 Archetype pages render two empty h2 sections and dump all body copy above them — 7 pages × 2 locales
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/[locale]/archetypes/_components/ArchetypePageClient.tsx:77, apps/web/app/[locale]/archetypes/_components/ArchetypePageClient.tsx:112, apps/web/app/[locale]/archetypes/_components/ArchetypePageClient.tsx:116, apps/web/lib/i18n/dictionaries/en.ts:1
- **What's happening:** The component renders the entire `essay` array as one undifferentiated block at line 77, then emits three section headings. Only `sectionIdentifies` gets content beneath it. `sectionPractice` ("What a Builder looks like in practice") at line 112 and `sectionRadar` ("The Builder's radar shape") at line 116 are immediately adjacent — nothing renders between them, and nothing after 116 except two footer links. The essay paragraphs that belong under those headings are stranded at the top: `builder.essay[6]` literally opens "On the Chapa radar chart, a Builder's shape leans heavily toward the top…", which is the `sectionRadar` body.
- **Why it matters:** These are the product's long-form SEO surfaces and the only in-depth explanation of what an archetype means. Every one of the 14 rendered pages ends with two headings promising content that never arrives — the single most visible "unfinished" signal a reader can encounter. It also produces headings with no accessible content for screen-reader users navigating by heading, and degrades semantic value for search.
- **Recommendation:** Split `essay` in the dictionaries into per-section arrays (`introEssay`, `practiceEssay`, `radarEssay`) or add explicit paragraph-index ranges, and render each under its heading.
- **Regression risk:** `essay` is an array read via `tArray<string>`; changing its shape touches all 7 archetype namespaces in both dictionaries at once and will fail `parity.test.ts` until both sides match — treat es/en as one atomic edit. The `[locale]` pages are `force-static` with both locales pre-rendered, so stale prerenders must be invalidated. Do NOT "fix" this by deleting the two headings: the copy under them exists and is good, and dropping the headings would lose real content structure.
- **Expected impact:** Archetype guides read as finished long-form pages; heading navigation and SEO structure become meaningful.
- **Effort estimate:** M

#### UX-H3 The badge SVG — the product's primary shareable artifact — is hardcoded English in a Spanish-default app
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/render/BadgeSvg.tsx:137-141, apps/web/lib/render/RadarChart.ts:34-44, apps/web/lib/render/RadarChart.ts:101, apps/web/lib/render/VerificationStrip.ts:26, apps/web/lib/render/VerificationStrip.ts:43, apps/web/app/u/[handle]/badge.svg/route.ts:1
- **What's happening:** `DEFAULT_LOCALE` is 'es', 1385 lines of dictionary cover both locales, all 9 content pages are locale-segmented and pre-rendered per locale — and the badge has no locale parameter on its route and no translated string anywhere in its renderer (grep for `locale|lang|i18n|getServerT` on the route returns zero hits). A Spanish user reads Spanish marketing copy, signs in through a Spanish flow, and receives an English badge.
- **Why it matters:** The badge is the only thing that travels — into READMEs, social cards, the OG image. Its language is what a third party sees. Shipping a Spanish-first product whose one distributed artifact is monolingual undercuts the i18n investment on every other surface and reads as unfinished localisation to exactly the audience the default locale targets.
- **Recommendation:** Thread a locale through `renderBadgeSvg` (from a `?lang=` query param, defaulting to the handle's stored preference or `DEFAULT_LOCALE`) and resolve the ~10 literal strings through `getServerT`. Add the locale to the SVG cache key.
- **Regression risk:** The SVG cache and the badge route's `s-maxage=21600` are keyed per handle/theme today; adding a locale dimension doubles cache cardinality and invalidates every warm key, causing a one-off cold-miss spike against the 3000ms cache-miss p95 budget. Layout is length-sensitive: BadgeSvg.tsx:196 computes the archetype pill width from `archetypeText.length * 10`, and Spanish dimension labels ("Consistencia") are longer than English — radar label placement and pill widths need re-measuring, not just re-stringing. Archetype names are deliberately untranslated brand terms in `es.ts` and should stay that way.
- **Expected impact:** The artifact that carries the product matches the language of the person who generated it.
- **Effort estimate:** L

#### UX-H4 The verification seal is illegible on the badge and inert where badges actually live, while the copy tells users to click it
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence] for the rendering and markup; [inference] for the img-embed link behaviour
- **Files:** apps/web/lib/render/VerificationStrip.ts:25-27, apps/web/lib/render/VerificationStrip.ts:43, apps/web/lib/render/BadgeSvg.tsx:19, apps/web/lib/i18n/dictionaries/es.ts:1, apps/web/components/SharePageOwnerContent.tsx:120
- **What's happening:** The verification hash renders as vertical 11px monospace at 50% opacity in coral #E05A47 on the badge's #0C0D14 background — an effective contrast of ≈2.1:1. GitHub renders a README image at roughly 830/1200 scale, putting that text at ~7.6px. The strip is wrapped in an SVG `<a href>`, which is inert when the SVG is loaded through `<img src>` — the exact embed form the product's own snippets recommend. The same file already acknowledges at line 19 that `<img>`-embedded SVGs lose interactivity for SMIL. Meanwhile the Spanish landing copy instructs the user to click it.
- **Why it matters:** Verification is goal #6 and the product's central differentiation claim. In its primary distribution channel the trust signal is simultaneously unreadable and unclickable, and the copy makes a promise the artifact cannot keep. The identical problem applies to the demo badge's honesty disclosure — "SAMPLE · NOT A REAL BADGE · FOR ILLUSTRATION ONLY" is rendered at the same 11px/0.5-opacity/rotated treatment on the landing hero, a disclosure that structurally cannot be read.
- **Recommendation:** Raise the strip to ≥14px at ≥0.85 opacity, or move the verified marker into the horizontal header row beside the existing shield icon where it has room. Reword the landing copy to describe the share-page verification flow rather than clicking the embedded badge, and surface the verify URL as copyable text. Give the demo SAMPLE disclosure a legible, horizontal treatment.
- **Regression risk:** The strip occupies the badge's right edge by design; widening or reorienting it eats into the radar/ring area laid out with hardcoded coordinates throughout `BadgeSvg.tsx`, so this is a layout change, not a style tweak. The `<a>` wrapper must stay for the inline-SVG path on the share page, where it does work — removing it would regress a functioning affordance. Raising opacity makes verified and unverified badges more visually divergent, which is the intent but changes every existing embedded badge's appearance at once.
- **Expected impact:** The trust claim becomes visible and the copy becomes truthful in the embed context.
- **Effort estimate:** M

#### UX-H5 Thirteen error boundaries, three different visual languages — ten violate the design system's mandatory error-color rule
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/error.tsx:20, apps/web/app/u/[handle]/error.tsx:20, apps/web/app/[locale]/about/error.tsx:18, apps/web/app/[locale]/privacy/error.tsx:18, apps/web/app/[locale]/terms/error.tsx:18, apps/web/app/admin/error.tsx:19, apps/web/app/studio/error.tsx:19, apps/web/app/generating/error.tsx:19, apps/web/app/cli/authorize/error.tsx:18, apps/web/app/verify/error.tsx:19, apps/web/components/StatusCallout.tsx:41-46
- **What's happening:** Two boundaries use `StatusCallout` with `role="alert"`, the terminal-red palette, an icon, and a description. Ten render a bare `<h1 className="text-amber">` with amber-tinted buttons and no `role="alert"`. One renders the same shape in `text-complement` teal. `StatusCallout` already implements all four variants correctly and is used by only two of the thirteen. The spec states: "Error banners and alerts must use terminal-red tokens … never amber/purple for error states."
- **Why it matters:** The clearest systemic craft signal in the codebase: the same failure state looks like three different products depending on which route threw. Amber is the brand-action color — an amber error page reads as a promotion, not a fault. Eleven of thirteen also lack `role="alert"`, so screen-reader users get no announcement that the page failed. And none render a navbar, so a user who errors on `/about` has "Try again" and "Go home" as their entire option set.
- **Recommendation:** Replace all eleven non-compliant bodies with `<StatusCallout variant="error" titleAs="h1">` plus the terminal-red button pair already used in `app/error.tsx:30`. This is close to a mechanical substitution — the copy keys are already shared.
- **Regression risk:** `verify/error.tsx`'s teal is not arbitrary — the verify surface is deliberately complement-toned per the design system's verification rule. Switching it to red is still correct (an error is an error, not a trust signal), but confirm it reads as intentional rather than a palette leak. `StatusCallout` sets `role="alert"` on the container; on a full-page boundary that fires an assertive announcement on mount, which is right here but means the eleven pages change announcement behaviour, not just color. Several of these boundaries (`admin`, `cli/authorize`, `coming-soon`) are low-traffic and untested for locale — they use `useTranslation()`, so verify the provider is in scope for each.
- **Expected impact:** One error language across the product; failure states announce to assistive tech.
- **Effort estimate:** S

#### UX-H6 Interactive targets down to 14×14px across tooltips, the footer, and panel controls
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/InfoTooltip.tsx:163, apps/web/app/LandingContent.tsx:437-451, apps/web/components/dashboard/SubMetricPanel.tsx:75, apps/web/components/ErrorBanner.tsx:48, apps/web/components/CopyButton.tsx:23, apps/web/components/BadgeToolbar.tsx:156
- **What's happening:** The codebase has a 44px touch-target convention and applies it in some components and not others. `InfoTooltip`'s button is `w-4 h-4` (16×16px) — and it is the product's designated explainer mechanism, instantiated 7+ times across `StatsGrid`, `ImpactBreakdown`, and `DimensionCard`. The landing footer packs five `w-3.5 h-3.5` (14×14px) social links 10px apart. `SubMetricPanel`'s close button is 24×24px. Meanwhile `ErrorBanner`, `CopyButton`, and `BadgeToolbar` all correctly use `min-h-[44px] min-w-[44px]`.
- **Why it matters:** WCAG 2.2 SC 2.5.8 sets a 24×24px minimum; platform guidance is 44px. CLAUDE.md's acceptance criteria explicitly require tooltips to be "hover/tap/keyboard accessible" — a 16px target is not tap-accessible. On the share page's dimension grid, adjacent info icons sit close enough that a mis-tap opens the wrong explainer, which is worse than no affordance.
- **Recommendation:** Give `InfoTooltip`'s button `min-h-[44px] min-w-[44px]` with a transparent hit area (`p-3 -m-3` preserves visual size while expanding the target), matching what `CopyButton` already does. Same for the footer social links and the SubMetricPanel close button. Worth a one-time sweep for `w-3.5`/`w-4` on button/anchor elements.
- **Regression risk:** `InfoTooltip` positions its portal from `buttonRef.current.getBoundingClientRect()` — enlarging the button changes the rect, so tooltip centering and the `rect.top < 120` auto-flip threshold shift with it. Use negative margin so the layout box stays 16px and only the hit area grows, otherwise inline label rows in `StatsGrid`/`DimensionCard` will reflow. Expanded hit areas on adjacent tooltips can start overlapping — check the dimension-card grid at mobile widths.
- **Expected impact:** Tooltips and footer links become reliably tappable; the acceptance criterion is actually met.
- **Effort estimate:** S

#### UX-M1 Creator Studio's only GUI is collapsed by default behind the lowest-contrast control in the system, and the page has no visible title
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/StudioClient.tsx:154, apps/web/app/studio/StudioClient.tsx:509, apps/web/app/studio/QuickControls.tsx:48, apps/web/app/studio/QuickControls.tsx:88, apps/web/app/studio/QuickControls.tsx:125
- **What's happening:** `/studio` exposes 9 visual customization categories. Their only pointer-driven affordance is the Quick Controls panel, which initialises collapsed and whose toggle is 12px `terminal-dim` text (≈2.3:1, per UX-H1). The alternative is typing slash-commands into the terminal pane. The page's `<h1>` is `sr-only`, so nothing on screen names the tool or states what it does.
- **Why it matters:** A user lands on Studio and sees a badge and a blinking prompt, with no title, no visible list of what can be changed, and a nearly-invisible row that would reveal it. The terminal-first aesthetic is a deliberate product choice, but "discoverable only if you already know" is different from "terminal-first" — the QuickControls panel exists precisely to bridge that, and it is hidden.
- **Recommendation:** Default `showQuickControls` to true (persisting the user's collapse choice in localStorage), promote the toggle to `text-text-secondary`, and render a visible page title with a one-line subhead alongside the existing `sr-only` h1.
- **Regression risk:** Expanding by default pushes `TerminalOutput` and `TerminalInput` down; the right pane is `lg:h-[calc(100vh-3.5rem)]` with `mt-auto` on the input, so the terminal's usable height shrinks and may need a scroll region at short viewports. The panel's own `max-h-48 sm:max-h-64 overflow-y-auto` caps the damage but stacks two scroll areas. Studio is gated behind `NEXT_PUBLIC_STUDIO_ENABLED` and has a judge/demo mode — verify the default doesn't alter the demo's intended first frame.
- **Expected impact:** Studio's capabilities become visible on arrival without abandoning the terminal metaphor.
- **Effort estimate:** S

#### UX-M2 The Studio preview does not match the badge it previews
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/badge/BadgeContent.tsx:204-207, apps/web/lib/render/RadarChart.ts:34-38
- **What's happening:** Studio previews the badge through a React re-implementation rather than the SVG renderer. Its radar is hardcoded to four axes with fixed absolute-positioned labels, one truncated to "Consist". The shipped badge renders a pentagon with a Craft axis whenever Craft is present — a documented acceptance criterion — with the full word "Consistency".
- **Why it matters:** Studio's entire value proposition is "see what your badge will look like." A user with a Craft score sees a four-sided preview of a five-sided badge, and a label that doesn't exist in the output. Any preview that diverges from the artifact trains users to distrust it.
- **Recommendation:** Either render the real `renderBadgeSvg` output into the preview pane and overlay only the interactive effect layers, or drive `BadgeContent`'s axes from the same `DimensionScores` shape `RadarChart.ts:32` uses so the pentagon/diamond branch and label strings are shared rather than duplicated.
- **Regression risk:** `BadgeContent` exists as a React tree specifically so the Studio effects layer can attach to real DOM nodes; swapping in a server-rendered SVG string would break every effect targeting those elements. The safer fix is sharing the axis data and label constants, not the renderer. `PreviewFooter.tsx` already exists to hold platform/host/verification parity — extend that pattern rather than inventing a second one. Widening "Consist" to "Consistency" at `text-[9px]` in an absolutely-positioned slot will overflow its container without a layout adjustment.
- **Expected impact:** The preview becomes trustworthy; Craft users see their actual badge shape.
- **Effort estimate:** M

#### UX-M3 aria-current="page" is set but never styled, and the nav links it applies to never render on inner pages
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/NavLink.tsx:23, apps/web/components/MobileNav.tsx:119, apps/web/styles/globals.css:1
- **What's happening:** Both nav implementations correctly emit `aria-current="page"` on a pathname match. No CSS selector or conditional class ever consumes it — `grep -n 'aria-current' styles/globals.css` returns nothing, so sighted users get zero indication of where they are. Compounding it: the only page that renders nav links is the landing page (UX-B1), and its links are hash anchors, so `pathname === link.href` is never true there. The active state is currently unreachable in both directions.
- **Why it matters:** Screen-reader users get an orientation cue that sighted users don't — an inverted accessibility gap, and a sign the state was added to satisfy a checklist rather than designed. Once UX-B1 lands and inner pages get real nav links, the missing visual state becomes immediately noticeable.
- **Recommendation:** Add an `[aria-current="page"]` rule (or a `text-amber` conditional class) and switch the landing's hash links to scroll-spy or accept that they have no active state. Fix alongside UX-B1 — separately it fixes nothing observable.
- **Regression risk:** A global `[aria-current="page"]` selector will also hit any future breadcrumb or pagination that sets the attribute, so scope it to the nav. If the active color is `text-amber`, it must be distinguishable from the `text-amber/50` `/` prefix already inside every nav link or the two accents merge.
- **Expected impact:** Location is visible to everyone, not only to assistive tech.
- **Effort estimate:** S

#### UX-M4 Copy-to-clipboard behaves three different ways, one of which fails silently with an unhandled rejection
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/CopyButton.tsx:13, apps/web/components/SharePageShortcuts.tsx:28-31, apps/web/components/BadgeToolbar.tsx:91-98
- **What's happening:** Three copy paths, three failure semantics. `CopyButton` — used for both embed snippets on the share page and on the landing page — has no catch at all: a rejected clipboard write (insecure context, denied permission, unfocused document) produces an unhandled promise rejection, `setCopied(true)` never runs, and the button visibly does nothing. `SharePageShortcuts` swallows the error deliberately but shows nothing either way, so even a successful keyboard copy gives no confirmation. Only `BadgeToolbar` surfaces a toast.
- **Why it matters:** Copying the embed snippet is the terminal action of the entire funnel — the moment the user takes the product away with them. A silent no-op there means the user pastes nothing into their README and has no idea why. The keyboard shortcut path is worse: it succeeds silently, so the user re-presses it, unsure.
- **Recommendation:** Extract one `useCopyToClipboard()` hook wrapping the write in try/catch, returning `idle | copied | failed`, driving both the existing `aria-live` confirmation and the shared Toast on failure. Point all three call sites at it and add a confirmation toast to the copy-embed shortcut.
- **Regression risk:** `CopyButton`'s success indicator is a CSS cross-fade between two absolutely-positioned icon spans keyed off `copied`; routing through a hook must preserve that the `sr-only` `aria-live` region flips at the same time, or the announcement and the visual desync. `BadgeToolbar` reuses `setErrorToast` for both copy and download failures with the same generic string — unifying shouldn't collapse those into an even less specific message. The `refresh-badge` shortcut in the same file has the identical no-feedback problem and fires a POST plus a full page reload; fix it in the same pass or it becomes the last inconsistent path.
- **Expected impact:** Copy always tells the user what happened; the funnel's last step stops failing silently.
- **Effort estimate:** S

#### UX-M5 Two different embed snippets on the same page — the keyboard shortcut and the Copy button produce different text
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/page.tsx:304, apps/web/components/SharePageOwnerContent.tsx:119, apps/web/components/SharePageOwnerContent.tsx:120, apps/web/components/SharePageShortcuts.tsx:28
- **What's happening:** The share page builds an embed string at page.tsx:304 and passes it to `SharePageShortcuts`, which is what the `e` shortcut copies. `SharePageOwnerContent` independently builds a different string for the visible Markdown block and its Copy button. So `e` yields `![Chapa Badge](…)` while clicking Copy two inches away yields `![Chapa de impacto](…)` in Spanish. Separately, the two snippets shown side by side disagree on alt quality: the Markdown one omits the handle, the HTML one includes it.
- **Why it matters:** Two affordances for one action producing different output is a correctness bug, not a style nit — and the shortcut path hardcodes English on a Spanish-default product and emits the weakest alt text of the three. Since the markdown snippet is what most users actually paste, its alt is what screen-reader users encounter on every README that embeds a Chapa badge.
- **Recommendation:** Build the embed string once — localized, handle-bearing — and pass the single value to both `SharePageShortcuts` and the visible snippet. Align the Markdown alt with the HTML alt.
- **Regression risk:** `page.tsx` is a server component resolving locale per request; `SharePageOwnerContent` is a client component using `useTranslation()`. Lifting the string to the server means the client block must accept it as a prop rather than recompute it, or the two can desync again on a `?lang=` override — the exact case `LocaleSync` exists to handle. Changing the alt text changes what existing embedders get on re-copy but does not retroactively fix already-pasted READMEs.
- **Expected impact:** One embed string, localized, with useful alt text, from both affordances.
- **Effort estimate:** S

#### UX-M6 The badge's score runs an infinite animation with no reduced-motion guard, inside third-party pages
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence] for the markup; [inference] that reduced-motion media queries inside an img-embedded SVG evaluate against the viewer's OS setting
- **Files:** apps/web/lib/render/BadgeSvg.tsx:147-149, apps/web/lib/render/BadgeSvg.tsx:249, apps/web/lib/render/BadgeSvg.tsx:246-247, apps/web/styles/globals.css:479-500, apps/web/lib/render/heatmap.ts:64-84
- **What's happening:** The app's own CSS has an exemplary reduced-motion implementation, and the heatmap renderer has an explicit static mode. The badge's inline `<style>` block has neither: the score number pulses between opacity 0.7 and 1 forever, with no `prefers-reduced-motion` override inside the SVG document. Unlike SMIL (which the file at line 19 correctly notes is dead in `<img>` embeds), CSS animations inside an `<img>`-loaded SVG do run.
- **Why it matters:** This animation is not on Chapa's own pages — it is on other people's READMEs and profile pages, indefinitely, for readers who have explicitly asked their OS to stop motion. A perpetually pulsing element in a document a user did not opt into is precisely the case SC 2.3.3 and the reduced-motion preference exist for, and the project already respects that preference everywhere it controls.
- **Recommendation:** Add a `@media (prefers-reduced-motion: reduce)` block inside the SVG's `<defs><style>` disabling the animation and pinning opacity to 1, mirroring `globals.css`. `ring-draw` is a finite 1.2s reveal and can stay.
- **Regression risk:** `lib/render/svg-to-png.ts:76-82` strips `@keyframes` blocks with a regex before PNG rasterization; a nested `@media` block will not match that pattern and could survive into the PNG path or cause the existing regex to mis-slice the stylesheet — verify `svg-to-png` still produces clean output, and extend its stripping to cover the media block. The badge SVG cache stores rendered strings, so every cached badge must be invalidated for the guard to take effect.
- **Expected impact:** The badge stops animating on third-party pages for users who asked it not to.
- **Effort estimate:** S

#### UX-M7 The app ignores the OS dark-mode preference and defaults every first visit to light
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/ThemeProvider.tsx:15, apps/web/app/global-error.tsx:43-48, apps/web/components/ThemeToggle.tsx:12
- **What's happening:** `enableSystem={false}` means `next-themes` never consults `prefers-color-scheme`. Every first-time visitor gets light regardless of their system setting, and only a manual toggle changes it. The one page that bypasses the provider — `global-error.tsx` — implements system-preference detection by hand, so the product does both things in different places.
- **Why it matters:** The audience is developers, who skew heavily to dark environments, and CLAUDE.md itself calls dark "the signature brand look." Serving the brand's non-signature theme to a dark-mode user on first contact is a self-inflicted first-impression cost — and it's the visit where the demo badge (always dark) sits against a white page, the least flattering framing of the product's core artifact.
- **Recommendation:** Set `enableSystem` and keep `defaultTheme="system"` with light as the resolved fallback. `next-themes` handles the no-flash inline script, and the existing `useIsClient()` hydration guard already covers the placeholder case.
- **Regression risk:** `ThemeToggle` derives state as `theme === "dark"`; under `enableSystem` that's wrong for `theme === "system"` and must read `resolvedTheme`, or the icon shows the wrong state for every system-preference user. The root layout is force-static/ISR for the `[locale]` pages, so the theme script must run before paint or the flash lands on exactly the CDN-cached pages the i18n work fought to keep flash-free. Light must stay the resolved fallback for `no-preference`.
- **Expected impact:** Dark-mode developers meet the product in its signature look.
- **Effort estimate:** S

#### UX-M8 Duplicate language and theme controls in the mobile DOM
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/NavbarShell.tsx:86-88, apps/web/components/MobileNav.tsx:125-126, apps/web/components/NavbarShell.tsx:80
- **What's happening:** The navbar's right cluster renders `LanguageSwitcher` + `ThemeToggle` at all breakpoints. `MobileNav`'s expanded panel renders a second copy of both. On a phone with the menu open, two identical globe buttons and two identical theme toggles are in the DOM simultaneously, each with the same `aria-label`. (Same defect as FE-L2, from the a11y side.)
- **Why it matters:** Screen-reader users hear "language switcher, button" twice with no way to distinguish them. Sighted users see the same control in two places, which reads as a layout bug. It also crowds a 320px navbar: logo + hamburger + globe + toggle + login link all compete for the same row before the panel even opens.
- **Recommendation:** Hide the right-cluster toggles below `md` so the mobile panel owns them, keeping the auth control in the bar — or drop them from the panel.
- **Regression risk:** The right cluster also holds `UserMenu` and the login link, which must stay visible on mobile — wrap only the two toggles, not the whole cluster. `MobileNav` only renders when `navLinks` is non-empty, which per UX-B1 is currently just the landing page; hiding the bar copies below `md` would strip theme and language control from every other page on mobile until UX-B1 lands. Sequence this after UX-B1, or gate the hide on `navLinks` presence.
- **Expected impact:** One control per function; a less crowded mobile navbar.
- **Effort estimate:** S

#### UX-M9 The activity timeline is a role="img" containing ~90 focusable buttons
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/ActivityHeatmap.tsx:647, apps/web/components/dashboard/ActivityHeatmap.tsx:679-681, apps/web/components/dashboard/ActivityHeatmap.tsx:711, apps/web/components/dashboard/ActivityHeatmap.tsx:708
- **What's happening:** The timeline wrapper declares itself a single image with one label, then fills itself with one `role="button"`, `tabIndex={0}` node per day. `role="img"` is meant to collapse its subtree into one graphic — descendants are generally pruned from the accessibility tree — so the per-day labels are unreliable, while the tab stops are entirely real. A keyboard user tabbing through the share page hits roughly 90 stops inside a widget whose only action is revealing a tooltip.
- **Why it matters:** Two accessible-name strategies contradict each other, so neither works predictably. The tab burden is the concrete harm: reaching the embed snippets below the dashboard by keyboard means ~90 presses through elements that activate into nothing but a hover card. The rest of the file is well-built, which makes this the odd seam rather than a pattern.
- **Recommendation:** Pick one. Either keep `role="img"` with its summary label and make the dots non-focusable decoration, or drop `role="img"`, keep the dots interactive, and apply roving `tabIndex` so the group is one tab stop with arrow-key traversal.
- **Regression risk:** `handleDotFocus`/`handleDotKeyDown` are the keyboard path to the tooltip; removing `tabIndex` removes that path, so day-level data must survive in the summary label or an adjacent visually-hidden table. If you go roving instead, `role="button"` is still wrong for a tooltip trigger — these should be `tabIndex` + `aria-describedby`, since activating them performs no action. Whichever path, the existing portal tooltip and its `rect.top < 120` flip must keep working.
- **Expected impact:** Coherent semantics and a keyboard-navigable share page.
- **Effort estimate:** M

#### UX-M10 "Verified" is coral on the badge and teal on the page it links to
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/badge-visual-metadata.ts:23, apps/web/lib/render/VerificationStrip.ts:23, apps/web/lib/render/BadgeSvg.tsx:180, apps/web/app/verify/[hash]/page.tsx:150, apps/web/components/StatusCallout.tsx:41-46, apps/web/app/LandingContent.tsx:132
- **What's happening:** The design system assigns one semantic color to verification: complement teal. The badge SVG is exempt from theme rules and uses coral for its verification strip — an intentional, documented token. But the badge also renders its verified shield icon in brand purple at BadgeSvg.tsx:180. So a single verified badge signals "verified" in purple (shield) and coral (strip), and the verify page it links to signals it in teal.
- **Why it matters:** Color is the fastest-read carrier of "this is the trust thing," and the product spends it three ways on its one trust claim. A user who clicks the coral strip lands on a teal page — the visual thread from artifact to proof breaks exactly where continuity matters most. The badge's dark-only palette justifies a different token; it doesn't justify two different ones within the same badge.
- **Recommendation:** Decide whether verification is coral or teal and apply it consistently. Simplest coherent option: keep coral as the badge's verification accent, recolor the verified shield from the brand accent to the coral token, and carry a coral accent onto `/verify/:hash` so the click-through is visually continuous. Record the decision in `design-system.md`, which currently states only the teal rule.
- **Regression risk:** Teal is not only used for verification — `bg-complement` is the landing's secondary CTA and `StatusCallout`'s verification variant serves the verify success card. Recoloring the verify page to coral collides with `--color-terminal-red` closely enough that "verified" and "error" could become hard to distinguish at a glance — check both themes before committing. Coral #E05A47 on the light theme's white needs its own contrast check; it currently only renders on the badge's fixed dark background. The coral token is shared between the SVG renderer and the Studio preview footer, so `PreviewFooter.tsx` follows whatever is decided.
- **Expected impact:** One color means "verified" from the badge through to the proof page.
- **Effort estimate:** S

#### UX-L1 Sub-12px type down to 7px, with no documented type scale to appeal to
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/ActivityHeatmap.tsx:655, apps/web/components/dashboard/ActivityHeatmap.tsx:668, apps/web/components/badge/BadgeContent.tsx:204-207, apps/web/app/studio/QuickControls.tsx:88, apps/web/app/studio/QuickControls.tsx:125, apps/web/components/AuthorTypewriter.tsx:185
- **What's happening:** 28 arbitrary-size occurrences outside `experiments/` escape Tailwind's scale into pixel values below `text-xs` (12px), bottoming out at 7px for the heatmap's day-of-week row — and nearly all are additionally in `text-text-secondary` or `text-terminal-dim`, so small and low-contrast compound. The design system has no typographic scale section, so there is nothing for a reviewer to point at.
- **Why it matters:** 7px is below the threshold at which most people can read a glyph at arm's length regardless of contrast, and browser minimum-font-size settings will silently reflow these rows. Individually each is a nitpick; as a pattern it's the absence of a type scale, which is why it keeps recurring.
- **Recommendation:** Add a type-scale table to `design-system.md` with 11px as the documented floor and a rule that anything below `text-xs` must use a named token. Raise the 7px/9px heatmap labels to at least 10px — abbreviating to single letters buys the room.
- **Regression risk:** The heatmap week grid divides available width across 7 `flex-1` columns; larger day labels will wrap or force horizontal scroll at mobile widths, so shortening the strings has to come with the size increase, not after it. `BadgeContent`'s 9px radar labels are absolutely positioned around a fixed-size chart — enlarging them without re-laying-out will overlap the polygon. Several 10px uses are uppercase tracking-wide micro-labels where the small size is doing real hierarchical work; a blanket bump would flatten the dashboard's hierarchy.
- **Expected impact:** A floor exists, and the worst offenders clear it.
- **Effort estimate:** M

#### UX-L2 The badge palette drifts from globals.css despite an explicit invariant comment
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/render/theme.ts:13-15, apps/web/lib/render/theme.ts:19-20, apps/web/lib/render/theme.ts:32-33, apps/web/styles/globals.css:129-132, apps/web/app/u/[handle]/page.tsx:341-343
- **What's happening:** theme.ts:13-15 states "Invariant: shared brand and archetype colors must stay aligned with globals.css". Four of the six shared values have drifted: badge `bg` #0C0D14 vs token #0A0A0F, `card` #13141E vs #111118, `textStrong` #E6EDF3 vs #E2E4E9, `textMuted` #9AA4B2 vs #8B8FA0. The accent and all seven archetype colors match exactly. On the share page the badge renders inline inside a `bg-card` panel on `bg-bg`, so #0C0D14 sits directly against #111118 — a small but visible seam.
- **Why it matters:** The file states an invariant it does not hold, so the next person to touch either palette has no reliable signal about what must stay synchronized. The visual cost is minor; the maintenance cost is that "aligned" now means "aligned for some values."
- **Recommendation:** Either bring the four values into agreement, or narrow the comment to say exactly what is shared (accent + archetypes) and that the surface palette is deliberately independent because the badge is theme-fixed. The second is probably the honest answer.
- **Regression risk:** Changing `theme.ts`'s `bg` alters every rendered badge including all cached SVGs and every already-embedded README image, for a difference of two RGB steps — not worth the cache invalidation. Prefer correcting the comment. If the values are unified, note the badge's `textMuted` is lighter than the app's, so aligning downward would reduce contrast on the badge's secondary text.
- **Expected impact:** The stated invariant becomes true, so future edits have a reliable rule.
- **Effort estimate:** S

#### UX-L3 The global error page's dark-mode secondary text falls below AA
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/global-error.tsx:46, apps/web/app/global-error.tsx:117
- **What's happening:** The file documents that its hardcoded hex values mirror the design-system tokens — and the light values do (#FFFFFF, #1A1A2E, #6B7280 all match). The dark secondary is #6B6F7B, not the token's #8B8FA0. On #0A0A0F that computes to **3.94:1** at 14px, versus 6.15:1 for the correct token. The same value colors the "Go home" link.
- **Why it matters:** Small in isolation — it's the crash page. But it's the one screen where a user is already stuck, and the only place they're told what happened. The hardcoding is legitimately necessary here (the boundary replaces the root layout and Tailwind); the wrong value is not.
- **Recommendation:** Change both occurrences to #8B8FA0 to match the token's dark value, as the file's own comment intends.
- **Regression risk:** None functionally — a static string in an inline style block on a page with no CSS dependencies. The constraint to preserve is that these values must stay hardcoded (Tailwind and CSS custom properties are genuinely unavailable at this boundary), so the fix is a literal edit, not a token reference. Verify the light-mode value is untouched; it is already correct.
- **Expected impact:** The crash page's explanatory text is readable in dark mode.
- **Effort estimate:** S

#### UX-L4 design-system.md's LanguageSwitcher spec contradicts the implementation
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** docs/design-system.md:1, apps/web/components/LanguageSwitcher.tsx:96, apps/web/components/LanguageSwitcher.tsx:132, apps/web/components/LanguageSwitcher.tsx:147, apps/web/components/LanguageSwitcher.tsx:68-79
- **What's happening:** The spec describes a menu (`aria-expanded`, `role="menu"`, `role="menuitem"`); the code implements a listbox (`role="group"`, `role="listbox"`, `role="option"`) with arrow-key traversal, Escape-to-close, and focus return to the trigger. The implementation is the better pattern for a single-select control — a language picker is a choice among options, not a set of commands — but the document says otherwise, and `design-system.md` is designated MANDATORY, so a deviation is a finding regardless of which side is right.
- **Why it matters:** The document is the audit reference. When it disagrees with the code, every future reviewer either "fixes" working code toward a worse pattern or learns to distrust the spec. The same document also encodes the `terminal-dim` nav-link rule that UX-H1 identifies as an accessibility failure — both are cases of the spec, not the code, needing the edit.
- **Recommendation:** Update `design-system.md` to describe the listbox/option pattern the component actually implements, including the Escape-and-return-focus behaviour. Do not change the component.
- **Regression risk:** Documentation-only. The one thing to preserve is that `useDropdownMenu` (used by `UserMenu` and `BadgeToolbar`) genuinely IS a menu pattern keyed on `[role="menuitem"]` — the doc should distinguish the two patterns rather than declare one universal rule, or a future refactor will try to unify components that are correctly different. Worth noting in the same edit: `useDropdownMenu`'s Escape handler does not return focus to the trigger, while `LanguageSwitcher`'s does.
- **Expected impact:** The mandatory spec stops contradicting shipped, correct code.
- **Effort estimate:** S

#### UX-L5 The badge SVG has no accessible name of its own, and the recommended Markdown embed carries a generic alt
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/render/BadgeSvg.tsx:143, apps/web/app/u/[handle]/page.tsx:304, apps/web/lib/i18n/dictionaries/en.ts:212, apps/web/app/u/[handle]/page.tsx:341-343
- **What's happening:** Chapa's own surfaces handle this correctly — the share page wraps the inline SVG in `role="img" aria-labelledby`, and the landing and archetype pages do the same. The SVG document itself carries nothing: no `role="img"`, no `<title>`, no `<desc>`. So when fetched directly at `/u/:handle/badge.svg`, embedded via `<object>`, or rendered by any consumer that doesn't supply an alt, it has no accessible name. And the Markdown snippet the product hands users — the dominant embed form — resolves to alt text that names the brand but not the person or any of the data.
- **Why it matters:** A badge is a data-bearing image whose entire point is conveying a score, tier, and archetype. Every README that follows Chapa's own recommendation announces "Chapa Badge" and nothing else. This is the tail case of UX-M5 and UX-H3; the fix is cheapest done alongside them.
- **Recommendation:** Add `role="img"` and a `<title>` to the SVG root, generated from the same data the share page already uses for `aria-labelledby`. Make the Markdown snippet's alt match the HTML snippet's handle-bearing form.
- **Regression risk:** An SVG `<title>` renders as a native browser tooltip on hover for inline SVGs, which would add an unstyled tooltip on the share page's badge and collide with the portal-tooltip convention (`BadgeOverlay` already overlays that area). Verify the interaction, or gate the `<title>` to the route-served variant only. `svg-to-png.ts` strips animations before rasterization but not text nodes — confirm a `<title>` doesn't reach the PNG. The share page's existing `aria-labelledby` wrapper becomes redundant once the SVG names itself; leaving both risks a doubled announcement.
- **Expected impact:** The badge names itself wherever it travels.
- **Effort estimate:** S

**UX verified clean (checked, no finding):** no hardcoded hex in components outside the documented `global-error`/icon exceptions; no italic on monospace headings; no `onClick` on non-focusable divs; `rounded-full` only on icon-only buttons; all five portal-rendered tooltips comply with the mandated `position: fixed` / `z-[99999]` pattern; en/es dictionary parity holds (1385 lines each); Spanish copy quality is high; `app/webmcp-spike` is correctly gated out of production; `#main-content` skip-link targets exist on every route.

## 12. Prioritized Action Plan

Sorted by severity desc (blocker first), then time horizon asc (Before < After < Later), then effort asc.

| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|---|---|---|---|---|---|---|
| DO-B1 | DevOps | Alert channel inert in production; health check exempts it | launch-blocker | Before | S | Outages, dead crons, 5xx storms become observable |
| UX-B1 | UX | No nav or footer outside landing; Privacy/Terms unreachable | launch-blocker | Before | M | Legal reachable everywhere; SEO pages get a conversion path |
| BE-H1 | Backend | Chained mergeStats corrupts review count, flips profile type | high | Before | S | Quality + archetype independent of platform count |
| BE-H2 | Backend | Rejected low-scope fetch can overwrite better-scoped cache | high | Before | S | Non-downgrading rule holds on both paths |
| DO-H1 | DevOps | Outage playbook omits the repo-scope requirement for GITHUB_TOKEN | high | Before | S | Closes the procedural path to silent score collapse |
| UX-H5 | UX | 13 error boundaries, 3 visual languages, 10 violate the spec | high | Before | S | One error language; failure states announce |
| UX-H6 | UX | Interactive targets down to 14x14px | high | Before | S | Tooltips and footer links reliably tappable |
| FE-H1 | Frontend | English dictionary ships in every page's client bundle | high | Before | M | ~30 KB gzip off first load on every route |
| FE-H2 | Frontend | Share page discards server-resolved session, refetches client-side | high | Before | M | One fewer auth request; correct UI on first paint |
| PE-H1 | Performance | Same dictionary defect, measured: 87 KB raw / 30.6 KB gzip | high | Before | M | −87 KB raw from First Load JS, both locales |
| PE-H2 | Performance | Badge cold-miss deadlines sum to 4.6s against a 3.0s SLO | high | Before | M | ~500ms off TTFB; an achievable SLO |
| SE-H1 | Security | CLI device auth has no device-code binding to approval | high | Before | M | Phished approval link becomes useless |
| UX-H1 | UX | Hero CTAs and terminal-dim fail WCAG AA contrast | high | Before | M | CTAs and navigation become readable |
| UX-H2 | UX | Archetype pages render two empty sections, 7 pages x 2 locales | high | Before | M | SEO pages read as finished |
| UX-H4 | UX | Verification seal illegible and inert in embeds | high | Before | M | Trust claim visible; copy becomes truthful |
| UX-H3 | UX | Badge SVG hardcoded English in a Spanish-default app | high | Before | L | The travelling artifact matches the user's language |
| AR-M1 | Architect | no-process-env gate excludes components/** | medium | Before | S | Closes last uncovered directory in the env boundary |
| AR-M2 | Architect | Redis keys duplicated across 7 sites; one comment already drifted | medium | Before | S | Key rename becomes one line |
| AR-M3 | Architect | Two shipped feature flags undocumented | medium | Before | S | Config surface discoverable |
| BE-M1 | Backend | Badge coalescing key ignores readOnly | medium | Before | S | Smoke and real traffic stop cross-contaminating |
| BE-M2 | Backend | Quota refund recomputes date; midnight batch goes negative | medium | Before | S | Send quota stays a real ceiling |
| BE-M3 | Backend | Rate limiters set TTL only at count 1; lost EXPIRE = permanent lockout | medium | Before | S | A Redis hiccup can't lock a user out forever |
| BE-M4 | Backend | Telemetry client_error branch precedes all three rate limits | medium | Before | S | All telemetry ingress metered |
| DO-M1 | DevOps | main protection omits migration + contract gates; a migration is pending | medium | Before | S | Schema ordering mechanically enforced |
| DO-M2 | DevOps | 26h staleness threshold applied to an hourly cron | medium | Before | S | Warm-cache death detected in one rotation |
| FE-M1 | Frontend | DocumentLocaleScript on 3 of 12 routes; wrong html lang on 9 | medium | Before | S | Correct lang in served HTML |
| FE-M2 | Frontend | Heatmap streak uses local calendar date; hydration mismatch risk | medium | Before | S | Removes a timezone-dependent hydration error |
| FE-M3 | Frontend | Studio tracks dirty state but has no unsaved-changes guard | medium | Before | S | Unsaved Studio work not silently discarded |
| FE-M4 | Frontend | Hardcoded English in the insights import toast | medium | Before | S | Insights flow completes in the user's language |
| QA-M1 | QA | delete-user untested past pure helpers; no atomicity | medium | Before | S | Partial deletion diagnosable, not reported complete |
| SE-M1 | Security | Telemetry bypass + unsanitized payload to PostHog | medium | Before | S | No un-redacted client strings reach the vendor |
| SE-M2 | Security | displayName passes verbatim into browser-agent tool context | medium | Before | S | Bounds the one attacker-controlled free-text field |
| UX-M1 | UX | Studio GUI collapsed by default; no visible page title | medium | Before | S | Studio's capabilities visible on arrival |
| UX-M3 | UX | aria-current set but never styled, on links that never render | medium | Before | S | Location visible to everyone |
| UX-M4 | UX | Three copy-to-clipboard behaviours, one fails silently | medium | Before | S | Copy always reports what happened |
| UX-M5 | UX | Two different embed snippets from two affordances | medium | Before | S | One localized embed string with useful alt |
| UX-M6 | UX | Badge animates forever with no reduced-motion guard | medium | Before | S | Badge respects the OS motion preference |
| UX-M7 | UX | App ignores OS dark-mode preference on first visit | medium | Before | S | Developers meet the signature look |
| PE-M1 | Performance | /en ships the dictionary a second time in the RSC payload | medium | Before | M | Up to ~96 KB less HTML per English page |
| UX-M2 | UX | Studio preview doesn't match the badge it previews | medium | Before | M | Preview becomes trustworthy |
| BE-M5 | Backend | One 50-recipient batch per campaign per daily run | medium | After | S | Campaign drains at quota rate, not 50/day |
| BE-M6 | Backend | Missing Resend client permanently fails a whole batch | medium | After | S | Config outage costs a delay, not a truncated list |
| PE-M2 | Performance | warm-cache rewrites every badge SVG hourly, no read-before-write | medium | After | S | ~80% less cron Redis write volume |
| PE-M3 | Performance | Flag Map bypasses unstable_cache; nondeterministic ISR | medium | After | S | Deterministic build; up to 12x fewer regenerations |
| PE-M4 | Performance | Four serialized Redis round-trips on the cold-miss path | medium | After | S | One round-trip off every cold miss |
| QA-M2 | QA | backfill test covers a different module; backfill 0% covered | medium | After | S | Test-to-source mapping stops lying |
| UX-M8 | UX | Duplicate language/theme controls in the mobile DOM | medium | After | S | One control per function |
| UX-M10 | UX | "Verified" is coral on the badge, teal on the verify page | medium | After | S | One color means verified end to end |
| UX-M9 | UX | Activity timeline is role="img" wrapping ~90 focusable buttons | medium | After | M | Coherent semantics; keyboard-navigable share page |
| AR-L2 | Architect | knip.json ignoreDependencies stale; knip reports it | low | Before | S | Dead-code gate fully clean |
| DO-L1 | DevOps | Two feature-flag env vars absent from docs | low | Before | S | Removes a two-lever gotcha |
| SE-L1 | Security | Pre-hardening sessions never expire server-side | low | Before | S | 24h blast radius becomes universally true |
| SE-L3 | Security | explain_dimension lacks untrustedContentHint on public pages | low | Before | S | Trust classification decided at the call site |
| BE-L2 | Backend | Side-effect day-guard key is case-sensitive | low | After | S | One deferred run per handle per day |
| BE-L3 | Backend | Same annotation defect from the backend view | low | After | S | Per-call-site trust decision |
| BE-L4 | Backend | Campaign quota fail-open on read and reservation | low | After | S | Provider cap holds when Redis doesn't |
| BE-L5 | Backend | Ceiling alert fires 24x/day post-#1010 | low | After | S | Alert channel stays signal |
| BE-L6 | Backend | webmcp-spike debug page still compiled | low | After | S | One fewer duplicate WebMCP contract |
| DO-L2 | DevOps | Orphan COMING_SOON var in production | low | After | S | Config matches what code reads |
| DO-L3 | DevOps | Runbook calls a daily-polled path "real-time" | low | After | S | Stated detection latency matches reality |
| FE-L1 | Frontend | File input nested inside its own trigger button | low | After | S | Valid markup |
| FE-L2 | Frontend | Language/theme controls mounted twice on mobile | low | After | S | One canonical control per viewport |
| FE-L3 | Frontend | NavLink emits plain anchors; Studio does full reloads | low | After | S | Client-side navigation out of Studio |
| FE-L4 | Frontend | Effect overwrites document.title, duplicating metadata | low | After | S | One source of truth for the title |
| FE-L5 | Frontend | Route error boundaries report nothing | low | After | S | Client render failures visible |
| FE-L6 | Frontend | go-profile shortcut bypasses the session cache | low | After | S | One session-fetch implementation |
| PE-L1 | Performance | Share page serializes the SVG cache read after materialize | low | After | S | One round-trip off share-page TTFB |
| PE-L2 | Performance | /api/profile reads the snapshot key twice | low | After | S | One read removed per public API request |
| PE-L3 | Performance | warm-cache avatar resolution has no explicit deadline | low | After | S | A stated bound on the cron's avatar cost |
| QA-L1 | QA | Coverage includes packages/shared/dist build output | low | After | S | Coverage reflects source only |
| QA-L2 | QA | "Run all tests" excludes 33 contract tests | low | After | S | Pre-commit docs stop overstating coverage |
| SE-L4 | Security | Migration 032 grants CRUD to anon/authenticated; deny only for anon | low | After | S | Role intent explicit in schema |
| SE-L5 | Security | CSP omits base-uri, object-src, form-action | low | After | S | Completes an already-owned header |
| SE-L6 | Security | Two write routes use the fail-open limiter against policy | low | After | S | Write-path quota matches documented policy |
| UX-L2 | UX | Badge palette drifts from globals.css despite an invariant comment | low | After | S | The stated invariant becomes true |
| UX-L3 | UX | Crash page dark-mode secondary text below AA | low | After | S | Crash page readable in dark mode |
| UX-L4 | UX | design-system.md LanguageSwitcher spec contradicts the code | low | After | S | Spec stops contradicting correct code |
| UX-L5 | UX | Badge SVG has no accessible name; generic Markdown alt | low | After | S | The badge names itself wherever it travels |
| AR-L1 | Architect | Rate-limit preamble hand-rolled in 25 routes | low | After | M | Fail-open/closed choice forced, not inherited |
| BE-L1 | Backend | Studio config cache hit still reads Supabase | low | After | M | One fewer hop, or one fewer cache layer |
| SE-L2 | Security | OAuth nonce consumption disabled by client-influenceable inputs | low | After | M | Replay defense not switchable from the request |
| UX-L1 | UX | Type down to 7px with no documented scale | low | After | M | A floor exists and offenders clear it |
| FE-L7 | Frontend | ArchetypePageClient is a server component | low | Later | S | Names match reality |
| AR-L3 | Architect | TS omits exactOptionalPropertyTypes | low | Later | M | Marginal today; deliberate non-action |
| PE-L4 | Performance | Full posthog-js (190 KB) loaded for capture only | low | Later | M | Up to ~120 KB less deferred JS |
| AR-S1 | Architect | Two independent badge implementations; Studio previews a different artifact | strategic | Later | S | Removes a promise the product can't keep |
| AR-S2 | Architect | Seven interacting scoring/cache flags with no combination doc | strategic | Later | M | Combination surface reviewable in one place |
| BE-S1 | Backend | Compose layer has unchecked positional invariants (root cause of BE-H1) | strategic | Later | M | Adding a data source fails a test instead of mis-scoring |
| FE-S1 | Frontend | Session and locale sourcing chosen per page, not derived (root cause of FE-H2/FE-M1) | strategic | Later | L | Correct session and locale by construction |

## 13. Top 10 Highest-ROI Improvements

1. **DO-B1** — One environment variable restores the entire alerting system. Nothing else in this report buys as much observability per unit of effort, and every other operational finding is worth less until it lands.
2. **BE-H1** — The only genuine scoring-correctness bug found. Small fix, and it currently mis-scores every multi-platform user, writing wrong archetypes into attested HMAC records and trend history.
3. **UX-B1** — Makes legal documents reachable and turns 14 dead-end SEO pages into a conversion path. Blocks launch on its own merits; the fix is extracting an existing footer.
4. **FE-H1 / PE-H1** — One change, found independently by two specialists with separate measurements, removing ~30 KB gzip from every page load on both locales and reconciling three documentation claims with reality.
5. **UX-H5** — Near-mechanical substitution of an existing component across eleven files; converts the single most visible craft inconsistency in the product into one coherent error language and adds `role="alert"` where it is missing.
6. **BE-H2** — Small conditional that closes the reintroduced #1002/#1050 downgrade signature on the rejection path, protecting the Delivery dimension for every embed and visitor.
7. **SE-H1** — The only high-severity security finding, and the only unrevocable write path into another user's score. Needs CLI sequencing, so starting early matters more than the effort estimate suggests.
8. **UX-H1** — Two token swaps at the white-text-on-solid-fill call sites fix the contrast of the exact pixels the conversion funnel depends on, in both themes.
9. **DO-H1** — A two-line documentation correction that closes the one procedural path capable of silently collapsing every user's score during an incident.
10. **BE-M3** — A one-line change from conditional to unconditional `EXPIRE` that eliminates a permanent, unrecoverable-without-manual-surgery user lockout on fail-closed auth and write routes.

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)
- DO-B1: Alert channel inert in production; health check exempts it
- UX-B1: No nav or footer outside landing; Privacy/Terms unreachable
- BE-H1: Chained mergeStats corrupts review count, flips profile type
- BE-H2: Rejected low-scope fetch can overwrite better-scoped cache
- DO-H1: Outage playbook omits the repo-scope requirement for GITHUB_TOKEN
- FE-H1: English dictionary ships in every page's client bundle
- FE-H2: Share page discards server-resolved session, refetches client-side
- PE-H1: Dictionary defect, measured from the build output
- PE-H2: Badge cold-miss deadlines sum to 4.6s against a 3.0s SLO
- SE-H1: CLI device auth has no device-code binding to approval
- UX-H1: Hero CTAs and terminal-dim fail WCAG AA contrast
- UX-H2: Archetype pages render two empty sections
- UX-H3: Badge SVG hardcoded English in a Spanish-default app
- UX-H4: Verification seal illegible and inert in embeds
- UX-H5: 13 error boundaries, 3 visual languages, 10 violate the spec
- UX-H6: Interactive targets down to 14x14px
- AR-M1: no-process-env gate excludes components/**
- AR-M2: Redis keys duplicated across 7 sites; one comment already drifted
- AR-M3: Two shipped feature flags undocumented
- BE-M1: Badge coalescing key ignores readOnly
- BE-M2: Quota refund recomputes date; midnight batch goes negative
- BE-M3: Rate limiters set TTL only at count 1
- BE-M4: Telemetry client_error branch precedes all three rate limits
- DO-M1: main protection omits migration + contract gates
- DO-M2: 26h staleness threshold applied to an hourly cron
- FE-M1: DocumentLocaleScript on 3 of 12 routes; wrong html lang on 9
- FE-M2: Heatmap streak uses local calendar date
- FE-M3: Studio has no unsaved-changes guard
- FE-M4: Hardcoded English in the insights import toast
- PE-M1: /en ships the dictionary a second time in the RSC payload
- QA-M1: delete-user untested past pure helpers; no atomicity
- SE-M1: Telemetry bypass + unsanitized payload to PostHog
- SE-M2: displayName passes verbatim into browser-agent tool context
- UX-M1: Studio GUI collapsed by default; no visible page title
- UX-M2: Studio preview doesn't match the badge it previews
- UX-M3: aria-current set but never styled
- UX-M4: Three copy-to-clipboard behaviours, one fails silently
- UX-M5: Two different embed snippets from two affordances
- UX-M6: Badge animates forever with no reduced-motion guard
- UX-M7: App ignores OS dark-mode preference on first visit
- AR-L2: knip.json ignoreDependencies stale
- DO-L1: Two feature-flag env vars absent from docs
- SE-L1: Pre-hardening sessions never expire server-side
- SE-L3: explain_dimension lacks untrustedContentHint on public pages

### After launch (Wave 2)
- BE-M5: One 50-recipient batch per campaign per daily run
- BE-M6: Missing Resend client permanently fails a whole batch
- PE-M2: warm-cache rewrites every badge SVG hourly
- PE-M3: Flag Map bypasses unstable_cache; nondeterministic ISR
- PE-M4: Four serialized Redis round-trips on the cold-miss path
- QA-M2: backfill test covers a different module
- UX-M8: Duplicate language/theme controls in the mobile DOM
- UX-M9: Activity timeline is role="img" wrapping ~90 focusable buttons
- UX-M10: "Verified" is coral on the badge, teal on the verify page
- AR-L1: Rate-limit preamble hand-rolled in 25 routes
- BE-L1: Studio config cache hit still reads Supabase
- BE-L2: Side-effect day-guard key is case-sensitive
- BE-L3: explain_dimension annotation fixed at the factory
- BE-L4: Campaign quota fail-open on read and reservation
- BE-L5: Ceiling alert fires 24x/day post-#1010
- BE-L6: webmcp-spike debug page still compiled
- DO-L2: Orphan COMING_SOON var in production
- DO-L3: Runbook calls a daily-polled path "real-time"
- FE-L1: File input nested inside its own trigger button
- FE-L2: Language/theme controls mounted twice on mobile
- FE-L3: NavLink emits plain anchors; Studio does full reloads
- FE-L4: Effect overwrites document.title
- FE-L5: Route error boundaries report nothing
- FE-L6: go-profile shortcut bypasses the session cache
- PE-L1: Share page serializes the SVG cache read after materialize
- PE-L2: /api/profile reads the snapshot key twice
- PE-L3: warm-cache avatar resolution has no explicit deadline
- QA-L1: Coverage includes packages/shared/dist build output
- QA-L2: "Run all tests" excludes 33 contract tests
- SE-L2: OAuth nonce consumption disabled by client-influenceable inputs
- SE-L4: Migration 032 grants CRUD to anon/authenticated
- SE-L5: CSP omits base-uri, object-src, form-action
- SE-L6: Two write routes use the fail-open limiter against policy
- UX-L1: Type down to 7px with no documented scale
- UX-L2: Badge palette drifts from globals.css
- UX-L3: Crash page dark-mode secondary text below AA
- UX-L4: design-system.md LanguageSwitcher spec contradicts the code
- UX-L5: Badge SVG has no accessible name

### Later / strategic (Wave 3)
- AR-L3: TS omits exactOptionalPropertyTypes
- FE-L7: ArchetypePageClient is a server component
- PE-L4: Full posthog-js loaded for capture only
- AR-S1: Two independent badge implementations
- AR-S2: Seven interacting scoring/cache flags with no combination doc
- BE-S1: Compose layer has unchecked positional invariants
- FE-S1: Session and locale sourcing chosen per page, not derived

## 15. Open Questions / Assumptions

**Assumptions made during the audit.**
- The audit ran against `develop` at `e72a4e3a`, with production at `4f6265c3` (`v2.23.0`). The WebMCP series and Studio judge-demo mode are unreleased, so several findings concern code not yet in production — DO-B1 and DO-H1 are the exceptions and apply to production as it stands today.
- Items formally recorded in `docs/accepted-risks.md` were treated as intentional and excluded. Where a finding sits adjacent to an accepted item, the report says so explicitly (SE-L1 vs the session-revocation entry, SE-L2 vs proxy-header trust, SE-L6 vs rate-limiter fail-open, AR-S1 vs the project-scale policy).
- The project-scale policy was applied: findings amounting to new CI gates, new monitoring services, or hardening disproportionate to a solo project were suppressed unless they closed a concrete, material gap. DO-B1 and DO-M1 are deliberate exceptions — both concern machinery that already exists and is merely unwired.

**Missing context that limited stronger conclusions.**
- No runtime measurement was possible for contrast (UX-H1, UX-L3) or for production p95 latency (PE-H2). Contrast ratios were computed from committed token values; the latency figure is bounded arithmetic from the code's own deadline constants, not an observed distribution.
- Whether Vercel's edge overwrites a client-supplied `x-forwarded-host` was not verified, which bounds the confidence of SE-L2's host leg (labelled inference).
- The Chapa CLI is an external binary outside this repo, so SE-H1's fix sequencing could not be validated against the actual client.
- Whether any invalidation path deletes the badge SVG cache key was not established; PE-M2's fix depends on it.

**Questions for the human before remediation starts.**
1. **PE-H2 is a decision, not just a fix**: should `BADGE_LATENCY_SLO_MS.cacheMiss` rise to a number the implementation can hold, or should the materialize/avatar deadlines come down? That is a product/ops call about acceptable cold-miss latency.
2. **AR-S1**: is Creator Studio intended to eventually drive the embeddable SVG, or is it permanently a preview of on-page effects? The pre-launch action (a labeling change) differs completely from the strategic one.
3. **UX-M10**: is verification coral or teal? Both are currently used, and the fix direction depends entirely on the answer.
4. **SE-L6**: `/api/generate` failing closed would block first-run badge generation during a Redis outage. Is unmetered recompute or a blocked first run the worse outcome?
5. **DO-L2**: `COMING_SOON` removal is a production-config change requiring explicit authorization; confirm nothing Vercel-side consumes it first.
6. **Migration 036** (`webmcp_enabled`, `studio_demo_enabled`) is unapplied to production. Confirm the intended production values for both flags before the next release, per DO-L1/AR-M3.

## 16. Final Verdict

**Verdict: NOT READY**

**What would most worry me about shipping today.** That the two blockers are both invisible to every automated signal the project has. CI is green, the suite is 8009 tests strong, coverage is 95%, the scanners are clean — and none of that touches an unset environment variable that silently disables all nine operational alerts, or a footer that exists on exactly one page. The second-order worry is the pattern underneath: four separate places where the codebase confidently documents behaviour that the build, the runtime, or the arithmetic disproves (the dictionary claim, the badge SLO, the outage runbook, the design-system error rule). A team that trusts its own documentation as much as this one does is exposed precisely where that documentation has drifted, and BE-H1 shows the same drift has already produced a real scoring bug that reaches attested records.

**What gives me confidence.** The engineering fundamentals are genuinely strong and were verified, not assumed: zero test failures, zero skipped tests, zero lint warnings, zero type errors, zero circular dependencies, zero dead exports, zero vulnerabilities across 680 packages, no secrets, `withErrorCapture` on 100% of 51 routes, every one of 52 API routes carrying an appropriate auth guard, and the confidence-redaction and SSRF/XSS boundaries holding on every traced path. The newest and riskiest surface — WebMCP — turned out to be flag-gated with a working kill switch, read-only, same-origin, and better tested than the audit brief assumed. Every blocker and high finding is small: eleven of the sixteen Before-launch blockers and highs are S or M effort, and the two blockers between them are one env var and one extracted component.

**Next 5 actions (ordered).**
1. Set `CHAPA_ALERT_WEBHOOK_URL` in Vercel Production and verify `/api/health` reports `alertWebhook: "configured"` (DO-B1). Decide on the `warm_cache_ceiling_approached` throttle (BE-L5) before the channel goes live, or day one is 24 identical pages.
2. Fix BE-H1 — assign `primaryReviewsSubmittedCount` once in `_compose` from the GitHub-derived value — and plan a recalculate pass, since existing snapshots carry the wrong `profile_type`.
3. Extract the site footer and pass real `navLinks` to inner pages (UX-B1), then fix the `aria-current` styling in the same change (UX-M3).
4. Close BE-H2's downgrade hole and DO-H1's runbook instruction — two small, high-leverage protections for the scoring data, both guarding the same failure mode from opposite ends.
5. Land FE-H1/PE-H1 together with PE-M1's mechanism decision, and start the SE-H1 CLI sequencing early since it depends on an external binary shipping first.
