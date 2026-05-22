# Performance Report
> Generated: 2026-05-21 | Health status: yellow

## Executive Summary
Build is clean (Next.js 16.2.6 Turbopack, 4.8s compile, 0 TypeScript errors). Bundle is flat at **2,200 KB raw / 564 KB gzipped** across 77 chunks — no chunk ≥500 KB and slight improvement vs the 2026-05-14 baseline (2,266 KB / 706 KB). Status stays YELLOW only because the sustained 4-week growth (+30.8%) over Apr 9 (1,682 KB) is unresolved as cause; `ANALYZE=true pnpm run build` still needs an interactive run.

## Build Output
Next.js 16.2.4/16.2.6 Turbopack no longer prints a First Load JS column. Sizes below are derived from `.next/static/chunks/*.js` on disk (raw). Routes are all dynamic (`ƒ`) except `/apple-icon`, `/icon`, `/robots.txt`, `/sitemap.xml` (static). 86 routes total / 4 static / 82 dynamic / 48 statically generated.

| Chunk | Raw KB | Status |
|-------|--------|--------|
| `00xsj9hzyv9eo.js` (framework) | 228 | OK |
| `11-0ok76n7vk1.js` | 184 | OK |
| `13p4f94ru46~-.js` | 156 | OK |
| `03~yq9q893hmn.js` | 112 | OK |
| `0c386me6rt_tn.js` | 108 | OK |
| `0q9a99bssf4jo.js` | 68 | OK |
| `0fre4xy_hvbfo.js` | 60 | OK |
| All remaining 70 chunks | ≤56 each | OK |

**No chunk exceeds 500 KB (RED) or 300 KB (YELLOW).** Largest is 228 KB.

## Bundle Analysis
- **Total raw**: 2,200 KB across 77 chunks (was 2,266 KB / 78 chunks on 2026-05-14 — flat/slightly down)
- **Total gzipped**: ~564 KB (was 706 KB on 2026-05-14 — improvement, likely due to chunk consolidation)
- **Largest chunks**: 228 / 184 / 156 / 112 / 108 KB — all vendor/framework
- **Unused exports (knip --production)**: 1 finding — `server-only` flagged as unused dependency. **False positive**: it IS imported as `import "server-only"` in `apps/web/lib/db/supabase.ts:8` (side-effect-only import that knip's production tracer misses). Do not remove.

## Client/Server Boundary
- **113 `"use client"` files** in `apps/web/` (+2 vs 2026-05-14). Spot-audited recent additions — all appropriate (interactive UI, hooks, error boundaries). No misplaced directives pulling server code into client bundles.
- Heavy modules continue to be loaded via `next/dynamic` (PostHog, GlobalCommandBar, admin sub-dashboards, Studio effects).

## Caching & Headers
**Badge route `/u/[handle]/badge.svg`** (`apps/web/app/u/[handle]/badge.svg/route.ts`):
- `maxDuration = 35` (line 29) — 5th cycle hold, prevents Vercel cold-path kills against the 30s in-flight timeout.
- Success: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` (6h CDN + 24h SWR) ✓
- Error fallback: `s-maxage=300, stale-while-revalidate=600` ✓
- `Content-Security-Policy: frame-ancestors *` + `X-Frame-Options: ALLOWALL` to allow README embedding ✓

**Feature-flags ISR** (`lib/feature-flags.ts:84-94`): `unstable_cache(revalidate=300)` active — 13 pages CDN-eligible. ISR regression from 2026-04-30 remains resolved.

**Font loading**: `next/font/google` only, `display: "swap"`, Latin subset. Both `JetBrains_Mono` and `Plus_Jakarta_Sans` self-hosted via Next. No external font requests blocking render.

**CLS risks**: none observed. Badge `<img>` fallbacks carry explicit 1200×630 dims. `<Image>` usages all have explicit dimensions. `LiteYouTubeEmbed` is wrapped in `aspect-video`.

## Recommendations
**P2 (carry, 4th cycle)** — Bundle growth root-cause: sustained +30.8% over Apr 9 baseline is flat for 6 cycles but still unidentified. Run `ANALYZE=true pnpm run build` interactively (opens browser windows non-headlessly) and capture the treemap so we know whether the growth is vendor, feature, or i18n-driven. No user-visible regression yet — informational monitor only.

**P3 (new, monitor)** — Knip `server-only` false positive: knip's `--production` mode doesn't trace side-effect-only imports. If a future report tries to "clean up unused deps," verify `apps/web/lib/db/supabase.ts:8` before removing.

**No P1 issues.** Build is healthy, no route or chunk crosses size thresholds, badge route headers correct, ISR resolved, fonts and CLS safe.

---

<!-- ENTRY:START agent=performance timestamp=2026-05-21T09:00:00Z -->
## Performance Agent — 2026-05-21
- **Status**: YELLOW
- Build: Next.js 16.2.6 (Turbopack), 4.8s compile, 7.8s typecheck, 0 errors. 86 routes (4 static, 82 dynamic, 48 SSG).
- Total raw JS: **2,200 KB / 77 chunks** (vs 2,266 KB / 78 chunks on 2026-05-14) — **flat / slightly improved**. Gzipped ~564 KB (vs 706 KB) — chunk consolidation likely accounts for gzip drop.
- Largest chunks: 228 / 184 / 156 / 112 / 108 KB — all vendor/framework. **No chunk ≥500 KB.**
- Knip `--production`: 1 finding — `server-only` flagged unused. **False positive** (used at `apps/web/lib/db/supabase.ts:8` as side-effect import). No real unused production exports.
- `"use client"` files: 113 (+2 vs 2026-05-14). All spot-checked appropriate.
- Badge route: `maxDuration=35` (line 29, 5th hold), `s-maxage=21600` success / `s-maxage=300` error. Headers correct.
- ISR via `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active — 13 pages CDN-eligible.
- Fonts: `next/font/google` (JetBrains_Mono + Plus_Jakarta_Sans), `display: "swap"`, Latin subset. No external font requests.
- CLS: none — all images have explicit dimensions; badge fallback 1200×630.
- **P2 carry (cycle 4)**: Bundle growth source unidentified. `ANALYZE=true pnpm run build` still needs interactive run to localize.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths. Badge cold-path (`maxDuration=35`) still has no specific test — low priority.
- [Security]: No performance issues with security implications. Fail-open rate limiter intact, fetch timeouts 100%, badge cache headers unchanged. Knip `server-only` false positive does NOT mean the `server-only` boundary is broken — verified at `lib/db/supabase.ts:8`.
- [QA]: No CLS regressions, ISR caching active, fonts self-hosted with `display: swap`. No new UX performance concerns.
- [Cost Analyst]: Bundle flat 7/7 cycles now — sustained good signal for cold-start memory. Gzipped size dropped ~140 KB vs May 14 — may indicate Turbopack chunk consolidation in Next.js 16.2.6. 4-week +30.8% raw trend stable but unresolved; `ANALYZE=true pnpm run build` still needed interactively.
<!-- ENTRY:END -->
