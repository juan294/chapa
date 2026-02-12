import type { DimensionScores } from "@chapa/shared";
import { WARM_AMBER } from "./theme";

/**
 * Renders a 4-point diamond/radar chart as SVG markup.
 *
 * Axes (clockwise from top): Building, Guarding, Consistency, Breadth.
 * Each dimension (0-100) maps to distance from center (0 = center, 100 = edge).
 *
 * @param dimensions - Four dimension scores
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param radius - Maximum radius from center to edge
 * @returns SVG group string (<g>...</g>)
 */
export function renderRadarChart(
  dimensions: DimensionScores,
  cx: number,
  cy: number,
  radius: number,
): string {
  const t = WARM_AMBER;

  // Axes: top = Building, right = Guarding, bottom = Consistency, left = Breadth
  // Angles: 0 = top (-π/2), π/2 = right, π = bottom, 3π/2 = left
  const axes: { key: keyof DimensionScores; label: string; angle: number }[] = [
    { key: "building", label: "Building", angle: -Math.PI / 2 },
    { key: "guarding", label: "Guarding", angle: 0 },
    { key: "consistency", label: "Consistency", angle: Math.PI / 2 },
    { key: "breadth", label: "Breadth", angle: Math.PI },
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
      return `<polygon points="${pointsStr}" fill="none" stroke="${t.stroke}" stroke-width="${level === 1 ? 1.5 : 0.8}" opacity="${level === 1 ? 0.5 : 0.3}"/>`;
    })
    .join("\n    ");

  // Axis lines from center
  const axisLines = axes
    .map((a) => {
      const [x2, y2] = toPoint(a.angle, radius);
      return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${t.stroke}" stroke-width="0.8" opacity="0.3"/>`;
    })
    .join("\n    ");

  // Data shape
  const dataPoints = axes.map((a) => {
    const val = dimensions[a.key] / 100;
    const dist = val * radius;
    return toPoint(a.angle, dist);
  });
  const dataPointsStr = dataPoints.map(([x, y]) => `${x},${y}`).join(" ");

  // Axis labels
  const labelOffset = 20;
  const labelSvg = axes
    .map((a) => {
      const [x, y] = toPoint(a.angle, radius + labelOffset);
      let anchor = "middle";
      let dx = 0;
      if (a.angle === 0) {
        anchor = "start";
        dx = 4;
      } else if (a.angle === Math.PI) {
        anchor = "end";
        dx = -4;
      }
      const dy = a.angle === -Math.PI / 2 ? -6 : a.angle === Math.PI / 2 ? 14 : 4;
      return `<text x="${x + dx}" y="${y + dy}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" text-anchor="${anchor}">${a.label}</text>`;
    })
    .join("\n    ");

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
