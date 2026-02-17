# Embeddable SVG Badge — Design Spec v1.2

> **Version**: 1.2
> **Source of truth for**: The server-rendered SVG badge at `/u/:handle/badge.svg`
> **NOT for**: The React component (`BadgeContent.tsx`) used in Creator Studio — see [`badge-design-v1.md`](./badge-design-v1.md)
>
> **Acid test**: Give this document to any LLM or designer and they should produce a pixel-identical SVG.

---

## Table of Contents

1. [Canvas & Background](#1-canvas--background)
2. [Header Row](#2-header-row)
3. [Metadata Pills Row](#3-metadata-pills-row)
4. [Heatmap Grid](#4-heatmap-grid)
5. [Radar Chart](#5-radar-chart)
6. [Score Ring](#6-score-ring)
7. [Tier Label](#7-tier-label)
8. [Footer](#8-footer)
9. [Verification Strip](#9-verification-strip)
10. [Color Palette](#10-color-palette)
11. [Typography](#11-typography)
12. [Animations](#12-animations)
13. [Dynamic Data Contract](#13-dynamic-data-contract)
14. [Reference Screenshot](#14-reference-screenshot)

---

## 1. Canvas & Background

```
┌──────────────────────────────────────────────────────────────┐
│  1200 × 630 px, rounded corners, inner stroke               │
└──────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Width | `1200` |
| Height | `630` |
| Padding (all sides) | `60` (referred to as `PAD` throughout) |
| Border radius (outer rect) | `20` |
| Background fill | `#0C0D14` |
| Inner stroke rect | `x="1" y="1" width="1198" height="628" rx="19"` |
| Inner stroke color | `rgba(124,106,239,0.12)` |
| Inner stroke width | `2` |
| Inner stroke fill | `none` |

**SVG root element:**
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
```

---

## 2. Header Row

```
┌──────────────────────────────────────────────────────────────┐
│  (●) DisplayName              Chapa_                         │
│      🛡 Verified metrics                                     │
└──────────────────────────────────────────────────────────────┘
```

**Baseline Y**: `headerY = 80`

### 2a. Avatar (circular clip)

| Property | Value |
|----------|-------|
| Center X (`avatarCX`) | `PAD + 30` = `90` |
| Center Y (`avatarCY`) | `80` |
| Radius (`avatarR`) | `30` |
| Background circle fill | `rgba(124,106,239,0.10)` |
| Background circle stroke | `rgba(124,106,239,0.25)` |
| Background circle stroke-width | `2` |
| Clip path | `<clipPath id="avatar-clip"><circle cx="90" cy="80" r="30"/></clipPath>` |

**With avatar image:**
```xml
<image href="{dataUri}" x="60" y="50" width="60" height="60" clip-path="url(#avatar-clip)"/>
```

**Fallback (no avatar)** — GitHub octocat silhouette:
- Transform: `translate(76, 66)` (i.e., `avatarCX - 14`, `avatarCY - 14`)
- 28×28 px octocat path, `fill="{textSecondary}"`, `opacity="0.6"`

<details>
<summary>Octocat SVG path (click to expand)</summary>

```
M14 0C6.27 0 0 6.27 0 14c0 6.19 4.01 11.43 9.57 13.28.7.13.96-.3.96-.67 0-.34-.01-1.45-.02-2.61-3.52.64-4.42-.86-4.7-1.65-.16-.4-.84-1.65-1.44-1.98-.49-.26-1.19-.91-.02-.92 1.1-.02 1.89 1.01 2.16 1.43 1.26 2.12 3.27 1.52 4.07 1.16.13-.91.49-1.52.89-1.87-3.11-.35-6.37-1.55-6.37-6.92 0-1.52.55-2.78 1.44-3.76-.14-.35-.63-1.78.14-3.71 0 0 1.17-.37 3.85 1.44 1.12-.31 2.31-.47 3.5-.47s2.38.16 3.5.47c2.68-1.82 3.85-1.44 3.85-1.44.77 1.93.28 3.36.14 3.71.9.98 1.44 2.23 1.44 3.76 0 5.39-3.27 6.57-6.39 6.91.5.43.95 1.28.95 2.58 0 1.87-.02 3.37-.02 3.83 0 .37.26.81.96.67A14.03 14.03 0 0028 14c0-7.73-6.27-14-14-14z
```
</details>

### 2b. Handle / Display Name

| Property | Value |
|----------|-------|
| X | `PAD + 72` = `132` |
| Y | `headerY - 6` = `74` |
| Font family | `'Plus Jakarta Sans', system-ui, sans-serif` |
| Font size | `26` |
| Font weight | `600` |
| Fill | `#E6EDF3` (textPrimary) |
| Content | `displayName` if set, otherwise `@handle` |

### 2c. Verified Shield Icon + Subtitle

**Shield icon (scaled 0.7×):**

| Property | Value |
|----------|-------|
| Group transform | `translate(132, 86)` (i.e., `PAD + 72`, `headerY + 6`) |
| Group opacity | `0.4` |
| Path scale | `scale(0.7)` — effective size ~17×17 |
| Path fill | `#7C6AEF` (accent) |

Shield path:
```
M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z
```

**"Verified metrics" text:**

| Property | Value |
|----------|-------|
| X | `PAD + 72 + 20` = `152` |
| Y | `headerY + 20` = `100` |
| Font family | `'Plus Jakarta Sans', system-ui, sans-serif` |
| Font size | `19` |
| Fill | `#9AA4B2` (textSecondary) |
| Content | `Verified metrics` (static) |

### 2d. "Chapa_" Logo (top-right)

| Property | Value |
|----------|-------|
| X | `W - PAD` = `1140` |
| Y | `headerY + 2` = `82` |
| Font family | `'JetBrains Mono', monospace` |
| Font size | `22` |
| Fill | `#9AA4B2` (textSecondary) |
| Opacity | `0.7` |
| Text anchor | `end` |
| Letter spacing | `-0.5` |
| Content | `Chapa` + `<tspan fill="#7C6AEF">_</tspan>` |

---

## 3. Metadata Pills Row

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [< > Builder]  ·  [▦ 4 Repos]  ·  [👁 3 Watch]  ·  [⑂ 1 Fork]  ·  [★ 12 Star] │
└──────────────────────────────────────────────────────────────────────────┘
```

**Row baseline Y**: `metaRowY = 160`

### 3a. Layout Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `pillH` | `34` | Pill height |
| `pillR` | `17` | Pill border-radius (fully rounded) |
| `pillGap` | `8` | Gap between pills |
| `dotGap` | `6` | Extra space for `·` separator |
| `metricCharW` | `8` | Approximate character width for metric labels |

### 3b. Pill X Positioning Formula

Each pill group is positioned using cumulative offsets. Let `X0 = heatmapX = PAD = 60`:

```
Archetype pill:  X0
Dot separator 1: X0 + archetypePillWidth + pillGap + dotGap
Repos pill:       X0 + archetypePillWidth + pillGap + dotGap*2 + pillGap
Dot separator 2: <repos pill X> + reposPillW + pillGap + dotGap
Watch pill:       <repos pill X> + reposPillW + pillGap + dotGap*2 + pillGap
Dot separator 3: <watch pill X> + watchPillW + pillGap + dotGap
Fork pill:        <watch pill X> + watchPillW + pillGap + dotGap*2 + pillGap
Dot separator 4: <fork pill X> + forkPillW + pillGap + dotGap
Star pill:        <fork pill X> + forkPillW + pillGap + dotGap*2 + pillGap
```

All pills are vertically centered at `metaRowY` via `translate(x, metaRowY - pillH/2)` = `translate(x, 143)`.

### 3c. Archetype Pill

**Width formula**: `14 + 20 + 6 + archetypeText.length * 10 + 14`

| Component | Size |
|-----------|------|
| Left padding | `14` |
| Icon space | `20` |
| Gap after icon | `6` |
| Text (per char) | `10` |
| Right padding | `14` |

**Pill background:**

| Property | Value |
|----------|-------|
| Fill | `rgba(124,106,239,0.10)` |
| Stroke | `rgba(124,106,239,0.25)` |
| Stroke width | `1` |

**Code-brackets icon** (inside pill, offset `translate(14, 8)`):

```xml
<path d="M8 2L3 8.5L8 15" fill="none" stroke="{archetypeColor}" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"/>
<path d="M14 2L19 8.5L14 15" fill="none" stroke="{archetypeColor}" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"/>
```

**Archetype text:**

| Property | Value |
|----------|-------|
| X | `14 + 20 + 6 + archetypeText.length * 10 / 2` (centered over text area) |
| Y | `23` (within pill group) |
| Font family | `'Plus Jakarta Sans', system-ui, sans-serif` |
| Font size | `17` |
| Font weight | `600` |
| Fill | `{archetypeColor}` (see [Color Palette](#10-color-palette)) |
| Text anchor | `middle` |

### 3d. Dot Separators

| Property | Value |
|----------|-------|
| Character | `\u00B7` (middle dot) |
| Y | `metaRowY + 5` = `165` |
| Font family | `'Plus Jakarta Sans', system-ui, sans-serif` |
| Font size | `16` |
| Fill | `#9AA4B2` (textSecondary) |
| Opacity | `0.4` |

### 3e. Metric Pills (Repos, Watch, Fork, Star)

**Width formula** (same for all three): `12 + 16 + 6 + label.length * 8 + 12`

| Component | Size |
|-----------|------|
| Left padding | `12` |
| Icon space | `16` |
| Gap after icon | `6` |
| Text (per char) | `8` |
| Right padding | `12` |

**Pill background (all four metric pills):**

| Property | Value |
|----------|-------|
| Fill | `rgba(124,106,239,0.06)` |
| Stroke | `rgba(124,106,239,0.15)` |
| Stroke width | `1` |

**Label text (all four):**

| Property | Value |
|----------|-------|
| X | `12 + 16 + 6` = `34` (within pill group) |
| Y | `23` (within pill group) |
| Font family | `'Plus Jakarta Sans', system-ui, sans-serif` |
| Font size | `14` |
| Fill | `#9AA4B2` (textSecondary) |

**Label content** (dynamic):
- Repos: `"{count} Repos"` — e.g., `4 Repos`
- Watch: `"{count} Watch"` — e.g., `3 Watch`
- Fork: `"{count} Fork"` — e.g., `1 Fork`
- Star: `"★ {count} Star"` — the star character `\u2605` is a `<tspan fill="#7C6AEF">` prefix

**Icons** (all at `translate(12, 9)` within their pill group):

<details>
<summary>Repos icon (grid/repo) — click to expand</summary>

```xml
<g opacity="0.7">
  <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm6 0v10M2 8h12"
        fill="none" stroke="#9AA4B2" stroke-width="1.3"
        stroke-linecap="round" stroke-linejoin="round"/>
</g>
```
</details>

<details>
<summary>Watch icon (eye) — click to expand</summary>

```xml
<path d="M1 7.5C1 7.5 3.5 2.5 8 2.5S15 7.5 15 7.5S12.5 12.5 8 12.5S1 7.5 1 7.5Z"
      fill="none" stroke="#9AA4B2" stroke-width="1.3"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
<circle cx="8" cy="7.5" r="2.5" fill="none" stroke="#9AA4B2" stroke-width="1.3" opacity="0.7"/>
```
</details>

<details>
<summary>Fork icon (git fork) — click to expand</summary>

```xml
<g opacity="0.7">
  <path d="M6 3a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM6 11a2 2 0 1 0-4 0 2 2 0 0 0 4 0z
           M14 3a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM4 5v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5"
        fill="none" stroke="#9AA4B2" stroke-width="1.3"
        stroke-linecap="round" stroke-linejoin="round" transform="scale(0.95)"/>
</g>
```
</details>

**Star pill** has no separate icon — the `\u2605` character is inline in the text with `tspan fill="#7C6AEF"`.

### 3f. Number Formatting

Counts are formatted with `formatCompact()`:
- `>= 1,000,000` → `{n/1M}M` (e.g., `1.2M`)
- `>= 1,000` → `{n/1k}k` (e.g., `3.5k`)
- Otherwise → raw number string

Trailing `.0` is stripped (e.g., `1.0k` → `1k`).

---

## 4. Heatmap Grid

```
┌────────────────────────────────┐
│  13 columns × 7 rows          │
│  Each cell: 44×44, gap: 5     │
│  Total: 637 × 338 px          │
└────────────────────────────────┘
```

### 4a. Grid Constants

| Constant | Value |
|----------|-------|
| `CELL_SIZE` | `44` px |
| `CELL_GAP` | `5` px |
| `WEEKS` (columns) | `13` |
| `DAYS` (rows) | `7` |
| Cell border radius | `4` |
| Offset X (`heatmapX`) | `60` (= `PAD`) |
| Offset Y (`heatmapY`) | `190` |

### 4b. Cell Positioning Formula

```
cell[week][day].x = heatmapX + week * (CELL_SIZE + CELL_GAP)
                  = 60 + week * 49

cell[week][day].y = heatmapY + day * (CELL_SIZE + CELL_GAP)
                  = 190 + day * 49
```

Grid extent:
- Right edge: `60 + 12 * 49 + 44` = `692`
- Bottom edge: `190 + 6 * 49 + 44` = `528`

### 4c. Cell Colors (5 intensity levels)

| Level | Count range | Fill |
|-------|-------------|------|
| 0 — none | `count === 0` | `rgba(124,106,239,0.06)` |
| 1 — low | `count 1–2` | `rgba(124,106,239,0.20)` |
| 2 — medium | `count 3–5` | `rgba(124,106,239,0.38)` |
| 3 — high | `count 6–10` | `rgba(124,106,239,0.58)` |
| 4 — intense | `count > 10` | `rgba(124,106,239,0.85)` |

### 4d. Data Mapping

- Input: `stats.heatmapData` (array of `{ date, count }`)
- Display: last 91 entries (13 weeks × 7 days)
- If data has more than 91 entries, take the last 91
- Cells are laid out column-first: `index = week * 7 + day`

### 4e. Cell SVG Template

```xml
<rect x="{x}" y="{y}" width="44" height="44" rx="4" fill="{color}" opacity="0">
  <animate attributeName="opacity" from="0" to="1" dur="0.4s"
           begin="{delay}ms" fill="freeze"/>
</rect>
```

### 4f. Animation Timing

| Property | Value |
|----------|-------|
| Duration | `0.4s` |
| Delay per column | `week * 60` ms |
| Delay range | `0ms` (week 0) to `720ms` (week 12) |
| Fill mode | `freeze` |
| Effect | Columns fade in left-to-right |

---

## 5. Radar Chart

```
         Building
            ▲
           / \
          /   \
  Breadth ◄─────► Guarding
          \   /
           \ /
            ▼
        Consistency
```

### 5a. Positioning

| Property | Value | Formula |
|----------|-------|---------|
| Profile column X | `670` | — |
| Profile column width | `470` | `W - PAD - profileColX` = `1200 - 60 - 670` |
| Center X (`radarCX`) | `905` | `670 + 470/2` |
| Center Y (`radarCY`) | `275` | — |
| Radius (`radarR`) | `85` | — |

### 5b. Axes (4-point diamond)

Axes are positioned using trigonometric angles:

| Axis | Key | Label | Angle (radians) | Direction |
|------|-----|-------|-----------------|-----------|
| Top | `building` | `Building` | `-π/2` (−90°) | Up |
| Right | `guarding` | `Guarding` | `0` (0°) | Right |
| Bottom | `consistency` | `Consistency` | `π/2` (90°) | Down |
| Left | `breadth` | `Breadth` | `π` (180°) | Left |

### 5c. Point Position Formula

```
point(angle, distance) = (
  round(cx + distance * cos(angle)),
  round(cy + distance * sin(angle))
)
```

For data points, `distance = (dimensionScore / 100) * radius`.

At full radius (100):

| Axis | Point |
|------|-------|
| Building (top) | `(905, 190)` |
| Guarding (right) | `(990, 275)` |
| Consistency (bottom) | `(905, 360)` |
| Breadth (left) | `(820, 275)` |

### 5d. Guide Rings (4 concentric diamonds)

Diamond polygons at `25%`, `50%`, `75%`, `100%` of radius:

| Level | Radius | Outer stroke-width | Opacity |
|-------|--------|-------------------|---------|
| `0.25` | `21.25` | `1` | `0.2` |
| `0.50` | `42.5` | `1` | `0.2` |
| `0.75` | `63.75` | `1` | `0.2` |
| `1.00` | `85` | `2` | `0.5` |

All guides: `fill="none" stroke="#7C6AEF"`.

### 5e. Axis Lines

From center `(905, 275)` to each axis endpoint:

```xml
<line x1="905" y1="275" x2="{endpoint.x}" y2="{endpoint.y}"
      stroke="#7C6AEF" stroke-width="0.8" opacity="0.2"/>
```

### 5f. Data Polygon

```xml
<polygon points="{p1.x},{p1.y} {p2.x},{p2.y} {p3.x},{p3.y} {p4.x},{p4.y}"
         fill="#7C6AEF" fill-opacity="0.15"
         stroke="#7C6AEF" stroke-width="2" stroke-opacity="0.8"/>
```

### 5g. Vertex Dots

One dot per data point:

```xml
<circle cx="{x}" cy="{y}" r="4" fill="#7C6AEF" stroke="#0C0D14" stroke-width="2"/>
```

### 5h. Axis Labels

Labels offset `20px` beyond the radius, with dynamic anchoring:

| Property | Value |
|----------|-------|
| Font family | `'Plus Jakarta Sans', system-ui, sans-serif` |
| Font size | `13` |
| Fill | `#9AA4B2` (textSecondary) |

**Anchor logic** (based on `cos(angle)`):
- `cos > 0.3` → `text-anchor="start"`, `dx = +4`
- `cos < -0.3` → `text-anchor="end"`, `dx = -4`
- Otherwise → `text-anchor="middle"`, `dx = 0`

**Vertical offset** (based on `sin(angle)`):
- `sin < -0.3` → `dy = -4` (above)
- `sin > 0.3` → `dy = +14` (below)
- Otherwise → `dy = +4` (middle)

**Computed label positions** (at full `radius + 20 = 105`):

| Label | Approx position | Anchor |
|-------|----------------|--------|
| `Building` | `(905, 170)` | `middle` |
| `Guarding` | `(1014, 279)` | `start` |
| `Consistency` | `(905, 394)` | `middle` |
| `Breadth` | `(796, 279)` | `end` |

---

## 6. Score Ring

```
     ╭───────╮
    │         │
    │   72    │   ← score number, centered
    │         │
     ╰───────╯
       Elite       ← tier label
```

### 6a. Ring Geometry

| Property | Value | Formula |
|----------|-------|---------|
| Center X | `905` | Same as `radarCX` |
| Center Y (`ringCY`) | `460` | — |
| Radius (`ringR`) | `46` | — |
| Circumference | `~289.03` | `2 * π * 46` |

### 6b. Background Track

```xml
<circle cx="905" cy="460" r="46" fill="none"
        stroke="rgba(124,106,239,0.10)" stroke-width="4"/>
```

### 6c. Foreground Arc (tier-colored)

```xml
<circle cx="905" cy="460" r="46" fill="none"
        stroke="{tierColor}" stroke-width="4"
        stroke-dasharray="289.03"
        stroke-dashoffset="{289.03 * (1 - score/100)}"
        stroke-linecap="round"
        transform="rotate(-90 905 460)"
        style="animation: ring-draw 1.2s ease-out 0.5s both"/>
```

The `rotate(-90)` makes the arc start from the top (12 o'clock position).

**Dash offset formula**: `circumference * (1 - adjustedComposite / 100)`

| Score | Dash offset | Arc coverage |
|-------|-------------|-------------|
| `0` | `289.03` | 0% (empty) |
| `50` | `144.51` | 50% |
| `100` | `0` | 100% (full circle) |

### 6d. Score Number

```xml
<text x="905" y="460"
      font-family="'JetBrains Mono', monospace" font-size="52" font-weight="700"
      fill="#E6EDF3" text-anchor="middle" dominant-baseline="central"
      style="animation: pulse-glow 3s ease-in-out infinite">
  {adjustedComposite}
</text>
```

---

## 7. Tier Label

| Property | Value |
|----------|-------|
| X | `905` (= `radarCX`) |
| Y | `530` (= `ringCY + ringR + 24` = `460 + 46 + 24`) |
| Font family | `'Plus Jakarta Sans', system-ui, sans-serif` |
| Font size | `17` |
| Fill | `{tierColor}` (see [Color Palette](#10-color-palette)) |
| Text anchor | `middle` |
| Content | Tier name: `Emerging`, `Solid`, `High`, or `Elite` |

---

## 8. Footer

### 8a. Divider Line

```xml
<line x1="60" y1="560" x2="1140" y2="560" stroke="rgba(124,106,239,0.12)" stroke-width="1"/>
```

### 8b. GitHub Branding (left side)

Group transform: `translate(60, 583)` (i.e., `PAD`, `footerY - 2`)

**Octocat icon:**

| Property | Value |
|----------|-------|
| Scale | `0.85` (effective ~20×20 from 24×24 path) |
| Fill | `#9AA4B2` |
| Opacity | `0.8` |

<details>
<summary>Octocat path (click to expand)</summary>

```
M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z
```
</details>

**"Powered by GitHub" text:**

| Property | Value |
|----------|-------|
| X | `24` (relative to group) |
| Y | `14` (relative to group) |
| Font family | `'Plus Jakarta Sans', system-ui, sans-serif` |
| Font size | `17` |
| Fill | `#9AA4B2` |
| Opacity | `0.8` |

### 8c. Domain Text (right side)

| Property | Value |
|----------|-------|
| X | `1140` (= `W - PAD`) |
| Y | `597` (= `footerY + 12` = `585 + 12`) |
| Font family | `'JetBrains Mono', monospace` |
| Font size | `17` |
| Fill | `#9AA4B2` |
| Opacity | `0.8` |
| Text anchor | `end` |
| Content | `chapa.thecreativetoken.com` |

---

## 9. Verification Strip

Conditional — only rendered when `verificationHash` and `verificationDate` are provided.

```
                                                              │ V
                                                              │ E
                                                              │ R
                                                              │ I
                                                              │ F
                                                              │ I
                                                              │ E
                                                              │ D
```

### 9a. Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `CORAL` | `#E05A47` | Accent color for verification |
| `lineX` | `1145` | Vertical separator line X |
| `centerX` | `1168` | Text rotation center X |
| `textY` | `315` | Text rotation center Y |

### 9b. Separator Line

```xml
<line x1="1145" y1="30" x2="1145" y2="600"
      stroke="#E05A47" stroke-width="1" opacity="0.15"/>
```

### 9c. Clickable Link + Rotated Text

**v1.1 change**: The verification text is now wrapped in an SVG `<a>` element, making the hash clickable. Clicking opens the verification page in a new tab.

```xml
<a href="https://chapa.thecreativetoken.com/verify/{hash}" target="_blank">
  <text transform="rotate(-90 1168 315)"
        x="1168" y="315"
        font-family="'JetBrains Mono', monospace" font-size="11"
        fill="#E05A47" opacity="0.50"
        text-anchor="middle" letter-spacing="2"
        style="cursor:pointer">
    VERIFIED · {hash} · {date}
  </text>
</a>
```

- **Link URL**: `https://chapa.thecreativetoken.com/verify/{hash}` — uses the XML-escaped hash
- **`target="_blank"`**: Opens in a new tab (standard for embedded SVGs)
- **`style="cursor:pointer"`**: Provides visual click affordance on hover
- Rotation: `-90°` around `(1168, 315)` — text reads bottom-to-top
- Separator `·` is `\u00B7` (middle dot)
- Hash and date values are XML-escaped

---

## 10. Color Palette

### 10a. Theme Colors (`WARM_AMBER`)

| Token | Hex / Value | Usage |
|-------|-------------|-------|
| `bg` | `#0C0D14` | Canvas background |
| `card` | `#13141E` | Card surfaces (unused in SVG badge) |
| `textPrimary` | `#E6EDF3` | Headings, score number |
| `textSecondary` | `#9AA4B2` | Subtitle, labels, pills, branding |
| `accent` | `#7C6AEF` | Purple accent — radar, heatmap, pills |
| `stroke` | `rgba(124,106,239,0.12)` | Border, dividers |

### 10b. Heatmap Colors (5 levels)

| Level | Alpha | Full value |
|-------|-------|-----------|
| `heatmap[0]` — none | `0.06` | `rgba(124,106,239,0.06)` |
| `heatmap[1]` — low | `0.20` | `rgba(124,106,239,0.20)` |
| `heatmap[2]` — medium | `0.38` | `rgba(124,106,239,0.38)` |
| `heatmap[3]` — high | `0.58` | `rgba(124,106,239,0.58)` |
| `heatmap[4]` — intense | `0.85` | `rgba(124,106,239,0.85)` |

### 10c. Tier Colors

| Tier | Hex | Visual |
|------|-----|--------|
| `Emerging` | `#9AA4B2` | Muted gray |
| `Solid` | `#E6EDF3` | Light (near-white) |
| `High` | `#9D8FFF` | Lighter purple |
| `Elite` | `#7C6AEF` | Signature purple |

### 10d. Archetype Colors

| Archetype | Hex | Visual |
|-----------|-----|--------|
| `Builder` | `#7C6AEF` | Signature purple |
| `Guardian` | `#F472B6` | Pink |
| `Marathoner` | `#4ADE80` | Green |
| `Polymath` | `#FBBF24` | Amber/gold |
| `Balanced` | `#E6EDF3` | Light gray |
| `Emerging` | `#9AA4B2` | Muted gray |

### 10e. Verification Strip Color

| Token | Hex |
|-------|-----|
| `CORAL` | `#E05A47` |

### 10f. Other Inline Colors

| Usage | Value |
|-------|-------|
| Avatar placeholder fill | `rgba(124,106,239,0.10)` |
| Avatar placeholder stroke | `rgba(124,106,239,0.25)` |
| Archetype pill fill | `rgba(124,106,239,0.10)` |
| Archetype pill stroke | `rgba(124,106,239,0.25)` |
| Metric pill fill | `rgba(124,106,239,0.06)` |
| Metric pill stroke | `rgba(124,106,239,0.15)` |
| Ring track stroke | `rgba(124,106,239,0.10)` |
| Vertex dot stroke | `#0C0D14` (= bg, creates cutout effect) |

---

## 11. Typography

Every text element in the badge:

| Element | Font Family | Size | Weight | Fill | Anchor | Other |
|---------|-------------|------|--------|------|--------|-------|
| Handle / display name | Plus Jakarta Sans | `26` | `600` | `#E6EDF3` | `start` | — |
| "Verified metrics" | Plus Jakarta Sans | `19` | normal | `#9AA4B2` | `start` | — |
| "Chapa_" logo | JetBrains Mono | `22` | normal | `#9AA4B2` | `end` | `opacity="0.7"`, `letter-spacing="-0.5"` |
| Archetype pill text | Plus Jakarta Sans | `17` | `600` | `{archetypeColor}` | `middle` | — |
| Dot separators | Plus Jakarta Sans | `16` | normal | `#9AA4B2` | `start` | `opacity="0.4"` |
| Metric pill labels | Plus Jakarta Sans | `14` | normal | `#9AA4B2` | `start` | — |
| Radar axis labels | Plus Jakarta Sans | `13` | normal | `#9AA4B2` | dynamic | — |
| Score number | JetBrains Mono | `52` | `700` | `#E6EDF3` | `middle` | `dominant-baseline="central"` |
| Tier label | Plus Jakarta Sans | `17` | normal | `{tierColor}` | `middle` | — |
| "Powered by GitHub" | Plus Jakarta Sans | `17` | normal | `#9AA4B2` | `start` | `opacity="0.8"` |
| Domain text | JetBrains Mono | `17` | normal | `#9AA4B2` | `end` | `opacity="0.8"` |
| Verification text | JetBrains Mono | `11` | normal | `#E05A47` | `middle` | `opacity="0.50"`, `letter-spacing="2"` |

**Font stacks:**
- `'Plus Jakarta Sans', system-ui, sans-serif`
- `'JetBrains Mono', monospace`

**Note:** These fonts are NOT embedded in the SVG. Rendering environments must have them installed or available via Google Fonts, or the system fallbacks (`system-ui`, `monospace`) will be used.

---

## 12. Animations

### 12a. `pulse-glow` (score number)

```css
@keyframes pulse-glow {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}
```

- Applied to: Score number text
- Duration: `3s`
- Timing: `ease-in-out`
- Iteration: `infinite`

### 12b. `ring-draw` (score ring arc)

```css
@keyframes ring-draw {
  from { stroke-dashoffset: {circumference}; }
  to   { stroke-dashoffset: {finalOffset}; }
}
```

- Applied to: Foreground ring circle
- Duration: `1.2s`
- Timing: `ease-out`
- Delay: `0.5s`
- Fill mode: `both`
- `{circumference}` = `2 * π * 46` ≈ `289.03`
- `{finalOffset}` = `circumference * (1 - score/100)`

### 12c. Heatmap Cell Fade-in

Uses SMIL `<animate>` elements (not CSS):

```xml
<animate attributeName="opacity" from="0" to="1" dur="0.4s"
         begin="{week * 60}ms" fill="freeze"/>
```

- Duration: `0.4s` per cell
- Stagger: `60ms` per column (week)
- Effect: Columns reveal left-to-right in a wave

---

## 13. Dynamic Data Contract

### 13a. Variable Data (changes per user)

| Data point | Source | Used in |
|------------|--------|---------|
| `stats.handle` | `StatsData.handle` | Header (if no displayName) |
| `stats.displayName` | `StatsData.displayName` | Header name text |
| `stats.avatarUrl` | `StatsData.avatarUrl` | Avatar image (fetched as base64) |
| `stats.reposContributed` | `StatsData.reposContributed` | Repos pill |
| `stats.totalWatchers` | `StatsData.totalWatchers` | Watch pill |
| `stats.totalForks` | `StatsData.totalForks` | Fork pill |
| `stats.totalStars` | `StatsData.totalStars` | Star pill |
| `stats.heatmapData` | `StatsData.heatmapData[]` | Heatmap grid cells |
| `impact.dimensions` | `DimensionScores` | Radar chart shape |
| `impact.archetype` | `DeveloperArchetype` | Archetype pill text + color |
| `impact.adjustedComposite` | `number (0-100)` | Score number + ring arc |
| `impact.tier` | `ImpactTier` | Tier label + ring color |
| `verificationHash` | `string` | Verification strip text |
| `verificationDate` | `string` | Verification strip text |

### 13b. Fixed Layout (never changes)

| Element | Fixed values |
|---------|-------------|
| Canvas | 1200×630, rx=20, PAD=60 |
| Header Y | 80 |
| Meta row Y | 160 |
| Heatmap origin | (60, 190) |
| Heatmap cell size + gap | 44px + 5px |
| Radar center | (905, 275), radius=85 |
| Score ring center | (905, 460), radius=46 |
| Tier label Y | 530 |
| Footer divider Y | 560, footer Y=585 |
| Verification line X | 1145 |
| All colors | See Color Palette |
| All fonts + sizes | See Typography |

### 13c. Conditional Elements

| Element | Condition |
|---------|-----------|
| Avatar image vs octocat fallback | `avatarDataUri` provided or not |
| Display name vs `@handle` | `stats.displayName` truthy or not |
| GitHub branding | `includeGithubBranding` option (default `true`) |
| Verification strip | Both `verificationHash` and `verificationDate` provided |

---

## 14. Reference Screenshot

> **TODO**: Capture a reference PNG from `/u/juan294/badge.svg` and commit as `docs/badge-svg-spec-v1.0-reference.png`.
>
> To generate: visit `http://localhost:3001/u/juan294/badge.svg` in a browser and take a screenshot, or use a headless browser:
> ```bash
> npx playwright screenshot --viewport-size=1200,630 \
>   "http://localhost:3001/u/juan294/badge.svg" \
>   docs/badge-svg-spec-v1.0-reference.png
> ```

---

## Implementation Reference

Source files (in `apps/web/lib/render/`):

| File | Responsibility |
|------|---------------|
| `BadgeSvg.tsx` | Main layout, header, pills, score ring, footer — orchestrates all sections |
| `RadarChart.ts` | 4-axis diamond radar chart |
| `heatmap.ts` | 13×7 heatmap grid cells + animation |
| `theme.ts` | Color palette, tier colors, archetype colors, heatmap color mapping |
| `GithubBranding.tsx` | Footer GitHub branding section |
| `VerificationStrip.ts` | Right-edge verification seal |
| `avatar.ts` | Avatar URL → base64 data URI conversion |
| `escape.ts` | XML entity escaping for user-controlled text |

Route handler: `apps/web/app/u/[handle]/badge.svg/route.ts`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.2 | 2026-02-17 | **Repos pill** — Added "Repos" metric pill (repos contributed to) between archetype pill and Watch pill. Uses `reposContributed` from `StatsData`. Repo icon is a grid/book SVG. Pill row now has 5 pills: Archetype, Repos, Watch, Fork, Star. |
| 1.1 | 2026-02-13 | **Clickable verification hash** — Verification strip text (Section 9c) is now wrapped in an SVG `<a href>` element linking to `https://chapa.thecreativetoken.com/verify/{hash}` with `target="_blank"`. Added `style="cursor:pointer"` for hover affordance. No visual change to the badge appearance — only adds interactivity. Fixes #187. |
| 1.0 | 2026-02-13 | Initial spec — documents current production SVG badge |
