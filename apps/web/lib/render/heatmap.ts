import type { HeatmapDay } from "@chapa/shared";
import { getHeatmapColor } from "./theme";

const CELL_SIZE = 44;
const CELL_GAP = 5;
const WEEKS = 13;
const DAYS = 7;

interface HeatmapCell {
  x: number;
  y: number;
  fill: string;
  delay: number;
}

/**
 * Build a grid of heatmap cells from contribution data for badge SVG rendering.
 *
 * Displays the most recent 13 weeks (91 days) of activity. If the input
 * contains more than 91 days, only the last 91 are used (the scoring window
 * may cover up to 365 days, but the badge shows a compact view).
 *
 * Cells are laid out in a column-major grid: 13 columns (weeks) x 7 rows (days),
 * with each cell sized at {@link CELL_SIZE}px and spaced by {@link CELL_GAP}px.
 * Animation delays are staggered per column (60ms per week) for a left-to-right
 * fade-in effect.
 *
 * @param heatmapData - Array of daily contribution counts (may exceed 91 entries)
 * @param offsetX - Horizontal offset for positioning within the SVG (default: 0)
 * @param offsetY - Vertical offset for positioning within the SVG (default: 0)
 * @returns Array of {@link HeatmapCell} objects ready for {@link renderHeatmapSvg}
 */
export function buildHeatmapCells(
  heatmapData: HeatmapDay[],
  offsetX: number = 0,
  offsetY: number = 0,
): HeatmapCell[] {
  // Slice to last 13 weeks (91 days) — scoring window may be 365 days
  const displaySize = WEEKS * DAYS;
  const sliced =
    heatmapData.length > displaySize
      ? heatmapData.slice(-displaySize)
      : heatmapData;

  const cells: HeatmapCell[] = [];
  for (let week = 0; week < WEEKS; week++) {
    for (let day = 0; day < DAYS; day++) {
      const idx = week * DAYS + day;
      const count = idx < sliced.length ? sliced[idx]!.count : 0;
      cells.push({
        x: offsetX + week * (CELL_SIZE + CELL_GAP),
        y: offsetY + day * (CELL_SIZE + CELL_GAP),
        fill: getHeatmapColor(count),
        delay: week * 60,
      });
    }
  }
  return cells;
}

/**
 * Render an array of heatmap cells as SVG `<rect>` elements with fade-in animation.
 *
 * Each cell is rendered as a rounded rectangle (`rx="4"`) that starts fully
 * transparent (`opacity="0"`) and animates to full opacity via an SVG
 * `<animate>` element. The animation delay per cell is set by {@link HeatmapCell.delay},
 * producing a staggered column-by-column reveal.
 *
 * @param cells - Pre-computed heatmap cells from {@link buildHeatmapCells}
 * @returns SVG markup string containing all `<rect>` elements, separated by newlines
 */
export function renderHeatmapSvg(cells: HeatmapCell[]): string {
  return cells
    .map(
      (c) =>
        `<rect x="${c.x}" y="${c.y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="4" fill="${c.fill}" opacity="0">` +
        `<animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${c.delay}ms" fill="freeze"/>` +
        `</rect>`,
    )
    .join("\n    ");
}
