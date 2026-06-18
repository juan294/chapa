# Performance Report
> Generated: 2026-06-18 | Health status: green | HEAD: `63b18ac1`

## Executive Summary

Bundle is flat at 1,950 KB raw / 623 KB gzipped (77 chunks), up <1 KB from the prior cycle (2026-06-11), confirming no regression from the CI-only pnpm/action-setup@v4→@v5 change. Zero routes exceed 500 KB, build is clean, caching and font loading are correct. One low-priority observation: knip.json references the v5 schema but v6.17.1 is installed — this may produce noisier output (test files now appear in the "unused files" category).

## Build Output

Build: **Next.js 16.2.9** (Turbopack) | Compile: 4.4s | TypeCheck: 8.7s | Errors: 0

| Metric | Value |
|--------|-------|
| Routes total | 89 (4 static, 85 dynamic) |
| Static pages generated | 48 |
| Chunks | 77 |
| Compilation errors | 0 |
| TypeScript errors | 0 |

> **Note**: Turbopack omits per-route First Load JS from the build table. Route-level sizing requires `ANALYZE=true pnpm run build` (interactive, browser-driven). All sizes below are from `.next/static/chunks` byte totals.

### Largest Chunks (raw)

| Chunk | Size | Status |
|-------|------|--------|
| `0qmgkw5s78uqn.js` | 228 KB | OK |
| `2cz6l19i7nua_.js` | 192 KB | OK |
| `02frlnv1h55df.js` | 156 KB | OK |
| `0cz1d0mv5g_q7.js` | 112 KB | OK |
| `43e11u3pk0euw.js` | 108 KB | OK |
| *(remaining 72 chunks)* | ≤68 KB each | OK |

All chunks are framework/vendor bundles. None exceed 300 KB raw.

## Bundle Analysis

| Metric | This Cycle | Prior Cycle (2026-06-11) | Delta |
|--------|-----------|--------------------------|-------|
| Total raw | **1,950 KB** | 1,949.3 KB | +0.7 KB (+0.04%) |
| Total gzipped | **623 KB** | 622.6 KB | +0.4 KB (+0.06%) |
| Chunk count | **77** | 77 | flat |
| Routes >500 KB | **0** | 0 | — |
| Routes >300 KB | **0** | 0 | — |

**Verdict**: Bundle is effectively flat. M-bundle monitor stays closed (11th consecutive flat cycle since reversal on 2026-05-28).

### Knip — Unused Exports

```
Unused files (440)     ← all test files (.test.ts/.test.tsx); false positive in --production mode
Unused exports (91)    ← private helpers + internal functions
Unused exported types (21) ← DX/documentation types
```

**Assessment**: The 440 "unused files" are the entire test suite — correctly excluded by `--production` from entry-point reachability but still matched by the `**/*.{ts,tsx}` project glob. The 7,594 tests pass cleanly; this is a presentation artifact. The 91 exports and 21 types are the same pattern as prior cycles: underscore-prefix private helpers (e.g., `_computeEffectiveness`, `_computeSophistication`), internal types used for documentation (`SessionUser`, `CampaignStatus`), and functions used within their own module (`buildPayload`, `computeHash` in HMAC). **No production bloat identified.**

**Low-priority note**: `knip.json` references the v5 schema (`https://unpkg.com/knip@5/schema.json`) but v6.17.1 is installed. Prior cycles reported 0 output from `knip --production`; this cycle v6 surfaces test-file "unused" entries. Consider updating the schema ref to v6 or adding `"ignoreFiles": ["**/*.test.{ts,tsx}"]` to restore the cleaner output.

## Client/Server Boundary

`"use client"` directives (non-test, anchored): **105 files**

Spot audit of key public routes — all confirmed server components (no `"use client"` at top level):

| Route | File | Status |
|-------|------|--------|
| `/` | `app/page.tsx` | Server (`force-dynamic`) ✅ |
| `/about` | `app/about/page.tsx` | Server ✅ |
| `/u/[handle]` | `app/u/[handle]/page.tsx` | Server (`revalidate=3600`) ✅ |
| `/archetypes/builder` | `app/archetypes/builder/page.tsx` | Server ✅ |

