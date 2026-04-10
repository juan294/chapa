# Coverage Report
> Generated: 2026-04-10 | Health status: yellow

## Executive Summary

Overall coverage holds at **93.14% statements / 89.87% branches / 90.00% functions** — a plateau versus yesterday. The `BadgeToolbar` flaky test re-confirmed at **2/3 runs** (P2, unresolved since 2026-04-09), rooted in unreliable async-chain draining in JSDOM. All critical scoring, rendering, API, and DB paths remain GREEN.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| lib/impact | 100% | 98.5% | 100% | GREEN |
| lib/render | 100% | 92.7% | 100% | GREEN |
| packages/shared | 100% | 100% | 100% | GREEN |
| lib/cache | 99.2% | 97.9% | 95.8% | GREEN |
| lib/history | 98.2% | 96.5% | 100% | GREEN |
| lib/auth | 98.1% | 96.4% | 100% | GREEN |
| lib/email | 97.9% | 96.7% | 100% | GREEN |
| app/api | 97.6% | 94.8% | 97.4% | GREEN |
| lib/db | 97.6% | 95.2% | 100% | GREEN |
| lib/github | 96.8% | 91.9% | 96.2% | GREEN |
| components | 95.9% | 90.2% | 93.9% | GREEN |
| lib/analytics | 100% | 90.9% | 100% | GREEN |
| lib/other | 97.3% | 92.9% | 97.4% | GREEN |
| app/admin | 94.9% | 92.0% | 91.4% | GREEN |
| app/pages | 73.5% | 68.9% | 72.7% | YELLOW (Next.js server pages — untestable) |

## Gaps & Recommendations

### P2 — Flaky Test (action required)

- **`components/BadgeToolbar.render.test.tsx`** — "strips SVG animations" failed **2/3** runs today. Root cause: `setTimeout(r, 0)` inside `act()` does not reliably drain the full async chain (`fetch → stripAnimations → Image.src → onerror → fallback`). Fix: replace with `flushPromises` helper at `BadgeToolbar.render.test.tsx:994`. Also fix post-unmount `setDownloadStatus("idle")` unhandled rejection at `BadgeToolbar.tsx:130` (add mounted-guard or `AbortController` cleanup).

### P3 — Branch gaps (accepted / low priority)

- **`lib/render/archetypeDemoData.ts`** — 50% branches. Null-coalescing arms (`?? []`) are never exercised. Only reachable if caller passes `undefined` for list fields — no real path. Accepted.
- **`lib/render/demoData.ts`** — 50% branches. Same pattern as above. Accepted.
- **`lib/render/svg-to-png.ts`** — 66.7% branches. Fallback error path (PNG generation failure) not exercised. Low risk — path is defensive.
- **`components/AuthorTypewriter.tsx`** — 67.5% branches. JSDOM timing limitation on animation callbacks. Accepted.
- **`lib/effects/backgrounds/ParticleBackground.tsx`** — 72.2% branch / 77.8% funcs. Canvas/WebGL APIs absent in JSDOM. Accepted.
- **`app/api/refresh/route.ts`** — 75% funcs. `updateCraftCache` fire-and-forget catch arrow uncovered. Fire-and-forget by design. Accepted.
- **`components/UserMenu.tsx`** — 79.3% funcs. `handleInsightsFile` complex event handler. Low priority.
- **`lib/analytics/server-errors.ts`** — 87.5% branches. PostHog `fetch()` at line 106 missing `AbortSignal.timeout(5000)`. P3 from cost analyst 2026-04-09 — Vercel timeout acts as backstop.

### Not actionable (Next.js server components)

- `app/admin/page.tsx` — 0% (async server component with `headers()` + `redirect()` — untestable in Vitest/JSDOM)
- `app/studio/page.tsx` — 0% (same pattern)
- `app/layout.tsx`, `app/apple-icon.tsx`, `app/icon.tsx` — 0% (static asset generators)
- All `app/experiments/**` pages — canvas/WebGL — accepted limitation

## Flaky Tests

- **`BadgeToolbar.render.test.tsx` > "strips @keyframes, animation properties, and SMIL animate elements"** — Failed 2/3 runs (high rate). Declared resolved 2026-04-08, re-emerged 2026-04-09, confirmed persistent today. Expected SVG `opacity="1"` not present due to unreliable microtask/macrotask draining in JSDOM. **P2 — requires fix.**
