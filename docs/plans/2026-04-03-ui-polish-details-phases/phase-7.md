# Phase 7: Exit Animations (useAnimatedUnmount Hook + Components)

## Goal

Create a reusable `useAnimatedUnmount` hook that delays component unmounting until an exit animation completes, then apply it to dropdowns and overlays that currently vanish instantly.

## Why

Chapa has enter animations on most menus (`animate-scale-in`, `animate-terminal-fade-in`) but when they close, elements pop out of existence. The article recommends subtle exits: small Y movement, opacity fade, and optional blur over ~200-300ms. This creates a sense of intentional direction rather than abrupt removal.

## Part A: The Hook

### New file: `apps/web/hooks/useAnimatedUnmount.ts`

```tsx
import { useState, useEffect, useCallback } from "react";

/**
 * Delays unmounting until an exit animation completes.
 *
 * @param isOpen - The logical open/closed state from the parent
 * @param duration - Exit animation duration in ms (default: 200)
 * @returns { shouldRender, isAnimatingOut }
 *   - shouldRender: true while the component should be in the DOM
 *   - isAnimatingOut: true during the exit phase (apply exit animation classes)
 */
export function useAnimatedUnmount(isOpen: boolean, duration = 200) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Opening: render immediately, clear any exit state
      setShouldRender(true);
      setIsAnimatingOut(false);
    } else if (shouldRender) {
      // Closing: start exit animation, then unmount after duration
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsAnimatingOut(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration]); // shouldRender intentionally excluded

  return { shouldRender, isAnimatingOut };
}
```

### Test: `apps/web/hooks/useAnimatedUnmount.test.ts`

```tsx
// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { useAnimatedUnmount } from "./useAnimatedUnmount";

describe("useAnimatedUnmount", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("shouldRender is true when isOpen is true", () => {
    const { result } = renderHook(() => useAnimatedUnmount(true));
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isAnimatingOut).toBe(false);
  });

  it("shouldRender stays true during exit animation", () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useAnimatedUnmount(isOpen, 200),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: false });
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isAnimatingOut).toBe(true);
  });

  it("shouldRender becomes false after duration elapses", () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useAnimatedUnmount(isOpen, 200),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: false });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.shouldRender).toBe(false);
    expect(result.current.isAnimatingOut).toBe(false);
  });

  it("re-opening during exit cancels the unmount", () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useAnimatedUnmount(isOpen, 200),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: false }); // start closing
    act(() => { vi.advanceTimersByTime(100); }); // halfway through
    rerender({ isOpen: true }); // re-open before exit completes
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isAnimatingOut).toBe(false);
    act(() => { vi.advanceTimersByTime(200); }); // timer would have fired
    expect(result.current.shouldRender).toBe(true); // still open
  });
});
```

## Part B: Exit Animation Keyframe

### `apps/web/styles/globals.css`

Add a new keyframe and utility class:

```css
@keyframes fade-out-up {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

.animate-fade-out-up {
  animation: fade-out-up 0.2s ease-in forwards;
}
```

## Part C: Apply to Components

### 1. `apps/web/components/UserMenu.tsx`

Import hook, use it to manage dropdown lifecycle:

```tsx
import { useAnimatedUnmount } from "@/hooks/useAnimatedUnmount";

// Inside component:
const { shouldRender: showDropdown, isAnimatingOut: dropdownExiting } =
  useAnimatedUnmount(open, 200);

// Replace: {open && (<div ...>)}
// With:    {showDropdown && (<div className={`... ${dropdownExiting ? "animate-fade-out-up" : "animate-scale-in"}`}>)}
```

### 2. `apps/web/components/BadgeToolbar.tsx`

Same pattern for the share dropdown:

```tsx
const { shouldRender: showShare, isAnimatingOut: shareExiting } =
  useAnimatedUnmount(shareOpen, 200);

// Replace: {shareOpen && (<div ...>)}
// With:    {showShare && (<div className={`... ${shareExiting ? "animate-fade-out-up" : "animate-terminal-fade-in"}`}>)}
```

### 3. `apps/web/components/terminal/AutocompleteDropdown.tsx`

The dropdown already has a `visible` prop. Use the hook internally:

```tsx
const { shouldRender, isAnimatingOut } = useAnimatedUnmount(visible, 150);

// Change the early return:
// BEFORE: if (!visible || matching.length === 0) return null;
// AFTER:  if (!shouldRender || matching.length === 0) return null;

// Add animation class to the container:
// className={`... ${isAnimatingOut ? "animate-fade-out-up" : "animate-terminal-fade-in"}`}
```

### 4. `apps/web/app/studio/QuickControls.tsx`

The component has two states: collapsed (shows button) and expanded (shows full panel). The transition between them should animate. Use the hook on the expanded content:

```tsx
const { shouldRender: showPanel, isAnimatingOut: panelExiting } =
  useAnimatedUnmount(visible, 150);

// The expanded panel content gets: isAnimatingOut ? "animate-fade-out-up" : "animate-terminal-fade-in"
```

## Tests

Hook tests are in Part A above. Component tests verify integration:

### `apps/web/components/UserMenu.test.tsx` (source-level)
```
it("imports useAnimatedUnmount for exit animation", () => {
  expect(SOURCE).toContain("useAnimatedUnmount");
});

it("applies animate-fade-out-up during dropdown exit", () => {
  expect(SOURCE).toContain("animate-fade-out-up");
});
```

### `apps/web/components/BadgeToolbar.test.tsx` (source-level)
```
it("uses useAnimatedUnmount for share dropdown exit animation", () => {
  expect(SOURCE).toContain("useAnimatedUnmount");
});
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes (hook tests + component source assertions)
- [ ] `pnpm run lint` passes

### Manual
- [ ] Open UserMenu → close it → dropdown slides up and fades out over ~200ms
- [ ] Open BadgeToolbar share dropdown → close → smooth exit
- [ ] Type `/` in terminal input → autocomplete appears → press Escape → smooth exit
- [ ] Toggle QuickControls → panel fades out smoothly on collapse
- [ ] Rapid toggle (open-close-open quickly) → no broken state, animation interrupts cleanly
- [ ] `prefers-reduced-motion: reduce` → exit animations are instant (covered by global rule)
