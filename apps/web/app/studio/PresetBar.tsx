"use client";

import type { BadgeConfig } from "@chapa/shared";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";

export interface PresetBarProps {
  config: BadgeConfig;
  onSelect: (config: BadgeConfig) => void;
}

function configsEqual(a: BadgeConfig, b: BadgeConfig): boolean {
  return (
    a.background === b.background &&
    a.cardStyle === b.cardStyle &&
    a.border === b.border &&
    a.scoreEffect === b.scoreEffect &&
    a.heatmapAnimation === b.heatmapAnimation &&
    a.interaction === b.interaction &&
    a.statsDisplay === b.statsDisplay &&
    a.tierTreatment === b.tierTreatment &&
    a.celebration === b.celebration
  );
}

export function PresetBar({ config, onSelect }: PresetBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {STUDIO_PRESETS.map((preset) => {
        const isActive = configsEqual(config, preset.config);
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.config)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-amber text-warm-bg"
                : "border border-warm-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary"
            }`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
