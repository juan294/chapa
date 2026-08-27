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
| `--color-complement` | `#10B981` | `#10B981` | `bg-complement`, `border-complement` | Soft teal accent (sparingly) — verification, secondary CTAs. **Non-textual only** — see `--color-complement-text` below for teal-as-text/icon-stroke |
| `--color-complement-light` | `rgba(16,185,129,0.15)` | `#D1FAE5` | `bg-complement-light` | Teal tint |
| `--color-complement-dark` | `#047857` | `#047857` | `bg-complement-dark` | White-text-on-solid-fill verification CTAs only (`bg-complement` measures 2.54:1 for white text, below AA; this measures ~5.49:1) |
| `--color-complement-text` | `#10B981` | `#0B835C` | `text-complement-text` | Teal-colored TEXT and icon strokes on `bg-bg`/`bg-card` (#1189) — `text-complement` (i.e. raw `--color-complement`, `#10B981`) measures only ~2.54:1 on light-theme backgrounds, below the 4.5:1 AA floor even for large/bold text. This theme-aware token's light value (`#0B835C`) is the lightest same-hue/saturation shade that still clears 4.5:1 on both `#FFFFFF` (4.76:1) and `#F9FAFB` (4.55:1); its dark value reuses the base `#10B981` (~7.8:1 on dark surfaces, already fine as text). |
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
- **Verification-related UI on the site itself** (verify page headings, verify CTAs, in-app verification indicators) must use the complement (teal) tokens: `bg-complement`, `border-complement`, `bg-complement-light` for fills/tints/borders, and — for text and icon strokes specifically — `text-complement-text` (#1189), never `text-complement`. `--color-complement` (`#10B981`) measures only ~2.54:1 as text against the site's light-theme backgrounds, below the WCAG AA floor even for large/bold text (3:1), let alone normal text (4.5:1); `--color-complement-text` is the theme-aware, text-safe counterpart (see the color table above). This semantically distinguishes cryptographic trust from primary brand actions while keeping teal legible as text in both themes.
- **The embeddable badge SVG's own "verified" signal** (shield icon + vertical verification strip) is the one deliberate exception: it uses its own coral constant, `VERIFICATION_CORAL` (`#E05A47`, `apps/web/lib/badge-visual-metadata.ts`) — never the teal tokens above. The badge is a static, theme-independent asset rendered server-side before app CSS exists, so it can't reference CSS custom properties at all; coral was already load-bearing in the verification strip pre-dating this rule, and previously coexisted with the brand-purple shield icon (two colors signaling one "verified" concept). #1168 (UX-M10) resolved that duality by recoloring the shield to the same coral, so the badge now has exactly one verified color, distinct from teal (on-site) and from the brand purple accent. Contrast: coral is ~5.3:1 against the badge's own fixed dark background (#0C0D14) — comfortably AA. It is only ~3.7:1 against a light background (#FFFFFF/#F9FAFB) — AA for large/bold text only, not small body text — so if a coral accent is ever carried onto the (light/dark-capable) verify page, it needs its own contrast pass and cannot assume the badge's dark-background numbers apply. Coral vs. `--color-terminal-red` (error state) hue is close (~7° apart in HSL) but separated by lightness/saturation on the badge's dark canvas (~13pp lightness gap vs. dark-theme `--color-terminal-red` #F87171); the gap narrows on a hypothetical light-theme use (~7pp vs. light-theme `--color-terminal-red` #DC2626, nearly identical saturation) — verify the two stay visually distinguishable, including for colorblind users, before extending coral beyond the badge.
- **Wave 2 decision (#1183): coral stays badge-only — the verify page keeps teal.** The question above ("if a coral accent is ever carried onto the verify page") was evaluated and resolved: `/verify/:hash` and `StatusCallout`'s `verification` variant keep the teal family (`bg-complement`/`border-complement`, and — since #1189 — `text-complement-text` for text/icon-stroke) rather than adopting coral, and `VERIFICATION_CORAL` is not imported by either (enforced by `apps/web/lib/badge-visual-metadata.test.ts` and `apps/web/components/StatusCallout.render.test.tsx`). Two measured reasons, not just inertia:
  1. **Contrast.** Coral measures ~5.38:1 against the badge's own fixed dark canvas (comfortably AA for any text size there) but only ~3.67:1 against the site's light-theme backgrounds (`#FFFFFF`/`#F9FAFB`) — that clears the 3:1 large/bold-text AA floor but falls well short of the 4.5:1 normal-text floor. The verify page's body copy (verification hash, handle, dimension values) is normal-weight, non-large text; carrying coral there would mean either an inaccessible page or an inconsistent "coral heading, teal everything else" treatment — undermining the "one verified color" continuity this ticket was meant to serve, not delivering it.
  2. **Colorblind-safe separation from error red.** Coral and `--color-terminal-red` sit ~7.5° apart in hue in both themes; the *lightness* gap that currently keeps them apart on the badge's fixed dark canvas (~12.9pp) shrinks to ~7.3pp on light theme — the site's **default** theme (`defaultTheme="light"` in `next-themes`). A page whose entire purpose is asserting "verified" (not "error") cannot afford that shrinking margin, especially for protanopia/deuteranopia viewers where the red-orange range compresses further.

  The badge and the site are different rendering contexts by construction — the badge is a single fixed-dark canvas rendered server-side with no CSS custom properties, while the verify page is light/dark-capable and text-heavy — so this is a deliberate, documented split, not an oversight. Teal was already the intentional, colorblind-distinguishable verification signal for on-site UI (see the bullet above); Wave 2 confirmed it stays that way rather than partially diluting it with coral.
- Use Tailwind opacity modifiers: `bg-amber/10`, `text-amber/70`, `border-amber/20`.
- Cards use `bg-card` with `border-stroke`.
- Button text on purple background: always `text-white`.
- **White text on a solid `bg-amber`/`bg-complement` fill fails AA contrast** (`bg-amber` measures 4.06:1, `bg-complement` measures 2.54:1 — both below the 4.5:1 floor). Never change the `--color-amber`/`--color-complement` tokens themselves to fix this (they're used non-textually elsewhere — pills, heatmap, focus rings — and a token change shifts the whole brand/verification hue). Instead, at the specific white-text-on-solid-fill call site, use the darker step of the ramp: `bg-amber-dark` (~5.4:1) or `bg-complement-dark` (~5.49:1). When re-anchoring a hover state that previously went to the *lighter* step (e.g. `hover:bg-amber-light`, 2.72:1), shift the whole ramp one step darker instead (base `bg-amber-dark`, hover `bg-amber`) rather than just swapping the base color.

## Touch targets

- Interactive controls need a minimum 44×44px hit area (WCAG 2.5.5 / mobile touch-target guidance).
- **Default approach**: size the element itself to `min-h-[44px] min-w-[44px]` (see `ErrorBanner.tsx`, `CopyButton.tsx`, `BadgeToolbar.tsx`, `SubMetricPanel.tsx`'s close button).
- **When the element's own box is measured for positioning** (e.g. `InfoTooltip`'s trigger button, whose `getBoundingClientRect()` drives the portaled tooltip's placement and the `rect.top < 120` auto-flip — see Tooltips below), do NOT resize the element. Instead add `relative` plus an invisible `before:absolute before:-inset-3.5 before:content-['']` overlay: the pseudo-element grows the clickable/hoverable area without changing its host's own box model, so `getBoundingClientRect()` keeps returning the original visual size.

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

### Type scale

Tailwind's default named steps, plus the project's floor for anything smaller:

| Class | Size | Usage |
|-------|------|-------|
| `text-4xl`/`text-3xl` | 36px / 30px | Hero/section headings |
| `text-2xl`/`text-xl` | 24px / 20px | Card/panel headings |
| `text-lg` | 18px | Emphasized body, subheadings |
| `text-base` | 16px | Default body text |
| `text-sm` | 14px | Secondary body text, form labels |
| `text-xs` | 12px | Smallest **named** step — captions, meta text, pill/badge labels |
| 11px (documented floor) | 11px | The floor for **content text** in the product UI (`experiments/*` pages are exempt as prototypes) — see the narrow exception below for decorative micro-labels. Used sparingly for dense inline chrome (e.g. Studio's option-button labels) where 12px would visibly crowd the layout. |

**Rule:** 11px is the documented floor for content text — text conveying
information the user needs to read (a value, a name, a count, a sentence).
There is no Tailwind-named step between `text-xs` (12px) and the 11px floor,
so a genuine 11px use is written as an explicit arbitrary value
(`text-[11px]`). If a future design need requires 11px in more than one
place, promote it to a named token (e.g. a `--text-2xs` custom property in
`globals.css`) rather than repeating the bare arbitrary value — that gives
reviewers something to point at, which is the gap that let 28 arbitrary
sub-12px sizes accumulate outside `experiments/` before this table existed
(#1187).

**Narrow exception:** an uppercase, letter-spaced (`tracking-wide`/
`tracking-wider`) micro-label used as a section heading (e.g. a "PRESETS" or
"MORE" caption above a group of controls) is a deliberate hierarchy device,
not content the user reads at comfortable size — those may go below the
11px floor (commonly `text-[10px]`) when raising them would flatten the
hierarchy they exist to create, or would overflow a fixed-width layout (a
week-grid column, a chart label positioned around a fixed-size graphic).
This exception is narrow and does not extend to ordinary content text (a
value, a name, a count) — that text always meets the 11px floor, especially
when it also uses a dim/secondary color token, since small size and low
contrast compound.

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
- Nav links: `/` prefix in `text-amber/50`, label in `text-text-secondary` (was `text-terminal-dim` — 2.29:1 dark / 2.54:1 light, below the 4.5:1 AA floor; `text-text-secondary` measures 6.15:1 / 4.83:1). `terminal-dim` stays reserved for genuinely decorative glyphs (`$`, `>`, `|`).
- Active nav link (`aria-current="page"`): styled globally via `nav [aria-current="page"], [role="navigation"] [aria-current="page"]` in `globals.css` (covers both the desktop `<nav>` and `MobileNav`'s `role="navigation"` panel) — `color: var(--color-text-primary)` + `font-weight: 600`, deliberately not amber so it stays distinguishable from the `text-amber/50` `/` prefix already inside every link.
- CTA: `/ login` text link (no button), hover to `text-amber`
- **LanguageSwitcher**: globe icon button (`aria-label={t('aria.languageSwitcher')}`), shows `ES | EN` pill menu on click. This is a **listbox**, not a menu — a language picker is a single-select choice among options, not a set of commands. The trigger uses `aria-expanded` + `aria-haspopup="listbox"`; the container is `role="group"`; the panel is `role="listbox"` with `role="option"` items (not `role="menu"`/`role="menuitem"`). Active locale highlighted with `text-amber font-semibold`. Own hand-rolled behavior (not `useDropdownMenu` — see "Listbox vs. menu pattern" below): closes on outside click and on Escape, arrow-key (`ArrowUp`/`ArrowDown`/`Home`/`End`) traversal between options, and Escape **returns focus to the trigger button**. Sits between ThemeToggle and login CTA in the nav bar.

#### Listbox vs. menu pattern

Two distinct dropdown patterns exist in the codebase — do not unify them, they are correctly different:

| | `LanguageSwitcher` (listbox) | `useDropdownMenu` (menu) |
|---|---|---|
| Used by | `LanguageSwitcher` only | `UserMenu`, `BadgeToolbar` |
| ARIA roles | `role="listbox"` / `role="option"`, trigger `aria-haspopup="listbox"` | `role="menu"` / `role="menuitem"` (set by each consuming component; the hook queries `[role="menuitem"]`) |
| Semantics | Single-select choice among mutually exclusive options | A set of independent commands/actions |
| Escape behavior | Closes **and returns focus to the trigger** | Closes only — does **not** return focus to the trigger |
| Arrow keys | `ArrowUp`/`ArrowDown` (wrap) + `Home`/`End` | Same, via the shared hook |

A component whose items are alternatives the user picks one of (language, theme, sort order) should follow the listbox pattern; a component whose items are actions to invoke (profile actions, share actions) should use `useDropdownMenu`'s menu pattern. When adding a new dropdown, choose based on this semantic distinction first — don't default to whichever hook already exists.

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
