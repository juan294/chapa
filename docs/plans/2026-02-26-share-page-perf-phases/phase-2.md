# Phase 2: Loading Skeleton

> **Impact**: Immediate FCP (~0s) — browser shows skeleton instantly while SSR runs
> **Files created**: `apps/web/app/u/[handle]/loading.tsx`
> **Risk**: None — purely additive, no existing code changes

## How It Works

Next.js App Router automatically wraps the page component in a `<Suspense>` boundary. When the page is an async server component (which ours is), Next.js streams the `loading.tsx` fallback immediately while the page's async work completes.

**Before**: Browser shows blank white page for ~2–3s while SSR fetches data.
**After**: Browser immediately shows a skeleton that mirrors the page layout, then swaps in real content.

## Skeleton Layout

The skeleton should mirror the share page structure:

```
┌──────────────────────────────────────┐
│  [Navbar placeholder]                 │  ← height matches real navbar
├──────────────────────────────────────┤
│                                      │
│  [Section title placeholder]         │  ← "Your Impact, Decoded" area
│                                      │
│  ┌──────────────────────────────┐    │
│  │                              │    │  ← Badge area (aspect-ratio 1200/630)
│  │    [Pulsing placeholder]     │    │     Rounded, border, animate-pulse
│  │                              │    │
│  └──────────────────────────────┘    │
│                                      │
│  [Toolbar placeholder row]           │  ← Small pill shapes, right-aligned
│                                      │
│  ────────────────────────────────    │  ← Divider
│                                      │
│  [Breakdown cards placeholder]       │  ← 2x2 grid of pulsing cards
│                                      │
└──────────────────────────────────────┘
```

## Implementation

### Create `apps/web/app/u/[handle]/loading.tsx`

```tsx
export default function SharePageLoading() {
  return (
    <main className="min-h-screen bg-bg">
      {/* Navbar skeleton */}
      <div className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-stroke bg-bg/80 backdrop-blur-xl" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-16 sm:pt-24 sm:pb-24">
        {/* Section title skeleton */}
        <div className="h-4 w-40 rounded bg-card animate-pulse mb-4" />

        {/* Badge skeleton (matches 1200:630 aspect ratio) */}
        <div className="mb-4">
          <div
            className="rounded-2xl border border-stroke bg-card p-4 shadow-lg shadow-amber/5"
          >
            <div
              className="w-full rounded-xl bg-dark-card animate-pulse"
              style={{ aspectRatio: "1200 / 630" }}
            />
          </div>
        </div>

        {/* Toolbar skeleton */}
        <div className="flex justify-end mb-10 gap-2">
          <div className="h-[44px] w-20 rounded-lg bg-card animate-pulse" />
          <div className="h-[44px] w-20 rounded-lg bg-card animate-pulse" />
          <div className="h-[44px] w-24 rounded-lg bg-card animate-pulse" />
        </div>

        {/* Divider */}
        <hr className="border-stroke mb-10" />

        {/* Breakdown section title skeleton */}
        <div className="h-4 w-36 rounded bg-card animate-pulse mb-8" />

        {/* Archetype skeleton */}
        <div className="mb-12">
          <div className="h-9 w-48 rounded bg-card animate-pulse mb-2" />
          <div className="h-4 w-80 rounded bg-card animate-pulse" />
        </div>

        {/* Dimension cards skeleton (2x2 grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-stroke bg-card animate-pulse"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
```

## Design Choices

- **Server component** — no `"use client"`, zero JS shipped for the skeleton
- **Uses semantic tokens** (`bg-bg`, `bg-card`, `border-stroke`) — works in both light and dark themes
- **Aspect ratio matches badge** — `style={{ aspectRatio: "1200 / 630" }}` prevents CLS when real content loads
- **Shows breakdown section** — assumes the viewer is the owner (most common case). If they're not, the real page will hide it and there's no visual jank because the skeleton fades out.
- **`animate-pulse`** — standard Tailwind pulse animation, subtle and consistent

## Tests

### Test: `apps/web/app/u/[handle]/loading.test.tsx`

1. **Test: loading skeleton renders without errors**
   - Import and render `SharePageLoading`
   - Assert it returns valid JSX (no crashes)
   - Assert badge skeleton area exists with correct aspect ratio

2. **Test: no "use client" directive**
   - Read the file and assert it doesn't contain `"use client"`
   - (Ensures zero JS shipped for skeleton)

## Verification

```bash
# Automated
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test 2>&1

# Manual: throttle network in DevTools to see skeleton
# 1. Open Chrome DevTools → Network → Throttle to "Slow 3G"
# 2. Navigate to /u/juan294
# 3. Skeleton should appear instantly, then swap to real content
```
