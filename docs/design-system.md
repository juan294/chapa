# Chapa Design System

This is the single source of truth for visual design decisions. All agents working on UI must follow these guidelines.

## Theme: Paper, ink, vermilion and ice

Chapa combines editorial composition with a working developer shell. Light mode
uses paper and warm-white panels; dark mode uses charcoal with warm-white text.
Vermilion/coral provides emphasis, and ice fields frame the independent dark SVG
badge. Technical headings, navigation and terminal labels remain JetBrains Mono;
Manrope is body/UI and Barlow Condensed is reserved for expressive display.

### Theme switching

- Powered by `next-themes` with `attribute="data-theme"` and `defaultTheme="system"`.
- `ThemeProvider` wraps the app in `layout.tsx`; `ThemeToggle` lives in the nav bar and cycles three modes: system, light, dark (#1211).
- **Every themed color token is ONE declaration** (#1211): `--color-bg: light-dark(#F4F0E7, #141719);` inside the `@theme` block of `globals.css`. `color-scheme` on the root element decides which half resolves - `:root` carries `color-scheme: light dark` (follow the OS), and `[data-theme="light"]` / `[data-theme="dark"]` force one. Tailwind utilities (`bg-bg`, `text-text-primary`, etc.) resolve at runtime via `var()`, unchanged.
- The paired `:root` / `[data-theme="dark"]` custom property blocks are gone. `data-theme` now carries `color-scheme` only. Native form controls, scrollbars and focus rings follow the theme for free.
- When adding a theme-aware color token, write one `light-dark(<light>, <dark>)` value. Fixed ink terminal and raw archetype colors intentionally use one literal value in both themes. Do not reintroduce a second per-theme block.
- No `@supports` fallback is needed or wanted. LightningCSS (Next.js 16's CSS pipeline) compiles `light-dark()` to a custom-property toggle keyed off the same `color-scheme` selectors, so all three modes work below the native floor (Chrome/Edge 123+, Safari 17.5+, Firefox 120+). See `docs/decisions/2026-08-29-light-dark-token-layer.md`.

## Colors

Defined in `apps/web/styles/globals.css` via Tailwind v4 `@theme`: 77 tokens total, comprising 71 colors, four font roles and two shadows. Theme-aware colors use one `light-dark(<light>, <dark>)` declaration; fixed colors resolve identically in both themes. Both values are listed below. Token export must match the current declarations exactly, rather than assuming this count can never change.

| Token | Light value | Dark value |
| --- | --- | --- |
| `--color-bg` | `#f4f0e7` | `#141719` |
| `--color-card` | `#fffdf7` | `#202528` |
| `--color-purple-tint` | `#dceaf0` | `#192b35` |
| `--color-dark-section` | `#1b1b19` | `#0d1215` |
| `--color-dark-card` | `#252521` | `#202528` |
| `--color-hero-band` | `#dceaf0` | `#192b35` |
| `--color-warm-bg` | `#f4f0e7` | `#141719` |
| `--color-warm-card` | `#fffdf7` | `#202528` |
| `--color-warm-stroke` | `#24232130` | `#eeeae12b` |
| `--color-text-primary` | `#1b1b19` | `#eeeae1` |
| `--color-text-secondary` | `#64625e` | `#b3b9b9` |
| `--color-terminal-dim` | `#64625e` | `#b3b9b9` |
| `--color-stroke` | `#24232130` | `#eeeae12b` |
| `--color-stroke-strong` | `#1b1b19` | `#eeeae166` |
| `--color-track` | `#1b1b191f` | `#eeeae121` |
| `--color-amber` | `#ed4930` | `#ff795f` |
| `--color-amber-light` | `#f77a62` | `#ff9d88` |
| `--color-amber-dark` | `#aa2d1a` | `#c24e39` |
| `--color-amber-text` | `#aa2d1a` | `#ff927d` |
| `--color-terminal-green` | `oklch(.46 .13 145)` | `oklch(.8 .16 148)` |
| `--color-terminal-yellow` | `oklch(.46 .1 78)` | `oklch(.82 .13 85)` |
| `--color-terminal-red` | `oklch(.49 .18 25)` | `oklch(.76 .16 25)` |
| `--color-complement` | `oklch(.55 .1 225)` | `oklch(.7 .11 225)` |
| `--color-complement-light` | `oklch(.94 .035 225)` | `oklch(.7 .11 225 / .16)` |
| `--color-complement-dark` | `oklch(.42 .09 228)` | `oklch(.42 .09 228)` |
| `--color-complement-text` | `oklch(.46 .1 228)` | `oklch(.79 .1 222)` |
| `--color-complement-text-hover` | `oklch(.38 .09 228)` | `oklch(.84 .1 220)` |
| `--color-forest` | `#1b1b19` | `#1b1b19` |
| `--color-forest-card` | `#252521` | `#252521` |
| `--color-forest-line` | `#f4f0e766` | `#f4f0e766` |
| `--color-forest-text` | `#f4f0e7` | `#f4f0e7` |
| `--color-forest-dim` | `#c2c0b8` | `#c2c0b8` |
| `--color-forest-accent` | `#ff795f` | `#ff795f` |
| `--color-medal-gold` | `#d4a017` | `#d4a017` |
| `--color-medal-silver` | `#a8b0b8` | `#a8b0b8` |
| `--color-medal-bronze` | `#b8763e` | `#b8763e` |
| `--color-forest-grid` | `#f4f0e70a` | `#f4f0e70a` |
| `--color-forest-ok` | `oklch(.8 .16 148)` | `oklch(.8 .16 148)` |
| `--color-forest-warn` | `oklch(.82 .13 85)` | `oklch(.82 .13 85)` |
| `--color-forest-err` | `oklch(.72 .17 25)` | `oklch(.72 .17 25)` |
| `--color-identity-surface` | `#ed4930` | `#3a2222` |
| `--color-identity-text` | `#1b1b19` | `#eeeae1` |
| `--color-closing-surface` | `#ed4930` | `#a92f21` |
| `--color-closing-text` | `#1b1b19` | `#f4f0e7` |
| `--color-action` | `#1b1b19` | `#ff795f` |
| `--color-action-text` | `#f4f0e7` | `#17191a` |
| `--color-action-hover` | `#aa2d1a` | `#ff9d88` |
| `--color-dimension-delivery` | `oklch(.62 .14 145)` | `oklch(.72 .14 145)` |
| `--color-dimension-quality` | `oklch(.62 .14 50)` | `oklch(.72 .14 50)` |
| `--color-dimension-consistency` | `oklch(.62 .14 215)` | `oklch(.72 .14 215)` |
| `--color-dimension-breadth` | `oklch(.62 .14 330)` | `oklch(.72 .14 330)` |
| `--color-dimension-craft` | `oklch(.62 .14 95)` | `oklch(.72 .14 95)` |
| `--color-dimension-delivery-light` | `oklch(.75 .13 145)` | `oklch(.8 .13 145)` |
| `--color-dimension-quality-light` | `oklch(.75 .13 50)` | `oklch(.8 .13 50)` |
| `--color-dimension-consistency-light` | `oklch(.75 .13 215)` | `oklch(.8 .13 215)` |
| `--color-dimension-breadth-light` | `oklch(.75 .13 330)` | `oklch(.8 .13 330)` |
| `--color-dimension-craft-light` | `oklch(.75 .13 95)` | `oklch(.8 .13 95)` |
| `--color-archetype-builder` | `oklch(.62 .14 163)` | `oklch(.62 .14 163)` |
| `--color-archetype-guardian` | `oklch(.62 .14 330)` | `oklch(.62 .14 330)` |
| `--color-archetype-marathoner` | `oklch(.62 .14 145)` | `oklch(.62 .14 145)` |
| `--color-archetype-polymath` | `oklch(.62 .14 110)` | `oklch(.62 .14 110)` |
| `--color-archetype-balanced` | `oklch(.62 .14 240)` | `oklch(.62 .14 240)` |
| `--color-archetype-emerging` | `oklch(.62 .14 50)` | `oklch(.62 .14 50)` |
| `--color-archetype-artificer` | `oklch(.62 .14 75)` | `oklch(.62 .14 75)` |
| `--color-archetype-builder-text` | `oklch(.48 .12 163)` | `oklch(.78 .12 163)` |
| `--color-archetype-guardian-text` | `oklch(.48 .12 330)` | `oklch(.78 .12 330)` |
| `--color-archetype-marathoner-text` | `oklch(.48 .12 145)` | `oklch(.78 .12 145)` |
| `--color-archetype-polymath-text` | `oklch(.48 .12 110)` | `oklch(.78 .12 110)` |
| `--color-archetype-balanced-text` | `oklch(.48 .12 240)` | `oklch(.78 .12 240)` |
| `--color-archetype-emerging-text` | `oklch(.48 .12 50)` | `oklch(.78 .12 50)` |
| `--color-archetype-artificer-text` | `oklch(.48 .12 75)` | `oklch(.78 .12 75)` |

### Color rules

- Use the existing semantic tokens; retain historical `amber`, `warm-*`,
  `forest-*` and `purple-tint` names so all consumers and sync exports agree.
- Brand fill is vermilion/coral. Small accent text/icons use `amber-text`.
  Primary actions use `bg-action text-action-text hover:bg-action-hover`.
  Both states use the same paired foreground; do not assume white-on-coral.
- The hero/stage is theme-aware ice. Fixed terminals use ink `forest` surfaces
  with `forest-text`, `forest-dim`, the fixed coral `forest-accent` (the terminal
  prompt and status dot) and fixed `forest-ok/warn/err` status roles.
  A scoped terminal presentation context chooses these classes without changing
  theme tokens globally or affecting Studio's theme-aware session controls.
  Fixed ink controls use full-opacity `forest-text` focus outlines; page accent
  focus colors must not leak into that independent surface.
- Use neutral stroke/strong-stroke rules and solid offset shadows. Keep semantic
  green status and dimension/archetype colors; do not recolor data as branding.
  Raw `archetype-*` colors identify charts; guide headings and small signal
  labels use the corresponding `archetype-*-text` role, which preserves the hue
  with readable light/dark values.
- Site verification uses slate-blue complement fills and `complement-text` /
  `complement-text-hover` text. The independent SVG keeps its existing coral
  verification signal. Do not import badge coral into site verification UI.
- Measure text against actual page, panel, stage and selected/hover backgrounds.
  Composite translucent fills before contrast evaluation: normal text requires
  4.5:1, large text and meaningful control boundaries 3:1.
- Error text/alerts use semantic terminal-red. Destructive controls must retain
  a label/icon and measured contrast in both themes; color alone is insufficient.

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

Use neutral solid offsets: `shadow-card` is 3px and `shadow-card-hover` is 5px.
Keep a visible neutral rule around panels where needed. Dense UI uses smaller or
no offsets. Terminal chrome relies on thin borders; do not add ambient glow.

## Typography

Four families are loaded in the root layout; semantic roles are additive.

| Role | Font | Utility | Next variable |
| --- | --- | --- | --- |
| Technical headings | JetBrains Mono | `font-heading` | `--font-jetbrains-mono` |
| Terminal | JetBrains Mono | `font-terminal` | `--font-jetbrains-mono` |
| Body/UI | Manrope | `font-body` | `--font-manrope` |
| Expressive display | Barlow Condensed | `font-display` | `--font-barlow-condensed` |
| Badge metrics/footer/tier | Plus Jakarta Sans | SVG literal family | `--font-plus-jakarta` |

Browser SVG text needs the literal `Plus Jakarta Sans` and `JetBrains Mono`
family names. The installed Next 16.3.3 font output exposes those exact names
with local WOFF2 files, confirmed in the compiled CSS and browser font checks.
Keep both loaders: CSS variables alone are not evidence of literal names.
The resvg pipeline continues loading its original TTF files separately.
Standalone `.design-sync/fonts.css` binds the same roles without Next runtime.

### Typography rules

- Technical and content headings use `font-heading`; selected editorial headings use `font-display`.
- Body text, labels, buttons, and UI chrome use `font-body` (Manrope) — default on `<body>`.
- JetBrains Mono is monospace — do NOT use `italic` with it.
- Terminal output uses `font-heading` throughout for monospace consistency.
- Small accent text uses `text-amber-text`.
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

- Use `max-w-7xl` for editorial composition/nav; constrain long-form prose separately.
- Use generous section fields, asymmetric desktop composition and neutral dividers.
- Horizontal padding is responsive: editorial containers commonly use `px-6`; the navbar uses `px-3 sm:px-6` to retain 44px controls on narrow screens.
- Section dividers: `border-l border-stroke` — vertical left border for terminal output blocks.

## Landing composition and shell

The locale landing body is server-rendered editorial content: an asymmetric hero,
ice badge stage, vermilion identity field, archetype and dimension exploration,
README example, enterprise/tool/trust sections and a closing field. Technical
command markers support this hierarchy; the whole page is not a simulated log.
`MARK_` / `HUELLA_` stays JetBrains Mono beside selective Barlow display headings.

The hero uses the real animated SVG and its overlay in one tilted wrapper. The
README uses a static SVG data URL from the same immutable `LANDING_IMPACT` fixture:
92 / Elite / Balanced. These are curated illustrative values, not a computed
result of `DEMO_STATS`. Shared Studio `DEMO_IMPACT` remains 82 / High / Balanced.
Derive visible sample scores, summaries and accessible labels from the supplied
fixture; do not hardcode a second sample or duplicate inline SVG IDs.

`ArchetypeExplorer` exposes seven keyboard tabs (arrows, Home and End).
`DimensionExplorer` uses five native details elements, with optional Craft
identified explicitly. Small client leaves own these interactions; they do not
turn the translated server body into a client boundary.

The persistent bottom dock is fixed ink in both page themes and reserves document
space beneath the footer. It retains the last 50 submitted commands in React
state while mounted; it does not persist history across reloads. Global navigation,
`/theme [light|dark|system]`, autocomplete and history share the existing command
registry. `KeyboardShortcutsListener` alone owns `/` and Mod+K focus routing.
Landing adds scoped `/archetypes`, `/dimensions`, `/section`, `/embed`, `/mcp`,
`/copy` and `/whoami` commands. Command prompts fill the same input. Copy uses the
visible button's clipboard action and reports its actual success or failure.

## Components

### Cards

```
rounded-[3px] border border-stroke bg-card overflow-hidden
```

### Buttons (Primary)

```
rounded-[3px] bg-action px-6 py-3 text-sm font-semibold text-action-text
hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-amber-text
```

### Buttons (Ghost/Outline)

```
min-h-11 rounded-[3px] border border-text-primary px-6 py-3 text-sm text-text-primary
hover:bg-purple-tint focus-visible:outline-2 focus-visible:outline-amber-text
```

### Navigation

- The navbar is 69px tall (44px controls plus 24px vertical padding and a 1px rule). Studio page, viewport calculations and loading skeleton use this same offset.
- Fixed top, theme-aware surface: `fixed top-0 z-50 border-b border-stroke bg-bg`
- Logo: `Chapa_` with blinking cursor (`animate-cursor-blink`)
- Nav links keep monospace command prefixes and readable `text-text-secondary`.
  Active links use the global primary-text/weight treatment. Informational meta
  may use `terminal-dim`, measured on actual page/card/stage surfaces.
- Login remains a text navigation action; its hover uses `text-text-primary`.
- **LanguageSwitcher**: globe icon button (`aria-label={t('aria.languageSwitcher')}`), opens the `ES` / `EN` option list on click. This is a **listbox**, not a menu — a language picker is a single-select choice among options, not a set of commands. The trigger uses `aria-expanded` + `aria-haspopup="listbox"`; the container is `role="group"`; the panel is `role="listbox"` with `role="option"` items (not `role="menu"`/`role="menuitem"`). Active locale highlighted with `text-amber-text font-semibold`. Own hand-rolled behavior (not `useDropdownMenu` — see "Listbox vs. menu pattern" below): closes on outside click and on Escape, arrow-key (`ArrowUp`/`ArrowDown`/`Home`/`End`) traversal between options, and Escape **returns focus to the trigger button**. Precedes ThemeToggle and the login/user control in the nav bar.

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

### Section header (`% chapa <command>`)

`apps/web/components/SectionHeader.tsx` (#1214). A flex row with the
`% chapa <command>` marker on the left and a right-aligned meta readout
(`exit 0 · 5 results`, `3 steps · ~1 min`), and a
`border-stroke-strong` rule underneath. Both spans are `whitespace-nowrap`:
the pair is one line of terminal output, and the row wraps as a whole instead
of breaking either half. Pass `title` to put the real section name in the
accessibility tree, since `% chapa features` is a poor document-outline entry.

Use the meta only for something the reader can act on or verify. On a prose
page there is usually nothing to report, and an invented meta string is
decoration.

### Content page shell

`apps/web/components/content/ContentPageHeader.tsx` and
`OnThisPageIndex.tsx` (#1218). Every long-form route opens with the marker,
the title and a one-paragraph orientation; pages long enough to need one get
the sticky index, which highlights the current section with an accent rail.

Two things the index depends on:
- Each section heading needs a stable `id` and `scroll-mt-28`.
- The `<nav>` needs `self-start`. As a stretched grid child it would be as
  tall as the whole article, and sticky positioning would have no range to
  travel in.

### Tooltips (mandatory pattern)

Every tooltip/popover must be portal-rendered to `document.body` with `position: fixed`, viewport-relative coordinates (from `getBoundingClientRect()`), `z-index: 99999`, and `pointer-events: none`. Add a flip-below rule when the trigger is near the top of the viewport (`rect.top < 120`) so the tooltip doesn't clip off-screen. Never use `position: absolute` inside a scrollable/animated container — an ancestor with a CSS `transform` breaks `position: fixed` positioning unless the tooltip is portaled out of that subtree entirely (#1021). Reference implementations: `apps/web/components/InfoTooltip.tsx` and `apps/web/components/dashboard/ActivityHeatmap.tsx`'s `ChartTooltip`. (`lib/effects/heatmap/HeatmapGrid.tsx` was a third until #1191 retired the DOM badge that used it.)

### Terminal components

- **TerminalOutput**: `role="log" aria-live="polite"`, monospace, color-coded by line type
- **TerminalInput**: `chapa >` or `studio >` prompt, native editable input and history navigation; presentation context supplies page-theme or fixed ink colors.
- **AutocompleteDropdown**: `role="listbox"`, shows on `/` keystroke, accent color on active item
- **QuickControls**: Seven configuration groups drive the same Studio state and commands.

### Studio

The ice stage contains the canonical rendered SVG. Fit, 50% and 100% change only
preview presentation and never enter saved config. At desktop sizes the controls
and session form the workspace below the stage; narrow layouts stack and retain
scroll access. The saved schema remains seven fields and six palettes: Ice, Jade,
Indigo, Amber, Crimson and Mono. New/no-row/reset configs use Ice; saved rows
missing a palette resolve to Jade, and explicit saved palette colors stay intact.
The current renderer is `ice-terminal-v2` for every palette, with no selectable
historical layout. See `docs/svg-design.md` for geometry and cache versioning.

### Images

All avatar and user-uploaded images use the `.img-outline` utility class:
- 1px semi-transparent outline (`rgba(0,0,0,0.1)` light / `rgba(255,255,255,0.1)` dark)
- `outline-offset: -1px` so the outline sits inside the image boundary
- Prevents avatars from visually bleeding into matching backgrounds

### Code blocks

```
rounded-[3px] border border-stroke bg-card overflow-hidden
```

Terminal dots: `bg-terminal-red/60`, `bg-terminal-yellow/60`, `bg-terminal-green/60`.

## Background Effects

- **Grid pattern**: `.bg-grid-warm` — faint 72px grid lines at 4% opacity. Uses subtle black lines in light mode and neutral light lines in dark mode (both defined in `globals.css`).
- No ambient glow on dark backgrounds.

## Animations

Defined in `globals.css`; availability does not imply use in every redesigned section. Reduced-motion rules disable decorative motion, show inline badge activity immediately and retain the complete score ring. Badge SVG/static export behavior is specified in `docs/svg-design.md`.

| Class | Effect | Duration |
|-------|--------|----------|
| `animate-fade-in-up` | Fade in + slide up 30px | 0.8s ease-out |
| `animate-cursor-blink` | Step cursor blink | 1s infinite |
| `animate-terminal-fade-in` | Fade in + slide up 8px | 0.3s ease-out |
| `animate-pulse-glow-amber` | Historical name: neutral solid offset changes from 2px to 3px | 3s infinite |
| `animate-float-slow` | Gentle vertical float + slight rotation | 6s infinite |
| `animate-float-medium` | Medium vertical float + counter-rotation | 7.5s infinite |
| `animate-float-fast` | Faster vertical float + stronger rotation | 5s infinite |
| `animate-drift` | Multi-axis drift with 4 waypoints | 8s infinite |
| `animate-shimmer` | Horizontal shimmer gradient (left to right) | 3s linear infinite |
| `shimmer-sweep` (keyframe only) | Horizontal shimmer gradient (right to left) | (set per-element) |
| `animate-scale-in` | Scale from 0.92 + fade in | 0.6s ease-out |
| `animate-toast-out` | Scale to 0.95 + fade out + slide up 8px | 0.3s ease-in forwards |
| `animate-gauge-fill` | SVG circular gauge stroke fill | 1.5s ease-out |
| `animate-bar-fill` | Horizontal bar scale from 0 to target | 0.8s ease-out |
| `terminal-type` (keyframe only) | Typewriter width expansion (0 to 100%) | (set per-element) |
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
- Assume white text works on brand fills — use the paired action foreground.
- Touch badge SVG theme — it stays dark as an independent embeddable asset.
- Use pill corners for ordinary text/CTA buttons. Keep the explicit author signature pill and round avatars/icon buttons.


## Historical badge palettes

The five historical palette identifiers — Jade, Indigo, Amber, Crimson and Mono — retain their colors.
The redesign's additive Ice palette and global layout version are documented in
`docs/svg-design.md`. Badge output uses literal raster-compatible colors and one
renderer; it never inherits page theme or CSS custom properties. The historical
Jade references remain archived for comparison and rollback planning.
