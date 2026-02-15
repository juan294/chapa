"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface InfoTooltipProps {
  content: string;
  id: string;
  position?: "top" | "bottom";
  className?: string;
}

export function InfoTooltip({
  content,
  id,
  position = "top",
  className,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click (mobile)
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  const panelPosition =
    position === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";

  return (
    <span
      ref={wrapperRef}
      className={`group/tip relative inline-flex items-center ${className ?? ""}`}
    >
      <button
        type="button"
        aria-label="More info"
        aria-describedby={id}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-center w-4 h-4 text-text-secondary hover:text-amber focus-visible:text-amber transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-amber/50 rounded-full"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>

      <span
        id={id}
        role="tooltip"
        className={`absolute ${panelPosition} left-1/2 -translate-x-1/2 z-50 w-max max-w-[240px] rounded-lg bg-card/90 backdrop-blur-xl border border-stroke shadow-lg p-3 text-xs text-text-secondary font-body leading-relaxed normal-case tracking-normal text-center pointer-events-none opacity-0 translate-y-1 scale-95 transition-all duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover/tip:opacity-100 group-hover/tip:translate-y-0 group-hover/tip:scale-100 group-focus-within/tip:opacity-100 group-focus-within/tip:translate-y-0 group-focus-within/tip:scale-100 ${open ? "!opacity-100 !translate-y-0 !scale-100 pointer-events-auto" : ""}`}
      >
        {content}
      </span>
    </span>
  );
}
