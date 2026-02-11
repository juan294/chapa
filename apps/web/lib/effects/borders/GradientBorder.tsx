"use client";

import { useId } from "react";

export interface GradientBorderProps {
  enabled?: boolean;
  speed?: number;
  children: React.ReactNode;
  className?: string;
}

/** CSS for rotating conic-gradient border. Inject once in the page. */
export const GRADIENT_BORDER_CSS = `
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes rotate-gradient-border {
  0% { --gradient-angle: 0deg; }
  100% { --gradient-angle: 360deg; }
}

.animated-gradient-border {
  background: conic-gradient(
    from var(--gradient-angle),
    #5E4FCC, #7C6AEF, #9D8FFF, #7C6AEF, #5E4FCC
  );
  animation: rotate-gradient-border 4s linear infinite;
}

@supports not (background: conic-gradient(from var(--gradient-angle), red, blue)) {
  .animated-gradient-border {
    background: linear-gradient(90deg, #5E4FCC, #7C6AEF, #9D8FFF, #7C6AEF, #5E4FCC);
    background-size: 300% 300%;
    animation: gradient-shift-fallback 3s ease infinite;
  }
  @keyframes gradient-shift-fallback {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .animated-gradient-border {
    animation: none !important;
    background: conic-gradient(from 45deg, #5E4FCC, #7C6AEF, #9D8FFF, #7C6AEF, #5E4FCC);
  }
}
`;

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
