"use client";

import { useRef, useCallback } from "react";
import type { OptionMeta } from "./studio-options";

export interface OptionPickerProps {
  options: OptionMeta[];
  value: string;
  onChange: (value: string) => void;
  columns?: 2 | 3;
}

export function OptionPicker({
  options,
  value,
  onChange,
  columns = 2,
}: OptionPickerProps) {
  const gridClass =
    columns === 3 ? "grid-cols-3" : "grid-cols-2";
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIdx = options.findIndex((o) => o.value === value);
      let nextIdx = -1;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIdx = (currentIdx + 1) % options.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIdx = (currentIdx - 1 + options.length) % options.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIdx = options.length - 1;
      }

      if (nextIdx >= 0) {
        onChange(options[nextIdx].value);
        // Focus the newly selected button
        const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="radio"]',
        );
        buttons?.[nextIdx]?.focus();
      }
    },
    [options, value, onChange],
  );

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      className={`grid gap-2 ${gridClass}`}
      onKeyDown={handleKeyDown}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              isActive
                ? "border-amber bg-amber/[0.06] text-text-primary"
                : "border-stroke text-text-secondary hover:border-amber/20 hover:bg-amber/[0.03]"
            }`}
          >
            <div className="text-sm font-medium">{opt.label}</div>
            <div className="text-xs text-text-secondary mt-0.5">
              {opt.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
