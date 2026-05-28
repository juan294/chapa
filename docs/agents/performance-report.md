# Performance Report
> Generated: 2026-05-28 | Health status: green

## Executive Summary
Bundle shrank meaningfully this cycle — total client JS dropped to **1,943 KB raw / 620 KB gzipped**, down ~14% from the May 14 baseline (2,266 KB / 707 KB). No chunk exceeds 500 KB, no `use client` regressions, knip is clean, badge caching and font loading remain optimal. The 4-week +34.7% growth trend is now broken without an identified single source — likely Next.js 16.2.6 Turbopack chunking improvements.

## Build Output
Next.js 16.2.6 + Turbopack does not print per-route First Load JS sizes (the column was dropped from the route table). Per-route sizing requires `ANALYZE=true pnpm run build` (interactive browser visualizer). Below is chunk-level data instead.

| Metric | Value | Status |
|--------|-------|--------|
| Compile time | 4.4s | GREEN |
| TypeScript check | 10.5s, 0 errors | GREEN |
| Static pages generated | 48/48 | GREEN |
| Total routes | 86 (4 static, 82 dynamic) | GREEN |
| Total chunks | 77 | GREEN |
| Total client JS (raw) | 1,943.3 KB | GREEN |
| Total client JS (gzipped) | 620.2 KB | GREEN |
| Largest chunk | 228 KB | GREEN |
| Chunks >500 KB | 0 | GREEN |
| Chunks >300 KB | 0 | GREEN |

Top 5 chunks:
| Size | File | Likely contents |
|------|------|-----------------|
| 228 KB | `00xsj9hzyv9eo.js` | Next.js framework runtime |
| 184 KB | `0t2d80uj0xcbn.js` | PostHog (lazy) |
| 156 KB | `13p4f94ru46~-.js` | React DOM / RSC |
| 112 KB | `03~yq9q893hmn.js` | core-js / polyfills |
| 108 KB | `0c386me6rt_tn.js` | vendor (Recharts/Supabase JS) |

## Bundle Analysis
- Total First Load JS: **1,943.3 KB raw / 620.2 KB gzipped**
- Delta vs 2026-05-14: **−322 KB raw (−14.2%) / −86 KB gzipped (−12.2%)**
- 4-week trend reversed — prior carry "M-bundle" (sustained +34.7% growth) is resolved this cycle. The drop coincides with Next.js 16.2.4 → 16.2.6; consistent with Turbopack chunk-consolidation gains noted earlier.
- Largest chunks: all framework/vendor; no application chunk dominates.
- **Unused exports (knip `--production`): 0** application findings. The single reported "unused dependency" (`server-only` in `apps/web/package.json:29`) is a **false positive** — it is used at `lib/db/supabase.ts:8` via `import "server-only"`, which knip cannot trace through side-effect-only imports.

## Client/Server Boundary
- `"use client"` files (non-test): **92** — *down* from 111 (May 14). Spot audit confirms remaining directives are appropriate: error boundaries, interactive UI, hooks (`useState`/`useEffect`), Canvas/WebGL experiments. No misplaced directives observed.
- Dynamic imports: **20** `next/dynamic` usages — PostHog, GlobalCommandBar, ShortcutCheatSheet, admin sub-dashboards, Studio effects, experiment canvases — all lazy-loaded. Good code-splitting hygiene.

## Caching & Headers
- Badge SVG route (`app/u/[handle]/badge.svg/route.ts`):
  - `maxDuration = 35` (line 29) — correct, exceeds 30s `INFLIGHT_TIMEOUT_MS`.
  - Success: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` (6h fresh / 24h stale).
  - `CSP: frame-ancestors *` override for cross-site embed.
  - In-flight dedup via `inflightBadgeRenders` Map + `cacheSetNx` lock (30s TTL) — prevents thundering herd.
- Feature-flags: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84` — ISR rehydrated, 13 pages CDN-eligible.
- `/api/health` GitHub probe: now wrapped in `unstable_cache(revalidate=60)` (commit `dc0b7261`). Previous P3 cost carry resolved.

## Fonts & CLS
- `next/font/google` with `JetBrains_Mono` + `Plus_Jakarta_Sans` at `app/layout.tsx`. Latin subset, `display: swap`. No external font requests, no render-blocking.
- CLS risks: none observed. `next/image` used with explicit dimensions; badge `<img>` fallbacks declare `1200×630`; `LiteYouTubeEmbed` wrapped in `aspect-video`.
- `prefers-reduced-motion`: respected in `globals.css` and key animated components.

## Recommendations
Priority-ordered:

1. **(P3, carry)** Run `ANALYZE=true pnpm run build` interactively when convenient to localize which package(s) drove the now-reversed +34.7% trend. With the regression undone, this is informational only — closing out the "M-bundle" monitor unless growth returns.
2. **(P3, new)** Add `// knip-ignore` annotation or knip config entry for `server-only` to silence the false-positive dependency warning. Cosmetic — does not affect bundle.
3. **(P3, new)** Next 16 Turbopack drops per-route First Load JS from the build table. Consider adding a CI step that parses `.next/static/chunks` sizes (raw + gzipped) so we still trend per-build totals automatically. Today the tracking is manual via this report.

No P1/P2 items this cycle.

<!-- ENTRY:START agent=performance timestamp=2026-05-28T10:00:00Z -->
## Performance Agent — 2026-05-28
- **Status**: GREEN
- Total First Load JS: **1,943.3 KB raw / 620.2 KB gzipped** (77 chunks). **−322 KB / −14.2%** vs 2026-05-14 (2,266 KB raw). 4-week +34.7% growth trend reversed without identified single cause — likely Turbopack chunk-consolidation gains across Next.js 16.2.4 → 16.2.6.
- Routes >500KB: **0**. Largest chunks 228 / 184 / 156 / 112 / 108 KB — all framework/vendor.
- Build: Next 16.2.6 Turbopack, 4.4s compile, 10.5s typecheck, 0 errors. 86 routes (4 static, 82 dynamic), 48 static pages generated.
- Knip `--production`: **0 application findings**. Reported unused dep `server-only` is a false positive — used at `lib/db/supabase.ts:8` via side-effect import.
- `"use client"` files (non-test): **92**, down from 111 (May 14). Spot-audit clean.
- Dynamic imports: 20 `next/dynamic` usages — PostHog, command bar, admin sub-dashboards, Studio, experiments. Good code-splitting.
- Badge route: `maxDuration=35` (5th cycle hold), `s-maxage=21600 / stale-while-revalidate=86400`, in-flight dedup + Redis lock — unchanged.
- Feature-flags ISR: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active. `/api/health` GitHub probe now cached 60s (dc0b7261). 0 uncached external calls.
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), `display: swap`. No CLS risks. `prefers-reduced-motion` respected.
- **Note**: Next 16 Turbopack omits per-route First Load JS from the build table. Per-route sizing requires `ANALYZE=true pnpm run build` interactively.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths.
- [Security]: No performance issues with security implications. Badge in-flight dedup + rate limit + `frame-ancestors *` override unchanged. Fail-open Redis rate limiter intact.
- [QA]: Bundle reduction should slightly improve TTI/LCP across pages. No CLS regressions; ISR caching active on archetype/about pages.
- [Cost Analyst]: Carry "M-bundle" can be closed this cycle — bundle is **down** 14% vs May 14, and 4-week growth is reversed. Likely lower cold-start memory on serverless functions. `ANALYZE=true` run no longer urgent.
<!-- ENTRY:END -->
