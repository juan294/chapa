# Performance Report
> Generated: 2026-06-11 | Health status: green

## Executive Summary
First confirmatory cycle on the new HEAD `5ef06c09` after dep bumps #850/#851 (next 16.2.6→16.2.9, posthog-js 1.376.6→1.384.0, react 19.2.7): total First Load JS is **1,949.3 KB raw / 622.6 KB gzipped (77 chunks)** — effectively flat vs the 2026-06-04 baseline (+6.0 KB raw / +2.4 KB gzip, +0.3%). Zero routes over 500 KB, knip clean, caching and font posture unchanged.

> **Operational note**: local `node_modules` was stale at the start of this run — `apps/web/package.json` declared `next ^16.2.9` but 16.2.6 was installed (no `pnpm install` after the Dependabot merges). The first build measured the wrong stack; ran `pnpm install` and rebuilt on 16.2.9 before sizing. All numbers below reflect the deployed stack.

## Build Output

Build: **Next.js 16.2.9 (Turbopack)** — compiled in 2.8s, TypeScript 6.6s, **0 errors**. 89 routes (4 static ○, 85 dynamic ƒ), 48 static pages generated.

Next 16 Turbopack omits per-route First Load JS from the build table, so per-route sizing is unavailable from build output; sizes below are byte-accurate measurements of `.next/static/chunks`.

| Route / Chunk | Size (First Load JS) | Status |
|-------|---------------------|--------|
| All 89 routes | shared chunk pool, largest chunk 227.1 KB | GREEN |
| Largest chunk `0qmgkw5s…` | 227.1 KB raw | GREEN |
| `1ln_wl_f…` | 189.2 KB raw | GREEN |
| `0006cyfs…` | 153.3 KB raw | GREEN |
| `0cz1d0mv…` | 110.0 KB raw | GREEN |
| `43e11u3p…` | 107.2 KB raw | GREEN |

**Routes >500 KB: 0. Chunks >300 KB: 0.** All top chunks are framework/vendor.

## Bundle Analysis
- Total First Load JS: **1,949.3 KB raw / 622.6 KB gzipped** across **77 chunks** (vs 1,943.3 / 620.2 / 77 on 2026-06-04 — +0.3%, attributable to next 16.2.9 + posthog-js 1.384.0)
- Largest chunks: 227.1 / 189.2 / 153.3 / 110.0 / 107.2 / 64.2 / 58.4 / 53.4 KB — all framework/vendor
- Unused exports: **none** — `npx knip --production` exits 0 with no findings (the `server-only` false positive remains suppressed)

## Client/Server Boundary
- `"use client"` files (non-test, anchored at line start): **105**. Spot audit clean — no server code pulled into client bundles.
- Key public pages confirmed server components: `/` (`app/page.tsx`), `/about`, `/u/[handle]`, archetype pages.
- Dynamic imports: `next/dynamic` in **7 files** — PostHog provider, command bar, admin sub-dashboards, Studio, experiments. Code-splitting posture unchanged.
- No unnecessary directives found that should move deeper this cycle.

## Caching & Headers
- Badge route (`app/u/[handle]/badge.svg/route.ts`): `maxDuration = 35` (line 29, 7th cycle hold). Success: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` (line 45). Error: `s-maxage=300, stale-while-revalidate=600` (line 205). In-flight dedup + Redis lock unchanged.
- Feature-flags ISR: `unstable_cache(revalidate=300)` active (`lib/feature-flags.ts`).
- `/api/health` GitHub probe cached 60s via `unstable_cache`.
- 0 uncached external calls (per cost-analyst 2026-06-11, confirmed).

## Fonts & CLS
- Fonts: `next/font/google` only (JetBrains Mono + Plus Jakarta Sans), `display: "swap"` in `app/layout.tsx:17,24`. **0 external font requests** (`fonts.googleapis`/`fonts.gstatic`/`@import url`: no matches).
- CLS risks: **none**. Badge fallback `<img>` on `/u/[handle]` has explicit `width={1200} height={630}` + `BadgeSkeleton` placeholder (`app/u/[handle]/page.tsx:231-238`). `LiteYouTubeEmbed` thumbnail fills a fixed-size container (`h-full w-full object-cover`). All other images use `next/image` with dimensions.
- `prefers-reduced-motion` respected (`motion-reduce:animate-none` on animated share-page elements).

## Recommendations
1. **None blocking.** Bundle flat through the Next 16.2.9 / posthog-js bumps — cost-analyst's request to confirm bundle totals post-bump is satisfied.
2. (Hygiene) Run `pnpm install` after Dependabot merges land on `develop` — local `node_modules` had drifted 3 patch versions behind the lockfile, which silently invalidates any local perf/build measurement. Consider this a standing check at the top of agent build runs.
3. (Carry, informational) Per-route First Load JS remains unavailable under Turbopack; `ANALYZE=true pnpm run build` interactive run remains optional, not urgent — chunk totals are flat and well under thresholds.
