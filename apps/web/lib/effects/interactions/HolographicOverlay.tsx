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

/** CSS for holographic overlay. Inject once in the page. */
export const HOLOGRAPHIC_CSS = `
.holo-card {
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
.holo-card:hover {
  border-color: rgba(226, 168, 75, 0.25);
  box-shadow: 0 0 40px rgba(226, 168, 75, 0.06);
}
.holo-overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-size: 200% 200%;
  mix-blend-mode: color-dodge;
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: 8;
}
.holo-amber {
  background: linear-gradient(var(--holo-angle, 115deg), transparent 20%, rgba(226,168,75,0.3) 36%, rgba(240,201,125,0.3) 42%, rgba(255,255,255,0.2) 48%, rgba(240,201,125,0.3) 54%, rgba(194,138,46,0.3) 60%, transparent 80%);
  background-size: 200% 200%;
}
.holo-rainbow {
  background: linear-gradient(var(--holo-angle, 115deg), transparent 20%, rgba(255,0,100,0.25) 30%, rgba(255,150,0,0.25) 38%, rgba(255,255,0,0.25) 44%, rgba(0,255,100,0.25) 50%, rgba(0,100,255,0.25) 56%, rgba(150,0,255,0.25) 64%, transparent 80%);
  background-size: 200% 200%;
}
.holo-overlay.active { opacity: var(--holo-intensity, 0.45); }
.holo-overlay.auto-animate.active { animation: holo-shift var(--holo-speed, 3s) ease infinite; }
@keyframes holo-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .holo-overlay {
    opacity: calc(var(--holo-intensity, 0.45) * 0.4) !important;
    animation: none !important;
    background-position: 50% 50%;
  }
}
`;

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
