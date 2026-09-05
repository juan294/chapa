"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

type InlineBadgeSvgProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "dangerouslySetInnerHTML"> & {
  /** Trusted output from renderBadgeSvg, which escapes user-controlled text. */
  svg: string;
};

/** Keep the real renderer markup while honoring reduced motion for SVG SMIL. */
export function InlineBadgeSvg({ svg, ...props }: InlineBadgeSvgProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const badge = host.current?.querySelector("svg");
    if (!badge || typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => {
      if (preference.matches) {
        // CSS suppresses the badge's CSS animation and paints activity cells
        // immediately. SMIL has its own timeline, so stop it at the base frame.
        badge.pauseAnimations?.();
        badge.setCurrentTime?.(0);
      } else {
        badge.unpauseAnimations?.();
      }
    };
    applyMotion();
    preference.addEventListener("change", applyMotion);
    return () => preference.removeEventListener("change", applyMotion);
  }, [svg]);

  return <div {...props} ref={host} dangerouslySetInnerHTML={{ __html: svg }} />;
}
