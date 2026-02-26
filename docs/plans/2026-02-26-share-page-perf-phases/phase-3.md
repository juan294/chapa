# Phase 3: Lazy-Load GlobalCommandBar

> **Impact**: ~50KB less initial JS on share page, faster TTI
> **Files modified**: `apps/web/app/u/[handle]/page.tsx`
> **Risk**: Very low — deferred loading of non-critical UI

## Rationale

`GlobalCommandBar` is a `"use client"` component that renders a fixed-bottom terminal bar with autocomplete, command registry, router integration, and a typewriter animation. It's interactive but not needed for the initial page view or LCP.

Currently it's imported eagerly:
```typescript
// page.tsx:14
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
```

This forces Next.js to include all its dependencies (TerminalInput, TerminalOutput, AutocompleteDropdown, command-registry, AuthorTypewriter) in the initial page JS bundle.

## Changes

### 1. Create lazy wrapper in `page.tsx`

Replace the static import with a dynamic one:

```typescript
// BEFORE (page.tsx:14):
import { GlobalCommandBar } from "@/components/GlobalCommandBar";

// AFTER:
import dynamic from "next/dynamic";

const GlobalCommandBarLazy = dynamic(
  () => import("@/components/GlobalCommandBar").then(m => ({ default: m.GlobalCommandBar })),
  { ssr: false }
);
```

### 2. Update usage (line 335)

```tsx
// BEFORE:
<GlobalCommandBar />

// AFTER:
<GlobalCommandBarLazy />
```

## Why `ssr: false`

The GlobalCommandBar:
- Uses `useRouter()`, `useState`, `useCallback`, `useRef` — all client-only hooks
- Queries the DOM directly (`document.querySelector`)
- Dispatches browser events (`window.dispatchEvent`)
- Has no meaningful server-rendered HTML (it's a fixed-bottom overlay)

Setting `ssr: false` means:
- Zero HTML emitted for the command bar during SSR → smaller initial HTML
- JS chunk loads asynchronously after page hydration
- Command bar appears after a brief delay (~200ms on fast connections) — acceptable for a non-critical UI element

## No Loading Placeholder Needed

The command bar is a fixed-bottom overlay that doesn't affect layout or CLS. It simply appears when ready. No loading placeholder is necessary.

## Tests

### Existing tests should still pass

The GlobalCommandBar's own tests (`GlobalCommandBar.test.tsx` if it exists) are unaffected — the component itself doesn't change, only how it's imported on the share page.

### New assertion in share page test

Add to the share page test:
- Assert that the rendered output does NOT include `GlobalCommandBar` markup in the server-rendered HTML (since `ssr: false` prevents it)

## Verification

```bash
# Automated
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test 2>&1

# Manual: check bundle impact
# 1. Build with ANALYZE=true: ANALYZE=true pnpm run build
# 2. Compare the /u/[handle] route's First Load JS before and after
# 3. Expected reduction: ~30–50KB
```

## Future Consideration

If the GlobalCommandBar is lazy-loaded on the share page, consider doing the same on other pages that use it (e.g., `/admin`). This would be a separate, small follow-up task — not part of this plan.