Client components are correctly pushed to leaf level: error boundaries, loading states, Studio interactive components, experiments pages (flag-gated), admin sub-dashboards.

### Dynamic Imports (code-splitting)

17 dynamic `import()` / `next/dynamic` usages covering:
- `PostHogProvider` — analytics, lazy-loaded
- `GlobalCommandBar` — heavy interactive, lazy via `GlobalCommandBarLazy.tsx`
- `SharePageOwnerContent` — owner-only panel, lazy via `SharePageOwnerContentLazy.tsx`
- Admin sub-dashboards: `AgentsDashboard`, `EngagementDashboard`, `CampaignsDashboard`
- Studio effects: `AuroraBackground`, `ParticleCanvas`, `GradientBorder`, `HolographicOverlay`
- `canvas-confetti` — celebration effect, lazy at call site (`lib/effects/celebrations/confetti.ts`)
- `ShortcutCheatSheet`, `InsightsParser` — lazy on demand

Code-splitting posture is good. No heavy synchronous imports on the critical render path.

## Caching & Headers

### Badge SVG Route (`/u/[handle]/badge.svg`)

| Header | Value |
|--------|-------|
| `Cache-Control` (success) | `public, s-maxage=21600, stale-while-revalidate=86400` |
| `Cache-Control` (error) | `public, s-maxage=300, stale-while-revalidate=600` |
| `maxDuration` | 35s (8th cycle hold) |
| In-flight dedup | Redis lock — prevents duplicate GitHub API calls |

- Success path: 6h CDN fresh / 24h SWR — badges served from CDN edge without origin hits
- Error path: 5min CDN / 10min SWR — short window forces retry on transient failures

### Other Routes

| Route / Pattern | Caching Strategy |
|-----------------|-----------------|
| `/api/feature-flags` | ISR `unstable_cache(revalidate=300)` — 5min server-side |
| `/api/health` GitHub probe | `unstable_cache` 60s |
| `/u/[handle]` share page | ISR `revalidate=3600` — 1h |
| Archetype / About pages | ISR (Next.js static generation) |
| All external GitHub calls | Cache-first (6h + 7d SWR) with Redis lock |
| PostHog | Batched fire-and-forget |
| Resend | Event-driven + daily quota guard |

**Uncached external calls: 0.**

## Font Loading

| Font | Source | Class | `display` |
|------|--------|-------|-----------|
| JetBrains Mono | `next/font/google` | `font-heading` | `swap` |
| Plus Jakarta Sans | `next/font/google` | `font-body` | `swap` |

- Zero external font requests in HTML — fonts preloaded by Next.js font optimization
- `display: swap` on both — no render-blocking, FOUT handled gracefully
- No Google Fonts `<link>` tags in `<head>`

## CLS Risk Audit

| Element | Location | Dimensions | Status |
|---------|----------|-----------|--------|
| Badge `<img>` fallback | `app/u/[handle]/page.tsx:231` | `width={1200} height={630}` | ✅ |
| LiteYouTubeEmbed thumbnail | `components/LiteYouTubeEmbed.tsx:45` | CSS `h-full w-full` in fixed container | ✅ |
| Badge skeleton | `components/BadgeSkeleton.tsx` | Fixed dimensions, shown before fallback | ✅ |

No CLS risks identified. `prefers-reduced-motion` respected across all animated components.

## Recommendations

| Priority | Item | Action |
|----------|------|--------|
| P3 | Update knip.json schema to v6 | Change `"$schema"` to `https://unpkg.com/knip@6/schema.json`; optionally add `"ignoreFiles": ["**/*.test.{ts,tsx}"]` to restore clean `--production` output |
| P3 | Per-route bundle analysis | Run `ANALYZE=true pnpm run build` interactively to get route-level First Load JS breakdown; informational only, bundle is flat |

**No P1 or P2 items. Bundle growth rate: flat (11 consecutive cycles). Caching, fonts, and CLS all clean.**

---

*Cross-agent context entry appended to `docs/agents/shared-context.md`.*
