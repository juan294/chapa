# Phase 3: Badge Loading Skeleton `[batch-eligible]`

> **Files**: 2 (1 new component, 1 modified)
> **Estimated tests**: 0 (visual-only, no logic)
> **Dependencies**: None

## Goal

When the share page can't inline the badge SVG (stats fetch failed during ISR, or ISR
cache is stale), it falls back to an `<img>` tag that loads `/u/:handle/badge.svg`.
During that load, users see a blank white card. Replace it with an animated skeleton
that matches the badge layout so the page feels responsive.

## Changes

### 1. New file: `apps/web/components/BadgeSkeleton.tsx`

A lightweight skeleton placeholder that approximates the badge layout. Uses the existing
design system tokens — no new colors or animations needed.

```pseudo
// BadgeSkeleton — pure presentational, no props needed
// Matches badge dimensions: 1200×630 aspect ratio (via aspect-[1200/630])
// Uses existing animate-shimmer class from globals.css

export function BadgeSkeleton() {
  return (
    <div
      role="img"
      aria-label="Loading badge..."
      className="w-full aspect-[1200/630] rounded-xl bg-card overflow-hidden"
    >
      {/* Shimmer overlay */}
      <div className="h-full w-full animate-shimmer bg-gradient-to-r
        from-transparent via-stroke/30 to-transparent" />

      {/* Structural hints — faint shapes matching badge layout */}
      <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none">
        {/* Top: avatar + name */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-stroke/20" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-stroke/20" />
            <div className="h-3 w-24 rounded bg-stroke/15" />
          </div>
        </div>

        {/* Bottom: score circle hint */}
        <div className="flex justify-end">
          <div className="w-20 h-20 rounded-full bg-stroke/15" />
        </div>
      </div>
    </div>
  );
}
```

**Design notes:**
- Uses `animate-shimmer` (already defined in `globals.css`)
- Uses `bg-stroke/20` and `bg-stroke/15` for skeleton shapes (purple-tinted, on-brand)
- `aspect-[1200/630]` maintains badge proportions, prevents layout shift
- `role="img" aria-label="Loading badge..."` for accessibility
- No JavaScript state — pure CSS animation
- Works in both light and dark themes (stroke token adapts)

### 2. Modify: `apps/web/app/u/[handle]/page.tsx`

Wrap the `<img>` fallback with the skeleton as a loading state.

```diff
+ import { BadgeSkeleton } from "@/components/BadgeSkeleton";

  // Lines 239-249: replace the bare <img> fallback
  {inlineSvg ? (
    <div
      role="img"
      aria-label={`Chapa badge for ${handle}`}
      className="w-full rounded-xl overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
      dangerouslySetInnerHTML={{ __html: inlineSvg }}
    />
  ) : (
-   /* eslint-disable-next-line @next/next/no-img-element */
-   <img
-     src={`/u/${encodeURIComponent(handle)}/badge.svg?v=${encodeURIComponent(badgeCacheBuster)}`}
-     alt={`Chapa badge for ${handle}`}
-     width={1200}
-     height={630}
-     fetchPriority="high"
-     className="w-full rounded-xl"
-   />
+   <div className="relative">
+     <BadgeSkeleton />
+     {/* eslint-disable-next-line @next/next/no-img-element */}
+     <img
+       src={`/u/${encodeURIComponent(handle)}/badge.svg?v=${encodeURIComponent(badgeCacheBuster)}`}
+       alt={`Chapa badge for ${handle}`}
+       width={1200}
+       height={630}
+       fetchPriority="high"
+       className="w-full rounded-xl absolute inset-0"
+       onLoad="this.parentElement.querySelector('[role=img]')?.remove()"
+     />
+   </div>
  )}
```

**How it works:**
- Skeleton renders immediately (visible while `<img>` loads)
- `<img>` is positioned absolutely on top of the skeleton
- When the image loads, the inline `onLoad` removes the skeleton
- If the image fails to load, skeleton remains (better than blank)
- No React state needed — pure HTML/CSS with a tiny inline handler

**Note on `onLoad` string handler:**
This is a Server Component (no `"use client"`). React Server Components don't support
`onClick`/`onLoad` as functions. The inline string handler is the minimal approach —
it only removes the skeleton div, no security concern (no user input involved).

If the inline handler approach is not acceptable in review, an alternative is to extract
the fallback into a tiny `"use client"` component with `useState` for load tracking.
This adds a client bundle but gives clean React event handling.

## Design decisions

**Why not use `<Suspense>` / streaming?**
The share page uses ISR (`export const revalidate = 3600`), not streaming. The badge
data is fetched during SSR — if it succeeds, the SVG is inlined. The `<img>` fallback
only activates when SSR data fetch fails. Suspense doesn't help here because the
decision is made server-side before streaming.

**Why not a loading.tsx?**
A `loading.tsx` at `app/u/[handle]/loading.tsx` would show during the entire page load
(navigation to the share page). That's a different concern — the skeleton here is
specifically for the badge image within the already-loaded page.

**Why position:absolute overlay instead of state-based show/hide?**
Server Component — no `useState`. The overlay approach works without client JS. The
skeleton disappears instantly when the image paints (no flash/flicker).

## Success criteria

### Automated
- [ ] Type check passes: `pnpm run typecheck`
- [ ] Lint passes: `pnpm run lint`
- [ ] Build passes: `pnpm run build`
- [ ] No layout shift: skeleton matches badge aspect ratio (1200/630)

### Manual
- [ ] Visit a share page where stats fetch fails (e.g., non-existent handle) — skeleton should render
- [ ] Visit a share page with cold cache — skeleton visible briefly, then badge appears
- [ ] Skeleton looks correct in both light and dark themes
