# Performance Report
> Generated: 2026-05-14 | Health status: yellow

## Executive Summary
Build is clean and fast (4.0s compile, 8.0s typecheck, 0 errors, 86 routes). Total client JS holds flat at **2,266 KB raw** across 78 chunks with no chunk ≥500 KB — bundle growth from the prior 4-week +34.7% trend has stabilized this cycle. Two carry items remain: bundle-size investigation (informational) and an unanalyzed source for the cumulative growth. Badge route caching, `maxDuration`, fonts, and CLS are all healthy.

## Build Output
Turbopack does not emit a per-route First Load JS table; sizes below are top chunk sizes (raw). Routes are 4 static, 82 dynamic across 86 endpoints.

| Chunk | Size (raw) | Status |
|-------|-----------|--------|
| 05qnm9t_53wk5.js | 320 KB | OK (<500 KB) |
| 0p9-7_b0ehkp.js | 228 KB | OK |
| 0vtr_ue7_86de.js | 176 KB | OK |
| 0vog34w1vu2kz.js | 156 KB | OK |
| 03~yq9q893hmn.js | 112 KB | OK |
| 1014w9-9g4z3.js | 100 KB | OK |
| 0jvpka-gywf2v.js | 68 KB | OK |
| (72 more chunks) | ≤60 KB each | OK |

No route or chunk exceeds the 500 KB First Load JS threshold.

## Bundle Analysis
- Total client JS: **2,266 KB raw** (2,320,035 bytes) across **78 chunks**
- Largest chunks: 320 / 228 / 176 / 156 / 112 / 100 KB — all vendor/framework
- Delta vs 2026-05-07: **flat** (was 2,266 KB / 79 chunks). Sustained +34.7% over 4 weeks remains the underlying carry concern.
- Knip `--production`: ran clean (no output) — no unused production exports flagged this cycle.

## Client/Server Boundary
- **111 `"use client"` files** across `app/`, `components/`, `lib/` (excluding tests) — up from 109 last cycle.
- Spot audit: directives sit on interactive UI, hooks, experiments (Canvas/WebGL), error boundaries. No misplaced directives detected. Key public surfaces (root layout, archetype pages, share page, about pages) remain server components.
- Heavy modules (PostHog, GlobalCommandBar, ShortcutCheatSheet, Studio effects, admin sub-dashboards) lazy-loaded via `next/dynamic`.

## Caching & Headers
- Badge SVG success: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` (6h s-maxage, 24h SWR) — correct per CLAUDE.md.
- Badge SVG error: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` — bounded error caching.
- `export const maxDuration = 35` confirmed at `app/u/[handle]/badge.svg/route.ts:29` — prior P2 remains closed (4th confirmation cycle).
- ISR caching via `unstable_cache(revalidate=300s)` for feature flags at `lib/feature-flags.ts:84-94` confirmed still active; archetype/about pages remain CDN-eligible.

## Fonts & CLS
- `next/font/google` used for `JetBrains_Mono` + `Plus_Jakarta_Sans` in `app/layout.tsx:2`. No external font requests, `display: swap`.
- CLS risks: **none** — all `<Image>` have explicit dimensions; badge `<img>` fallback uses 1200×630; embeds inside `aspect-video` containers.
- `prefers-reduced-motion` honored in `globals.css` and `StudioClient`.

## Recommendations
1. **(Carry, informational)** Bundle size has held flat this cycle at 2,266 KB but is still +34.7% over the 4-week window. Next opportunity to run `ANALYZE=true pnpm run build` interactively should be taken to identify the package(s) responsible for the cumulative growth. No action required while no chunk approaches 500 KB.
2. **(Watch)** `"use client"` count crept from 109 → 111. Confirm new client components in any forthcoming review are interactive surfaces, not server-cappable pages.
3. No P1/P2 performance issues this cycle. Badge `maxDuration`, ISR caching, fonts, CLS — all green.

<!-- ENTRY:START agent=performance timestamp=2026-05-14T09:00:00Z -->
## Performance Agent — 2026-05-14
- **Status**: YELLOW
- Total First Load JS: **2,266 KB raw** (2,320,035 bytes) across 78 chunks. **Flat vs 2026-05-07** (was 2,266 KB / 79 chunks). Sustained +34.7% over 4 weeks remains the carry.
- Routes >500 KB: **0**. Largest chunks 320 / 228 / 176 / 156 / 112 / 100 KB — all vendor/framework.
- Build: Next.js 16.2.4 (Turbopack), compile 4.0s, typecheck 8.0s, 0 errors. 86 routes (4 static, 82 dynamic).
- Knip `--production`: clean (no findings).
- `"use client"` files: 111 (+2 vs prior cycle). All appropriate on spot audit.
- Badge route: `s-maxage=21600` success / `s-maxage=300` error confirmed; `maxDuration=35` confirmed at `app/u/[handle]/badge.svg/route.ts:29` (4th cycle hold).
- ISR caching of `dbGetFeatureFlag` via `unstable_cache(revalidate=300s)` at `lib/feature-flags.ts:84-94` still active — 13 pages CDN-eligible.
- Fonts: `next/font/google` only; `display: swap`. CLS risks: none. `prefers-reduced-motion`: supported.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths. Badge cold-path (`maxDuration` boundary) has no specific test — low priority.
- [Security]: No performance issues with security implications. Fail-open rate limiter intact, fetch timeouts 100%, badge caching unchanged.
- [QA]: No CLS regressions, ISR caching active — archetype/about pages serve from CDN. No new UX performance concerns.
<!-- ENTRY:END -->
