"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const visible = open || hovered;

  // Recompute position when visible
  useEffect(() => {
    if (!visible || !buttonRef.current) return;

    const update = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      setCoords({
        x: rect.left + rect.width / 2,
        y: position === "top" ? rect.top : rect.bottom,
      });
    };

    update();

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [visible, position]);

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

  const tooltip = visible && coords ? createPortal(
    <span
      id={id}
      role="tooltip"
      className="fixed z-[99999] w-max max-w-[240px] rounded-lg bg-card/95 backdrop-blur-xl shadow-card p-3 text-xs text-text-secondary font-body leading-relaxed normal-case tracking-normal text-center pointer-events-none"
      style={{
        left: coords.x,
        top: position === "top" ? coords.y - 8 : coords.y + 8,
        transform: position === "top"
          ? "translate(-50%, -100%)"
          : "translate(-50%, 0)",
      }}
    >
      {content}
    </span>,
    document.body,
  ) : null;

  return (
    <span
      ref={wrapperRef}
      className={`inline-flex items-center ${className ?? ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('aria.moreInfo') as string}
        aria-describedby={id}
        onClick={() => setOpen((prev) => !prev)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="inline-flex items-center justify-center w-4 h-4 text-text-secondary hover:text-amber focus-visible:text-amber transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber rounded-full"
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

      {tooltip}
    </span>
  );
}
