# Performance Report
> Generated: 2026-04-09 | Health status: green

## Executive Summary

Build is stable at 1,682 KB raw client JS (~522 KB gzipped), down 19 KB from last run with zero chunks exceeding the 500 KB threshold. Knip is clean. The Turbopack NFT warning for the OG image route persists despite `turbopackIgnore` comments — cosmetic only. One minor finding: the landing page imports `GlobalCommandBar` synchronously instead of via `GlobalCommandBarLazy`, bypassing the lazy loader used on admin and share pages — worth unifying but not a blocker.

## Build Output

> Next.js 16.2.2 (Turbopack) | Compiled in 2.8s | 0 TypeScript errors | 64 static pages | 84 routes (5 static, 79 dynamic)

### Client Chunks (top 10 by raw size)

| Chunk | Raw Size | Gzipped | Identity (inferred) | Status |
|-------|----------|---------|---------------------|--------|
| `0i6hmdj2yp4zb.js` | 232 KB | 71 KB | Next.js framework | OK |
| `0vs6rbxsqj~ew.js` | 173 KB | 55 KB | PostHog (lazy-loaded) | OK |
| `085mqcepw4kbq.js` | 137 KB | 36 KB | React DOM | OK |
| `03~yq9q893hmn.js` | 113 KB | 38 KB | Polyfills | OK |
| `11y515pezrwu_.js` | 64 KB | 17 KB | App code | OK |
| `068u3mvcdl~af.js` | 60 KB | 18 KB | App code | OK |
| `0w9q9~bez_4so.js` | 60 KB | 18 KB | App code | OK |
| `0bzfuyt45vye4.js` | 55 KB | 13 KB | App code | OK |
| `0aq-rtaxc~c2w.js` | 52 KB | 17 KB | App code | OK |
| `06hqx00bf66nv.js` | 46 KB | 14 KB | App code | OK |

> Note: Turbopack generates content-hashed chunk names. No chunk exceeds 232 KB raw / 71 KB gzipped. **No chunks exceed 500 KB threshold.**

### Page-level bundles

Turbopack does not emit per-route First Load JS tables in build output (unlike webpack). Per-route server entry points are all < 2 KB (loader stubs); shared chunks are composed at runtime. This is expected behavior.

## Bundle Analysis

- **Total client JS**: 1,682 KB raw / ~522 KB gzipped (68 chunks)
- **Total CSS**: 103 KB raw / ~15 KB gzipped (1 chunk)
- **Total client assets**: ~537 KB gzipped
- **vs 2026-04-02**: +19 KB raw (+1.1%) — within noise
- **Largest chunks**: Next.js framework (232 KB), PostHog lazy (173 KB), React DOM (137 KB), polyfills (113 KB)
- **Unused exports**: **0** — knip clean

## Client/Server Boundary

**98 non-test files** carry `"use client"`. All are appropriate:

| Category | Count | Assessment |
|----------|-------|------------|
| Error boundaries (`error.tsx`) | 12 | Required — Next.js enforces client for error boundaries |
| Interactive components (terminal, tooltips, nav) | 28 | Legitimate — browser APIs needed |
| Dashboard UI (admin, studio, experiments) | 22 | Legitimate — canvas/WebGL/complex state |
| Hooks and effects | 9 | Legitimate — browser-only hooks |
| Analytics / providers | 4 | Legitimate — client-only APIs |
| Canvas/WebGL experiment pages | 13 | Legitimate — cannot SSR |

**Finding (LOW):** `app/page.tsx` imports `GlobalCommandBar` synchronously via `LandingTerminal` re-export, while `app/admin/page.tsx` and `app/u/[handle]/page.tsx` use `GlobalCommandBarLazy` (`next/dynamic`, `ssr: false`). The landing page therefore pays the synchronous cost of `GlobalCommandBar` + `command-registry.ts` (427 lines) at initial load. Given `GlobalCommandBar` is small (148 lines) and is the main interaction point of the landing page, this is arguably intentional — but the inconsistency creates confusion. Consider switching `LandingTerminal` to use the lazy variant, or document the intentional divergence.

**Dynamic imports in use (correct):**
- `GlobalCommandBarLazy` — `next/dynamic`, `ssr: false`
- `ShareBadgePreviewLazy` — `next/dynamic`, `ssr: false`
- `AgentsDashboard`, `EngagementDashboard`, `CampaignsDashboard` — admin sub-tabs, `ssr: false`
- `KeyboardShortcutsListener` → `ShortcutCheatSheet` — `next/dynamic`
- `ClientAnalytics` — `next/dynamic`, `ssr: false`

## Caching & Headers

### Badge SVG Route (`/u/[handle]/badge.svg`)
- **Success path**: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` — 6h CDN cache, 24h stale-while-revalidate. Correct.
- **Error path**: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` — 5m CDN cache on error. Correct.
- **Embed headers**: `Content-Security-Policy: frame-ancestors *` + `X-Frame-Options: ALLOWALL`. Correct for embeddable badge.

### ISR Revalidation
| Route | Revalidate | Assessment |
|-------|-----------|------------|
| `/` (landing) | 1h | OK |
| `/u/[handle]` (share page) | 1h | OK |
| `/about/*` | 24h | OK (updated from 1h in triage 2026-03-30) |
| `/archetypes/*` | 7 days | OK (static content) |

### Font Loading
- `next/font/google` with `display: "swap"`, Latin subset only. No external font requests. **Optimal.**

## Build Warnings

**Turbopack NFT warning** — OG image route (`/u/[handle]/og-image`) still triggers:
```
Encountered unexpected file in NFT list
Import trace: next.config.ts → svg-to-png.ts → og-image/route.ts
```
`turbopackIgnore` comments were added to `svg-to-png.ts:36-37` in triage 2026-04-03. The warning persists because `existsSync` (line 38 of `svg-to-png.ts`) and the `@resvg/resvg-js` native module import also trigger full-project tracing. This is cosmetic — it may slightly increase the Lambda zip size for the OG image route but does not affect functionality or correctness. Tracked as LOW.

## CLS Risk Analysis

- **`<Image>` components**: 3 files use `next/image`, all with explicit `width` and `height`. **No CLS risk.**
- **Bare `<img>` tags**: Found only in `SharePageOwnerContent.tsx:44` as a code snippet string inside a `<code>` block — not rendered as an actual DOM image. **No CLS risk.**
- **Skeleton loaders**: All dynamically-loaded admin sub-dashboards have `loading` UI (`animate-pulse` placeholders).
- **`prefers-reduced-motion`**: Defined in `globals.css` at lines 381 and 472. **Correct.**

## Recommendations

| Priority | Item | File | Action |
|----------|------|------|--------|
| LOW | Turbopack NFT warning persists for OG image route | `lib/render/svg-to-png.ts` | `existsSync` cannot be suppressed with `turbopackIgnore` — accepted cosmetic warning. No action needed. |
| LOW | Landing page uses synchronous `GlobalCommandBar` via `LandingTerminal` re-export | `app/page.tsx`, `app/LandingTerminal.tsx` | Consider switching to `GlobalCommandBarLazy` for consistency, or add a comment documenting the intentional divergence. |
| INFO | Bundle grew +19 KB (+1.1%) vs 2026-04-02 | — | Within noise. No action. |
