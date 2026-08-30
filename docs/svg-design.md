# Chapa Badge SVG Design (React-to-SVG)

> Implementation: `apps/web/lib/render/BadgeSvg.tsx`

## Badge version history

| Version | Changes |
|---------|---------|
| **v1** | Initial badge: 4-axis diamond radar, heatmap, score ring, archetype pill |
| **v2** | Added craft score pill (AI Craft indicator) in footer area |
| **v3** | Pentagon radar (5 axes) when craft dimension is present; removed standalone craft pill. Graceful fallback to 4-axis diamond when craft is absent. |

## Output formats
- Default: 1200x630 (wide)
- Theme: Warm Amber (dark card with purple/indigo accent)
- Rendering method: JSX `<svg>` template rendered server-side to string.

## Layout goals
- Premium dark card with jade accents (`#1BD093`)
- Strong hierarchy: header > archetype + metrics > heatmap + radar + score > footer
- Readable at small size
- Subtle animation only

## Layout (top to bottom)

### 1) Background frame
- Rounded rect with subtle gradient
- Border stroke (low opacity purple): `accentTint(0.12)`

### 2) Header row (top)
- Avatar circle (30px radius, left-aligned)
- Display name (bold, large) or `@handle` fallback
- "CHAPA" label (right-aligned)
- All user text escaped via `escapeXml()` for XSS prevention

### 3) Archetype + metrics pill row
- **Archetype pill**: colored bracket icon + archetype label (e.g. "Builder", "Quality Champion")
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
  - 0: `accentTint(0.12)` (none)
  - 1: `accentTint(0.30)` (low)
  - 2: `accentTint(0.48)` (medium)
  - 3: `accentTint(0.68)` (high)
  - 4: `accentTint(0.92)` (intense)
- Animation: left-to-right column sweep, 60ms per week group (the `fade-in` config value; see #1226 for why the value's name does not describe it)

**Center column: Radar chart**
- Dynamic radar/spider chart showing dimension scores
- **Pentagon mode** (5 axes, 72° spacing): When craft dimension is present in `DimensionScores`. Axes: Delivery (top), Quality, Consistency, Breadth, Craft (clockwise).
- **Diamond mode** (4 axes, 90° spacing): When craft is absent. Axes: Delivery (top), Quality (right), Consistency (bottom), Breadth (left). Identical to v1/v2 layout.
- Filled polygon with purple accent fill at low opacity
- Axis labels at each vertex
- Guide rings at 25%, 50%, 75%, 100% (shape matches axis count: pentagon or diamond)
- Data point dots at each axis vertex
- Implementation: `apps/web/lib/render/RadarChart.ts`

**Right column: Score ring**
- Large circular score display (hero element)
- Animated arc showing adjusted composite score (0-100)
- Score number centered inside the ring
- Tier label below (color-coded: Emerging=gray, Solid=white, High=light purple, Elite=purple)

### 5) Footer
- "Forged from purpose. Driven by curiosity." text + dynamic platform logos (behind `includeBranding` flag)
- Platform logos shown: GitHub always, plus Bitbucket/Codeberg/GitLab if user has linked them
- Demo badges show all 4 platform logos regardless of linked status
- Branding isolated in `BadgeBranding` component
- If disabled, layout stays balanced

### 6) Verification strip (optional, right edge)
- Coral-colored vertical strip on the right edge of the badge
- Shows verification hash + date
- Only present when `verificationHash` and `verificationDate` are provided
- Rendered by `VerificationStrip` component

## Badge branding
- `includeBranding: boolean`
- Branding isolated in `apps/web/lib/render/BadgeBranding.tsx`
- Shows "Forged from purpose. Driven by curiosity." + dynamic platform logos (GitHub, Bitbucket, Codeberg, GitLab)
- If disabled, layout should still look balanced (no big empty gap).
- Platform logo paths, canonical platform ordering, and the coral verification color are owned by the client-safe `apps/web/lib/badge-visual-metadata.ts` module. The server SVG renderer and Creator Studio preview both consume this metadata so the two surfaces stay in parity without a client import from server render modules.
- Creator Studio does not reproduce this footer any more. It renders `renderBadgeSvg` output directly (#1191, step 6), so it gets `BadgeBranding.tsx` and `VerificationStrip.tsx` themselves rather than a parity copy — and a saved Studio configuration does alter the public SVG badge.

## Theme tokens (Jade)

Defined in `apps/web/lib/render/theme.ts`. #1225 converged the accent and the
seven archetype colours onto the app's Jade tokens; the ground stayed as it was.

| Token | Value |
|-------|-------|
| bg | `#0C0D14` |
| card | `#13141E` |
| textPrimary | `#E6EDF3` |
| textSecondary | `#9AA4B2` |
| accent | `#1BD093` |
| accentLight | `#65E7B0` |
| stroke | `accentTint(0.12)` |

Never write an `rgba(...)` accent literal here — derive it with
`accentTint(alpha)`. The palette lives in one place so it cannot scatter again,
and `lib/render/badge-palette.test.ts` enforces that.

### Heatmap palette (0..4)
| Level | Color |
|-------|-------|
| 0 (none) | `accentTint(0.12)` |
| 1 (low) | `accentTint(0.30)` |
| 2 (medium) | `accentTint(0.48)` |
| 3 (high) | `accentTint(0.68)` |
| 4 (intense) | `accentTint(0.92)` |

### Tier colors
| Tier | Color |
|------|-------|
| Emerging | `#9AA4B2` (muted gray) |
| Solid | `#E6EDF3` (light) |
| High | `#65E7B0` (light jade) |
| Elite | `#1BD093` (signature jade) |

### Archetype colors

Converted from the app's `--color-archetype-*` tokens, all `oklch(.62 .14 <hue>)`
(#1225). Hue is the only thing that varies; keep that if an eighth is added.

| Archetype | Color | Hue |
|-----------|-------|-----|
| Builder | `#009F6D` (jade) | 163 |
| Quality Champion | `#B464AE` (magenta) | 330 |
| Marathoner | `#479C4D` (leaf) | 145 |
| Polymath | `#8C8C00` (olive) | 110 |
| Balanced | `#0A8FD1` (blue) | 240 |
| Emerging | `#C7692C` (orange) | 50 |
| Artificer | `#B67700` (amber) | 75 |

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

**From `ImpactV6Result`:**
- `archetype` (archetype pill)
- `dimensions` (radar chart: delivery, quality, consistency, breadth, and optionally craft)
- `adjustedComposite` (score ring)
- `tier` (tier label)

**From options:**
- `includeBranding` (footer)
- `avatarDataUri` (inline avatar)
- `verificationHash`, `verificationDate` (verification strip)
- ~~`craftScore`~~ — removed in v3 (craft is now a radar axis, not a separate pill)

## Accessibility
- Ensure contrast is high enough for legibility
- Avoid tiny text below 12px
- All user-controlled text HTML-escaped before SVG rendering
