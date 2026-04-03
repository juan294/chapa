# Performance Report
> Generated: 2026-04-02 | Health status: green

## Executive Summary
Build is healthy — total client JS decreased 8% to 1,663 KB vs 1,800 KB last cycle (2026-03-26). No chunk exceeds 232 KB, zero knip findings, all caching headers correct. One Turbopack NFT warning for the OG image route is low-severity.

## Build Output

**Build stats:** Next.js 16.2.1 (Turbopack) · compiled 5.4s · TypeScript 8.0s · 0 errors · 64 static pages · 84 routes (5 static, 79 dynamic)

| Route / Chunk | Size (First Load JS) | Status |
|--------------|---------------------|--------|
| Largest chunk (framework) | 232 KB | GREEN |
| 2nd largest (PostHog, lazy) | 179 KB | GREEN |
| 3rd (React DOM) | 137 KB | GREEN |
| 4th (polyfills) | 113 KB | GREEN |
| 5th | 64 KB | GREEN |
| All remaining chunks | < 60 KB each | GREEN |

No route or chunk exceeds the 500 KB threshold. No chunk exceeds 300 KB.

**Note:** Turbopack does not emit a per-route First Load JS table (unlike webpack mode). Sizes above are the raw production static chunk files from `.next/static/chunks/`.

**Turbopack warning (low severity):** `svg-to-png.ts` uses `path.join(process.cwd(), ...)` at lines 36–37, causing the OG image route to trace the entire project via NFT. This is cosmetic in dev but may produce a slightly larger Lambda bundle on Vercel for `/u/[handle]/og-image`. Fix: add `/*turbopackIgnore: true*/` comment to the `process.cwd()` calls if the path is always statically resolvable.

## Bundle Analysis
- **Total First Load JS:** 1,663 KB (1.63 MB) — down 137 KB (-8%) from 1,800 KB on 2026-03-26
- **Largest chunks:** 232 KB (Next.js framework), 179 KB (PostHog lazy-loaded), 137 KB (React DOM), 113 KB (polyfills)
- **Chunks >100 KB:** 4 — all framework/vendor, not application code
- **Unused exports (knip):** 0 production findings. 384 test files flagged as false positives (expected — test files are not in the production entry graph); same result as previous cycle.
- **Dynamic imports:** `ShareBadgePreviewLazy.tsx` and `GlobalCommandBarLazy.tsx` confirmed using `next/dynamic` with `ssr: false`. Additional dynamic splits for admin sub-dashboards (AgentsDashboard, EngagementDashboard, CampaignsDashboard) from previous cycle still in place.

## Client/Server Boundary

56 non-test files with `"use client"` (41 in `components/`, 15 in `lib/`). All appear appropriate:

- **Error boundaries** (`error.tsx` files) — required by Next.js App Router
- **Admin dashboard** (`AdminDashboardClient.tsx`, agents, campaigns, engagement sub-views) — interactive tables/charts with client state
- **Studio** (`StudioClient.tsx`, `BadgePreviewCard.tsx`, `QuickControls.tsx`) — live badge customization with controlled form state
- **Share page** (`ShareBadgePreviewLazy.tsx`) — wraps a `next/dynamic` to avoid SSR of heavy canvas component
- **Experiments** (`app/experiments/**`) — all canvas/WebGL demos; client rendering is required
- **Terminal/global UI** (`TerminalInput.tsx`, `AutocompleteDropdown.tsx`, `GlobalCommandBarLazy.tsx`) — keyboard state, autocomplete, command bar
- **Hooks/effects** (`lib/effects/**`, `lib/hooks/`) — `useState`/`useEffect` patterns

No high-level `"use client"` directives found that should be pushed deeper. `ShareBadgePreviewLazy` and `GlobalCommandBarLazy` are correctly the shallowest boundaries with server parents above them.

## Caching & Headers

| Route | Cache-Control | Status |
|-------|--------------|--------|
| `/u/[handle]/badge.svg` (success) | `public, s-maxage=21600, stale-while-revalidate=86400` | GREEN |
| `/u/[handle]/badge.svg` (error fallback) | `public, s-maxage=300, stale-while-revalidate=600` | GREEN |
| `/u/[handle]/og-image` | ISR `revalidate=3600` | GREEN |
| `/about`, `/about/scoring`, `/about/verification` | ISR `revalidate=86400` | GREEN |

Badge SVG frame-ancestors set to `*` via explicit `Content-Security-Policy` override — correct for embeddable asset.

## Font Loading

- `next/font/google` with `display: "swap"`, Latin subset for both JetBrains Mono and Plus Jakarta Sans
- No external `<link rel="stylesheet" href="fonts.googleapis.com/...">` in layout — no render-blocking font requests
- Server-side TTF files for `svg-to-png.ts` (resvg OG image rendering) are scoped to `lib/render/fonts/` — not exposed to browsers

## CLS Risks

- **None found.** All 4 `<Image>` components (UserMenu.tsx ×2, BadgeContent.tsx, AdminUserTable.tsx) have explicit `width` and `height` attributes
- No bare `<img>` tags in production components
- Skeleton loaders present for async content (confirmed from previous cycles)
- `display: "swap"` on fonts prevents FOIT; FOUT is acceptable

## Recommendations

| Priority | Item | File | Action |
|----------|------|------|--------|
| LOW | Turbopack NFT warning | `lib/render/svg-to-png.ts:36-37` | Add `/*turbopackIgnore: true*/` to `process.cwd()` calls to scope NFT tracing. Cosmetic — does not affect functionality. |

All other metrics are GREEN. No immediate action required.
