/**
 * Shared data-viz color constants for client-rendered (HTML/JS) surfaces —
 * the interactive heatmap grid (`lib/effects/heatmap`) and the dashboard
 * activity heatmap (`components/dashboard/ActivityHeatmap`).
 *
 * Single source of truth so these values can't silently drift apart across
 * components (see issue #1040 / UX-L3).
 *
 * IMPORTANT: the server-rendered badge SVG (`apps/web/lib/render/theme.ts`)
 * intentionally keeps its OWN literal hex/rgba values. CSS custom properties
 * (`var(--color-dimension-*)`) do not resolve in a server-rendered SVG string
 * context, so `theme.ts` cannot import from this module. Do not attempt to
 * unify the two — badge SVG / HTML parity depends on `theme.ts`'s literals
 * matching the design tokens exactly, and that module documents its own
 * "kept in sync manually" invariant.
 */

export type DataVizDimension = "delivery" | "quality" | "consistency" | "breadth";

/**
 * Per-dimension accent colors for the 4 Impact dimensions, resolving the
 * `--color-dimension-*` CSS custom properties defined in
 * `apps/web/styles/globals.css` (see docs/design-system.md).
 */
export const DIMENSION_COLORS: Record<DataVizDimension, string> = {
  delivery: "var(--color-dimension-delivery)",
  quality: "var(--color-dimension-quality)",
  consistency: "var(--color-dimension-consistency)",
  breadth: "var(--color-dimension-breadth)",
};

/**
 * Heatmap cell intensity ramp (levels 0–4), a purple/amber-accent opacity
 * scale used by the interactive `HeatmapGrid` component and the
 * `heatmap-wave` experiment.
 */
export const INTENSITY_COLORS: Record<number, string> = {
  0: "rgba(139,92,246,0.15)",
  1: "rgba(139,92,246,0.35)",
  2: "rgba(139,92,246,0.52)",
  3: "rgba(139,92,246,0.72)",
  4: "rgba(139,92,246,0.95)",
};
