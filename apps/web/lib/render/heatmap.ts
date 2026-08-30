import type { BadgeConfig, HeatmapDay } from "@chapa/shared";
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
 * column sweep.
 *
 * @param heatmapData - Array of daily contribution counts (may exceed 91 entries)
 * @param offsetX - Horizontal offset for positioning within the SVG (default: 0)
 * @param offsetY - Vertical offset for positioning within the SVG (default: 0)
 * @returns Array of {@link HeatmapCell} objects ready for {@link renderHeatmapSvg}
 */
/**
 * Per-cell reveal delay, in ms (#1191).
 *
 * `fade-in` is the DEFAULT and reproduces the pre-#1191 stagger exactly
 * (60ms per column). It is the same shape as `cascade` (120ms per column) and
 * differs only in speed.
 *
 * #1226 resolved the naming mismatch this comment used to record: Studio
 * called it "Fade In" / "uniform gentle fade", which is not what it does. The
 * label and description were corrected; the enum VALUE stays `fade-in`,
 * because it is persisted in every saved Studio config and renaming it would
 * need the same read-path migration `RETIRED_BADGE_CONFIG_KEYS` got. The
 * shipped animation did not change.
 *
 * Every function here is deterministic: `renderBadgeSvg` is pure, so `scatter`
 * derives its order from the cell index rather than from a random source.
 */
function heatmapDelay(
  animation: BadgeConfig["heatmapAnimation"],
  week: number,
  day: number,
  index: number,
): number {
  switch (animation) {
    case "diagonal":
      return (week + day) * 45;
    case "ripple": {
      const dx = week - (WEEKS - 1) / 2;
      const dy = day - (DAYS - 1) / 2;
      return Math.round(Math.sqrt(dx * dx + dy * dy) * 70);
    }
    case "scatter":
      // Deterministic shuffle: a fixed multiplier modulo the grid size gives a
      // scattered-looking but stable order for the same badge every render.
      return ((index * 61) % (WEEKS * DAYS)) * 9;
    case "cascade":
      return week * 120;
    case "waterfall":
      return day * 130;
    case "fade-in":
    default:
      return week * 60;
  }
}

export function buildHeatmapCells(
  heatmapData: HeatmapDay[],
  offsetX: number = 0,
  offsetY: number = 0,
  animation: BadgeConfig["heatmapAnimation"] = "fade-in",
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
        delay: heatmapDelay(animation, week, day, idx),
      });
    }
  }
  return cells;
}

/** Options controlling how {@link renderHeatmapSvg} emits cell markup. */
interface RenderHeatmapOptions {
  /**
   * When `true`, cells render at full opacity with NO SMIL `<animate>` elements.
   *
   * SMIL animations do not run when an SVG is embedded via `<img>` (e.g. GitHub
   * README badges). Animated cells start at `opacity="0"`, so without a running
   * animation they render permanently invisible. The badge SVG — which is always
   * consumed as an `<img>` — must pass `disableAnimation: true` so cells are
   * visible. Interactive/in-DOM previews can keep the default animated reveal. (#760)
   */
  disableAnimation?: boolean;
}

/**
 * Render an array of heatmap cells as SVG `<rect>` elements.
 *
 * By default each cell is a rounded rectangle (`rx="4"`) that starts fully
 * transparent (`opacity="0"`) and animates to full opacity via an SVG
 * `<animate>` element, with a per-cell delay ({@link HeatmapCell.delay})
 * producing a staggered column-by-column reveal.
 *
 * When `options.disableAnimation` is `true`, cells render statically at
 * `opacity="1"` with no `<animate>` elements — required for `<img>` embeds
 * where SMIL does not run (see {@link RenderHeatmapOptions.disableAnimation}).
 *
 * @param cells - Pre-computed heatmap cells from {@link buildHeatmapCells}
 * @param options - Rendering options (e.g. {@link RenderHeatmapOptions.disableAnimation})
 * @returns SVG markup string containing all `<rect>` elements, separated by newlines
 */
export function renderHeatmapSvg(
  cells: HeatmapCell[],
  options: RenderHeatmapOptions = {},
): string {
  const { disableAnimation = false } = options;
  return cells
    .map((c) =>
      disableAnimation
        ? `<rect x="${c.x}" y="${c.y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="4" fill="${c.fill}" opacity="1"/>`
        : `<rect x="${c.x}" y="${c.y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="4" fill="${c.fill}" opacity="0">` +
          `<animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${c.delay}ms" fill="freeze"/>` +
          `</rect>`,
    )
    .join("\n    ");
}
