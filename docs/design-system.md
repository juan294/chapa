# Chapa Design System

This is the single source of truth for visual design decisions. All agents working on UI must follow these guidelines.

## Theme: Warm Amber

Dark developer-tool aesthetic with warm, premium undertones. Think luxury dev tools — sophisticated, warm, technical.

## Colors

Defined in `apps/web/styles/globals.css` via Tailwind v4 `@theme`:

| Token | Hex | Tailwind class | Usage |
|-------|-----|----------------|-------|
| `--color-bg` | `#12100D` | `bg-bg` | Page background (warm dark) |
| `--color-card` | `#1A1610` | `bg-card` | Card/panel backgrounds |
| `--color-text-primary` | `#E6EDF3` | `text-text-primary` | Headings, body text |
| `--color-text-secondary` | `#9AA4B2` | `text-text-secondary` | Muted text, labels |
| `--color-amber` | `#E2A84B` | `text-amber`, `bg-amber` | Primary accent — CTAs, highlights, data |
| `--color-amber-light` | `#F0C97D` | `text-amber-light`, `bg-amber-light` | Hover states, lighter accent |
| `--color-amber-dark` | `#C28A2E` | `text-amber-dark`, `bg-amber-dark` | Darker accent variant |
| `--color-stroke` | `rgba(226,168,75,0.12)` | `border-stroke` | Borders, dividers (amber-tinted) |
| `--color-warm-bg` | `#12100D` | `bg-warm-bg` | Alias for page background |
| `--color-warm-card` | `#1A1610` | `bg-warm-card` | Alias for card background |
| `--color-warm-stroke` | `rgba(226,168,75,0.12)` | `border-warm-stroke` | Alias for warm-tinted borders |

### Color rules

- Amber (`#E2A84B`) is the signature accent. Use sparingly — CTAs, active states, key data points, section highlights.
- Never use neon/bright greens or blues. The palette is warm and sophisticated.
- Use Tailwind opacity modifiers for amber variants: `bg-amber/10`, `text-amber/70`, `border-amber/20`.
- Ambient glow effects use `bg-amber/[0.03]` to `bg-amber/[0.06]` with `blur-[120px]`+.
- Cards use semi-transparent backgrounds where needed: `bg-warm-card/50`, `bg-warm-card/60`.

## Typography

Two fonts loaded via `next/font/google` in `apps/web/app/layout.tsx`:

| Role | Font | Tailwind class | CSS variable | Weights |
|------|------|----------------|-------------|---------|
| Headings | **JetBrains Mono** | `font-heading` | `--font-jetbrains-mono` | 400, 500, 700, 800 |
| Body/UI | **Plus Jakarta Sans** | `font-body` | `--font-plus-jakarta` | 400, 500, 600, 700 |

### Typography rules

- All `<h1>`–`<h3>` elements use `font-heading` (JetBrains Mono).
- Body text, labels, buttons, and UI chrome use `font-body` (Plus Jakarta Sans) — this is the default on `<body>`.
- JetBrains Mono is monospace — do NOT use `italic` with it. Use `font-bold` or `font-extrabold` for emphasis.
- Accent text in headings uses `text-amber` (not italic).
- Heading sizes follow responsive scale: `text-3xl sm:text-4xl md:text-5xl` for section heads, larger for hero.
- Use `tracking-tight` on headings. Use `leading-relaxed` on body paragraphs.

## Spacing & Layout

- Max content width: `max-w-7xl` (nav, features grid), `max-w-5xl` (mid sections), `max-w-4xl` (hero text, badge preview).
- Section padding: `py-32` for full sections. Generous vertical space between sections.
- Horizontal padding: `px-6` on all containers.
- Section dividers: `border-t border-warm-stroke` — subtle amber-tinted, not heavy.
- Section eyebrows: Uppercase amber text above section headings (`text-amber text-sm tracking-widest uppercase mb-4`).

## Components

### Cards

```
rounded-2xl border border-warm-stroke bg-warm-card/50 p-8
```

Hover state: `hover:border-amber/20 hover:bg-warm-card`

### Buttons (Primary)

```
rounded-full bg-amber px-8 py-3.5 text-base font-semibold text-warm-bg
hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25
```

Dark text on amber background. Always `rounded-full`.

### Buttons (Ghost/Outline)

```
rounded-full border border-warm-stroke px-8 py-3.5 text-base font-medium text-text-secondary
hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]
```

### Navigation

- Fixed top, backdrop-blur: `fixed top-0 z-50 border-b border-warm-stroke bg-warm-bg/80 backdrop-blur-xl`
- Nav links in a pill container: `rounded-full border border-warm-stroke bg-warm-card/60`
- CTA button: amber `rounded-full` with GitHub icon

### Terminal/Code blocks

```
rounded-xl border border-warm-stroke bg-[#0d0b08] overflow-hidden
```

Header with three dots: `w-3 h-3 rounded-full` using `bg-amber/20`, `bg-amber/10`, `bg-amber/[0.06]` (warm gradient tones).

## Background Effects

- **Grid pattern**: `.bg-grid-warm` class — faint 72px grid lines at 3% opacity, amber-tinted.
- **Ambient glow**: Large `rounded-full` divs with `bg-amber/[0.03-0.06]` and `blur-[120px-150px]`, positioned absolute behind content.
- Dark theme ONLY. No light mode.

## Animations

Defined in `globals.css`:

| Class | Effect | Duration |
|-------|--------|----------|
| `animate-fade-in-up` | Fade in + slide up 30px | 0.8s ease-out |
| `animate-pulse-glow-amber` | Pulsing amber box-shadow | 3s infinite |
| `animate-float-slow` | Gentle vertical float | 6s infinite |
| `animate-float-medium` | Gentle vertical float | 7.5s infinite |
| `animate-float-fast` | Gentle vertical float | 5s infinite |
| `animate-drift` | Multi-directional drift | 8s infinite |
| `animate-shimmer` | Horizontal shimmer gradient | 3s linear infinite |
| `animate-scale-in` | Scale from 0.92 + fade in | 0.6s ease-out |

Use `[animation-delay:Xms]` for staggered reveals.

## Icons

- Inline SVG components — no icon library dependency.
- Stroke icons: `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
- Always include `aria-hidden="true"` on decorative icons.
- GitHub icon uses the official octocat SVG path (fill, not stroke).
- Decorative icons: `DiamondIcon` and `StarIcon` for floating elements and social proof.

## Hero Layout

- **Two-column layout**: Text content on the left, badge preview card on the right.
- Floating decorative pills with stats (commits, tier, PRs) around the hero area.
- Diamond icons scattered as decorative elements.
- Social proof row below CTAs: avatar circles + 5 star icons + developer count.
- Badge card as hero centerpiece with shimmer top edge and outer amber glow.

## Do NOT

- Use bright/neon colors (`#39FF88`, `#80CCB4` and similar are not in this palette).
- Use italic on monospace headings.
- Add a light mode or theme toggle.
- Use icon libraries (lucide, heroicons, etc.) — keep inline SVGs.
- Use `Inter`, `Roboto`, `Arial`, or other generic fonts anywhere.
- Add heavy shadows or gradients — keep effects subtle and muted.
- Use cool-toned blues for backgrounds — keep everything warm-tinted.
