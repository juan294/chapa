# Performance Report
> Generated: 2026-06-25 | Health status: green

## Executive Summary
Build is clean (0 errors, 6.8s compile, 10.0s TypeScript), all 77 chunks are well under the 350 KB/chunk CI budget, and the +124 KB raw bundle growth since the last cycle is fully attributed to the score challenge flow (#933), which is correctly code-split behind a `next/dynamic` wrapper and does not affect visitor First Load JS.

## Build Output

Next.js 16.2.9 (Turbopack) — 89 routes (5 static, 84 dynamic), 48 static pages.

Turbopack omits per-route First Load JS from build output. Sizes are measured byte-accurately from `.next/static/chunks`.

| Metric | Value | vs 2026-06-18 |
|--------|-------|---------------|
| Total chunks | 77 | flat |
| Raw total | 2,074 KB | +124 KB (+6.4%) |
| Gzipped total | 657 KB | +34 KB (+5.5%) |
| Routes >500 KB | 0 | flat |
| Routes >350 KB | 0 | flat |
| Routes >300 KB | 0 | flat |

**No routes exceed any threshold — GREEN.**

## Bundle Analysis

### Top 10 chunks (raw bytes)

| Chunk | Size (raw) | Status |
|-------|-----------|--------|
| 0qmgkw5s78uqn.js | 228 KB | OK |
| 2cz6l19i7nua_.js | 192 KB | OK |
| 0cz1d0mv5g_q7.js | 110 KB | OK |
| 43e11u3pk0euw.js | 107 KB | OK |
| 1vt8gl2pmut_4.js | 88 KB | OK |
| 1basnt1r1mzrk.js | 78 KB | OK |
| 1kpewill5hsck.js | 64 KB | OK |
| 0hv4jnlpj1fkb.js | 61 KB | OK |
| 233_diaisj6me.js | 58 KB | OK |
| 3n24e6d0161oo.js | 57 KB | OK |

All framework/vendor. Largest chunk is 228 KB raw — well under the 350 KB CI gate.

### Bundle growth attribution

+124 KB raw since 2026-06-18 is fully explained by commits landed since then:

- **feat(score): add score challenge flow (#933)** — 887 insertions: `ChallengeForm.tsx` (173 lines), `lib/email/challenge.ts` (101 lines), `lib/challenge/validation.ts`, i18n keys in both dictionaries, tests. This is the dominant driver.
- **fix(dashboard): show uploaded craft submetrics**, **fix(i18n): suppress hydration mismatch** — minor contributions.
- **fix(agents): harden shared context extraction**, **chore: sync to cc-rpi v1.24.0** — no client bundle impact.

`ChallengeForm` → `ScoreExplanationPanel` → `SharePageOwnerContent` → **loaded via `next/dynamic` in `SharePageOwnerContentLazy`**. Visitor First Load JS is unaffected; the component only loads for authenticated profile owners.

### Unused exports (knip --production)

One finding: `vitest.setup.ts` — **known false positive** (test infrastructure, not production). Zero real unused production exports.

## Client/Server Boundary

`"use client"` count: **113 files** (non-test).

Key public pages confirmed as server components:

| Route | Type |
|-------|------|
| `/` (app/page.tsx) | SERVER ✓ |
| `/u/[handle]` (app/u/[handle]/page.tsx) | SERVER ✓ |
| `/about` | SERVER ✓ |
| `/archetypes/[type]` | SERVER ✓ |

`"use client"` in app/ is appropriately scoped to `*Client.tsx` leaf components, error boundaries, and experiment pages (Canvas/WebGL requires client). No top-level page routes are unnecessarily client-rendered.

Dynamic imports in production: **22 usages** covering PostHog, `GlobalCommandBar`, `SharePageOwnerContent` (owner-only panel + challenge form), admin sub-dashboards, Studio effects, and canvas-confetti. All heavy or conditionally-loaded components are properly deferred.

## Caching & Headers

### Badge SVG route (`/u/[handle]/badge.svg`)

| Property | Value |
|----------|-------|
| `export const maxDuration` | 35s |
| Success `Cache-Control` | `public, s-maxage=21600, stale-while-revalidate=86400` |
| Error `Cache-Control` | `public, s-maxage=300, stale-while-revalidate=600` |
| In-flight dedup | ✓ Redis lock |

6h CDN freshness with 24h stale fallback is appropriate for daily-computed impact scores.

### Static ISR pages

| Route | Revalidate |
|-------|-----------|
| `/about`, `/about/scoring`, `/about/verification` | 5 min |
| `/archetypes/artificer`, `/archetypes/balanced`, `/archetypes/builder`, `/archetypes/emerging`, `/archetypes/guardian` | 5 min |
| `/archetypes/marathoner`, `/archetypes/polymath` | 1 hour |
| `/privacy`, `/terms`, `/verify` | 1 hour |

No uncached external calls. Feature flags use `unstable_cache` with 60s/300s revalidate. `/api/health` GitHub probe cached 60s.

## Font Loading

- `next/font/google` with `display: swap` — **no external font requests from the browser**.
- Fonts: **JetBrains Mono** (`font-heading`, `font-terminal`) and **Plus Jakarta Sans** (`font-body`).
- Font CSS variables injected at build time; zero render-blocking font link tags.

## CLS Risks

| Element | Location | CLS Risk |
|---------|----------|---------|
| Badge fallback `<img>` | `app/u/[handle]/page.tsx:245` | **None** — explicit `width={1200} height={630}` + `fetchPriority="high"` |
| YouTube thumbnail `<img>` | `components/LiteYouTubeEmbed.tsx:45` | **Low** — no explicit `width`/`height` attrs, but rendered inside a fixed-height container with `h-full w-full object-cover`. CLS is container-bounded. Could add `width="480" height="270"` for belt-and-suspenders robustness. |
| `BadgeSkeleton` placeholder | shown while `<img>` loads | **None** — reserves space before image loads |

`prefers-reduced-motion` is respected across all animated components.

## New Route: `/api/challenge`

Added by #933. Server-side route, no client bundle contribution. Should be included in next documentation cycle for CLAUDE.md route table.

## Recommendations

| # | Priority | Finding | Action |
|---|----------|---------|--------|
| R1 | P3 | Bundle grew +124 KB raw (+6.4%) vs last cycle. Still GREEN (largest chunk 228 KB). Growth from #933 challenge flow, correctly code-split. | Monitor next cycle; if growth continues past 2,300 KB raw, run `ANALYZE=true pnpm run build` to identify contributors. |
| R2 | P3 | `LiteYouTubeEmbed` thumbnail `<img>` has no explicit `width`/`height` attributes. | Add `width="480" height="270"` for belt-and-suspenders CLS protection. |
| R3 | P3 | `/api/challenge` route added by #933 is not yet in CLAUDE.md route table. | Add to next documentation agent cycle. |
