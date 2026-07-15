# Chapa Design System

This is the single source of truth for visual design decisions. All agents working on UI must follow these guidelines.

## Theme: Terminal Dark + Purple Accent (with Light Mode)

Bold, developer-tool aesthetic inspired by terminal UIs. The dark theme is the signature brand look, with purple (`#8B5CF6`) used sparingly for CTAs, highlights, and active states. Terminal-specific colors (green, red, yellow) for output types. A light theme is supported as an alternative, toggled via the `ThemeToggle` component in the nav bar. Badge SVG always renders in dark theme as an independent embeddable asset.

### Theme switching

- Powered by `next-themes` with `attribute="data-theme"` and `defaultTheme="light"`.
- `ThemeProvider` wraps the app in `layout.tsx`; `ThemeToggle` lives in the nav bar.
- All color tokens are CSS custom properties defined twice in `globals.css`: light values in `:root` and dark values in `[data-theme="dark"]`. Tailwind utilities (`bg-bg`, `text-text-primary`, etc.) resolve at runtime via `var()`.
- When adding new color tokens, always define both light and dark values.

## Colors

Defined in `apps/web/styles/globals.css` via Tailwind v4 `@theme`. Values shown below are the **dark** theme values; light equivalents are defined in `:root` (see `globals.css`).

