import type { BadgeConfig } from "@chapa/shared";
import { CATEGORY_KEY_TO_ALIAS } from "@/components/terminal/command-registry";
import { STUDIO_CATEGORIES } from "./studio-options";

/**
 * The whole preview configuration on one line (#1241).
 *
 * This replaces the ACTIVE CONFIG definition list that sat beside the badge:
 * it carried the same six values Quick Controls already shows, in a block tall
 * enough to push the preview off-screen. One line under the badge keeps the
 * "what am I looking at" answer without the duplication.
 */
export function formatConfigSummary(config: BadgeConfig): string {
  return STUDIO_CATEGORIES.map(
    (category) =>
      `${CATEGORY_KEY_TO_ALIAS[category.key] ?? category.key}=${
        config[category.key]
      }`,
  ).join("  ·  ");
}

/**
 * The same configuration as replayable terminal input — one `/set` per
 * category, in `STUDIO_CATEGORIES` order. Pasting the block back into the
 * studio prompt reproduces the configuration exactly, which is what makes the
 * copy affordance worth having over copying a JSON blob nothing consumes.
 */
export function formatConfigCommands(config: BadgeConfig): string {
  return STUDIO_CATEGORIES.map(
    (category) =>
      `/set ${CATEGORY_KEY_TO_ALIAS[category.key] ?? category.key} ${
        config[category.key]
      }`,
  ).join("\n");
}
