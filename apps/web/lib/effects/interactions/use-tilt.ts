"use client";

import { useRef, useCallback, useState } from "react";

export interface TiltState {
  rotateX: number;
  rotateY: number;
  mouseX: string;
  mouseY: string;
  isHovering: boolean;
}

/**
 * Compute the tilt rotation and glare position from a mouse event
 * relative to an element's bounding rect.
 *
 * Pure function — no DOM side effects.
 */
export function computeTilt(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  maxTilt: number,
): TiltState {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const rotateX = ((y - centerY) / centerY) * -maxTilt;
  const rotateY = ((x - centerX) / centerX) * maxTilt;
  const mouseXPercent = `${(x / rect.width) * 100}%`;
  const mouseYPercent = `${(y / rect.height) * 100}%`;

  return {
    rotateX,
    rotateY,
    mouseX: mouseXPercent,
    mouseY: mouseYPercent,
    isHovering: true,
  };
}

const IDLE_STATE: TiltState = {
  rotateX: 0,
  rotateY: 0,
  mouseX: "50%",
  mouseY: "50%",
  isHovering: false,
};

export function useTilt(maxTilt = 15) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<TiltState>(IDLE_STATE);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTilt(computeTilt(e.clientX, e.clientY, rect, maxTilt));
    },
    [maxTilt],
  );

  const handleMouseLeave = useCallback(() => {
    setTilt(IDLE_STATE);
  }, []);

  return { ref, tilt, handleMouseMove, handleMouseLeave };
}