| Token | Dark value | Light value | Tailwind class | Usage |
|-------|-----------|-------------|----------------|-------|
| `--color-bg` | `#0A0A0F` | `#FFFFFF` | `bg-bg` | Page background |
| `--color-card` | `#111118` | `#F9FAFB` | `bg-card` | Card/panel surfaces |
| `--color-text-primary` | `#E2E4E9` | `#1A1A2E` | `text-text-primary` | Headings, body text |
| `--color-text-secondary` | `#8B8FA0` | `#6B7280` | `text-text-secondary` | Muted text, labels |
| `--color-amber` | `#8B5CF6` | `#8B5CF6` | `text-amber`, `bg-amber` | Primary accent — CTAs, highlights, data |
| `--color-amber-light` | `#A78BFA` | `#A78BFA` | `text-amber-light`, `bg-amber-light` | Hover states, lighter accent |
| `--color-amber-dark` | `#7C3AED` | `#7C3AED` | `text-amber-dark`, `bg-amber-dark` | Darker accent variant |
| `--color-stroke` | `rgba(139,92,246,0.10)` | `rgba(0,0,0,0.08)` | `border-stroke` | Borders, dividers (purple-tinted) |
| `--color-warm-bg` | `#0A0A0F` | `#FFFFFF` | `bg-warm-bg` | Alias for page background |
| `--color-warm-card` | `#111118` | `#F9FAFB` | `bg-warm-card` | Alias for card background |
| `--color-warm-stroke` | `rgba(139,92,246,0.10)` | `rgba(0,0,0,0.08)` | `border-warm-stroke` | Alias for borders |
| `--color-dark-section` | `#06060A` | `#1A1A2E` | `bg-dark-section` | Deeper emphasis band backgrounds |
| `--color-dark-card` | `#0E0E16` | `#252542` | `bg-dark-card` | Cards inside dark sections |
| `--color-purple-tint` | `rgba(139,92,246,0.06)` | `#F5F3FF` | `bg-purple-tint` | Subtle purple section tint |
| `--color-terminal-green` | `#4ADE80` | `#16A34A` | `text-terminal-green` | Success messages, checkmarks |
| `--color-terminal-red` | `#F87171` | `#DC2626` | `text-terminal-red` | Error messages |
| `--color-terminal-yellow` | `#FBBF24` | `#D97706` | `text-terminal-yellow` | Warning messages |
| `--color-terminal-dim` | `#4A4A5E` | `#9CA3AF` | `text-terminal-dim` | Dim text, prefixes, decorative |
| `--color-complement` | `#10B981` | `#10B981` | `text-complement`, `bg-complement` | Soft teal accent (sparingly) — verification, secondary CTAs |
| `--color-complement-light` | `rgba(16,185,129,0.15)` | `#D1FAE5` | `bg-complement-light` | Teal tint |
| `--color-track` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` | `bg-track` | Progress bar/gauge track background |
| | | | | |
| **Dimension colors** | | | | **Data visualization accents for the 4 impact dimensions** |
| `--color-dimension-delivery` | `#22c55e` | `#22c55e` | `text-dimension-delivery`, `bg-dimension-delivery` | Delivery dimension (green) |
| `--color-dimension-quality` | `#f97316` | `#f97316` | `text-dimension-quality`, `bg-dimension-quality` | Quality dimension (orange) |
| `--color-dimension-consistency` | `#06b6d4` | `#06b6d4` | `text-dimension-consistency`, `bg-dimension-consistency` | Consistency dimension (cyan) |
| `--color-dimension-breadth` | `#ec4899` | `#ec4899` | `text-dimension-breadth`, `bg-dimension-breadth` | Breadth dimension (pink) |
| `--color-dimension-delivery-light` | `#4ADE80` | `#4ADE80` | `text-dimension-delivery-light` | Lighter delivery accent |
| `--color-dimension-quality-light` | `#FB923C` | `#FB923C` | `text-dimension-quality-light` | Lighter quality accent |
| `--color-dimension-consistency-light` | `#22D3EE` | `#22D3EE` | `text-dimension-consistency-light` | Lighter consistency accent |
| `--color-dimension-breadth-light` | `#F472B6` | `#F472B6` | `text-dimension-breadth-light` | Lighter breadth accent |
| `--color-dimension-craft` | `#F59E0B` | `#F59E0B` | `text-dimension-craft`, `bg-dimension-craft` | Craft dimension (amber) |
| `--color-dimension-craft-light` | `#FBBF24` | `#FBBF24` | `text-dimension-craft-light` | Lighter craft accent |
| | | | | |
| **Archetype colors** | | | | **Accent color per developer archetype** |
| `--color-archetype-builder` | `#8B5CF6` | `#8B5CF6` | `text-archetype-builder`, `bg-archetype-builder` | Builder archetype (purple) |
| `--color-archetype-guardian` | `#EC4899` | `#EC4899` | `text-archetype-guardian`, `bg-archetype-guardian` | Quality Champion archetype (pink) |
| `--color-archetype-marathoner` | `#22C55E` | `#22C55E` | `text-archetype-marathoner`, `bg-archetype-marathoner` | Marathoner archetype (green) |
| `--color-archetype-polymath` | `#EAB308` | `#EAB308` | `text-archetype-polymath`, `bg-archetype-polymath` | Polymath archetype (yellow) |
| `--color-archetype-balanced` | `#0EA5E9` | `#0EA5E9` | `text-archetype-balanced`, `bg-archetype-balanced` | Balanced archetype (sky blue) |
| `--color-archetype-emerging` | `#F97316` | `#F97316` | `text-archetype-emerging`, `bg-archetype-emerging` | Emerging archetype (orange) |
| `--color-archetype-artificer` | `#F59E0B` | `#F59E0B` | `text-archetype-artificer`, `bg-archetype-artificer` | Artificer archetype (amber) |

### Color rules

- Purple (`#8B5CF6`) is the signature accent. Use sparingly — CTAs, active states, key data points.
- Use semantic tokens (`bg-bg`, `bg-card`, `text-text-primary`, etc.) — they resolve correctly in both themes.
- Never hardcode hex colors in components; always use the CSS variable tokens so theme switching works.
- Purple-tinted borders (`border-stroke`) are the default for all dividers.
- Terminal colors used in terminal output only: green for success, red for errors, yellow for warnings. These also have light-appropriate values.
- **Error banners and alerts** must use terminal-red tokens (`border-terminal-red/30`, `bg-terminal-red/10`, `text-terminal-red`) — never amber/purple for error states.
- **Verification-related UI** (verify page headings, verify CTAs, verification badges) must use the complement (teal) tokens: `text-complement`, `bg-complement`, `bg-complement-light`. This semantically distinguishes cryptographic trust from primary brand actions.
- Use Tailwind opacity modifiers: `bg-amber/10`, `text-amber/70`, `border-amber/20`.
- Cards use `bg-card` with `border-stroke`.
- Button text on purple background: always `text-white`.

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

