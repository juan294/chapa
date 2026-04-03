# Phase 1: Tabular Numbers on Public-Facing Scores [batch-eligible]

## Goal

Add `tabular-nums` to all numeric score displays on user-facing pages. This prevents digit-width jitter during animated counting and keeps number columns visually aligned.

## Why

The admin tables already use `tabular-nums` consistently, but the public-facing score displays — the ones users actually see — don't. When `useAnimatedCounter` counts from 0 to a score, digits shift width (e.g., "1" is narrower than "8"), causing visible horizontal jitter. `tabular-nums` makes all digits equal width, producing smooth, stable counter animations.

## Files to Modify

### 1. `apps/web/components/dashboard/DimensionCard.tsx`

**Line 181** — the animated score display:
```
BEFORE: <span className="font-heading text-3xl font-extrabold text-text-primary">
AFTER:  <span className="font-heading text-3xl font-extrabold text-text-primary tabular-nums">
```

### 2. `apps/web/components/dashboard/DeltaIndicator.tsx`

**Line 47** — the delta value display:
```
BEFORE: <span className="font-heading">{displayValue}</span>
AFTER:  <span className="font-heading tabular-nums">{displayValue}</span>
```

### 3. `apps/web/components/ImpactBreakdown.tsx`

**Line 265** — dimension score in breakdown cards:
```
BEFORE: <span className="font-heading text-3xl font-extrabold text-text-primary leading-none">
AFTER:  <span className="font-heading text-3xl font-extrabold text-text-primary leading-none tabular-nums">
```

**Line 314** — stat values in the stats grid:
```
BEFORE: <div className="font-heading text-2xl font-extrabold text-text-primary leading-none">
AFTER:  <div className="font-heading text-2xl font-extrabold text-text-primary leading-none tabular-nums">
```

### 4. `apps/web/app/page.tsx`

**Line 403** — the stats section numbers on landing page:
```
BEFORE: <span className="text-3xl sm:text-4xl tracking-tight text-amber">
AFTER:  <span className="text-3xl sm:text-4xl tracking-tight text-amber tabular-nums">
```

## Tests

Add to existing test files:

### `apps/web/components/dashboard/DimensionCard.test.tsx`
```
it("score display uses tabular-nums for stable counter animation", () => {
  // Source-level assertion matching existing test patterns
  expect(SOURCE).toContain("tabular-nums");
});
```

### `apps/web/components/ImpactBreakdown.test.tsx`
```
it("dimension scores use tabular-nums", () => {
  expect(SOURCE).toContain("tabular-nums");
});
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes (all existing + new assertions)
- [ ] `pnpm run lint` passes

### Manual
- [ ] Visit `/u/{handle}` — score counter animation is smooth without horizontal jitter
- [ ] DeltaIndicator values (+3, -5, etc.) don't shift width
- [ ] Landing page stats section numbers are aligned
