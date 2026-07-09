# Performance Report
> Generated: 2026-07-09 | Health status: green

## Executive Summary
Bundle re-baselined after the #982 landing refactor: 2,128 KB raw / 672 KB gzipped total JS (+49 KB raw / +2.4% vs 2026-07-02), fully attributed to the landing client split plus the v2.17.0 observability batch — and more than paid for by the landing page `/` now building as **static with 1h ISR** (confirmed `○` in build output), moving the highest-traffic route from per-request serverless to CDN. No route or chunk approaches the 500 KB / 350 KB budgets; knip is clean; fonts, CLS, and badge caching all pass.

## Build Output
Next.js 16.2.9 (Turbopack): compile 4.6s, TypeScript 8.7s, 0 errors. `pnpm install --frozen-lockfile` clean (lockfile up to date). 90 routes; 68 static pages generated in 848ms.

Turbopack omits the per-route First Load JS column, so routes are assessed from `.next/static/chunks` (same method as prior cycles). Notable route dispositions:

| Route | Size (First Load JS) | Status |
|-------|---------------------|--------|
| `/` (landing) | ○ static, revalidate 1h — **new since #982** | GREEN |
| `/about`, `/about/scoring`, `/about/verification` | ○ static, 5m ISR | GREEN |
| `/archetypes/*` (7 pages) | ○ static, 5m–1h ISR | GREEN |
| `/privacy`, `/terms`, `/verify` | ○ static, 1h ISR | GREEN |
| `/u/[handle]`, `/u/[handle]/badge.svg` | ƒ dynamic (by design — per-user) | GREEN |
| All chunks | largest 227 KB raw — none >300 KB | GREEN |

Routes >500 KB: **0**. Routes/chunks >350 KB (CI budget): **0**. Routes >300 KB: **0**.

## Bundle Analysis
- Total First Load JS (all chunks): **2,128 KB raw / 672 KB gzipped** (77 chunks)
- Delta vs 2026-07-02 baseline (2,079 / 659 / 76): **+49 KB raw (+2.4%) / +13 KB gzipped** — attributed to `LandingPageClient.tsx` (501 lines, #982) + observability batch (#974/#975/#976). Below the 2,300 KB `ANALYZE=true` trigger.
- Largest chunks: 227 / 190 / 109 / 107 / 88 KB raw — all framework/vendor, none >300 KB
- Unused exports: **none** — knip `--production` reports only the 2 known false positives (`vitest.setup.ts`, `vitest.contract-setup.ts`, test infrastructure)

## Client/Server Boundary
- `"use client"` directives (non-test): **125** (+8 vs 2026-07-02's 117) — growth from the #982 landing split and error/telemetry client surface tests batch. No misplaced directives found.
- Key public pages confirmed server components: `/` (server `page.tsx` with `force-static`), `/about`, `/u/[handle]`, archetype pages.
- The #982 pattern is correct: `app/page.tsx` stays a server component, renders the demo badge SVG **at build time** via `renderBadgeSvg()` and passes the string to `LandingPageClient` — no rendering libs (BadgeSvg, demoData) enter the client bundle. Client imports are lightweight (i18n, nav, terminal, CTA components).
- 11 files use `next/dynamic`/`import()` (Studio, admin sub-dashboards, command bar, analytics, instrumentation, share-page owner content) — heavy owner-only surfaces remain lazy.
- No synchronous imports of heavy libs (recharts/three/d3/framer-motion/canvas-confetti) in any non-dynamic client component.

## Caching & Headers
- Badge route (`/u/[handle]/badge.svg`): `maxDuration = 35`; success `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`; error responses `s-maxage=300, stale-while-revalidate=600`. Matches CLAUDE.md spec.
- **New (#974)**: every badge response now carries a `Server-Timing` header (`cache;desc="hit"` on warm hits; `materialize`/`render` breakdown + `total` on misses), and the `/api/cron/latency-check` daily synthetic monitor enforces the p95 budget (800ms hit / 3000ms miss) with P2 alerting — the badge route's latency characteristics are now continuously observable, closing the long-standing blind spot.
- Landing `/` and content pages CDN/ISR-cached as above — the biggest invocation-count win of the cycle.

## Fonts & CLS
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), `display: swap`, `subsets: ["latin"]` — **0 external font requests**, no render-blocking font CSS.
- CLS: badge fallback `<img>` has explicit `width={1200} height={630}` + skeleton + `fetchPriority="high"`; `LiteYouTubeEmbed` thumbnail has explicit `width={480} height={270}` + `loading="lazy"` (2026-07-01 fix holding). `prefers-reduced-motion` respected in `globals.css`.
- Landing page note: #982 moved copy rendering client-side (locale applied post-hydration by `LanguageProvider`). The documented tradeoff is a brief locale flash for non-default-locale users — content-swap, not layout-shift, since the static shell renders Spanish at the same layout. Acceptable per the i18n architecture in CLAUDE.md.

## Recommendations
1. **None blocking.** Bundle growth is understood, structurally sound, and below all budgets.
2. (P3, monitor) `"use client"` count has grown 105 → 113 → 117 → 125 over four measured cycles. Each step was justified, but if the trend continues past ~140 without corresponding feature surface, audit for directives that could move deeper.
3. (P3, next cycle) With `/` now static, consider a Lighthouse/LCP spot-check of the landing page in a future cycle — the locale flash window is the only new user-visible timing artifact from #982, and no measurement of it exists yet.
4. (Housekeeping) Baseline for future cycles: **2,128 KB raw / 672 KB gzipped / 77 chunks** on HEAD `b16274ba` (post-#982). The `ANALYZE=true` trigger remains 2,300 KB raw.
