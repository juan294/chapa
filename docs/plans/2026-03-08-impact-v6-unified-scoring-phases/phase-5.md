# Phase 5: UI Components (Dashboard, Cards, Interactive Radar)

> Depends on: Phases 1, 4

## Objective

Update all client-side UI components to display the 5th "Craft" dimension: dimension cards, interactive radar chart, sub-metric panel, impact breakdown, coaching insights, and CSS color variables.

## Changes

### 5.1 — Add Craft CSS color variables (`apps/web/styles/globals.css`)

Add alongside existing dimension colors in both `:root` (light) and `[data-theme="dark"]` blocks:

```css
/* Light theme (:root) */
--color-dimension-craft: #F59E0B;
--color-dimension-craft-light: #FBBF24;

/* Dark theme ([data-theme="dark"]) */
--color-dimension-craft: #F59E0B;
--color-dimension-craft-light: #FBBF24;
```

Add to `@theme` block:

```css
--color-dimension-craft: var(--color-dimension-craft);
--color-dimension-craft-light: var(--color-dimension-craft-light);
```

### 5.2 — Add Artificer archetype color (`apps/web/styles/globals.css`)

```css
/* Both themes */
--color-archetype-artificer: #F59E0B;
```

Add Tailwind classes: `text-archetype-artificer`, `bg-archetype-artificer`.

### 5.3 — Add Artificer archetype color to theme (`apps/web/lib/render/theme.ts`)

```typescript
// In getArchetypeColor():
case "Artificer": return "#F59E0B";
```

