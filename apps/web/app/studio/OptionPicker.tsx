"use client";

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

  return (
    <div
      role="radiogroup"
      className={`grid gap-2 ${gridClass}`}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              isActive
                ? "border-amber bg-amber/[0.06] text-text-primary"
                : "border-warm-stroke text-text-secondary hover:border-amber/20 hover:bg-amber/[0.03]"
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
