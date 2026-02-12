"use client";

import { useState } from "react";
import type { BadgeConfig } from "@chapa/shared";
import { STUDIO_CATEGORIES } from "./studio-options";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";

interface QuickControlsProps {
  config: BadgeConfig;
  onCommand: (command: string) => void;
  visible: boolean;
  onToggle: () => void;
}

const CATEGORY_ALIAS: Record<string, string> = {
  background: "bg",
  cardStyle: "card",
  border: "border",
  scoreEffect: "score",
  heatmapAnimation: "heatmap",
  interaction: "interact",
  statsDisplay: "stats",
  tierTreatment: "tier",
  celebration: "celebrate",
};

export function QuickControls({
  config,
  onCommand,
  visible,
  onToggle,
}: QuickControlsProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (!visible) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-2 text-xs font-heading text-terminal-dim transition-colors hover:text-text-secondary border-b border-stroke w-full"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Quick Controls
      </button>
    );
  }

  return (
    <div className="border-b border-stroke">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-heading text-text-secondary transition-colors hover:text-text-primary w-full"
      >
        <span>Quick Controls</span>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>

      {/* Presets */}
      <div className="px-3 pb-2">
        <div className="text-[10px] text-terminal-dim uppercase tracking-wider mb-1.5">Presets</div>
        <div className="flex gap-1.5 flex-wrap">
          {STUDIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onCommand(`/preset ${preset.id}`)}
              className="rounded-md border border-stroke px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-amber/30 hover:text-amber font-heading"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="max-h-64 overflow-y-auto">
        {STUDIO_CATEGORIES.map((category) => {
          const alias = CATEGORY_ALIAS[category.key] ?? category.key;
          const isExpanded = expandedKey === category.key;
          const currentValue = config[category.key];

          return (
            <div key={category.key} className="border-t border-stroke/50">
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? null : category.key)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-amber/[0.03]"
              >
                <span className="text-text-secondary font-heading">
                  {category.label}
                </span>
                <span className="text-terminal-dim font-heading text-[10px]">
                  {currentValue}
                </span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                  {category.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onCommand(`/set ${alias} ${opt.value}`)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-heading transition-colors ${
                        opt.value === currentValue
                          ? "border-amber bg-amber/10 text-amber"
                          : "border-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-3 py-2 border-t border-stroke">
        <button
          type="button"
          onClick={() => onCommand("/save")}
          className="flex-1 rounded-md bg-amber px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-amber-light"
        >
          /save
        </button>
        <button
          type="button"
          onClick={() => onCommand("/reset")}
          className="rounded-md border border-stroke px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary"
        >
          /reset
        </button>
      </div>
    </div>
  );
}
