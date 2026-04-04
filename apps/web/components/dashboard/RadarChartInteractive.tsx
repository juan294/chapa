"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { DimensionScores } from "@chapa/shared";
import { useInView } from "@/lib/effects/counters/use-in-view";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Diamond axes (90° spacing) — 4 dimensions */
const AXES_4: {
  key: keyof DimensionScores;
  label: string;
  angle: number;
}[] = [
  { key: "delivery", label: "Delivery", angle: -Math.PI / 2 }, // top
  { key: "quality", label: "Quality", angle: 0 }, // right
  { key: "consistency", label: "Consistency", angle: Math.PI / 2 }, // bottom
  { key: "breadth", label: "Breadth", angle: Math.PI }, // left
];

/** Pentagon axes (72° spacing) — 5 dimensions including craft */
const AXES_5: {
  key: keyof DimensionScores;
  label: string;
  angle: number;
}[] = [
  { key: "delivery", label: "Delivery", angle: -Math.PI / 2 },
  { key: "quality", label: "Quality", angle: -Math.PI / 2 + (2 * Math.PI) / 5 },
  { key: "consistency", label: "Consistency", angle: -Math.PI / 2 + (4 * Math.PI) / 5 },
  { key: "breadth", label: "Breadth", angle: -Math.PI / 2 + (6 * Math.PI) / 5 },
  { key: "craft", label: "Craft", angle: -Math.PI / 2 + (8 * Math.PI) / 5 },
];

const DIMENSION_COLORS: Record<keyof DimensionScores, string> = {
  delivery: "var(--color-dimension-delivery)",
  quality: "var(--color-dimension-quality)",
  consistency: "var(--color-dimension-consistency)",
  breadth: "var(--color-dimension-breadth)",
  craft: "var(--color-dimension-craft)",
};

const RING_LEVELS = [0.25, 0.5, 0.75, 1.0];

