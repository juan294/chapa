"use client";

import { useCallback, useRef, useState } from "react";

export type HolographicVariant = "amber" | "rainbow";

export interface HolographicOverlayProps {
  variant?: HolographicVariant;
  intensity?: number;
  speed?: number;
  autoAnimate?: boolean;
  children: React.ReactNode;
  className?: string;
}

// Re-export CSS constant from lightweight module (allows importing CSS without pulling in the component)
export { HOLOGRAPHIC_CSS } from "./holographic-css";

export function HolographicOverlay({
  variant = "amber",
  intensity = 0.45,
  speed = 3,
  autoAnimate = true,
  children,
  className = "",
}: HolographicOverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (autoAnimate) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const angle = Math.atan2(y - 50, x - 50) * (180 / Math.PI) + 90;
      e.currentTarget.style.setProperty("--holo-angle", `${angle}deg`);
      e.currentTarget.style.setProperty("--holo-x", `${x}%`);
      e.currentTarget.style.setProperty("--holo-y", `${y}%`);
    },
    [autoAnimate],
  );

  const overlayClass = variant === "rainbow" ? "holo-overlay holo-rainbow" : "holo-overlay holo-amber";

  return (
    <div
      ref={cardRef}
      className={`holo-card ${className}`}
      style={{
        "--holo-intensity": intensity,
        "--holo-speed": `${speed}s`,
        "--holo-angle": "115deg",
      } as React.CSSProperties}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        cardRef.current?.style.setProperty("--holo-angle", "115deg");
      }}
    >
      <div
        className={`${overlayClass} ${hovering || autoAnimate ? "active" : ""} ${autoAnimate ? "auto-animate" : ""}`}
        aria-hidden="true"
      />
      <div className="relative z-[5]">{children}</div>
    </div>
  );
}
