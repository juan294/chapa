/* ------------------------------------------------------------------ */
/*  Heatmap Wave Animation — Delay Calculators                        */
/*  Pure functions that compute per-cell animation delay (ms)         */
/*  for each reveal variant.                                          */
/* ------------------------------------------------------------------ */

export type AnimationVariant =
  | "fade-in"
  | "diagonal"
  | "ripple"
  | "scatter"
  | "cascade"
  | "column-cascade"
  | "waterfall"
  | "row-waterfall";

export interface VariantMeta {
  id: AnimationVariant;
  label: string;
  description: string;
}

export const VARIANTS: VariantMeta[] = [
  {
    id: "diagonal",
    label: "Diagonal Wave",
    description: "Top-left to bottom-right sweep",
  },
  {
    id: "ripple",
    label: "Center Ripple",
    description: "Expanding ring from the center",
  },
  {
    id: "scatter",
    label: "Random Scatter",
    description: "Cells appear at random times",
  },
  {
    id: "column-cascade",
    label: "Column Cascade",
    description: "Left to right, column by column",
  },
  {
    id: "row-waterfall",
    label: "Row Waterfall",
    description: "Top to bottom, row by row",
  },
];

/** Total weeks (columns) in the heatmap */
export const WEEKS = 13;
/** Days per week (rows) */
export const DAYS = 7;

/**
 * Simple fade-in: uniform small stagger so all cells appear near-simultaneously.
 */
export function fadeInDelay(col: number, row: number): number {
  return (col * DAYS + row) * 8; // 8ms stagger per cell
}

/**
 * Diagonal wave: delay = col * 40 + row * 60
 */
export function diagonalDelay(col: number, row: number): number {
  return col * 40 + row * 60;
}

/**
 * Center-out ripple: delay proportional to Euclidean distance from center.
 */
export function rippleDelay(col: number, row: number): number {
  const centerCol = Math.floor(WEEKS / 2); // 6
  const centerRow = Math.floor(DAYS / 2); // 3
  const dist = Math.sqrt((col - centerCol) ** 2 + (row - centerRow) ** 2);
  return Math.round(dist * 60);
}

/**
 * Random scatter: deterministic pseudo-random delay based on position.
 * Uses the same seed algorithm as the heatmap data so it's reproducible.
 */
export function scatterDelay(col: number, row: number): number {
  const seed = (col * 7 + row + 1) * 2654435761;
  return ((seed >>> 16) & 0x3ff) % 1200; // 0-1199ms
}

/**
 * Column cascade: all rows in a column appear together.
 * delay = col * 80
 */
export function columnCascadeDelay(col: number, _row: number): number {
  return col * 80;
}

/**
 * Row waterfall: all columns in a row appear together.
 * delay = row * 100
 */
export function rowWaterfallDelay(_col: number, row: number): number {
  return row * 100;
}

/**
 * Get the delay calculator for a given variant.
 */
export function getDelayFn(
  variant: AnimationVariant
): (col: number, row: number) => number {
  switch (variant) {
    case "fade-in":
      return fadeInDelay;
    case "diagonal":
      return diagonalDelay;
    case "ripple":
      return rippleDelay;
    case "scatter":
      return scatterDelay;
    case "cascade":
    case "column-cascade":
      return columnCascadeDelay;
    case "waterfall":
    case "row-waterfall":
      return rowWaterfallDelay;
  }
}

/**
 * Generate deterministic mock heatmap data.
 * Returns a 2D array [week][day] with intensity levels 0-4.
 */
export function generateMockHeatmap(): number[][] {
  return Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: DAYS }, (_, day) => {
      const seed = (week * 7 + day) * 2654435761;
      return ((seed >>> 16) & 0xff) % 5;
    })
  );
}

/**
 * Heatmap cell color based on intensity level (0-4).
 */
export const INTENSITY_COLORS: Record<number, string> = {
  0: "rgba(124,106,239,0.08)",
  1: "rgba(124,106,239,0.25)",
  2: "rgba(124,106,239,0.42)",
  3: "rgba(124,106,239,0.62)",
  4: "rgba(124,106,239,0.88)",
};