## Typography

Two fonts loaded via `next/font/google` in `apps/web/app/layout.tsx`:

| Role | Font | Tailwind class | CSS variable | Weights |
|------|------|----------------|-------------|---------|
| Headings | **JetBrains Mono** | `font-heading` | `--font-jetbrains-mono` | 400, 500, 700, 800 |
| Body/UI | **Plus Jakarta Sans** | `font-body` | `--font-plus-jakarta` | 400, 500, 600, 700 |
| Terminal UI | **JetBrains Mono** | `font-terminal` | `--font-terminal` | (inherits heading weights) |

`--font-terminal` is an alias for JetBrains Mono with `ui-monospace` fallback, defined in `globals.css` `@theme`. Use `font-terminal` on terminal-specific components (`TerminalInput`, `TerminalOutput`, `AutocompleteDropdown`) for semantic clarity — it resolves to the same typeface as `font-heading` but signals "this is terminal chrome" to other developers.

### Typography rules

- All `<h1>`-`<h3>` elements use `font-heading` (JetBrains Mono).
- Body text, labels, buttons, and UI chrome use `font-body` (Plus Jakarta Sans) — default on `<body>`.
- JetBrains Mono is monospace — do NOT use `italic` with it.
- Terminal output uses `font-heading` throughout for monospace consistency.
- Accent text in headings uses `text-amber`.
- Use `tracking-tight` on headings. Use `leading-relaxed` on body paragraphs.
- Use `text-balance` on all `<h1>`-`<h3>` elements to prevent orphaned words.
- Use `text-pretty` on body paragraphs longer than one sentence.

## Spacing & Layout

- Max content width: `max-w-7xl` (nav), `max-w-4xl` (terminal session, landing page).
- Section spacing: `space-y-24` between terminal sections on landing page.
- Horizontal padding: `px-6` on all containers.
- Section dividers: `border-l border-stroke` — vertical left border for terminal output blocks.

## Terminal Section Pattern

The landing page is structured as a "terminal session" — each section is a command + output pair:

```
$ command-name
  [output content with left border]
```

- Command line: `font-heading text-sm`, `$` prefix in `text-terminal-dim`, command in `text-text-secondary`
- Output block: `pl-4 border-l border-stroke`
- Sections animate in with `animate-fade-in-up` and staggered `animation-delay`

## Components

### Cards

```
rounded-xl border border-stroke bg-card overflow-hidden
```

### Buttons (Primary)

```
rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white
hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25
```

White text on purple. `rounded-lg` (not `rounded-full`).

### Buttons (Ghost/Outline)

```
rounded-lg border border-stroke px-6 py-3 text-sm font-medium text-text-secondary
hover:border-amber/20 hover:text-text-primary
```

### Navigation

- Fixed top, dark glass: `fixed top-0 z-50 border-b border-stroke bg-bg/80 backdrop-blur-xl`
- Logo: `Chapa_` with blinking cursor (`animate-cursor-blink`)
- Nav links: `/` prefix in `text-amber/50`, label in `text-terminal-dim`
- CTA: `/ login` text link (no button), hover to `text-amber`
- **LanguageSwitcher**: globe icon button (`aria-label={t('aria.languageSwitcher')}`), shows `ES | EN` pill menu on click. Uses `aria-expanded`, `role="menu"`, `role="menuitem"`. Active locale highlighted with `text-amber font-semibold`. Closes on outside click via `useDropdownMenu`. Sits between ThemeToggle and login CTA in the nav bar.

### Tooltips (mandatory pattern)

Every tooltip/popover must be portal-rendered to `document.body` with `position: fixed`, viewport-relative coordinates (from `getBoundingClientRect()`), `z-index: 99999`, and `pointer-events: none`. Add a flip-below rule when the trigger is near the top of the viewport (`rect.top < 120`) so the tooltip doesn't clip off-screen. Never use `position: absolute` inside a scrollable/animated container — an ancestor with a CSS `transform` breaks `position: fixed` positioning unless the tooltip is portaled out of that subtree entirely (#1021). Reference implementations: `apps/web/components/InfoTooltip.tsx`, `apps/web/components/dashboard/ActivityHeatmap.tsx`'s `ChartTooltip`, `apps/web/lib/effects/heatmap/HeatmapGrid.tsx`.

