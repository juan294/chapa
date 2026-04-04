# Phase 5: Layered Shadows on Data Cards

> **Depends on:** Phase 4 (shadow tokens must be defined first)

## Goal

Replace `border border-stroke` with `shadow-card` on data-display components. Add `transition-shadow hover:shadow-card-hover` for interactive cards. Keep `border border-stroke` on terminal-aesthetic components.

## Why

Layered shadows add perceived depth and quality. The first shadow layer (1px ring) functionally replaces the border, so we remove the explicit border to avoid doubling. The hover elevation creates a tactile "lift" effect that feels responsive.

## Components to Update

### Components that GET shadow-card (replace border):

| Component | File | What changes |
|-----------|------|-------------|
| DimensionCard | `components/dashboard/DimensionCard.tsx` | Replace `border border-stroke` with `shadow-card`, add `transition-shadow hover:shadow-card-hover` |
| ImpactBreakdown dimension cards | `components/ImpactBreakdown.tsx` | Replace `border border-stroke` on dimension cards and stat grid items |
| Toast | `components/Toast.tsx` | Replace `border border-stroke` with `shadow-card` |
| InfoTooltip | `components/InfoTooltip.tsx` | Replace `border border-stroke` with `shadow-card` |
| BadgeToolbar dropdown | `components/BadgeToolbar.tsx` | Replace `border border-stroke` with `shadow-card` |
| UserMenu dropdown | `components/UserMenu.tsx` | Replace `border border-stroke` on dropdown panel with `shadow-card` |

### Components that KEEP border border-stroke (terminal aesthetic):

- `TerminalInput`, `TerminalOutput` — terminal chrome
- `GlobalCommandBar` — terminal command bar
- `Navbar` — top border-b is terminal style
- `AutocompleteDropdown` — terminal listbox
- Embed snippet code blocks (in `page.tsx` and `SharePageOwnerContent.tsx`) — these have terminal dots and monospace code
- `QuickControls` — terminal panel borders

## Detailed Changes

### 1. `apps/web/components/dashboard/DimensionCard.tsx`

**Line 170:**
```
BEFORE: className={`rounded-xl border border-stroke bg-card transition-colors duration-200 hover:border-amber/20 animate-fade-in-up ${className}`}
AFTER:  className={`rounded-xl bg-card shadow-card transition-shadow duration-200 hover:shadow-card-hover animate-fade-in-up ${className}`}
```

Note: The expanded panel border-t (`line 252`) stays as `border-t border-stroke` — it's an internal divider, not a card border.

### 2. `apps/web/components/ImpactBreakdown.tsx`

**Line 254** — dimension cards:
```
BEFORE: className="rounded-xl border border-stroke bg-card p-4 animate-fade-in-up relative hover:z-10 focus-within:z-10"
AFTER:  className="rounded-xl bg-card shadow-card p-4 animate-fade-in-up relative hover:z-10 focus-within:z-10 transition-shadow hover:shadow-card-hover"
```

**Line 311** — stat grid items:
```
BEFORE: className="rounded-xl border border-stroke bg-card px-3 py-4 text-center animate-fade-in-up relative hover:z-10 focus-within:z-10"
AFTER:  className="rounded-xl bg-card shadow-card px-3 py-4 text-center animate-fade-in-up relative hover:z-10 focus-within:z-10 transition-shadow hover:shadow-card-hover"
```

**Line 229** — empty state (keep border — it's not a data card):
No change.

### 3. `apps/web/components/Toast.tsx`

**Line 122:**
```
BEFORE: rounded-xl border border-stroke bg-card px-4 py-3
        shadow-xl shadow-stroke/20 backdrop-blur-sm
AFTER:  rounded-xl bg-card px-4 py-3
        shadow-card backdrop-blur-sm
```

### 4. `apps/web/components/InfoTooltip.tsx`

**Line 84:**
```
BEFORE: className="fixed z-[9999] w-max max-w-[240px] rounded-lg bg-card/95 backdrop-blur-xl border border-stroke shadow-lg p-3 ...
AFTER:  className="fixed z-[9999] w-max max-w-[240px] rounded-lg bg-card/95 backdrop-blur-xl shadow-card p-3 ...
```

### 5. `apps/web/components/BadgeToolbar.tsx`

**Line 204:**
```
BEFORE: className="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 min-w-[140px] rounded-xl border border-stroke bg-card shadow-xl shadow-black/20 p-1.5 z-20 animate-terminal-fade-in"
AFTER:  className="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 min-w-[140px] rounded-xl bg-card shadow-card p-1.5 z-20 animate-terminal-fade-in"
```

### 6. `apps/web/components/UserMenu.tsx`

**Line 240** — dropdown panel:
```
BEFORE: className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-stroke bg-card shadow-xl shadow-stroke animate-scale-in"
AFTER:  className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-card shadow-card animate-scale-in"
```

Note: Internal dividers (`border-t border-stroke` on lines 432, 500) stay unchanged — they separate menu sections.

## Tests

Update existing test files with source-level assertions:

### `apps/web/components/dashboard/DimensionCard.test.tsx`
```
it("uses shadow-card instead of border for card elevation", () => {
  expect(SOURCE).toContain("shadow-card");
  // Ensure we're not double-bordering the card container
  expect(SOURCE).not.toMatch(/border border-stroke.*bg-card.*rounded-xl/);
});
```

### `apps/web/components/ImpactBreakdown.test.tsx`
```
it("dimension cards use shadow-card for elevation", () => {
  expect(SOURCE).toContain("shadow-card");
});
```

### `apps/web/components/Toast.test.tsx`
```
it("uses shadow-card for toast elevation", () => {
  expect(SOURCE).toContain("shadow-card");
});
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run lint` passes

### Manual
- [ ] DimensionCards on share page show subtle shadow instead of hard border
- [ ] Hovering DimensionCard shows elevated shadow
- [ ] ImpactBreakdown dimension and stat cards have shadow treatment
- [ ] Toast notifications have clean shadow (not double-bordered)
- [ ] UserMenu dropdown has shadow elevation
- [ ] BadgeToolbar share dropdown has shadow elevation
- [ ] InfoTooltip has clean shadow
- [ ] Light mode: shadows are subtle and warm
- [ ] Dark mode: shadows use purple-tinted ring with deeper elevation
- [ ] Terminal components (embed code blocks, nav, command bar) still have sharp borders
