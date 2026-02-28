"use client";

interface SparklineProps {
  values: { date: string; value: number }[];
  width?: number;
  height?: number;
  color: string;
  className?: string;
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  color,
  className,
}: SparklineProps) {
  if (values.length < 2) return null;

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const nums = values.map((v) => v.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;

  function mapY(value: number): number {
    if (range === 0) return height / 2;
    // Invert: high values at top (low y), low values at bottom (high y)
    return padding + chartHeight - ((value - min) / range) * chartHeight;
  }

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * chartWidth;
    const y = mapY(v.value);
    return `${x},${y}`;
  });

  const polylinePoints = points.join(" ");

  // Polygon: line points + bottom-right + bottom-left to close the fill area
  const bottomY = height - padding;
  const lastX = padding + chartWidth;
  const firstX = padding;
  const polygonPoints = `${polylinePoints} ${lastX},${bottomY} ${firstX},${bottomY}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={className}
    >
      <polygon
        points={polygonPoints}
        fill={color}
        opacity="0.1"
        stroke="none"
      />
      <polyline
        points={polylinePoints}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
