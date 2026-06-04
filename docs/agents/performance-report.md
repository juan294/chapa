# Performance Report
> Generated: 2026-06-04 | Health status: **green**

## Executive Summary
Bundle is flat and healthy at **1,943 KB raw / 620 KB gzipped** across 77 chunks — no chunk exceeds 500 KB, knip reports zero unused exports, and all caching/font/CLS characteristics are optimal. HEAD is pinned at `2d7eb73c` (no code change since the 2026-05-28 cycle), so this is a confirmatory clean cycle.

## Build Output
Next.js 16.2.6 (Turbopack) compiled in 5.0s, TypeScript in 6.9s, 0 errors. 87 routes (5 static, 82 dynamic), 48 static pages generated. **Turbopack omits per-route First Load JS from the build table** — per-route sizing requires `ANALYZE=true pnpm run build` interactively. Sizing below is derived directly from `.next/static/chunks`.

| Route / Asset | Size (First Load JS) | Status |
|---------------|---------------------|--------|
| Total client JS (all routes) | 1,943 KB raw / 620 KB gzipped | GREEN (flat vs 05-28) |
| Largest shared chunk | 227.1 KB raw / 70.9 KB gz | GREEN (<300 KB) |
| 2nd largest chunk | 183.2 KB raw / 59.7 KB gz | GREEN |
| 3rd largest chunk | 153.3 KB raw / 51.2 KB gz | GREEN |
| 4th largest chunk | 110.0 KB raw / 38.6 KB gz | GREEN |
| 5th largest chunk | 107.2 KB raw / 28.5 KB gz | GREEN |
| All remaining 72 chunks | ≤ 64.3 KB raw each | GREEN |

No route or chunk exceeds the 500 KB threshold (none even exceeds 300 KB).

## Bundle Analysis
- **Total First Load JS**: 1,943.29 KB raw / 620.17 KB gzipped (77 chunks)
- **Largest chunks** (raw): 227.1 KB, 183.2 KB, 153.3 KB, 110.0 KB, 107.2 KB — all framework/vendor, none app-specific oversized
- **Trend**: Flat vs 2026-05-28 (1,943.3 KB raw / 620.2 KB gzipped, 77 chunks). The earlier 4-week +34.7% growth trend was reversed on 05-28 (−14% vs 05-14) via Turbopack chunk consolidation in Next 16.2.6; that reduction holds. M-bundle monitor stays **closed**.
- **Unused exports**: **none** — `knip --production` returns 0 findings (exit 0, empty output). The prior `server-only` false positive remains suppressed.

## Client/Server Boundary
- 112 non-test `"use client"` files (anchored grep). All appropriate on spot-audit — interactive UI, error boundaries, experiments, hooks. The delta vs the 92 reported on 05-28 is grep-methodology only; HEAD is unchanged at `2d7eb73c`, so no actual directives were added.
- Key public pages confirmed **server components**: `/` (`app/page.tsx`), `/about`, `/u/[handle]`, `/archetypes/builder` — all render server-side, keeping server code out of client bundles.
- No `"use client"` pulled too high in the tree.

## Caching & Headers
- **Badge route** (`app/u/[handle]/badge.svg/route.ts`):
  - `export const maxDuration = 35` (line 29) — 6th cycle hold; exceeds the 30s `INFLIGHT_TIMEOUT_MS` so cold-path renders complete on Vercel.
  - Success: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` (6h fresh / 24h stale) — matches spec.
  - Error: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` (5m fresh / 10m stale) — short cache prevents pinning a transient failure.
  - In-flight dedup + Redis lock prevent thundering-herd on cold badges.
- **Feature-flags**: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active — archetype/about pages remain CDN-eligible (ISR).
- **/api/health**: GitHub probe cached 60s via `unstable_cache` — 0 uncached external calls.

## Font Loading
- `next/font/google` for both JetBrains Mono and Plus Jakarta Sans (`app/layout.tsx:2`), both `display: "swap"` (lines 17, 24). **No external `fonts.googleapis`/`fonts.gstatic` `<link>` tags** — fonts self-hosted and non-render-blocking.

## CLS Risks
- **None**. Avatars/user images use `next/image` (9 usages) with explicit dimensions. All raw `<img>` matches are in test files or escaped display strings (`SharePageOwnerContent.tsx:180` renders the literal text `<img ` as an embed-snippet example, not a real element).
- `prefers-reduced-motion: reduce` honored (`globals.css:381, 472`).

## Recommendations
1. **None blocking** — performance posture is GREEN across every dimension this cycle.
2. **(Informational, carry)** `ANALYZE=true pnpm run build` for per-package attribution remains optional only; bundle is flat and well under threshold, so this is not urgent. Per-route First Load JS is no longer printed by Turbopack — the `bundle-size.yml` CI workflow (gzipped chunk totals per push) is the standing regression guard.
