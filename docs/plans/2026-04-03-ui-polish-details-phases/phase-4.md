# Phase 4: Layered Shadow Tokens

## Goal

Define reusable layered shadow CSS custom properties in `globals.css` for both light and dark themes. These replace flat `border border-stroke` on data cards (Phase 5 applies them). Also document in the design system.

## Why

The article advocates replacing flat borders with layered transparent shadows that adapt to any background. Three shadow layers create natural depth: a 1px "ring" shadow simulating a border, a subtle close shadow for definition, and a softer spread shadow for lift. Transparency means they work on both themes without color-matching.

This phase only defines the tokens — Phase 5 applies them to components.

## Files to Modify

### 1. `apps/web/styles/globals.css`

Add to the `:root` block (light theme values) after `--color-track`:

```css
  --shadow-card: 0px 0px 0px 1px rgba(0, 0, 0, 0.06),
                 0px 1px 2px -1px rgba(0, 0, 0, 0.06),
                 0px 2px 4px 0px rgba(0, 0, 0, 0.04);
  --shadow-card-hover: 0px 0px 0px 1px rgba(0, 0, 0, 0.08),
                       0px 2px 4px -1px rgba(0, 0, 0, 0.08),
                       0px 4px 8px 0px rgba(0, 0, 0, 0.06);
```

Add to the `[data-theme="dark"]` block:

```css
  --shadow-card: 0px 0px 0px 1px rgba(139, 92, 246, 0.08),
                 0px 1px 2px -1px rgba(0, 0, 0, 0.20),
                 0px 2px 4px 0px rgba(0, 0, 0, 0.15);
  --shadow-card-hover: 0px 0px 0px 1px rgba(139, 92, 246, 0.12),
                       0px 2px 4px -1px rgba(0, 0, 0, 0.25),
                       0px 4px 8px 0px rgba(0, 0, 0, 0.20);
```

Add to the `@theme` block so Tailwind generates utilities:

```css
  --shadow-card: 0px 0px 0px 1px rgba(0, 0, 0, 0.06),
                 0px 1px 2px -1px rgba(0, 0, 0, 0.06),
                 0px 2px 4px 0px rgba(0, 0, 0, 0.04);
  --shadow-card-hover: 0px 0px 0px 1px rgba(0, 0, 0, 0.08),
                       0px 2px 4px -1px rgba(0, 0, 0, 0.08),
                       0px 4px 8px 0px rgba(0, 0, 0, 0.06);
```

### 2. `docs/design-system.md`

Add a "Shadows" section after the "Colors" section:

```markdown
## Shadows

| Token | Usage | Tailwind class |
|-------|-------|----------------|
| `--shadow-card` | Default card/panel elevation | `shadow-card` |
| `--shadow-card-hover` | Hover state elevation | `shadow-card-hover` |

### Shadow rules

- Use `shadow-card` on data cards, dropdown menus, tooltips, and toasts. These replace `border border-stroke` on non-terminal components.
- Use `shadow-card-hover` as hover state via `hover:shadow-card-hover` with `transition-shadow`.
- Terminal-aesthetic components (TerminalInput, TerminalOutput, GlobalCommandBar, Navbar) keep `border border-stroke` — sharp lines are part of the terminal look.
- The first shadow layer (0px spread, 1px ring) replaces the border — don't combine `border` with `shadow-card`.
- Dark mode shadows use purple-tinted ring + deeper black spread.
```

## Tests

### Source-level assertion on `globals.css`
```
it("defines --shadow-card and --shadow-card-hover tokens", () => {
  expect(GLOBALS_CSS).toContain("--shadow-card:");
  expect(GLOBALS_CSS).toContain("--shadow-card-hover:");
});
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run build` passes (Tailwind generates `shadow-card` utility)
- [ ] `pnpm run test` passes
- [ ] `pnpm run lint` passes

### Manual
- [ ] None — this phase only defines tokens. Phase 5 applies and validates them visually.
