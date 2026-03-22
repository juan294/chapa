# Phase 3: Badge SVG v3 — Pentagon Radar [batch-eligible]

> Can run in parallel with Phase 2 — no shared files.
> Depends on: Phase 1 (types: DimensionScores with optional craft)

## Objective

Upgrade the badge SVG radar chart from a 4-point diamond to a 5-point pentagon. Remove the standalone craft pill. This is **Badge v3**.

## Badge Version History

| Version | Changes | Date |
|---------|---------|------|
| v1 | Original badge: heatmap + diamond radar + score ring | Initial release |
| v2 | Added branding footer (platform logos + tagline) + verification strip + craft pill | 2026-02-26 / 2026-03-07 |
| **v3** | **Pentagon radar (5 axes), craft pill removed, unified 5-dim scoring** | **2026-03-08** |

## Changes

### 3.1 — Update `renderRadarChart` for 5 axes (`apps/web/lib/render/RadarChart.ts:16-92`)

```typescript
// BEFORE — 4-point diamond (90° spacing)
const axes = [
  { key: "delivery", label: "Delivery", angle: -Math.PI / 2 },    // top
  { key: "quality", label: "Quality", angle: 0 },                  // right
  { key: "consistency", label: "Consistency", angle: Math.PI / 2 }, // bottom
  { key: "breadth", label: "Breadth", angle: Math.PI },            // left
];

// AFTER — 5-point pentagon (72° spacing = 2π/5)
const baseAxes = [
  { key: "delivery", label: "Delivery", angle: -Math.PI / 2 },              // top (0°)
  { key: "quality", label: "Quality", angle: -Math.PI / 2 + 2*Math.PI/5 },  // 72° (upper-right)
  { key: "consistency", label: "Consistency", angle: -Math.PI / 2 + 4*Math.PI/5 }, // 144° (lower-right)
  { key: "breadth", label: "Breadth", angle: -Math.PI / 2 + 6*Math.PI/5 },  // 216° (lower-left)
  { key: "craft", label: "Craft", angle: -Math.PI / 2 + 8*Math.PI/5 },      // 288° (upper-left)
];

// Filter to only axes with data (handles missing craft gracefully)
const axes = baseAxes.filter(a => dimensions[a.key] != null);
```

**Key changes in the function:**
- Axis angles: 72° spacing instead of 90°
- Guide rings: pentagons instead of diamonds (automatic — polygon code iterates axes)
- Data polygon: 5 points when craft exists, 4 points when absent
- Label positioning: existing angle-based math works for any number of axes
- Vertex dots: 5 circles instead of 4

**The radar should gracefully render both 4-axis (no craft) and 5-axis (with craft).** When `dimensions.craft` is undefined, the axis is filtered out and the chart renders as a 4-point diamond (same visual as v2).

### 3.2 — Remove craft pill from `BadgeSvg.tsx` (`apps/web/lib/render/BadgeSvg.tsx`)

```typescript
// REMOVE these lines:
import { renderBadgeCraft } from "./BadgeCraft";           // line 9
const craftY = footerDividerY - 30;                         // line 112
const craftSvg = renderBadgeCraft(PAD, craftY, craftScore);  // line 113
${craftSvg}                                                  // line 236

// REMOVE from BadgeOptions interface:
craftScore?: number | null;  // line 19

// The radar chart now shows craft as a dimension axis — no separate pill needed.
```

**Note:** The `renderBadgeSvg` function still receives `impact: ImpactV4Result` which now contains `dimensions.craft` when available. The radar chart reads it directly from `impact.dimensions`.

### 3.3 — Delete `BadgeCraft.tsx` (`apps/web/lib/render/BadgeCraft.tsx`)

Delete the entire file — it renders the pill that's being removed.

### 3.4 — Delete `BadgeCraft.test.tsx` (if exists)

Remove the test file for the deleted component.

### 3.5 — Update `svg-design.md` (`docs/svg-design.md`)

Update the spec to reflect v3:

```markdown
## Badge version: v3

### 4) Main content row
**Center column: Radar chart**
- 5-point pentagon radar showing dimension scores (4-point diamond when craft absent)
- Axes (72° spacing): Delivery (top), Quality (upper-right), Consistency (lower-right),
  Breadth (lower-left), Craft (upper-left)
- Filled polygon with purple accent fill at low opacity
- Axis labels at each corner
- Grid rings at 25%, 50%, 75%, 100%
- Graceful degradation: renders as 4-point diamond when craft dimension is absent

### Removed in v3
- Craft score pill (footer) — superseded by radar axis
```

## Visual Specification

### Pentagon Axis Positions (center at radarCX=930, radarCY=275, radius=85)

| Axis | Angle (rad) | Angle (deg) | Direction |
|------|-------------|-------------|-----------|
| Delivery | -π/2 | -90° | Top |
| Quality | -π/2 + 2π/5 | -18° | Upper-right |
| Consistency | -π/2 + 4π/5 | 54° | Lower-right |
| Breadth | -π/2 + 6π/5 | 126° | Lower-left |
| Craft | -π/2 + 8π/5 | 198° | Upper-left |

### Craft Axis Label Color

Craft labels in the SVG badge use the same `textSecondary` color as other axis labels (consistent with existing design). The dimension-specific color (`#F59E0B`) is used only in the interactive UI components.

## Tests

### New tests to write FIRST (TDD):

1. **`RadarChart.test.ts`**:
   - Pentagon output: 5 axis lines, 5 label texts, 5-point data polygon
   - Diamond fallback: when `craft` is undefined, renders 4 axes (identical to v2)
   - All 4 guide rings render as pentagons (or diamonds for 4-axis)
   - Axis labels positioned correctly for 5-point layout
   - SVG output is valid XML

2. **`BadgeSvg.test.tsx`**:
   - Badge with craft dimension renders pentagon radar
   - Badge without craft dimension renders diamond radar
   - No "AI Craft" pill in output (removed)
   - `craftScore` option no longer accepted (or ignored)
   - Badge dimensions unchanged (1200×630)

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes — all badge tests + new radar tests
- [ ] Badge SVG without craft: visually identical to v2 (4-point diamond)
- [ ] Badge SVG with craft: pentagon radar with 5 labeled axes
- [ ] No `BadgeCraft` references remain in codebase
- [ ] SVG output is valid XML (no broken tags)

### Manual
- [ ] Visual inspection: render a badge with craft data and verify the pentagon looks balanced
- [ ] Visual inspection: render a badge without craft data and verify diamond unchanged
- [ ] Badge renders correctly when embedded in a README `<img>` tag
