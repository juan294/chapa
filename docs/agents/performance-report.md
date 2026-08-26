# Performance Report
> Generated: 2026-08-20 | Health status: green

## Executive Summary
Build is clean (0 errors/warnings, 0 unused exports), zero routes/chunks exceed either the 350 KB CI gate or the 500 KB flag threshold, and the bundle grew only ~15 KB raw / ~5 KB gzip despite 90 app-code commits landing since the last measured baseline (HEAD `0482da44`, 2026-08-13).

## Build Output
Next.js 16.2.11 (Turbopack) no longer prints a First Load JS size table in its route output (`pnpm run build` route listing shows only route paths + revalidate/expire, no KB column) — sizes below are measured directly from `.next/static/chunks/*.js` on disk, consistent with the per-chunk-gzip-sum methodology established 2026-08-06.

| Metric | Value | Status |
|--------|-------|--------|
| Total chunks | 73 | — |
| Total raw JS | 2,013.6 KB | GREEN |
| Total gzip JS (per-file sum) | 644.1 KB | GREEN |
| Largest chunk (raw / gzip) | 227.1 KB / 70.9 KB | GREEN (< 350 KB gate) |
| Routes/chunks > 350 KB | 0 | GREEN |
| Routes/chunks > 500 KB | 0 | GREEN |
| TypeScript errors | 0 | GREEN |
| Build warnings | 0 | GREEN |

Build: `pnpm install --frozen-lockfile` clean (lockfile up to date, no stale-lockfile risk). Turbopack compile 49s, TypeScript check 88s. 81 routes generated (9 locale-segmented content pages confirmed SSG under `/[locale]/...`, both `en`/`es` variants prerendered).

## Bundle Analysis
- Total First Load JS: **2,013.6 KB raw / 644.1 KB gzipped, 73 chunks** — new canonical baseline (HEAD `5a45569f`), up from 1,999 KB raw / 639 KB gzip / 73 chunks (2026-08-13, HEAD `0482da44`). The ~15 KB raw / ~5 KB gzip delta is real but small relative to the 90 app-code commits in between (i18n locale-coherence fixes, tooltip viewport hardening, campaign-stats aggregation, badge/verification attestation renewal, source-text→behavioral test conversions) — no single change stands out as a bundle-size regression.
- Largest chunks (raw): 232,559 / 194,879 / 112,594 / 109,936 / 96,606 bytes — same composition and ordering as prior cycles (framework/vendor chunks).
- Unused exports: **none** — `pnpm exec knip` (default) and `pnpm exec knip --dependencies`, both run from repo root matching CI's actual invocation, exit 0 with zero findings.

## Client/Server Boundary
- `"use client"` directives (non-test): **111**, up from 109 (2026-08-13). Net +2 aligns with the i18n locale-coherence fixes (`fix(i18n): keep root controls locale coherent`, `fix(i18n): align landing client locale`) touching client-side language/locale components.
- Code-split points (`next/dynamic` / `await import()`): **16**, flat vs. 2026-08-13.
- Key public pages (`/[locale]`, `/[locale]/about`, `/u/[handle]`, `/[locale]/archetypes/[type]`) remain server components. No heavy render libraries (`@resvg/resvg-js`, `sharp`) found under any `"use client"` file — the render pipeline stays server-only.
- No directives found that should be pushed deeper; the small net increase tracks genuine new client-side i18n logic, not scope creep.

## Caching & Headers
- Badge route (`/u/[handle]/badge.svg`):
  - Cache hit / normal success: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`
  - Error path: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`
  - Materialize-deadline background-continuation path (#1086, stale-SVG-served-while-warming): `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
  - `Server-Timing` header present on every response (`cache`/`materialize`/`render`/`total` breakdown per CLAUDE.md's latency SLO spec).
- All three cache-header variants match the documented latency SLO design (#974, #1086) — no drift found.

## Fonts & CLS
- Fonts loaded via `next/font/google` (`JetBrains_Mono`, `Plus_Jakarta_Sans`) in `app/layout.tsx` — **0 external font requests**, no render-blocking `<link>` tags to Google Fonts CDN.
- `prefers-reduced-motion` media query present in `styles/globals.css` (2 occurrences).
- Both non-Next-`<Image>` `<img>` tags in production code have explicit `width`/`height`: the share-page badge SVG fallback (`app/u/[handle]/page.tsx`, 1200×630) and the YouTube lite-embed thumbnail (`components/LiteYouTubeEmbed.tsx`, 480×270). No CLS risk found from unsized images.

## Recommendations
No action items this cycle. Bundle, client/server boundary, caching, fonts, and CLS all measure clean. Continue treating **2,013.6 KB raw / 644.1 KB gzip / 73 chunks** (HEAD `5a45569f`) as the canonical reference point for the next cycle.

---

SHARED_CONTEXT_START
## Performance Agent — 2026-08-20
- **Status**: GREEN
- Total First Load JS: 2,013.6 KB raw / 644.1 KB gzip (73 chunks)
- Routes >500KB: 0
- Unused exports: 0

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths surfaced. 90 app-code commits landed since the last performance cycle (2026-08-13) — mostly i18n locale-coherence fixes, campaign-stats aggregation, and badge/verification attestation renewal — worth a coverage spot-check on `fix(verification): persist refreshed badge attestations` / `fix(verification): renew expired badge records` if not already covered, since they touch the verification record persistence path.
- [Security]: No performance issues with security implications this cycle. Badge cache headers unchanged and confirmed matching the documented three-variant SLO design (normal/error/background-continuation).
- [QA]: No CLS regressions — both non-Next `<img>` tags in production code carry explicit width/height. Fonts unchanged, zero external font requests.
- [Cost Analyst]: Bundle grew modestly to **2,013.6 KB raw / 644.1 KB gzip / 73 chunks**, up ~15 KB raw / ~5 KB gzip from the 2026-08-13 baseline (1,999/639) despite 90 intervening app-code commits — treat this as the new canonical reference point (HEAD `5a45569f`) rather than the prior one. Note: Next.js 16.2.11's Turbopack build no longer prints a First Load JS size table in route output; future cycles must measure directly from `.next/static/chunks/*.js` (per-chunk gzip sum, not concatenate-then-gzip) as done here.
SHARED_CONTEXT_END
