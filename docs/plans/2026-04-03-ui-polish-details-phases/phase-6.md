# Phase 6: Icon Transition Animations [batch-eligible]

## Goal

Replace instant icon swaps with smooth opacity/scale transitions on CopyButton, ThemeToggle, QuickControls chevron toggle, and DimensionCard expand chevron.

## Why

Icons that snap between states feel abrupt. A quick cross-fade with slight scale creates a polished, intentional feel. The transition duration (150-200ms) is fast enough that it never feels slow, but visible enough to register as smooth. This is one of the most frequently noticed micro-interactions — users click copy, toggle themes, and expand panels constantly.

## Design Decisions

- **Technique:** Instead of conditionally rendering two different SVGs (which unmounts one and mounts another, making CSS transitions impossible), render both icons always and use opacity/scale to show/hide them. This is a common pattern for animated icon swaps.
- **Duration:** 150ms for opacity, 200ms for scale — matches existing `transition-colors` durations in the codebase.
- **No new dependencies.** Pure CSS transitions on always-rendered elements.

## Files to Modify

### 1. `apps/web/components/CopyButton.tsx`

Current pattern: conditional `{copied ? <CheckSVG /> : <CopySVG />}` — instant swap.

New pattern: render both SVGs in a relative container, use absolute positioning + opacity/scale to transition between them.

```tsx
// Both icons rendered, positioned absolutely within the button
<button ...className="...relative">
  <span aria-live="polite" className="sr-only">{copied ? "Copied!" : "Copy"}</span>
  <span className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ${
    copied ? "opacity-0 scale-75" : "opacity-100 scale-100"
  }`}>
    <svg /* copy icon */ />
  </span>
  <span className={`flex items-center justify-center transition-all duration-150 ${
    copied ? "opacity-100 scale-100" : "opacity-0 scale-75"
  }`}>
    <svg /* check icon */ />
  </span>
</button>
```

The checkmark icon is in normal flow (sets the button size). The copy icon is absolute. When `copied` toggles, they cross-fade.

### 2. `apps/web/components/ThemeToggle.tsx`

Same pattern — render both sun and moon SVGs, cross-fade based on `isDark` state.

```tsx
<button ...className="...relative overflow-hidden">
  <span className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ${
    isDark ? "opacity-100 scale-100" : "opacity-0 scale-75"
  }`}>
    <svg /* sun icon (shown in dark mode → switches to light) */ />
  </span>
  <span className={`flex items-center justify-center transition-all duration-150 ${
    isDark ? "opacity-0 scale-75" : "opacity-100 scale-100"
  }`}>
    <svg /* moon icon (shown in light mode → switches to dark) */ />
  </span>
</button>
```

### 3. `apps/web/components/dashboard/DimensionCard.tsx`

**Line 232-249** — the expand/collapse chevron already has `transition-transform duration-200` and `rotate-180`. This is already correct — it's a CSS transition, not a swap. **Verify it works and move on.**

### 4. `apps/web/app/studio/QuickControls.tsx`

**Lines 42 and 58** — the toggle button switches between a `+` icon and a `chevron-up` icon. These are different icons, so use the same cross-fade pattern as CopyButton.

The collapsed state shows `+` (plus icon). The expanded state shows `↑` (chevron up). Cross-fade between them.

## Tests

### `apps/web/components/CopyButton.test.tsx`

```
it("renders both icon states for CSS transition (not conditional mount)", () => {
  // Both SVGs should be present in source — opacity controls visibility
  const svgCount = (SOURCE.match(/<svg/g) || []).length;
  expect(svgCount).toBeGreaterThanOrEqual(2);
  expect(SOURCE).toContain("transition-all duration-150");
});

it("uses opacity and scale for icon cross-fade", () => {
  expect(SOURCE).toContain("opacity-0 scale-75");
  expect(SOURCE).toContain("opacity-100 scale-100");
});
```

### `apps/web/components/ThemeToggle.test.tsx`

```
it("renders both theme icons for CSS cross-fade transition", () => {
  const svgCount = (SOURCE.match(/<svg/g) || []).length;
  expect(svgCount).toBeGreaterThanOrEqual(2);
  expect(SOURCE).toContain("transition-all duration-150");
});
```

### `apps/web/app/studio/QuickControls.render.test.tsx`

```
it("toggle button icons use cross-fade transition", () => {
  expect(SOURCE).toContain("transition-all duration-150");
});
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run lint` passes

### Manual
- [ ] Click copy button on share page — checkmark fades in smoothly with slight scale
- [ ] After 2s, copy icon fades back in
- [ ] Toggle theme — icons cross-fade, no flash of missing icon
- [ ] Expand/collapse QuickControls — icon smoothly transitions
- [ ] DimensionCard chevron rotates smoothly (already working, verify)
- [ ] No layout shift during any icon transition
