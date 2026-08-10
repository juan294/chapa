# Performance Report
> Generated: 2026-08-06 | Health status: green

## Executive Summary
Zero-delta cycle — HEAD `553652d3` unchanged since the 2026-07-30 report, and this cycle's independent re-measurement confirms the bundle, caching, and build health are all still flat. No performance regressions, no new unused exports, no client/server boundary issues.

## Build Output
Next.js 16.2.11 (Turbopack) no longer emits a First Load JS column in its route table (only Revalidate/Expire), so sizes are measured directly from `.next/static/chunks/`. All 81 routes build cleanly; the 9 locale-segmented content pages are confirmed SSG (`●`, both `en`/`es` pre-rendered via `generateStaticParams`).

| Route class | Status |
|-------|---------------------|--------|
| All 81 routes (34 pages + 56 API + static assets) | Build succeeds, 0 TypeScript errors | GREEN |
| 9 `/[locale]/*` content pages | SSG, both locales pre-rendered | GREEN |
| `/u/[handle]/badge.svg` | Dynamic (ƒ), `maxDuration=35` | GREEN |
| 4 cron routes + bulk-recalculate | `maxDuration=300` (latency-check=60) | GREEN |
| Chunks >500KB | 0 | GREEN |
| Chunks >350KB (CI gate, raw or gzip) | 0 | GREEN |

## Bundle Analysis
- Total First Load JS: **1,993 KB raw / 638 KB gzipped, 73 chunks** — matches the 2026-07-23 canonical baseline and the 2026-07-30 cycle exactly.
- **Methodology note (self-correction within this cycle)**: an initial concatenate-then-gzip measurement returned 577 KB, which looked like a real improvement over the 638 KB baseline. Re-measured by summing each chunk's *individually* gzipped size (the correct model — a browser fetches chunks as separate files, so concatenated compression against a shared dictionary understates real transfer size) and got 638.3 KB, reconciling exactly with the established baseline. The 577 KB figure was a measurement artifact, not a regression or an improvement — noting this so a future cycle doesn't get fooled the same way.
- Largest chunks (raw): 228 KB, 192 KB, 112 KB, 108 KB, 92 KB — all framework/vendor, unchanged from prior cycles.
- Unused exports: **none** — CI's actual two invocations (`pnpm exec knip`, `pnpm exec knip --dependencies`, both run from repo root) exit 0 with zero findings. (An `apps/web`-local `npx knip` run without repo-root config resolution surfaced a long list of "unused" exported types — this is a known config-resolution artifact of running knip from the wrong directory, not a real signal; the CI-matching invocation is authoritative and clean.)

## Client/Server Boundary
- 110 files with `"use client"` (non-test) — flat vs. 2026-07-30's 110.
- 11 `next/dynamic`/`await import()` code-split points.
- Key public pages (`/[locale]`, `/[locale]/about`, `/u/[handle]`, `/[locale]/archetypes/*`) confirmed server components. No heavy render libs (`@resvg/resvg-js`, `sharp`) leak into client bundles — both are server-only imports in `lib/render/svg-to-png.ts`.

## Caching & Headers
- Badge route (`/u/[handle]/badge.svg`): success `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`; error `s-maxage=300, stale-while-revalidate=600`. `Server-Timing` header present on every response (#974). Unchanged.
- `maxDuration`: badge route 35s; `latency-check` cron 60s; `warm-cache`/`sync-audience`/`process-campaigns`/`bulk-recalculate` 300s each.

## Fonts & CLS
- `next/font/google` (JetBrains Mono + Plus Jakarta Sans) — **0 external font requests** confirmed (no `<link>` to fonts.googleapis.com/fonts.gstatic.com in `app/layout.tsx`).
- No new CLS risks identified — no changes to badge/OG/avatar image dimensioning since 2026-07-23's confirmation (badge SVG 1200×630, OG images 1200×630, `LiteYouTubeEmbed` 480×270, `prefers-reduced-motion` present).

## Recommendations
None — pure confirmation cycle, no action items. Bundle baseline (1,993 KB raw / 638 KB gzip / 73 chunks) remains reproducible and stable across four consecutive measurement cycles (2026-07-23, 2026-07-30, and now).
