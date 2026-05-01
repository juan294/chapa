# Performance Report
> Generated: 2026-04-30 | Health status: yellow

## Executive Summary

Build succeeds cleanly (Next.js 16.2.4, 0 TypeScript errors, no chunks exceed 500 KB), but two YELLOW issues require attention: total bundle size grew +194.9 KB (+11.6%) since the April 9 report, and the root layout's Redis feature-flag fetch is silently defeating ISR on archetype and about pages (7 pages expected to be statically cached are being server-rendered on every request).

## Build Output

Turbopack does not emit per-route First Load JS sizes in its build table. Route-level data below is derived from chunk analysis.

| Metric | Value | Status |
|--------|-------|--------|
| Compiled in | 6.6s | GREEN |
| TypeScript errors | 0 | GREEN |
| Total pages | 64 static definitions, 84 routes | GREEN |
| Pages rendered static (○) | 5 (`/apple-icon`, `/coming-soon`, `/icon`, `/robots.txt`, `/sitemap.xml`) | ⚠️ YELLOW — see ISR regression |
| Pages rendered dynamic (ƒ) | All others, including `/about`, `/archetypes/*` which should be ISR | ⚠️ YELLOW |
| Largest JS chunk | 227.1 KB (Next.js framework) | GREEN |
| Chunks >500 KB | **0** | GREEN |
| Chunks >300 KB | **0** | GREEN |

## Bundle Analysis

| Category | Raw | Gzipped |
|----------|-----|---------|
| Total JS (68 chunks) | **1,876.9 KB** (+194.9 KB vs Apr 9) | **598.1 KB** |
| CSS (1 file) | 103.4 KB | 15.4 KB |

**Top chunks by size:**

| Chunk (raw size) | Gzipped | Identified as | Status |
|-----------------|---------|---------------|--------|
| 0p9-7_b0ehkp..js (227.1 KB) | 70.7 KB | Next.js framework | GREEN |
| 0vtr_ue7_86de.js (175.3 KB) | 57.1 KB | PostHog analytics (lazy-loaded) | GREEN |
| 073dy37cyju-4.js (125.9 KB) | 33.7 KB | React DOM / RSC flight protocol | GREEN |
| 03~yq9q893hmn.js (110.0 KB) | 38.5 KB | Core-js polyfills | GREEN |
| 05bbsl_.fzfk..js (63.7 KB) | 17.5 KB | App code | GREEN |
| 0jzrw17xs9ipi.js (63.3 KB) | 18.7 KB | App code / RSC | GREEN |
| 11cnqbx.2k2ly.js (60.3 KB) | 20.4 KB | App code | GREEN |
| 0h8du~3h4.wb9.js (58.4 KB) | 18.3 KB | App code | GREEN |

**Bundle delta vs 2026-04-09 (1,682 KB → 1,876.9 KB, +194.9 KB / +11.6%):**
- Vendor/framework chunks (top 4): unchanged (-16.7 KB net)
- Application code chunks: grew from ~1,027 KB to ~1,239 KB (+212 KB)
- All recent commits (env.ts, JSON logger, withErrorCapture) are server-only — they should contribute 0 to client bundles. The growth predates the last 5 commits and likely reflects feature additions over the 3-week gap between April 9 and April 30.

**Unused exports (knip):**
- `--production` mode: 8 false positives confirmed in use (same as prior 3 cycles, verified via grep).
- Default mode (from `apps/web/`): 86 unused TypeScript `interface`/`type` exports. These are erased at compile time — zero bundle impact. A `knip.json` config would suppress the test-file false positives and produce a cleaner signal.

## ISR Regression (NEW — YELLOW)

**Affected pages:** `/about`, `/about/scoring`, `/about/verification`, `/archetypes/builder`, `/archetypes/guardian`, `/archetypes/marathoner`, `/archetypes/polymath`, `/archetypes/emerging`, `/archetypes/balanced`, `/archetypes/artificer`, `/_not-found`, `/cli/authorize`, `/admin`

**Root cause:** `app/layout.tsx:71` calls `isStudioEnabled()` → `dbGetFeatureFlag()` → `cacheGet()` → Upstash Redis HTTP (`https://delicate-muskrat-42024.upstash.io/pipeline` with `no-store`). Next.js detects this `no-store` fetch during static generation and marks the entire layout — and every page that inherits it — as dynamic.

Build log confirms:
```
[cache] cacheGet failed: Dynamic server usage: Route /archetypes/artificer couldn't be rendered
statically because it used no-store fetch https://delicate-muskrat-42024.upstash.io/pipeline
```

**Impact:** `/archetypes/*` should be statically cached for 7 days (`revalidate = 604800`); `/about*` for 24 hours (`revalidate = 86400`). Instead they're server-rendered on every request, adding a Redis + Supabase round-trip to every page load.

**Fix options (in order of preference):**
1. Wrap the `dbGetFeatureFlag` Redis call with Next.js `unstable_cache()` so it participates in ISR rather than blocking it.
2. Move `isStudioEnabled()` out of the root layout server component into a separate Suspense boundary or async child component, keeping the main layout statically renderable.
3. Use the in-process TTL cache (`flagCache` already exists in `lib/feature-flags.ts`) for the layout call, skipping Redis entirely for the ISR-sensitive path.

