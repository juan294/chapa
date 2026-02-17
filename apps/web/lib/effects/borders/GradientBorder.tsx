"use client";

import { useId } from "react";

export interface GradientBorderProps {
  enabled?: boolean;
  speed?: number;
  children: React.ReactNode;
  className?: string;
}

// Re-export CSS constant from lightweight module (allows importing CSS without pulling in the component)
export { GRADIENT_BORDER_CSS } from "./gradient-border-css";

export function GradientBorder({
  enabled = true,
  speed = 4,
  children,
  className = "",
}: GradientBorderProps) {
  const gradientId = useId();

  const animationStyle = enabled
    ? { animationDuration: `${speed}s` }
    : { animationPlayState: "paused" as const };

  return (
    <div
      className={`animated-border-wrapper relative rounded-2xl ${className}`}
      style={{ "--gradient-id": gradientId } as React.CSSProperties}
    >
      <div
        className="animated-gradient-border absolute rounded-[18px] pointer-events-none"
        style={{
          inset: "-3px",
          zIndex: 0,
          ...animationStyle,
        }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
