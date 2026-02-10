import type { HeatmapDay } from "@chapa/shared";
import { getHeatmapColor } from "./theme";

const CELL_SIZE = 14;
const CELL_GAP = 3;
const WEEKS = 13;
const DAYS = 7;

interface HeatmapCell {
  x: number;
  y: number;
  fill: string;
  delay: number;
}

export function buildHeatmapCells(
  heatmapData: HeatmapDay[],
  offsetX: number = 0,
  offsetY: number = 0,
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let week = 0; week < WEEKS; week++) {
    for (let day = 0; day < DAYS; day++) {
      const idx = week * DAYS + day;
      const count = idx < heatmapData.length ? heatmapData[idx].count : 0;
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

export function renderHeatmapSvg(cells: HeatmapCell[]): string {
  return cells
    .map(
      (c) =>
        `<rect x="${c.x}" y="${c.y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="3" fill="${c.fill}" opacity="0">` +
        `<animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${c.delay}ms" fill="freeze"/>` +
        `</rect>`,
    )
    .join("\n    ");
}

const HEATMAP_WIDTH = WEEKS * (CELL_SIZE + CELL_GAP) - CELL_GAP;
const HEATMAP_HEIGHT = DAYS * (CELL_SIZE + CELL_GAP) - CELL_GAP;
