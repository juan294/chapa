# Performance Report
> Generated: 2026-08-27 | Health status: green

## Executive Summary
Bundle and build health are stable — 0 chunks over the 350 KB CI budget (largest 227 KB raw), 0 unused exports/files per `knip`, and no client/server boundary or CLS issues found. HEAD `e72a4e3a` (develop); this is a real re-measurement (not carried from a prior cycle).

## Build Output
`pnpm install --frozen-lockfile` was clean (lockfile up to date). `pnpm run build` compiled successfully in 12.1s, TypeScript checked in 23.0s, 0 errors/0 warnings, 81 routes (9 locale-segmented content pages statically prerendered for both `en`/`es` via `generateStaticParams`, rest server-rendered on demand).

Turbopack's build output for this Next.js version does not emit a per-route "First Load JS" table (unlike the older webpack output format), so route-level sizes are approximated via the per-chunk-file budget check below, which is also what CI actually enforces (`scripts/check-bundle-size.sh`, run in `ci.yml` and `bundle-size.yml`).

| Check | Result | Status |
|-------|--------|--------|
| Chunks >350 KB (raw, CI gate) | 0 | GREEN |
| Largest chunk | 227 KB raw (`3esax2k9hq7dp.js`) | GREEN |
| Total JS chunks | 74 files | — |
| Total raw JS | 2.2 MB | — |
| Total gzip JS (per-file sum) | 666.0 KB | — |

No route or chunk exceeds 500 KB or even the tighter 350 KB CI budget.

## Bundle Analysis
- Total First Load JS (gzip, per-file sum — the correct methodology per prior-cycle methodology notes; concatenate-then-gzip understates real transfer size and must not be used): **666.0 KB**, 74 chunks.
- Total raw JS: **2.2 MB** across 74 chunks.
- Largest chunks (raw): 227 KB, 190 KB, 110 KB, 107 KB, 99 KB — all framework/vendor, composition unchanged from prior cycles.
- Unused exports: **0** — `pnpm exec knip` and `pnpm exec knip --dependencies` (both run from repo root, matching CI's actual invocation) exit clean with only 2 informational config hints (`knip.json` `ignoreDependencies` entries for `@upstash/redis`/`@supabase/supabase-js` that could be removed) — not unused-code findings.

## Client/Server Boundary
- 117 files carry `"use client"` (non-test) — up slightly from the 2026-08-13 baseline of 109, consistent with real feature growth (webmcp tool catalog, Studio judge demo mode, public read tools landed since).
- 11 `next/dynamic`/`await import()` code-split points present.
- 0 client-marked files import `@resvg/resvg-js` or `sharp` — the heavy SVG/PNG render libraries stay server-only.
- New route `app/webmcp-spike/` (added by recent `feat(webmcp)` commits) is a client component (`WebMcpSpikeClient.tsx`) behind a thin server `page.tsx` — standard shape, no boundary issue. Note: this route is not yet listed in CLAUDE.md's route table — flagging for Documentation Agent, not a performance concern.

## Caching & Headers
Badge route (`app/u/[handle]/badge.svg/route.ts`) cache headers confirmed present and correct:
- Success: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` (6h fresh, 24h stale — matches CLAUDE.md's documented caching rules).
- Cold-miss/background-continuation fallback: `s-maxage=60` (short-TTL, per #1086's materialize-deadline design).
- Error path: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.

`Server-Timing` instrumentation and the badge latency SLO budgets (800ms cache-hit / 3000ms cache-miss) were not independently re-measured this cycle (requires a live request against warm/cold cache, out of scope for a static build audit) — unchanged from prior GREEN confirmations.

## Fonts & CLS
- `next/font/google` used in `app/layout.tsx` (JetBrains Mono + Plus Jakarta Sans) — **0 external font `<link>` requests found** in any production component.
- `prefers-reduced-motion` media query present in `globals.css` (2 occurrences).
- Both `<img>` tags initially flagged by a naive single-line grep (`LiteYouTubeEmbed.tsx`, `app/u/[handle]/page.tsx`'s SVG-render fallback) do carry explicit `width`/`height` attributes on the next lines — false positive from the grep pattern, not a real CLS risk. No images found without explicit dimensions.

## Recommendations
1. **P3 (Documentation, not Performance)** — Add `GET /webmcp-spike` to CLAUDE.md's route table; it's a new page shipped since the last documentation audit (2026-08-14) and isn't yet listed.
2. No performance action items this cycle — bundle, client/server boundary, caching, fonts, and CLS all check out clean.
