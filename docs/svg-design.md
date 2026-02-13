# Chapa Badge SVG Design (React-to-SVG)

> Implementation: `apps/web/lib/render/BadgeSvg.tsx`

## Output formats
- Default: 1200x630 (wide)
- Theme: Warm Amber (dark card with purple/indigo accent)
- Rendering method: JSX `<svg>` template rendered server-side to string.

## Layout goals
- Premium dark card with purple accents (`#7C6AEF`)
- Strong hierarchy: header > archetype + metrics > heatmap + radar + score > footer
- Readable at small size
- Subtle animation only

## Layout (top to bottom)

### 1) Background frame
- Rounded rect with subtle gradient
- Border stroke (low opacity purple): `rgba(124,106,239,0.12)`

### 2) Header row (top)
- Avatar circle (30px radius, left-aligned)
- Display name (bold, large) or `@handle` fallback
- "CHAPA" label (right-aligned)
- All user text escaped via `escapeXml()` for XSS prevention

### 3) Archetype + metrics pill row
- **Archetype pill**: colored bracket icon + archetype label (e.g. "Builder", "Guardian")
- **Metric pills** (right of archetype, separated by dots):
  - Watch count (eye icon)
  - Fork count (fork icon)
  - Star count (star icon)
- Pills use rounded-rect backgrounds with subtle opacity

### 4) Main content row (three columns)

**Left column: Heatmap**
- 13 weeks x 7 days grid (91 cells)
- Cell size ~14px with ~3px gap
- 5 intensity colors from theme (purple-based):
  - 0: `rgba(124,106,239,0.06)` (none)
  - 1: `rgba(124,106,239,0.20)` (low)
  - 2: `rgba(124,106,239,0.38)` (medium)
  - 3: `rgba(124,106,239,0.58)` (high)
  - 4: `rgba(124,106,239,0.85)` (intense)
- Animation: fade-in by week group

**Center column: Radar chart**
- 4-point radar/spider chart showing dimension scores
- Axes: Building (top), Guarding (right), Consistency (bottom), Breadth (left)
- Filled polygon with purple accent fill at low opacity
- Axis labels at each corner
- Grid rings at 25%, 50%, 75%, 100%

**Right column: Score ring**
- Large circular score display (hero element)
- Animated arc showing adjusted composite score (0-100)
- Score number centered inside the ring
- Tier label below (color-coded: Emerging=gray, Solid=white, High=light purple, Elite=purple)

### 5) Footer
- "Powered by GitHub" + GitHub mark (behind `includeGithubBranding` flag)
- Branding isolated in `GithubBranding` component
- If disabled, layout stays balanced

### 6) Verification strip (optional, right edge)
- Coral-colored vertical strip on the right edge of the badge
- Shows verification hash + date
- Only present when `verificationHash` and `verificationDate` are provided
- Rendered by `VerificationStrip` component

## GitHub branding swap
- `includeGithubBranding: boolean`
- Branding isolated in `apps/web/lib/render/GithubBranding.tsx`
- If disabled, layout should still look balanced (no big empty gap).

## Theme tokens (Warm Amber)

Defined in `apps/web/lib/render/theme.ts`:

| Token | Value |
|-------|-------|
| bg | `#0C0D14` |
| card | `#13141E` |
| textPrimary | `#E6EDF3` |
| textSecondary | `#9AA4B2` |
| accent | `#7C6AEF` |
| stroke | `rgba(124,106,239,0.12)` |

### Heatmap palette (0..4)
| Level | Color |
|-------|-------|
| 0 (none) | `rgba(124,106,239,0.06)` |
| 1 (low) | `rgba(124,106,239,0.20)` |
| 2 (medium) | `rgba(124,106,239,0.38)` |
| 3 (high) | `rgba(124,106,239,0.58)` |
| 4 (intense) | `rgba(124,106,239,0.85)` |

### Tier colors
| Tier | Color |
|------|-------|
| Emerging | `#9AA4B2` (muted gray) |
| Solid | `#E6EDF3` (light) |
| High | `#9D8FFF` (light purple) |
| Elite | `#7C6AEF` (signature purple) |

### Archetype colors
| Archetype | Color |
|-----------|-------|
| Builder | `#7C6AEF` (purple) |
| Guardian | `#F472B6` (pink) |
| Marathoner | `#4ADE80` (green) |
| Polymath | `#FBBF24` (amber/gold) |
| Balanced | `#E6EDF3` (light gray) |
| Emerging | `#9AA4B2` (muted gray) |

## Typography
- All text uses system-safe fonts embedded in SVG
- Mono: JetBrains Mono (numbers, score, stats)
- Sizes:
  - Header name: ~28px
  - Archetype label: ~16px
  - Metric pill text: ~14px
  - Score number: ~52px
  - Tier label: ~18px
  - Radar axis labels: ~13px
  - Footer: ~12px

## Animation guidelines
- Minimal, not distracting
- Heatmap weeks fade-in 50–80ms stagger
- Score ring has subtle pulse animation
- Avoid large movements

## Data inputs

**From `StatsData`:**
- `handle`, `displayName`, `avatarUrl` (header)
- `totalStars`, `totalForks`, `totalWatchers` (metric pills)
- `heatmapData` (heatmap grid)

**From `ImpactV4Result`:**
- `archetype` (archetype pill)
- `dimensions` (radar chart: building, guarding, consistency, breadth)
- `adjustedComposite` (score ring)
- `tier` (tier label)

**From options:**
- `includeGithubBranding` (footer)
- `avatarDataUri` (inline avatar)
- `verificationHash`, `verificationDate` (verification strip)

## Accessibility
- Ensure contrast is high enough for legibility
- Avoid tiny text below 12px
- All user-controlled text HTML-escaped before SVG rendering
