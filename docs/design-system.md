# Chapa Design System

This is the single source of truth for visual design decisions. All agents working on UI must follow these guidelines.

## Theme: Light + Purple Accent

Clean, airy, professional aesthetic. White backgrounds dominate, with purple (`#7C6AEF`) used sparingly for CTAs and highlights. Dark sections (`#1A1A2E`) used strategically for emphasis bands (stats, CTA). Badge SVG remains dark-themed as an independent embeddable asset.

## Colors

Defined in `apps/web/styles/globals.css` via Tailwind v4 `@theme`:

| Token | Hex | Tailwind class | Usage |
|-------|-----|----------------|-------|
| `--color-bg` | `#FFFFFF` | `bg-bg` | Page background (white) |
| `--color-card` | `#F9FAFB` | `bg-card` | Card/panel backgrounds (very light gray) |
| `--color-text-primary` | `#1A1A2E` | `text-text-primary` | Headings, body text (deep navy-dark) |
| `--color-text-secondary` | `#6B7280` | `text-text-secondary` | Muted text, labels |
| `--color-amber` | `#7C6AEF` | `text-amber`, `bg-amber` | Primary accent — CTAs, highlights, data |
| `--color-amber-light` | `#9D8FFF` | `text-amber-light`, `bg-amber-light` | Hover states, lighter accent |
| `--color-amber-dark` | `#5E4FCC` | `text-amber-dark`, `bg-amber-dark` | Darker accent variant |
| `--color-stroke` | `rgba(0,0,0,0.08)` | `border-stroke` | Borders, dividers (neutral soft) |
| `--color-warm-bg` | `#FFFFFF` | `bg-warm-bg` | Alias for page background |
| `--color-warm-card` | `#F9FAFB` | `bg-warm-card` | Alias for card background |
| `--color-warm-stroke` | `rgba(0,0,0,0.08)` | `border-warm-stroke` | Alias for neutral borders |
| `--color-dark-section` | `#1A1A2E` | `bg-dark-section` | Dark emphasis band backgrounds |
| `--color-dark-card` | `#252542` | `bg-dark-card` | Cards inside dark sections |
| `--color-purple-tint` | `#F5F3FF` | `bg-purple-tint` | Light purple section backgrounds |
| `--color-complement` | `#10B981` | `text-complement` | Soft teal accent (sparingly) |
| `--color-complement-light` | `#D1FAE5` | `bg-complement-light` | Teal tint for light backgrounds |

### Color rules

- Purple (`#7C6AEF`) is the signature accent. Use sparingly — CTAs, active states, key data points.
- White backgrounds dominate. Use `bg-purple-tint` for featured sections (e.g. Features).
- Dark sections (`bg-dark-section`) used for emphasis: stats band, final CTA. Text in dark sections uses `text-white` or `text-[#9AA4B2]`.
- Use Tailwind opacity modifiers: `bg-amber/10`, `text-amber/70`, `border-amber/20`.
- No ambient glow blurs on light backgrounds — they are invisible and add unnecessary DOM.
- Cards use `bg-card` or `bg-white` with `border-stroke` and optional `shadow-sm`.
- Button text on purple background: always `text-white` (not `text-warm-bg`).

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
- Accent text in headings uses `text-amber`.
- Heading sizes: `text-3xl sm:text-4xl md:text-5xl` for section heads, larger for hero.
- Use `tracking-tight` on headings. Use `leading-relaxed` on body paragraphs.

## Spacing & Layout

- Max content width: `max-w-7xl` (nav, features grid), `max-w-5xl` (mid sections), `max-w-4xl` (hero text).
- Section padding: `py-32` for full sections.
- Horizontal padding: `px-6` on all containers.
- Section dividers: `border-t border-stroke` — subtle neutral borders.
- Section eyebrows: `text-amber text-sm tracking-widest uppercase mb-4`.

## Section Pattern

The landing page alternates between light and dark sections:

1. **Hero** — White background, clean text + dark badge card
2. **Badge Preview** — White background, dark code block
3. **Features** — `bg-purple-tint`, white cards with `shadow-sm`
4. **How It Works** — White background
5. **Stats** — `bg-dark-section` (dark emphasis band)
6. **Final CTA** — `bg-dark-section` (dark emphasis band)
7. **Footer** — White background

## Components

### Cards (light sections)

```
rounded-2xl border border-stroke bg-white p-8 shadow-sm
```

Hover: `hover:border-amber/30 hover:shadow-md`

### Cards (dark sections)

```
rounded-2xl border border-amber/15 bg-dark-card p-10
```

### Buttons (Primary)

```
rounded-full bg-amber px-8 py-3.5 text-base font-semibold text-white
hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25
```

White text on purple. Always `rounded-full`.

### Buttons (Ghost/Outline)

```
rounded-full border border-stroke px-8 py-3.5 text-base font-medium text-text-secondary
hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]
```

### Navigation

- Fixed top, frosted glass: `fixed top-0 z-50 border-b border-stroke bg-white/80 backdrop-blur-xl`
- Nav links pill: `rounded-full border border-stroke bg-card/60`
- CTA button: `bg-amber text-white rounded-full`

### Code blocks (always dark)

```
rounded-xl border border-black/10 bg-[#1A1A2E] overflow-hidden shadow-lg
```

Terminal dots: `bg-red-400/60`, `bg-yellow-400/60`, `bg-green-400/60`.

## Background Effects

- **Grid pattern**: `.bg-grid-warm` — faint 72px grid lines at 3% opacity, neutral gray.
- **No ambient glow** on light sections (invisible on white).
- Light theme ONLY. No dark mode toggle.

## Animations

Defined in `globals.css`:

| Class | Effect | Duration |
|-------|--------|----------|
| `animate-fade-in-up` | Fade in + slide up 30px | 0.8s ease-out |
| `animate-pulse-glow-amber` | Soft pulsing indigo shadow | 3s infinite |
| `animate-float-slow` | Gentle vertical float | 6s infinite |
| `animate-float-medium` | Gentle vertical float | 7.5s infinite |
| `animate-float-fast` | Gentle vertical float | 5s infinite |
| `animate-drift` | Multi-directional drift | 8s infinite |
| `animate-shimmer` | Horizontal shimmer gradient | 3s linear infinite |
| `animate-scale-in` | Scale from 0.92 + fade in | 0.6s ease-out |

## Icons

- Inline SVG components — no icon library dependency.
- Stroke icons: `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
- Always include `aria-hidden="true"` on decorative icons.
- GitHub icon uses the official octocat SVG path (fill, not stroke).

## Do NOT

- Use the old dark colors (`#0C0D14`, `#13141E`, `#E6EDF3`, `#9AA4B2`) in light sections.
- Use italic on monospace headings.
- Add a dark mode or theme toggle.
- Use icon libraries (lucide, heroicons, etc.) — keep inline SVGs.
- Use `Inter`, `Roboto`, `Arial`, or other generic fonts.
- Add ambient glow blurs on white backgrounds (invisible, wastes DOM).
- Use `text-warm-bg` for button text — use `text-white` instead.
- Touch badge SVG theme — it stays dark as an independent embeddable asset.