(Already specified in Phase 1, but verify it's applied.)

### 5.4 — Update `DimensionCardsRow` (`apps/web/components/dashboard/DimensionCardsRow.tsx:8-13`)

```typescript
// BEFORE
const DIMENSIONS = ["delivery", "quality", "consistency", "breadth"];

// AFTER — filter to active dimensions
const ALL_DIMENSIONS = ["delivery", "quality", "consistency", "breadth", "craft"];

// In render: filter to only dimensions with data
const activeDimensions = ALL_DIMENSIONS.filter(d => dimensions[d] != null);
```

Grid layout changes from 2×2 to flexible:

```tsx
// BEFORE
<div className="grid grid-cols-2 gap-3">

// AFTER — responsive grid that handles 4 or 5 cards
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
```

When craft is absent (4 cards), the grid still looks good with 2 columns on mobile, 4 on desktop. When craft is present (5 cards), it flows into 5 columns on wide screens.

### 5.5 — Update `DimensionCard` (`apps/web/components/dashboard/DimensionCard.tsx`)

Add to all Record constants:

```typescript
// DIMENSION_LABELS
craft: "Craft",

// DIMENSION_SUBTITLES
craft: "AI tool mastery & workflow sophistication",

// DIMENSION_COLORS
craft: {
  text: "text-dimension-craft",
  bg: "bg-dimension-craft",
  light: "text-dimension-craft-light",
  border: "border-dimension-craft/20",
},

// DIMENSION_TOOLTIPS
craft: "How effectively you use AI coding tools — tool diversity, outcome quality, and workflow complexity.",
```

### 5.6 — Update `SubMetricPanel` (`apps/web/components/dashboard/SubMetricPanel.tsx`)

Add craft case to `getSubMetrics()` switch:

```typescript
case "craft": {
  // Show the 3 craft sub-dimensions as sub-metrics
  // These come from craftResult.dimensions (proficiency, effectiveness, sophistication)
  // SubMetricPanel will need to accept craftResult as an optional prop
  return [
    { label: "Proficiency", value: craftDims?.proficiency ?? 0, max: 100 },
    { label: "Effectiveness", value: craftDims?.effectiveness ?? 0, max: 100 },
    { label: "Sophistication", value: craftDims?.sophistication ?? 0, max: 100 },
  ];
}
```

Add to DIMENSION_COLORS and DIMENSION_LABELS:

```typescript
craft: "var(--color-dimension-craft)",
craft: "Craft",
```

### 5.7 — Update `RadarChartInteractive` (`apps/web/components/dashboard/RadarChartInteractive.tsx:11-27`)

```typescript
// BEFORE
const AXES = [
  { key: "delivery", label: "Delivery", angle: -Math.PI / 2 },
  { key: "quality", label: "Quality", angle: 0 },
  { key: "consistency", label: "Consistency", angle: Math.PI / 2 },
  { key: "breadth", label: "Breadth", angle: Math.PI },
];

// AFTER — dynamic 4 or 5 axes based on data
const ALL_AXES = [
  { key: "delivery", label: "Delivery", angle: -Math.PI / 2 },
  { key: "quality", label: "Quality", angle: -Math.PI / 2 + 2*Math.PI/5 },
  { key: "consistency", label: "Consistency", angle: -Math.PI / 2 + 4*Math.PI/5 },
  { key: "breadth", label: "Breadth", angle: -Math.PI / 2 + 6*Math.PI/5 },
  { key: "craft", label: "Craft", angle: -Math.PI / 2 + 8*Math.PI/5 },
];

// PENTAGON_AXES for 5 dims, DIAMOND_AXES for 4 dims (fallback)
const DIAMOND_AXES = [
  { key: "delivery", label: "Delivery", angle: -Math.PI / 2 },
  { key: "quality", label: "Quality", angle: 0 },
  { key: "consistency", label: "Consistency", angle: Math.PI / 2 },
  { key: "breadth", label: "Breadth", angle: Math.PI },
];

// In component: select axes based on data
const axes = dimensions.craft != null ? ALL_AXES : DIAMOND_AXES;
```

Add craft to DIMENSION_COLORS:

```typescript
craft: "var(--color-dimension-craft)",
```

### 5.8 — Update `ImpactBreakdown` (`apps/web/components/ImpactBreakdown.tsx`)

Add craft to all label/subtitle/color/tooltip constants:

```typescript
// DIMENSION_LABELS
craft: "Craft",

// DIMENSION_SUBTITLES
craft: "AI tool mastery",

// DIMENSION_COLORS
craft: { text: "text-dimension-craft", bg: "bg-dimension-craft" },

// DIMENSION_TOOLTIPS
craft: "How effectively you use AI coding tools — tool diversity, outcome quality, workflow complexity.",
```

Update the dimension iteration to filter active dimensions:

```typescript
// BEFORE
(["delivery", "quality", "consistency", "breadth"] as const).map(...)

// AFTER
(["delivery", "quality", "consistency", "breadth", "craft"] as const)
  .filter(key => dims[key] != null)
  .map(...)
```

### 5.9 — Update `generate-insights.ts` (`apps/web/lib/dashboard/generate-insights.ts`)

Add craft to:

```typescript
// DIMENSION_LABELS
craft: "Craft",

// DIMENSION_TIPS
craft: "Import more AI tool reports (Claude Code, Cursor, etc.) and use advanced features like agent orchestration and multi-session workflows.",

// ARCHETYPE_PROFILES
Artificer: "You're an Artificer — you excel at leveraging AI coding tools to amplify your development workflow. Your mastery of tool orchestration, parallel sessions, and high achievement rates sets you apart.",
```

## Tests

### New tests to write FIRST (TDD):

1. **`DimensionCardsRow.test.tsx`**:
   - Renders 4 cards when craft absent
   - Renders 5 cards when craft present
   - Craft card shows correct label and color

2. **`DimensionCard.test.tsx`**:
   - Craft dimension renders with correct label, subtitle, tooltip
   - Craft progress bar uses craft color

3. **`RadarChartInteractive.test.tsx`**:
   - Pentagon with 5 axes when craft present
   - Diamond with 4 axes when craft absent
   - Craft axis uses correct color

4. **`ImpactBreakdown.test.tsx`**:
   - Shows 4 dimension cards without craft
   - Shows 5 dimension cards with craft
   - Craft card has correct tooltip

5. **`generate-insights.test.ts`**:
   - Artificer profile text exists
   - Craft dimension tip exists

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes
- [ ] All dimension UI components handle 4 and 5 dimensions
- [ ] Craft color variables defined in CSS

### Manual
- [ ] Dashboard shows 5 dimension cards when craft data exists
- [ ] Interactive radar renders as pentagon with craft axis
- [ ] Sub-metric panel shows proficiency/effectiveness/sophistication for craft
- [ ] Artificer archetype color renders correctly
