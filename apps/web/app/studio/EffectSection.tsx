"use client";

import type { BadgeConfig } from "@chapa/shared";
import type { CategoryMeta } from "./studio-options";
import { getOptionLabel } from "./studio-options";
import { OptionPicker } from "./OptionPicker";

export interface EffectSectionProps {
  category: CategoryMeta;
  config: BadgeConfig;
  onChange: (key: keyof BadgeConfig, value: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  triggerId: string;
  panelId: string;
}

export function EffectSection({
  category,
  config,
  onChange,
  isExpanded,
  onToggle,
  triggerId,
  panelId,
}: EffectSectionProps) {
  const currentValue = config[category.key];
  const currentLabel = getOptionLabel(category.key, currentValue);
  const columns = category.options.length <= 3 ? 2 : 2;

  return (
    <div className="border-b border-stroke last:border-b-0">
      <button
        type="button"
        id={triggerId}
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        data-accordion-trigger=""
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-amber/[0.03]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-text-primary">
            {category.label}
          </span>
          <span className="text-xs text-text-secondary truncate">
            {currentLabel}
          </span>
        </div>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-text-secondary transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isExpanded && (
        <div id={panelId} role="region" aria-labelledby={triggerId} className="px-4 pb-4">
          <OptionPicker
            options={category.options}
            value={currentValue}
            onChange={(val) => onChange(category.key, val)}
            columns={columns}
          />
        </div>
      )}
    </div>
  );
}
