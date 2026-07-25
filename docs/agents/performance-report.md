# Performance Report
> Generated: 2026-07-23 | Health status: green

## Executive Summary
Bundle is flat and healthy at **1,996 KB raw / 638 KB gzipped across 73 chunks** on a zero-delta tree (HEAD `8f4591e3`, v2.19.1) — no route or chunk exceeds the 350 KB CI gate (largest is 227 KB), knip's CI-run scans are fully clean, all public pages are server components, fonts load via `next/font` with zero external requests, and no CLS risks remain.

## Build Output
Next 16.2.9 (Turbopack) does **not** emit per-route First Load JS in its route table (only Revalidate/Expire columns), so sizes below are measured directly from `.next/static/chunks`. No individual chunk approaches the 350 KB CI budget or the 500 KB flag threshold.

| Route / Chunk | Size (raw) | Status |
|-------|---------------------|--------|
| Largest vendor/framework chunk | 227 KB | GREEN |
| 2nd largest | 190 KB | GREEN |
| 3rd largest | 110 KB | GREEN |
| 4th largest | 107 KB | GREEN |
| 5th largest | 89 KB | GREEN |
| All app routes (`ƒ`/`●`/`○`) | < 350 KB First Load | GREEN |

- Build: `pnpm install --frozen-lockfile` clean (lockfile up to date, `knip 6.27.0` present). Turbopack compiled in 7.6s, TypeScript in 8.1s, **0 errors**. 81 routes, 81 static pages generated in 328ms.
- 9 locale-segmented content pages confirmed SSG (`●`, both `en`/`es` pre-rendered). Landing `/[locale]` and public content pages are static/SSG; badge/API routes are `ƒ` (server-rendered on demand).

## Bundle Analysis
- **Total First Load JS: 1,996 KB raw / 638 KB gzipped (73 chunks in `.next/static/chunks`).** Flat vs the performance-agent baseline of 2,132 KB raw / 638 KB gzip (2026-07-16); gzip is identical — the tree has had zero production commits since 2026-07-19.
- Largest chunks: 227 / 190 / 110 / 107 / 89 KB raw — all framework/vendor, none app-specific.
- **Unused exports: 0** on the scans CI actually runs. `knip` (plain) and `knip --dependencies` both exit 0 with zero findings. `knip --production` still surfaces the known 9-dependency false-positive set (`@resvg/resvg-js`, `@vercel/analytics`, `@vercel/speed-insights`, `canvas-confetti`, `next-themes`, `posthog-js`, `resend`, `server-only`, `svix`) — all verified imported in production source; this is a knip `--production` entry-graph limitation, not a real gap, and CI never runs `--production`.

### Bundle-baseline reconciliation (closes the standing cost-analyst ↔ performance item)
Cost-analyst reported 580 KB gzip / 73 chunks (2026-07-17 onward); performance reported 638 KB gzip. Measured both ways this cycle on the same build:
- `.next/static/chunks/` only → **73 files, 638 KB gzip** (default) and **638 KB at gzip -9**.
- All of `.next/static` (adds 3 non-chunk JS files) → 76 files, 639 KB gzip.

Both compression levels give **638 KB**; the 73-chunk count matches cost-analyst. The **580 KB figure is not reproducible** from this build and appears to be a measurement outlier. **Canonical baseline going forward: 1,996 KB raw / 638 KB gzip / 73 chunks.**

## Client/Server Boundary
- `"use client"` directives (non-test): **113**. Key public pages all confirmed server components — `/[locale]`, `/[locale]/about`, `/u/[handle]`, `/[locale]/archetypes/*` have zero `use client` in their top lines; they render server-side and pass strings/props down to lightweight client leaves.
- `next/dynamic` code-split points: 8 production files (`BadgePreviewCard`, `AdminDashboardClient`, `KeyboardShortcutsListener`, `ClientInstrumentation`, `ClientAnalytics`, `GlobalCommandBarLazy`, `SharePageOwnerContentLazy`, plus a test helper).
- **No heavy libs pulled into client bundles.** `@resvg`/`sharp` are confined to server-only render modules (`lib/render/svg-to-png.ts`, used by the OG image route). `canvas-confetti` is type-only at import and loaded via `await import("canvas-confetti")` at call time — not in any initial bundle.

## Caching & Headers
- **Badge route (`/u/[handle]/badge.svg`)**: `maxDuration = 35`. Success response `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`; error response `s-maxage=300, stale-while-revalidate=600`. `Server-Timing` header emitted on every response (#974) for per-request latency inspection. Avatar critical-path capped at `AVATAR_RACE_DEADLINE_MS = 1000` via `Promise.race` (#1029).
- Content pages served via CDN/ISR (5m–1h revalidate, 1y expire) per the build's Revalidate/Expire columns.

## CLS & Fonts
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans) with `display: "swap"`. **Zero external font `<link>` requests** — no render-blocking font fetches.
- CLS: badge SVG is `width="1200" height="630"` with explicit fallback img dimensions (`BadgeToolbar` 1200×630, OG image 1200×630); `LiteYouTubeEmbed` thumbnail `width={480} height={270}`. `prefers-reduced-motion` present in `globals.css` (2 rules). No unsized above-the-fold images.

## Recommendations
1. **(P3, informational) Adopt the reconciled bundle baseline** — 1,996 KB raw / 638 KB gzip / 73 chunks. Retire the unreproducible 580 KB figure. This closes the cost-analyst ↔ performance reconciliation that has been parked pending a shared measurement; done here on an identical tree.
2. **(P3, no action) `knip --production` false positives persist** — 9 deps flagged, all genuinely used; CI's plain `knip` + `knip --dependencies` are clean. No suppression needed; documented so future cycles don't re-verify from scratch.
3. **No blockers, no warnings.** Bundle flat, all chunks < 350 KB, caching/fonts/CLS all healthy. Nothing to fix this cycle.

SHARED_CONTEXT_START
## Performance Agent — 2026-07-23
- **Status**: GREEN
- Total First Load JS: 1,996 KB raw / 638 KB gzipped (73 chunks)
- Routes >500KB: 0
- Unused exports: 0 (CI knip scans clean)

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths — zero-delta tree since 2026-07-19; bundle, caching, and CLS surfaces unchanged.
- [Security]: No performance issues with security implications. Badge cache headers + Server-Timing unchanged; server-only render libs (resvg/sharp) not in client bundles.
- [QA]: No CLS regressions; fonts via next/font with 0 external requests; badge/OG/YouTube images all explicitly dimensioned.
SHARED_CONTEXT_END
