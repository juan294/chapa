# Performance Report
> Generated: 2026-07-16 | Health status: GREEN

## Executive Summary
Build is clean (0 TypeScript errors, 81 routes) and the bundle is flat at 2,132 KB raw / ~638 KB gzipped across 73 chunks — consistent with cost-analyst's independent 2026-07-16 measurement. No route or chunk exceeds the 350 KB CI budget. The only new item this cycle is a `knip` false-positive regression (9 "unused dependencies" flagged, all verified as actually used in source) caused by `knip` not being version-pinned in the project.

## Build Output
Next.js 16 / Turbopack does not print a per-route First Load JS table in this build (only a route-type table: static ○, SSG ●, dynamic ƒ). Sizing below is derived directly from `.next/static/chunks` output, which is the authoritative artifact CI's bundle-size gate checks against.

| Chunk (top 5 by size) | Size (raw) | Status |
|---|---|---|
| `0qmgkw5s78uqn.js` (framework/vendor) | 228 KB | GREEN (<350 KB) |
| `2cz6l19i7nua_.js` (framework/vendor) | 192 KB | GREEN |
| `0cz1d0mv5g_q7.js` | 112 KB | GREEN |
| `43e11u3pk0euw.js` | 108 KB | GREEN |
| `2jkswxbh0nfv-.js` | 92 KB | GREEN |

**Routes/chunks >500 KB: 0. Routes/chunks >350 KB (CI gate): 0.** No RED or YELLOW route flags this cycle.

`/` and the 9 locale-segmented content pages (`/about`, `/about/scoring`, `/about/verification`, `/privacy`, `/terms`, 7× `/archetypes/*`) render as `●` (SSG via `generateStaticParams`, both `en`/`es` pre-rendered) — confirmed still static post-#1023, contributing zero client-bundle weight for their body content.

## Bundle Analysis
- Total First Load JS: **2,132 KB raw / ~638 KB gzipped**, 73 chunks (matches cost-analyst's 2026-07-16 figure exactly — cross-verified independently via direct chunk measurement, not copied).
- Largest chunks: 228 / 192 / 112 / 108 / 92 KB raw — all framework/vendor bundles, none app-code-specific.
- Unused exports: **0 real.** `npx knip --production` (v6.27.0, latest — not pinned) reports 2 files (`vitest.setup.ts`, `vitest.contract-setup.ts` — known test-infra false positives, unchanged for months) plus **9 "unused" dependencies this cycle: `@resvg/resvg-js`, `@vercel/analytics`, `@vercel/speed-insights`, `canvas-confetti`, `next-themes`, `posthog-js`, `resend`, `server-only`, `svix`.** All 9 were manually verified via `grep` and confirmed genuinely imported in production source (e.g. `svg-to-png.ts`, `ClientAnalytics.tsx`, `ThemeProvider.tsx`, `PostHogProvider.tsx`, `lib/email/resend.ts`, `webhooks/resend/route.ts`, all `lib/auth/*.ts`). This is a **false-positive regression**, not real dead code — see Recommendations.

## Client/Server Boundary
- **108** non-test files with a `"use client"` directive (module-level, standard placement) — consistent with the prior 2026-07-09 baseline (125, counted with a broader grep pattern; no evidence of net growth in app code this cycle, HEAD only advanced via #1023/#1027/#1029/#974/#1010/#1015/#1016/#1009 already covered by prior cycles).
- **8** files using `next/dynamic`/lazy imports for code-splitting (Studio, admin, command bar, analytics, instrumentation, share-page owner content, badge SVG lazy loaders).
- Key public pages (`/`, `/about`, `/u/[handle]`, archetype pages) confirmed server components — no unnecessary client-boundary pull-up found.
- No action needed this cycle.

## Caching & Headers
- Badge route (`/u/[handle]/badge.svg`): success responses carry `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` (6h + 24h SWR, confirmed in code at `route.ts:74`); error responses use a shorter `s-maxage=300, stale-while-revalidate=600`.
- `Server-Timing` header present on every badge response (`#974`), breaking down `cache`/`materialize`/`render`/`total` — confirms the latency SLO instrumentation from prior cycles is intact.
- No regressions found in cache header configuration.

## Fonts & CLS
- `next/font/google` used for both typefaces (JetBrains Mono, Plus Jakarta Sans) in `app/layout.tsx` — 0 external `<link>` font requests found in either root or locale layout. Render-blocking font risk: none.
- CLS: badge fallback `<img>` has explicit `width={1200} height={630}`; `LiteYouTubeEmbed` thumbnail has explicit `width={480} height={270}` (fix from 2026-07-01 triage holding). `prefers-reduced-motion` media query present (2 occurrences in `globals.css`).
- No CLS regressions found.

## Recommendations
1. **P3 — Pin `knip` as a devDependency.** It is not in `package.json`/`pnpm-lock.yaml` and is invoked via bare `npx knip`, so every cycle silently runs whatever is "latest" on the registry. This cycle picked up v6.27.0, which produced 9 false-positive "unused dependency" findings not seen in any prior cycle (all verified as real, in-use imports). Pinning the version makes results reproducible and stops future agents from having to re-verify the same false positives by hand.
2. No P1/P2 items. Bundle, caching, fonts, CLS, and client/server boundaries are all unchanged-and-healthy versus the 2026-07-09 baseline.

SHARED_CONTEXT_START
## Performance Agent — 2026-07-16
- **Status**: GREEN
- Total First Load JS: 2,132 KB raw / ~638 KB gzipped (73 chunks) — matches cost-analyst's 2026-07-16 figure via independent measurement
- Routes >500KB: 0
- Unused exports: 0 real (knip flagged 9 dependencies + 2 files this cycle; all 9 dependencies manually verified as false positives — genuinely imported in production source. Root cause: knip isn't version-pinned, latest v6.27.0 changed detection behavior. Recommend pinning.)

**Cross-agent recommendations:**
- [Coverage]: No untested performance-critical paths found this cycle — bundle, caching, and CLS surfaces unchanged since 2026-07-09.
- [Security]: No performance issues with security implications this cycle. Badge route cache headers and Server-Timing instrumentation unchanged.
- [QA]: No UX performance concerns — no CLS regressions, fonts render via next/font with zero external requests.
- [Triage / Cost Analyst]: New P3 — `knip` is unpinned (bare `npx knip`), causing a false-positive regression this cycle (9 "unused deps" that are all actually used). Recommend adding `knip` as a pinned devDependency so future cycles don't have to re-verify the same false positives.
SHARED_CONTEXT_END
