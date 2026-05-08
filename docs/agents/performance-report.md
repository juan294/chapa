# Performance Report
> Generated: 2026-05-07 | Health status: yellow

## Executive Summary

Bundle size has grown to **2,266 KB raw / 706.5 KB gzipped** — a +389 KB (+20.7%) increase from the Apr 30 cycle and +584 KB (+34.7%) from the Apr 9 baseline, establishing a sustained upward trend. The `maxDuration` export on the badge SVG route remains absent (P2, 3rd cycle). No route or individual chunk exceeds the 500 KB threshold; all other indicators are green.

## Build Output

Next.js **16.2.4** (Turbopack) | Compile: 5.9s | TypeScript: 7.2s | Errors: 0

> Note: Turbopack does not emit per-route First Load JS sizes in the build console. The table below reflects individual chunk sizes from `.next/static/chunks/`. No chunk exceeded 500 KB.

| Chunk (top 10 by raw size) | Raw Size | Gzipped (est.) | Status |
|----------------------------|----------|----------------|--------|
| `05qnm9t_53wk5.js` | 320 KB | ~100 KB | GREEN |
| `0p9-7_b0ehkp..js` | 228 KB | ~71 KB | GREEN |
| `0vtr_ue7_86de.js` | 176 KB | ~55 KB | GREEN |
| `16r25uuav1ljj.js` | 156 KB | ~49 KB | GREEN |
| `03~yq9q893hmn.js` | 112 KB | ~35 KB | GREEN |
| `1014w9-9g4z3..js` | 100 KB | ~31 KB | GREEN |
| `0jvpka-gywf2v.js` | 68 KB | ~21 KB | GREEN |
| `17gpy2uarky_d.js` | 60 KB | ~19 KB | GREEN |
| `0w5isd9_6uorm.js` / `07eo395sdu_1z.js` | 52 KB ea. | ~16 KB ea. | GREEN |

Route breakdown: **86 total routes** — 4 static (○): `/apple-icon`, `/icon`, `/robots.txt`, `/sitemap.xml`. All 82 remaining routes are dynamic (ƒ), as expected for a user-data-driven app.

## Bundle Analysis

| Metric | May 7 | Apr 30 | Apr 9 | Trend |
|--------|-------|--------|-------|-------|
| Total raw JS | **2,266 KB** | 1,877 KB | 1,682 KB | ↑↑ RED |
| Total gzipped | **706.5 KB** | 598.1 KB | ~522 KB | ↑↑ YELLOW |
| Total chunks | 79 | 68 | 68 | +11 chunks |
| Chunks >500 KB | 0 | 0 | 0 | GREEN |

**Month-over-month growth: +584 KB raw (+34.7%)** — this is a three-cycle sustained trend, not a one-off spike. The +11 new chunks (79 vs 68) suggest new code paths are being split rather than this being a single large addition.

Cost analyst noted the posthog-js 1.372.3→1.372.6 bump removed ~28 protobufjs transitive deps (should consolidate), so the growth predates this week's commits and persists despite the dep reduction.

**Knip (`--production`) — new findings this cycle:**

| Type | Count | Examples |
|------|-------|---------|
| Unused exported functions | ~12 | `_parseNumeric`, `_parseSubtitle` (insights/parser.ts); `materializeImpactState` (profile/materialize-profile.ts); `fetchAvatarBase64` (render/avatar.ts); `buildPayload`, `computeHash` (verification/hmac.ts) |
| Unused exported types | 23 | `SessionUser`, `CampaignType`, `CampaignStatus`, `KeyCombo`, `WeeklyBucket`, etc. |

Prior cycles reported 8 confirmed false positives. The current knip run reports a larger set — some of these may be consumed via dynamic/barrel imports. Recommend verifying before removing (especially `fetchAvatarBase64`, `computeHash`, `buildPayload` which are used in server-only paths knip may not trace).

## Client/Server Boundary

- **109 non-test files** carry `"use client"` (up from 94 in Apr 30, +15). All examined directives are appropriate:
  - Error boundaries: `error.tsx` files throughout
  - Interactive UI: Studio, verify form, generating progress
  - Experiments (Canvas/WebGL): all 13 experiment pages
  - Hooks: all appropriate leaf components
- Key public pages (`/`, `/about`, `/u/[handle]`) remain **server components** — correct.
- The +15 increase aligns with i18n and new experiment pages added since Apr 30.
- **LOW (carried)**: Landing page imports `GlobalCommandBar` synchronously via `LandingTerminal` (`app/page.tsx:12`). Admin + share pages use `GlobalCommandBarLazy`. Inconsistency — low impact but worth documenting.

## Caching & Headers

### ISR Regression — RESOLVED ✓
The Apr 30 blocker (`isStudioEnabled()` calling Upstash with `no-store` from root layout) is **fixed**. `lib/feature-flags.ts:84-94` now wraps `dbGetFeatureFlag` in `unstable_cache()` (revalidate=300s, tag `feature-flags`). The 13 pages that were forced dynamic are now eligible for CDN caching again.

### Badge SVG Route — `maxDuration` MISSING (P2, 3rd cycle)
`app/u/[handle]/badge.svg/route.ts` has **no `export const maxDuration`**. Vercel Pro defaults to 10s; the internal `INFLIGHT_TIMEOUT_MS=30_000` (`lib/github/client.ts`) and `BADGE_RENDER_LOCK_TTL_SECONDS=30` exceed this. Cold-path badge fetches (new handle, cache miss) will be silently killed by Vercel at 10s before the internal timeout fires.

Fix: add one line to `app/u/[handle]/badge.svg/route.ts`:
```ts
export const maxDuration = 35;
```

Cache headers are otherwise correct:
| Scenario | Cache-Control |
|----------|--------------|
| Success | `public, s-maxage=21600, stale-while-revalidate=86400` (6h CDN, 24h stale) |
| Error | `public, s-maxage=300, stale-while-revalidate=600` (5m CDN, 10m stale) |

### Dynamic Imports (Green)
All heavy client-side modules use `next/dynamic`: PostHog analytics, GlobalCommandBar (admin/share pages), ShortcutCheatSheet, admin sub-dashboards (AgentsDashboard, EngagementDashboard, CampaignsDashboard), Studio background effects (Aurora, Particles, GradientBorder, Holographic).

### Font Loading (Green)
`JetBrains_Mono` and `Plus_Jakarta_Sans` loaded via `next/font/google` (`app/layout.tsx:2`). No external font requests, no render-blocking.

### CLS Risks (Green)
No CLS risks detected. All `<Image>` components have explicit dimensions. No unsized above-the-fold dynamic content. `prefers-reduced-motion` honored in `globals.css:381,472` and `StudioClient.tsx:31`.

## Recommendations

| Priority | Item | Action |
|----------|------|--------|
| P2 | `maxDuration` missing on badge SVG route | Add `export const maxDuration = 35;` to `app/u/[handle]/badge.svg/route.ts` |
| P2 | Bundle growth trend (+34.7% over 4 weeks) | Run `ANALYZE=true pnpm run build` to identify the largest contributing packages; check if any new server lib was accidentally imported client-side |
| P3 | Knip reports ~35 unused exports/types | Verify each is truly unused (esp. `fetchAvatarBase64`, `computeHash`, `buildPayload`) — remove confirmed dead code to reduce surface area |
| P3 (LOW) | Landing page `GlobalCommandBar` sync import | Standardize to `GlobalCommandBarLazy` or document the intentional exception |
