import type { DimensionScores } from "@chapa/shared";
import { WARM_AMBER, type BadgeTheme } from "./theme";

/**
 * Locale-resolved label strings for the radar chart. Optional so existing
 * callers (out of this issue's ownership — the share page, og-image route,
 * warm-cache cron, and the demo/archetype pages) keep getting the exact same
 * English output with zero code changes. #1181 (UX-H3) — `renderRadarChart`
 * must stay a pure, synchronous function: labels are resolved by the caller
 * (via `getServerT`) and passed in as plain strings, never looked up here.
 */
export interface RadarChartLabels {
  delivery: string;
  quality: string;
  consistency: string;
  breadth: string;
  craft: string;
  /** Empty-state text shown when every dimension is 0 (e.g. "no data yet"). */
  noData: string;
}

const DEFAULT_RADAR_LABELS: RadarChartLabels = {
  delivery: "Delivery",
  quality: "Quality",
  consistency: "Consistency",
  breadth: "Breadth",
  craft: "Craft",
  noData: "no data yet",
};

/**
 * Renders a radar chart as SVG markup.
 *
 * When all 5 dimensions are present (including craft), renders a 5-axis pentagon.
 * When craft is absent, falls back to the original 4-axis diamond layout.
 *
 * Pentagon axes (72° spacing from top): Delivery, Quality, Consistency, Breadth, Craft.
 * Diamond axes (90° spacing from top): Delivery, Quality, Consistency, Breadth.
 *
 * Each dimension (0-100) maps to distance from center (0 = center, 100 = edge).
 *
 * @param dimensions - Four or five dimension scores
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param radius - Maximum radius from center to edge
 * @param labels - Locale-resolved axis/empty-state labels (defaults to English)
 * @returns SVG group string (<g>...</g>)
 */
export function renderRadarChart(
  dimensions: DimensionScores,
  cx: number,
  cy: number,
  radius: number,
  labels: RadarChartLabels = DEFAULT_RADAR_LABELS,
  theme: BadgeTheme = WARM_AMBER,
): string {
  const t = theme;

  const hasCraft = dimensions.craft != null;

  // Pentagon (72° spacing) when craft present; diamond (90° spacing) when absent
  const axes: { key: keyof DimensionScores; label: string; angle: number }[] = hasCraft
    ? [
        { key: "delivery", label: labels.delivery, angle: -Math.PI / 2 },
        { key: "quality", label: labels.quality, angle: -Math.PI / 2 + (2 * Math.PI) / 5 },
        { key: "consistency", label: labels.consistency, angle: -Math.PI / 2 + (4 * Math.PI) / 5 },
        { key: "breadth", label: labels.breadth, angle: -Math.PI / 2 + (6 * Math.PI) / 5 },
        { key: "craft", label: labels.craft, angle: -Math.PI / 2 + (8 * Math.PI) / 5 },
      ]
    : [
        { key: "delivery", label: labels.delivery, angle: -Math.PI / 2 },
        { key: "quality", label: labels.quality, angle: 0 },
        { key: "consistency", label: labels.consistency, angle: Math.PI / 2 },
        { key: "breadth", label: labels.breadth, angle: Math.PI },
      ];

  const toPoint = (angle: number, dist: number): [number, number] => [
    Math.round(cx + dist * Math.cos(angle)),
    Math.round(cy + dist * Math.sin(angle)),
  ];

  // Concentric guide rings at 25%, 50%, 75%, 100%
  const ringLevels = [0.25, 0.5, 0.75, 1.0];
  const ringSvg = ringLevels
    .map((level) => {
      const r = radius * level;
      const pts = axes.map((a) => toPoint(a.angle, r));
      const pointsStr = pts.map(([x, y]) => `${x},${y}`).join(" ");
      return `<polygon points="${pointsStr}" fill="none" stroke="${t.accent}" stroke-width="${level === 1 ? 2 : 1}" opacity="${level === 1 ? 0.5 : 0.2}"/>`;
    })
    .join("\n    ");

  // Axis lines from center
  const axisLines = axes
    .map((a) => {
      const [x2, y2] = toPoint(a.angle, radius);
      return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${t.accent}" stroke-width="0.8" opacity="0.2"/>`;
    })
    .join("\n    ");

  // Data shape
  const dataPoints = axes.map((a) => {
    const val = (dimensions[a.key] ?? 0) / 100;
    const dist = val * radius;
    return toPoint(a.angle, dist);
  });
  const allZero = axes.every((a) => (dimensions[a.key] ?? 0) === 0);
  const dataPointsStr = dataPoints.map(([x, y]) => `${x},${y}`).join(" ");

  // Axis labels — position based on angle direction (works for any rotation)
  const labelOffset = 20;
  const labelSvg = axes
    .map((a) => {
      const [x, y] = toPoint(a.angle, radius + labelOffset);
      const cosA = Math.cos(a.angle);
      const sinA = Math.sin(a.angle);
      let anchor = "middle";
      let dx = 0;
      if (cosA > 0.3) { anchor = "start"; dx = 4; }
      else if (cosA < -0.3) { anchor = "end"; dx = -4; }
      const dy = sinA < -0.3 ? -4 : sinA > 0.3 ? 14 : 4;
      return `<text x="${x + dx}" y="${y + dy}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" text-anchor="${anchor}">${a.label}</text>`;
    })
    .join("\n    ");

  if (allZero) {
    return `<g>
    ${ringSvg}
    ${axisLines}
    <circle cx="${cx}" cy="${cy}" r="3" fill="${t.textSecondary}" opacity="0.6" data-role="radar-empty-marker"/>
    <text x="${cx}" y="${cy + 18}" font-family="'JetBrains Mono', monospace" font-size="10" fill="${t.textSecondary}" text-anchor="middle" opacity="0.7">${labels.noData}</text>
    ${labelSvg}
  </g>`;
  }

  return `<g>
    ${ringSvg}
    ${axisLines}
    <polygon points="${dataPointsStr}" fill="${t.accent}" fill-opacity="0.15" stroke="${t.accent}" stroke-width="2" stroke-opacity="0.8"/>
    ${dataPoints
      .map(
        ([x, y]) =>
          `<circle cx="${x}" cy="${y}" r="4" fill="${t.accent}" stroke="${t.bg}" stroke-width="2"/>`,
      )
      .join("\n    ")}
    ${labelSvg}
  </g>`;
}
