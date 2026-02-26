# Share Page Performance Optimization

> **Goal**: Improve desktop Real Experience Score from 81 → 90+ by reducing LCP from 4.04s to <2.5s on `/u/[handle]`
>
> **Branch**: `fix/share-page-perf`
> **Issue**: TBD (create before implementation)

## Problem

The `/u/[handle]` share page has a desktop RES of 59 (site-wide 81) due to two sequential server round-trips:

1. **Page SSR**: fetches stats from GitHub API → computes impact → renders HTML (~2–3s)
2. **Badge `<img>`**: browser parses HTML, sees `<img src="/u/.../badge.svg">`, sends a *second* request → badge route fetches stats (cached) + avatar (network) + renders SVG (~1–2s)

Total: 3–5s before the badge (LCP element) appears. FCP is 2.37s, LCP is 4.04s.

Other metrics are fine: INP 64ms, CLS 0, FID 7ms, TTFB 0.83s.

## Root Causes (ranked by impact)

| # | Bottleneck | Time cost | Location |
|---|-----------|-----------|----------|
| 1 | Badge loaded as `<img>` — triggers second request waterfall | +1–2s | `page.tsx:178-185` |
| 2 | Snapshot fetch is sequential (blocks after stats complete) | 0–500ms | `page.tsx:110` |
| 3 | Avatar base64 fetch in badge route (external network call) | 0.5–2s | `avatar.ts:56-74` |
| 4 | No `loading.tsx` — blank page until SSR completes | FCP delay | (missing file) |
| 5 | `GlobalCommandBar` loaded eagerly on every page | ~50KB JS | `page.tsx:335` |

## Strategy

Three phases, ordered by impact:

1. **Inline SVG + parallel data fetching** — eliminates the second round-trip entirely (biggest LCP win)
2. **Loading skeleton** — shows a skeleton instantly while SSR runs (FCP win)
3. **Lazy-load non-critical client components** — reduces initial JS bundle (TTI win)

## Phase Summary

### Phase 1: Inline Badge SVG + Parallel Data Fetching

**Impact**: Eliminates ~1.5–2.5s from LCP (second round-trip gone)

The share page already computes `stats` and `impact` during SSR. Instead of emitting an `<img>` that triggers a second server request, render the badge SVG server-side and inline it directly in the HTML.

Changes:
- Restructure `Promise.all` to fetch `stats`, `config`, and `latestSnapshot` in parallel (snapshot currently waits for stats)
- After stats resolve, kick off avatar fetch concurrently with impact computation
- Call `renderBadgeSvg()` during page SSR to produce the SVG string
- Inline the SVG via `dangerouslySetInnerHTML` instead of `<img src="...">`
- Add `after()` to the share page for deferred work (verification storage, tracking, snapshot recording)
- Keep badge.svg route unchanged (external embeds still need it)

**Files modified**: `apps/web/app/u/[handle]/page.tsx`
**Files read (no changes)**: `lib/render/BadgeSvg.tsx`, `lib/render/avatar.ts`, `lib/cache/snapshot-cache.ts`, `lib/verification/hmac.ts`

### Phase 2: Loading Skeleton

**Impact**: Immediate FCP (~0s) instead of waiting for SSR

Add `apps/web/app/u/[handle]/loading.tsx` with a skeleton that mirrors the page layout: navbar placeholder, badge area pulse, toolbar area, breakdown cards.

**Files created**: `apps/web/app/u/[handle]/loading.tsx`

### Phase 3: Lazy-Load GlobalCommandBar

**Impact**: ~50KB less initial JS on share page

Wrap `GlobalCommandBar` in `next/dynamic` with `ssr: false`. It's a fixed-bottom bar that users don't interact with on initial load — no reason to block hydration.

**Files modified**: `apps/web/app/u/[handle]/page.tsx` (import change)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Inline SVG increases HTML payload by ~50–100KB | Gzip compresses SVG strings to ~10–20KB. Still faster than second round-trip. |
| SVG `id` collisions if multiple SVGs on page | Share page only renders one badge SVG. No collision risk. |
| `after()` work duplicated between share page and badge route | Badge route serves external embeds; share page serves direct visitors. Different audiences, acceptable. |
| Breaking the interactive preview path (`ShareBadgePreviewLazy`) | Only the default `<img>` path changes. Interactive preview is untouched. |
| Badge.svg route still works for embeds | Route is completely unchanged — zero risk. |

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes (including new tests)
- [ ] Badge SVG route still returns valid SVG for direct requests
- [ ] Share page HTML contains inline `<svg>` element (test with curl)

### Manual
- [ ] Desktop LCP < 2.5s on Vercel production (check after deploy)
- [ ] Desktop RES for `/u/[handle]` > 80 (target: 90+)
- [ ] Site-wide desktop RES > 90
- [ ] Badge displays correctly on share page (visual check)
- [ ] Loading skeleton appears before content loads (throttle network in DevTools)
- [ ] GlobalCommandBar still works after lazy-loading (type a command)

## Out of Scope

- Server-side caching of rendered SVG strings (can explore later if needed)
- Edge function migration for lower TTFB
- Mobile performance (already at 99 RES)
- Badge.svg route optimization (external embeds are separately cacheable)
