# Chapa Design System

This is the single source of truth for visual design decisions. All agents working on UI must follow these guidelines.

## Theme: Terminal Dark + Purple Accent (with Light Mode)

Bold, developer-tool aesthetic inspired by terminal UIs. The dark theme is the signature brand look, with purple (`#7C6AEF`) used sparingly for CTAs, highlights, and active states. Terminal-specific colors (green, red, yellow) for output types. A light theme is supported as an alternative, toggled via the `ThemeToggle` component in the nav bar. Badge SVG always renders in dark theme as an independent embeddable asset.

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
| `--color-amber` | `#7C6AEF` | `text-amber`, `bg-amber` | Primary accent — CTAs, highlights, data |
| `--color-amber-light` | `#9D8FFF` | `text-amber-light`, `bg-amber-light` | Hover states, lighter accent |
| `--color-amber-dark` | `#5E4FCC` | `text-amber-dark`, `bg-amber-dark` | Darker accent variant |
| `--color-stroke` | `rgba(124,106,239,0.10)` | `border-stroke` | Borders, dividers (purple-tinted) |
| `--color-warm-bg` | `#0A0A0F` | `bg-warm-bg` | Alias for page background |
| `--color-warm-card` | `#111118` | `bg-warm-card` | Alias for card background |
| `--color-warm-stroke` | `rgba(124,106,239,0.10)` | `border-warm-stroke` | Alias for borders |
| `--color-dark-section` | `#06060A` | `bg-dark-section` | Deeper emphasis band backgrounds |
| `--color-dark-card` | `#0E0E16` | `bg-dark-card` | Cards inside dark sections |
| `--color-purple-tint` | `rgba(124,106,239,0.06)` | `bg-purple-tint` | Subtle purple section tint |
| `--color-terminal-green` | `#4ADE80` | `text-terminal-green` | Success messages, checkmarks |
| `--color-terminal-red` | `#F87171` | `text-terminal-red` | Error messages |
| `--color-terminal-yellow` | `#FBBF24` | `text-terminal-yellow` | Warning messages |
| `--color-terminal-dim` | `#4A4A5E` | `text-terminal-dim` | Dim text, prefixes, decorative |
| `--color-complement` | `#10B981` | `text-complement` | Soft teal accent (sparingly) |
| `--color-complement-light` | `rgba(16,185,129,0.15)` | `bg-complement-light` | Teal tint |

### Color rules

- Purple (`#7C6AEF`) is the signature accent. Use sparingly — CTAs, active states, key data points.
- Use semantic tokens (`bg-bg`, `bg-card`, `text-text-primary`, etc.) — they resolve correctly in both themes.
- Never hardcode hex colors in components; always use the CSS variable tokens so theme switching works.
- Purple-tinted borders (`border-stroke`) are the default for all dividers.
- Terminal colors used in terminal output only: green for success, red for errors, yellow for warnings. These also have light-appropriate values.
- Use Tailwind opacity modifiers: `bg-amber/10`, `text-amber/70`, `border-amber/20`.
- Cards use `bg-card` with `border-stroke`.
- Button text on purple background: always `text-white`.

## Typography

Two fonts loaded via `next/font/google` in `apps/web/app/layout.tsx`:

| Role | Font | Tailwind class | CSS variable | Weights |
|------|------|----------------|-------------|---------|
| Headings | **JetBrains Mono** | `font-heading` | `--font-jetbrains-mono` | 400, 500, 700, 800 |
| Body/UI | **Plus Jakarta Sans** | `font-body` | `--font-plus-jakarta` | 400, 500, 600, 700 |

### Typography rules

- All `<h1>`-`<h3>` elements use `font-heading` (JetBrains Mono).
- Body text, labels, buttons, and UI chrome use `font-body` (Plus Jakarta Sans) — default on `<body>`.
- JetBrains Mono is monospace — do NOT use `italic` with it.
- Terminal output uses `font-heading` throughout for monospace consistency.
- Accent text in headings uses `text-amber`.
- Use `tracking-tight` on headings. Use `leading-relaxed` on body paragraphs.

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

### Terminal components

- **TerminalOutput**: `role="log" aria-live="polite"`, monospace, color-coded by line type
- **TerminalInput**: `chapa >` or `studio >` prompt in amber, blinking cursor, input with placeholder
- **AutocompleteDropdown**: `role="listbox"`, shows on `/` keystroke, purple accent on active item
- **QuickControls**: Collapsible panel with clickable chips that insert terminal commands

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
| `animate-pulse-glow-amber` | Soft pulsing indigo shadow | 3s infinite |
| `animate-float-slow` | Gentle vertical float | 6s infinite |
| `animate-shimmer` | Horizontal shimmer gradient | 3s linear infinite |
| `animate-scale-in` | Scale from 0.92 + fade in | 0.6s ease-out |

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
- Use `rounded-full` for primary buttons — use `rounded-lg` instead.
