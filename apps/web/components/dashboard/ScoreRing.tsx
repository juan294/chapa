"use client";

import { useRef } from "react";
import { useInView } from "@/lib/effects/counters/use-in-view";

interface ScoreRingProps {
  value: number;
  maxValue?: number;
  size: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  animated?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function ScoreRing({
  value,
  maxValue = 100,
  size,
  strokeWidth = 8,
  color,
  trackColor = "rgba(124,106,239,0.08)",
  animated = true,
  className,
  children,
}: ScoreRingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.3);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  const offset = circumference * (1 - percentage);

  const cx = size / 2;
  const cy = size / 2;

  const shouldAnimate = animated && inView;
  const dashOffset = animated && !inView ? circumference : offset;

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: "relative", width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        aria-hidden="true"
      >
        {/* Track circle (background) */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Value circle (progress arc) */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            strokeDasharray: String(circumference),
            strokeDashoffset: String(dashOffset),
            transition: shouldAnimate
              ? "stroke-dashoffset 1.5s ease-out"
              : "none",
          }}
        />
      </svg>
      {children && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
