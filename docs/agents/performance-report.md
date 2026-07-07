# Performance Report
> Generated: 2026-07-02 | Health status: green

## Executive Summary
Bundle size is flat (2,079 KB raw / 659 KB gzipped, +0.2% vs the 2026-06-25 cycle) despite ~19 intervening commits (#935-#962). Both P3s carried from the last cycle — the `LiteYouTubeEmbed` thumbnail missing explicit dimensions and the `/api/challenge` route missing from CLAUDE.md — were resolved in the 2026-07-01 triage cycle. No route exceeds 500KB, no unused production exports, no render-blocking resources found.

## Build Output
Turbopack does not print a per-route First Load JS table (route list shows only static `○` vs dynamic `ƒ` markers, no size column). Sizes below are measured directly from `.next/static/chunks`.

| Route | Size (First Load JS) | Status |
|-------|---------------------|--------|
| All routes | Not itemized by Turbopack | — |
| Largest chunk (`0qmgkw5s78uqn.js`, framework/vendor) | 227.1 KB | GREEN |
| 2nd largest chunk (`2cz6l19i7nua_.js`) | 190.3 KB | GREEN |
| 3rd largest chunk (`0cz1d0mv5g_q7.js`) | 110.0 KB | GREEN |
| All other chunks | ≤108 KB each | GREEN |

No individual chunk exceeds 300KB, let alone the 500KB flag threshold or the CI bundle-size gate (350 KB/chunk).

## Bundle Analysis
- Total First Load JS: **2,079 KB raw / 659 KB gzipped** across 76 top-level chunks
- Vs 2026-06-25: +5 KB raw (+0.2%), +2 KB gzipped, -1 chunk — within measurement noise
- Largest chunks: 227.1 / 190.3 / 110.0 / 107.2 / 88.9 KB raw (all framework/vendor)
- Unused exports (knip `--production`): **0 real findings** — only `vitest.setup.ts` flagged, a known false positive (test infrastructure, not shipped in production bundle)

## Client/Server Boundary
- `"use client"` directives (non-test, anchored): **117** — up from 113 on 2026-06-25. Growth is spread across the #935-#962 fix batch (i18n aria-label localization, InfoTooltip portal audit, studio-config backing store) — no single new large client component.
- Key public pages confirmed as server components: `/` (`app/page.tsx`), `/about`, `/u/[handle]`, and all archetype pages (`app/archetypes/*/page.tsx`) — zero `"use client"` in any of them.
- 7 files use `next/dynamic` for code-splitting: `app/studio/BadgePreviewCard.tsx`, `app/admin/AdminDashboardClient.tsx`, `components/KeyboardShortcutsListener.tsx`, `components/ClientInstrumentation.tsx`, `components/ClientAnalytics.tsx`, `components/GlobalCommandBarLazy.tsx`, `components/SharePageOwnerContentLazy.tsx`.
- No action needed — client/server boundary is healthy, no server-only code leaking into client bundles detected.

## Caching & Headers
- Badge route (`app/u/[handle]/badge.svg/route.ts`): `maxDuration = 35`; success responses `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` (line 54); error responses `s-maxage=300, stale-while-revalidate=600` (line 245) — matches CLAUDE.md spec exactly.
- In-flight render dedup present: `inflightBadgeRenders` Map (line 50) prevents duplicate concurrent renders for the same cache key; documented in `docs/accepted-risks.md` per #946.
- 0 uncached external calls detected in the badge/API critical path (consistent with cost-analyst's 2026-07-01/07-02 findings).

## Fonts & CLS
- Fonts loaded via `next/font/google` (JetBrains Mono + Plus Jakarta Sans) — 0 external font requests, no render-blocking font loads.
- `prefers-reduced-motion` support present in `globals.css`.
- Badge fallback `<img>` has explicit `width={1200} height={630}` (`app/u/[handle]/page.tsx:248`).
- **Resolved this cycle**: `LiteYouTubeEmbed.tsx` thumbnail `<img>` now has explicit `width={480} height={270}` (`components/LiteYouTubeEmbed.tsx:48-49`) — this was a P3 carried from the 2026-06-25 report, fixed in the 2026-07-01 triage cycle.
- No other CLS risks identified.

## Recommendations
No blocking or high-priority action items this cycle. All items carried from the prior cycle are closed:
1. ~~`/api/challenge` route missing from CLAUDE.md~~ — **RESOLVED** (added in 2026-07-01 triage cycle).
2. ~~`LiteYouTubeEmbed` thumbnail missing explicit dimensions~~ — **RESOLVED** (fixed in 2026-07-01 triage cycle).

**Monitor only** (no action needed): if bundle size exceeds 2,300 KB raw in a future cycle, trigger an `ANALYZE=true` run per the cost-analyst's standing threshold.
