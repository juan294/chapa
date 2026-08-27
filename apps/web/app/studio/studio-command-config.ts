import { DEFAULT_BADGE_CONFIG, type BadgeConfig } from "@chapa/shared";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import type { StudioCommandAction } from "./useStudioCommands";

/** Resolve the badge configuration produced by a Studio command action. */
export function getStudioCommandConfig(
  config: BadgeConfig,
  action: StudioCommandAction | undefined,
): BadgeConfig | null {
  if (!action) return null;

  switch (action.type) {
    case "set":
      return { ...config, [action.category]: action.value };
    case "preset":
      return (
        STUDIO_PRESETS.find((preset) => preset.id === action.name)?.config ??
        null
      );
    case "reset":
      return { ...DEFAULT_BADGE_CONFIG };
    default:
      return null;
  }
}
