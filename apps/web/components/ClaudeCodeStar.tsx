"use client";

import { useState, useEffect } from "react";

const FRAMES = ["*", "·", "|", "L"] as const;
const INTERVAL_MS = 400;

/**
 * Animates the Claude Code attribution star in the footer by cycling through
 * the same spinner characters the Claude Code CLI uses: * · | L
 *
 * Respects prefers-reduced-motion — stays on "*" when motion is reduced.
 */
export function ClaudeCodeStar() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

  return <>{FRAMES[frame]}</>;
}
