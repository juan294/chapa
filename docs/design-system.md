# Chapa Design System

This is the single source of truth for visual design decisions. All agents working on UI must follow these guidelines.

## Theme: Midnight Mint

Dark developer-tool aesthetic. Think Vercel, Linear, Raycast — premium, minimal, technical.

## Colors

Defined in `apps/web/styles/globals.css` via Tailwind v4 `@theme`:

| Token | Hex | Tailwind class | Usage |
|-------|-----|----------------|-------|
| `--color-bg` | `#0B0F14` | `bg-bg` | Page background |
| `--color-card` | `#0F1720` | `bg-card` | Card/panel backgrounds |
| `--color-text-primary` | `#E6EDF3` | `text-text-primary` | Headings, body text |
| `--color-text-secondary` | `#9AA4B2` | `text-text-secondary` | Muted text, labels |
| `--color-mint` | `#80CCB4` | `text-mint`, `bg-mint` | Primary accent — CTAs, highlights, data |
| `--color-stroke` | `rgba(230,237,243,0.12)` | `border-stroke` | Borders, dividers |

### Color rules

- Mint (`#80CCB4`) is the signature accent. Use sparingly — CTAs, active states, key data points, section highlights.
- Never use bright/neon greens. The palette is muted and sophisticated.
- Use Tailwind opacity modifiers for mint variants: `bg-mint/10`, `text-mint/70`, `border-mint/20`.
- Ambient glow effects use `bg-mint/[0.04]` to `bg-mint/[0.06]` with `blur-[120px]`+.
- Cards use semi-transparent backgrounds where needed: `bg-card/50`, `bg-card/80`.

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
- Accent text in headings uses `text-mint` (not italic).
- Heading sizes follow responsive scale: `text-3xl sm:text-4xl md:text-5xl` for section heads, larger for hero.
- Use `tracking-tight` on headings. Use `leading-relaxed` on body paragraphs.

## Spacing & Layout

- Max content width: `max-w-7xl` (nav, features grid), `max-w-5xl` (mid sections), `max-w-4xl` (hero text, badge preview).
- Section padding: `py-32` for full sections. Generous vertical space between sections.
- Horizontal padding: `px-6` on all containers.
- Section dividers: `border-t border-stroke/50` — subtle, not heavy.

## Components

### Cards

```
rounded-2xl border border-stroke bg-card/50 p-8
```

Hover state: `hover:border-mint/20 hover:bg-card`

### Buttons (Primary)

```
rounded-full bg-mint px-8 py-3.5 text-base font-semibold text-bg
hover:shadow-xl hover:shadow-mint/25
```

Dark text on mint background. Always `rounded-full`.

### Buttons (Ghost/Outline)

```
rounded-full border border-stroke px-8 py-3.5 text-base font-medium text-text-secondary
hover:border-text-secondary/30 hover:text-text-primary hover:bg-white/[0.02]
```

### Navigation

- Fixed top, backdrop-blur: `fixed top-0 z-50 border-b border-stroke/50 bg-bg/80 backdrop-blur-xl`
- Nav links in a pill container: `rounded-full border border-stroke bg-card/50`
- CTA button: mint `rounded-full` with GitHub icon

### Terminal/Code blocks

```
rounded-xl border border-stroke bg-[#0a0e13] overflow-hidden
```

Header with three dots: `w-3 h-3 rounded-full bg-white/[0.06]`

## Background Effects

- **Grid pattern**: `.bg-grid` class — faint 64px grid lines at 3% opacity.
- **Ambient glow**: Large `rounded-full` divs with `bg-mint/[0.04-0.06]` and `blur-[120px-150px]`, positioned absolute behind content.
- Dark theme ONLY. No light mode.

## Animations

Defined in `globals.css`:

| Class | Effect | Duration |
|-------|--------|----------|
| `animate-fade-in-up` | Fade in + slide up 30px | 0.8s ease-out |
| `animate-pulse-glow` | Pulsing mint box-shadow | 3s infinite |
| `animate-float-slow` | Gentle vertical float | 6s infinite |
| `animate-float-medium` | Gentle vertical float | 7.5s infinite |
| `animate-float-fast` | Gentle vertical float | 5s infinite |

Use `[animation-delay:Xms]` for staggered reveals.

## Icons

- Inline SVG components — no icon library dependency.
- Stroke icons: `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
- Always include `aria-hidden="true"` on decorative icons.
- GitHub icon uses the official octocat SVG path (fill, not stroke).

## Do NOT

- Use bright/neon colors (`#39FF88` and similar are too bright).
- Use italic on monospace headings.
- Add a light mode or theme toggle.
- Use icon libraries (lucide, heroicons, etc.) — keep inline SVGs.
- Use `Inter`, `Roboto`, `Arial`, or other generic fonts anywhere.
- Add heavy shadows or gradients — keep effects subtle and muted.