### Terminal components

- **TerminalOutput**: `role="log" aria-live="polite"`, monospace, color-coded by line type
- **TerminalInput**: `chapa >` or `studio >` prompt in amber, blinking cursor, input with placeholder
- **AutocompleteDropdown**: `role="listbox"`, shows on `/` keystroke, purple accent on active item
- **QuickControls**: Collapsible panel with clickable chips that insert terminal commands

### Images

All avatar and user-uploaded images use the `.img-outline` utility class:
- 1px semi-transparent outline (`rgba(0,0,0,0.1)` light / `rgba(255,255,255,0.1)` dark)
- `outline-offset: -1px` so the outline sits inside the image boundary
- Prevents avatars from visually bleeding into matching backgrounds

### Code blocks

```
rounded-xl border border-stroke bg-card overflow-hidden
```

Terminal dots: `bg-terminal-red/60`, `bg-terminal-yellow/60`, `bg-terminal-green/60`.

## Background Effects

- **Grid pattern**: `.bg-grid-warm` — faint 72px grid lines at 4% opacity. Uses subtle black lines in light mode and purple-tinted lines in dark mode (both defined in `globals.css`).
- No ambient glow on dark backgrounds.

## Animations

Defined in `globals.css`:

| Class | Effect | Duration |
|-------|--------|----------|
| `animate-fade-in-up` | Fade in + slide up 30px | 0.8s ease-out |
| `animate-cursor-blink` | Step cursor blink | 1s infinite |
| `animate-terminal-fade-in` | Fade in + slide up 8px | 0.3s ease-out |
| `animate-pulse-glow-amber` | Soft pulsing purple shadow | 3s infinite |
| `animate-float-slow` | Gentle vertical float + slight rotation | 6s infinite |
| `animate-float-medium` | Medium vertical float + counter-rotation | 7.5s infinite |
| `animate-float-fast` | Faster vertical float + stronger rotation | 5s infinite |
| `animate-drift` | Multi-axis drift with 4 waypoints | 8s infinite |
| `animate-shimmer` | Horizontal shimmer gradient (left to right) | 3s linear infinite |
| `animate-shimmer-sweep` | Horizontal shimmer gradient (right to left) | 3s linear infinite |
| `animate-scale-in` | Scale from 0.92 + fade in | 0.6s ease-out |
| `animate-toast-out` | Scale to 0.95 + fade out + slide up 8px | 0.3s ease-in forwards |
| `animate-gauge-fill` | SVG circular gauge stroke fill | 1.5s ease-out |
| `animate-bar-fill` | Horizontal bar scale from 0 to target | 0.8s ease-out |
| `animate-terminal-type` | Typewriter width expansion (0 to 100%) | (set per-element) |
| `.sparkline-animated polyline` | SVG polyline stroke trace via `--sparkline-length` | 0.6s ease-out |
| `radar-expand` (keyframe only) | Scale from 0 + fade in (for radar chart polygons) | (set per-element) |
| `animate-hex-cell-in` | Scale from 0.3 + fade in (hex grid cells) | 0.45s ease-out |

## Icons

- Inline SVG components — no icon library dependency.
- Stroke icons: `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
- Always include `aria-hidden="true"` on decorative icons.
- GitHub icon uses the official octocat SVG path (fill, not stroke).

## Do NOT

- Hardcode hex background/text colors in components — always use semantic tokens (`bg-bg`, `text-text-primary`, etc.) so both themes work.
- Use italic on monospace headings.
- Use icon libraries (lucide, heroicons, etc.) — keep inline SVGs.
- Use `Inter`, `Roboto`, `Arial`, or other generic fonts.
- Add ambient glow blurs on dark backgrounds (invisible, wastes DOM).
- Use `text-warm-bg` for button text — use `text-white` instead.
- Touch badge SVG theme — it stays dark as an independent embeddable asset.
- Use `rounded-full` for text/CTA buttons — use `rounded-lg` instead. Exception: icon-only buttons (dismiss, info trigger, avatar) may use `rounded-full`.