/** Convert polar to cartesian */
function toPoint(
  angle: number,
  dist: number,
  cx: number,
  cy: number,
): [number, number] {
  return [
    Math.round(cx + dist * Math.cos(angle)),
    Math.round(cy + dist * Math.sin(angle)),
  ];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RadarChartInteractiveProps {
  dimensions: DimensionScores;
  activeDimension?: keyof DimensionScores | null;
  onDimensionHover?: (key: keyof DimensionScores | null) => void;
  onDimensionClick?: (key: keyof DimensionScores) => void;
  size?: number;
  animated?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RadarChartInteractive({
  dimensions,
  activeDimension: controlledActive,
  onDimensionHover,
  onDimensionClick,
  size = 280,
  animated = true,
  className,
}: RadarChartInteractiveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, 0.3);

  // Select diamond (4 axes) or pentagon (5 axes) based on craft presence
  const hasCraft = dimensions.craft != null;
  const AXES = hasCraft ? AXES_5 : AXES_4;

  // Internal active state (uncontrolled) — overridden by prop when provided
  const [internalActive, setInternalActive] = useState<
    keyof DimensionScores | null
  >(null);
  const active =
    controlledActive !== undefined ? controlledActive : internalActive;

  // Animation progress (0→1). Starts at 1 when animation is disabled.
  const [progress, setProgress] = useState(animated ? 0 : 1);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animated || !inView) return;

    // Check prefers-reduced-motion — use rAF to avoid synchronous setState
    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const duration = prefersReduced ? 0 : 1000; // 1s

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const t = duration === 0 ? 1 : Math.min(elapsed / duration, 1);
      // Ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);

      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    startTimeRef.current = null;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [inView, animated]);

  // Derive display values from progress — no setState in the effect body
  const displayValues: DimensionScores = {
    delivery: Math.round(dimensions.delivery * progress),
    quality: Math.round(dimensions.quality * progress),
    consistency: Math.round(dimensions.consistency * progress),
    breadth: Math.round(dimensions.breadth * progress),
    ...(dimensions.craft != null ? { craft: Math.round(dimensions.craft * progress) } : {}),
  };

  // ---------------------------------------------------------------------------
  // Derived geometry
  // ---------------------------------------------------------------------------

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35; // Leave room for labels
  const labelOffset = 22;

  // Data points for the shape polygon
  const dataPoints = AXES.map((axis) => {
    const val = (displayValues[axis.key] ?? 0) / 100;
    return toPoint(axis.angle, val * radius, cx, cy);
  });
  const dataPointsStr = dataPoints.map(([x, y]) => `${x},${y}`).join(" ");

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAxisHover = useCallback(
    (key: keyof DimensionScores) => {
      setInternalActive(key);
      onDimensionHover?.(key);
    },
    [onDimensionHover],
  );

  const handleAxisClick = useCallback(
    (key: keyof DimensionScores) => {
      onDimensionClick?.(key);
    },
    [onDimensionClick],
  );

  const handleSvgLeave = useCallback(() => {
    setInternalActive(null);
    onDimensionHover?.(null);
  }, [onDimensionHover]);

  const handleVertexKeyDown = useCallback(
    (key: keyof DimensionScores, e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onDimensionClick?.(key);
      }
    },
    [onDimensionClick],
  );

  // ---------------------------------------------------------------------------
  // aria-label
  // ---------------------------------------------------------------------------

  const ariaLabel = `Radar chart showing ${AXES.map(
    (a) => `${a.label} ${dimensions[a.key]}`,
  ).join(", ")}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div ref={containerRef} className={className}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={handleSvgLeave}
        style={{ width: "100%", height: "100%", maxWidth: size, maxHeight: size }}
      >
        {/* Guide diamonds at 25%, 50%, 75%, 100% */}
        {RING_LEVELS.map((level) => {
          const r = radius * level;
          const pts = AXES.map((a) => toPoint(a.angle, r, cx, cy));
          const pointsStr = pts.map(([x, y]) => `${x},${y}`).join(" ");
          return (
            <polygon
              key={`guide-${level}`}
              data-testid="guide-diamond"
              points={pointsStr}
              fill="none"
              stroke="var(--color-stroke)"
              strokeWidth={level === 1 ? 2 : 1}
              opacity={level === 1 ? 0.5 : 0.2}
              aria-hidden="true"
            />
          );
        })}

        {/* Axis lines from center to each vertex */}
        {AXES.map((axis) => {
          const [x2, y2] = toPoint(axis.angle, radius, cx, cy);
          return (
            <line
              key={`axis-line-${axis.key}`}
              data-testid="axis-line"
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              stroke="var(--color-stroke)"
              strokeWidth={0.8}
              opacity={0.3}
              aria-hidden="true"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          data-testid="data-polygon"
          points={dataPointsStr}
          fill="var(--color-amber)"
          fillOpacity={0.12}
          stroke="var(--color-amber)"
          strokeOpacity={0.7}
          strokeWidth={2}
        />

        {/* Vertex dots */}
        {AXES.map((axis, i) => {
          const [px, py] = dataPoints[i]!;
          const isActive = active === axis.key;
          const dimOpacity = active !== null && !isActive ? 0.5 : 1;

          return (
            <circle
              key={`vertex-${axis.key}`}
              data-testid="vertex-dot"
              cx={px}
              cy={py}
              r={isActive ? 7 : 5}
              fill={DIMENSION_COLORS[axis.key]}
              stroke="var(--color-bg)"
              strokeWidth={2}
              opacity={dimOpacity}
              tabIndex={0}
              role="button"
              aria-label={`${axis.label}: ${dimensions[axis.key]}`}
              onFocus={() => handleAxisHover(axis.key)}
              onBlur={() => {
                setInternalActive(null);
                onDimensionHover?.(null);
              }}
              onKeyDown={(e) => handleVertexKeyDown(axis.key, e)}
              style={{ cursor: "pointer" }}
            />
          );
        })}

        {/* Axis labels with dimension name and score */}
        {AXES.map((axis) => {
          const [lx, ly] = toPoint(axis.angle, radius + labelOffset, cx, cy);
          const cosA = Math.cos(axis.angle);
          const sinA = Math.sin(axis.angle);

          let anchor: "middle" | "start" | "end" = "middle";
          let dx = 0;
          if (cosA > 0.3) {
            anchor = "start";
            dx = 4;
          } else if (cosA < -0.3) {
            anchor = "end";
            dx = -4;
          }
          const dy = sinA < -0.3 ? -4 : sinA > 0.3 ? 14 : 4;

          const isActive = active === axis.key;

          return (
            <text
              key={`label-${axis.key}`}
              data-testid="axis-label"
              x={lx + dx}
              y={ly + dy}
              fontFamily="var(--font-plus-jakarta)"
              fontSize={12}
              fill={
                isActive
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)"
              }
              textAnchor={anchor}
              opacity={active !== null && !isActive ? 0.5 : 1}
            >
              {axis.label} {dimensions[axis.key]}
            </text>
          );
        })}

        {/* Invisible hit areas for each axis (hover + click + keyboard) */}
        {AXES.map((axis) => {
          // Create a wider hit area along the axis line
          const [ex, ey] = toPoint(axis.angle, radius + labelOffset, cx, cy);
          const perpAngle = axis.angle + Math.PI / 2;
          const hitWidth = 20;
          const [dx, dy] = [
            Math.cos(perpAngle) * hitWidth,
            Math.sin(perpAngle) * hitWidth,
          ];

          const hitPoints = [
            `${cx + dx},${cy + dy}`,
            `${ex + dx},${ey + dy}`,
            `${ex - dx},${ey - dy}`,
            `${cx - dx},${cy - dy}`,
          ].join(" ");

          return (
            <polygon
              key={`hit-${axis.key}`}
              data-testid="axis-hit-area"
              points={hitPoints}
              fill="transparent"
              stroke="none"
              style={{ cursor: "pointer" }}
              tabIndex={0}
              role="button"
              aria-label={`Select ${axis.label} dimension`}
              onMouseEnter={() => handleAxisHover(axis.key)}
              onClick={() => handleAxisClick(axis.key)}
              onKeyDown={(e) => handleVertexKeyDown(axis.key, e)}
              onFocus={() => handleAxisHover(axis.key)}
              onBlur={() => {
                setInternalActive(null);
                onDimensionHover?.(null);
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
