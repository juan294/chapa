# Phase 8: QuickControls Smooth Expand/Collapse [batch-eligible]

## Goal

Add a smooth height transition to the QuickControls category expand/collapse so it animates instead of instantly showing/hiding content.

## Why

Currently, clicking a QuickControls category header instantly shows or hides the options panel. This feels abrupt compared to the rest of the UI which has enter animations. A smooth height transition using `grid-template-rows` (the modern CSS approach for animating to/from `auto` height) makes it feel polished and interruptible.

## Design Decision: grid-template-rows

The `max-height` approach requires guessing a max value and causes visible timing mismatches. The `grid-template-rows: 0fr` → `1fr` technique animates to the element's natural height with correct timing. It's interruptible (CSS transition, not keyframe animation) and works in all modern browsers.

## Files to Modify

### 1. `apps/web/styles/globals.css`

Add utility classes:

```css
/* ── Collapsible panel (grid-row height transition) ─── */

.collapse-grid {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s ease-out;
}

.collapse-grid[data-expanded="true"] {
  grid-template-rows: 1fr;
}

.collapse-grid > * {
  overflow: hidden;
}
```

### 2. `apps/web/app/studio/QuickControls.tsx`

Replace the instant `{isExpanded && (...)}` conditional with a persistent `div` that uses the grid collapse pattern:

**Current pattern (line 103-119):**
```tsx
{isExpanded && (
  <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
    {category.options.map(/* ... */)}
  </div>
)}
```

**New pattern:**
```tsx
<div
  className="collapse-grid"
  data-expanded={isExpanded}
>
  <div>
    <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
      {category.options.map(/* ... */)}
    </div>
  </div>
</div>
```

The outer `div.collapse-grid` controls the height. The middle `div` has `overflow: hidden` (from the CSS rule). The inner `div` contains the actual content at its natural height.

**Important:** The options are now always in the DOM (just collapsed to 0 height). This is fine for a small number of option buttons per category.

## Tests

### `apps/web/app/studio/QuickControls.render.test.tsx`

```
it("category options use collapse-grid for smooth height transition", () => {
  expect(SOURCE).toContain("collapse-grid");
  expect(SOURCE).toContain('data-expanded');
});
```

### `apps/web/styles/globals.css` (source-level)
```
it("defines collapse-grid utility for smooth expand/collapse", () => {
  expect(GLOBALS_CSS).toContain(".collapse-grid");
  expect(GLOBALS_CSS).toContain("grid-template-rows");
});
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run lint` passes

### Manual
- [ ] Open a QuickControls category → options slide down smoothly over ~200ms
- [ ] Close it → options slide up smoothly
- [ ] Rapid toggle → animation interrupts cleanly (transition, not keyframe)
- [ ] Switch between categories → previous one collapses while new one expands
- [ ] Content inside collapsed panels is not visible (overflow: hidden)
- [ ] `prefers-reduced-motion: reduce` → transition is instant
