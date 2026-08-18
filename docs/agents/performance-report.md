# Performance Report
> Generated: 2026-08-13 | Health status: green

## Executive Summary
Build is clean (0 errors/warnings), bundle size is flat against the established baseline despite a real 78-file app-code delta since the last measured commit (`553652d3` → `0482da44`), and all CI-enforced budgets (350 KB/chunk, knip) pass with zero findings.

## Build Output
`pnpm install --frozen-lockfile` succeeded (lockfile up to date, no drift). `pnpm run build`: Turbopack compile 7.7s, TypeScript 12.0s, 0 errors, 0 warnings. 81 routes total (9 locale-segmented content pages confirmed SSG via `generateStaticParams`, both `en`/`es` variants prerendered — `●` markers). The Next.js 16.2.11 Turbopack route table no longer prints a First Load JS column (only Revalidate/Expire), so sizes below are measured directly from `.next/static/chunks`.

| Metric | Value | Status |
|--------|-------|--------|
| Total JS (raw) | 1,999 KB across 73 chunks | GREEN |
| Total JS (gzip, per-chunk-summed) | 639 KB | GREEN |
| Largest chunk (raw) | 228 KB (framework/vendor) | GREEN (< 350 KB gate) |
| Chunks/routes > 500 KB | 0 | GREEN |
| Chunks/routes > 350 KB (CI gate) | 0 | GREEN |

No route or chunk exceeds the 500KB or 300KB thresholds — the top 5 chunks (228/192/112/108/92 KB raw) are all framework/vendor bundles, unchanged in composition from prior cycles.

## Bundle Analysis
- Total First Load JS: **1,999 KB raw / 639 KB gzipped, 73 chunks** — measured by summing each chunk's *individually* gzipped size (the correct model: browsers fetch chunks separately, so concatenate-then-gzip understates real transfer size — see the 2026-08-06 cycle's self-caught methodology note in shared context).
- This is the first genuinely fresh measurement in several cycles: 78 files changed under `apps/web/{app,components,lib}` since the last-measured commit `553652d3` (i18n locale-hydration fixes, campaign lease hardening, `BadgeSvg.tsx`/`badge-svg-cache.ts` changes for the fresh-badge-headline API work in #1062). Despite that real delta, raw/gzip totals landed within ~6 KB of the 2026-07-23/07-30/08-06 baseline (1,993–1,996 KB raw / 638 KB gzip) — no meaningful bundle growth.
- Largest chunks: 228 KB, 192 KB, 112 KB, 108 KB, 92 KB (all raw, all framework/vendor) — composition unchanged from prior cycles.
- Unused exports: **none** — `pnpm exec knip` and `pnpm exec knip --dependencies`, run from the repo root (matching CI's actual invocation), both exit 0 with zero findings.

## Client/Server Boundary
- `"use client"` directives (non-test): **109** — down 1 from the 2026-08-06 cycle's 110.
- Key public pages confirmed as server components (no `"use client"` in their leading imports): `/[locale]` (landing), `/[locale]/about`, `/u/[handle]` (share page), `/[locale]/archetypes/[type]`.
- 16 `next/dynamic`/`await import()` code-split points found (up from 11 in 2026-08-06 — consistent with new code landing, not a regression).
- No heavy render libraries leaked into client bundles: grepped for `@resvg/resvg-js` and `sharp` imports inside components/app files carrying `"use client"` — zero matches. These stay server-only (`lib/render/svg-to-png.ts`).
- No "use client" directives found that should obviously be pushed deeper this cycle — none flagged.

## Caching & Headers
- Badge route (`/u/[handle]/badge.svg`): `maxDuration=35`. Success responses: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`. Error responses: `s-maxage=300, stale-while-revalidate=600`. `Server-Timing` header present on every response (#974), unchanged from prior cycles.
- No other API caching changes observed this cycle.

## Fonts & CLS
- `next/font/google` used in `app/layout.tsx` for both `JetBrains_Mono` and `Plus_Jakarta_Sans` — zero external font `<link>` requests found (no `fonts.googleapis.com` references).
- `prefers-reduced-motion` support confirmed present in `styles/globals.css`.
- No unsized above-the-fold images found in the sampled surfaces (badge/OG images, embed toolbar) — consistent with prior cycles' explicit 1200×630 dimensioning.

## Recommendations
None this cycle — all budgets green, no regressions despite real app-code churn since the last measurement. Continue using the per-chunk-gzip-sum methodology (not concatenate-then-gzip) for all future bundle measurements to avoid re-triggering the known measurement trap documented in the 2026-08-06 cycle.

---

SHARED_CONTEXT_START
## Performance Agent — 2026-08-13
- **Status**: GREEN
- Total First Load JS: 1,999 KB raw / 639 KB gzip, 73 chunks
- Routes >500KB: 0
- Unused exports: 0

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths surfaced. 78 files changed since the last-measured commit (`553652d3`→`0482da44`) touch `BadgeSvg.tsx`/`badge-svg-cache.ts` (fresh-badge-headline work, #1062) and i18n locale-hydration fixes — worth a coverage spot-check on `badge-svg-cache.ts` if not already covered, since it's a cache-key-shape change adjacent to the badge latency SLO path.
- [Security]: No performance issues with security implications. Badge cache headers and `Server-Timing` unchanged; render-lib client-bundle isolation (resvg/sharp) re-confirmed absent from client bundles.
- [QA]: No CLS regressions. Fonts via `next/font` with 0 external requests; `prefers-reduced-motion` present. No unsized above-the-fold images found.
- [Cost Analyst]: Bundle re-confirmed flat at **1,999 KB raw / 639 KB gzip / 73 chunks** — within ~6 KB of the 2026-07-23/07-30/08-06 baseline despite a genuine 78-file app-code delta since `553652d3`. This is the first non-zero-delta measurement in the recent cycle series; treat it as the new canonical reference point going forward rather than the earlier flat carries.
SHARED_CONTEXT_END