## Client/Server Boundary

All 94 non-test `"use client"` files are appropriate:
- Error boundaries (required by Next.js)
- Interactive UI: terminal input, command bar, badge customization, user menu, theme toggle
- Canvas/WebGL experiments (browser-only APIs)
- React hooks: `useSession`, `useTrendData`, `useKeyboardShortcuts`

**Dynamic imports (code-split correctly):**
- `GlobalCommandBarLazy` — `next/dynamic` with `ssr: false` ✓
- PostHog analytics — `next/dynamic` with `ssr: false` ✓  
- `ShortcutCheatSheet` — `next/dynamic` with `ssr: false` ✓
- Admin sub-dashboards (Agents, Engagement, Campaigns) — `next/dynamic` ✓
- Studio effects (Aurora, ParticleCanvas, GradientBorder, HolographicOverlay) — `next/dynamic` ✓

**Previous finding resolved:** Landing page previously flagged for synchronous `GlobalCommandBar` import. Confirmed: `LandingTerminal` re-exports `GlobalCommandBarLazy` (already lazy). Finding was incorrect — no action needed.

## Caching & Headers

**Badge SVG route (`/u/[handle]/badge.svg`):**
- Success: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` ✓
- Error fallback: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` ✓
- CSP: `frame-ancestors *` (intentional — embeddable asset) ✓

**API routes:** All mutation routes have `no-store`. Admin endpoints have `no-store`. Correct.

**Turbopack NFT warning:** **RESOLVED** — `svg-to-png.ts` now uses `dirname(fileURLToPath(import.meta.url))` for module-relative font path resolution. Zero warnings in current build.

## Font Loading

- `JetBrains Mono`: `next/font/google`, `display: "swap"`, Latin subset ✓
- `Plus Jakarta Sans`: `next/font/google`, `display: "swap"`, Latin subset ✓
- No external font requests, no render-blocking font URLs ✓

## CLS Risks

| Element | Location | Dimensions | Risk |
|---------|----------|-----------|------|
| `<Image>` (avatar) | `AdminUserTable.tsx:34` | `width={28} height={28}` | None ✓ |
| `<Image>` (avatar) | `UserMenu.tsx:267,308` | `width={32/40} height={32/40}` | None ✓ |
| `<Image>` (badge) | `BadgeContent.tsx:121` | `width={32} height={32}` | None ✓ |
| `<img>` (badge fallback) | `u/[handle]/page.tsx:186` | `width={1200} height={630}` | None ✓ |
| `<img>` (YouTube thumbnail) | `LiteYouTubeEmbed.tsx:45` | CSS `h-full w-full` inside `aspect-video` | None ✓ — container reserves space via `aspect-ratio: 16/9` |

No CLS risks found.

## Recommendations

| Priority | Item | Impact |
|----------|------|--------|
| **P1** | **Fix ISR regression** — wrap `dbGetFeatureFlag` in `unstable_cache()` or move out of root layout. 7 pages hitting Redis on every request instead of serving from CDN cache. | Latency + Supabase/Redis cost |
| **P2** | **Investigate +194.9 KB bundle growth** — run `ANALYZE=true pnpm run build` to identify which client-side modules grew since April 9. All recent commits are server-only, so growth predates the visible log. | User-facing load time |
| **P3** | Add `knip.json` config to suppress 404 test-file false positives and get a clean unused-code signal | DX / hygiene |

---

SHARED_CONTEXT_START
## Performance Engineer — 2026-04-30
- **Status**: YELLOW
- Total First Load JS: 1,876.9 KB raw / 598.1 KB gzipped (+194.9 KB / +11.6% vs Apr 9)
- Chunks >500 KB: **0**
- Unused exports (production): 8 confirmed false positives (stable)
- Turbopack NFT warning: RESOLVED
- **NEW YELLOW**: ISR regression — root layout `no-store` Redis call forces 13 pages dynamic (should be static/ISR)
- **NEW YELLOW**: Bundle +194.9 KB growth since Apr 9 — origin unknown (all recent commits are server-only)

**Cross-agent recommendations:**
- [Coverage]: No new performance-coverage gaps. `og-image/route.ts` 60% funcs remains the only critical-path gap (6th cycle).
- [Security]: ISR regression means archetype/about pages no longer serve from CDN cache — DDoS surface slightly increased. Rate limiting on these pages already present via Redis, but fixing ISR would reduce origin exposure.
- [QA]: `/about/scoring` embeds `LiteYouTubeEmbed` — not a CLS risk (`aspect-video` container). No rendering regressions observed.
- [Cost Analyst]: ISR regression likely increased Vercel serverless invocations for 7+ pages that should be CDN-cached. Archetype pages (revalidate=604800) hitting origin every request instead of being CDN-cached for a week is a cost regression worth quantifying.
SHARED_CONTEXT_END
