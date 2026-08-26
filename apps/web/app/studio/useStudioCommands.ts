import { useMemo } from "react";
import type { BadgeConfig } from "@chapa/shared";
import {
  getCategoryLabel,
  getOptionLabel,
  getPresetLabel,
  STUDIO_CATEGORIES,
} from "./studio-options";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import {
  CATEGORY_KEY_TO_ALIAS,
  makeLine,
  resolveCategory,
  type CommandAction,
  type CommandDef,
} from "@/components/terminal/command-registry";
import { getBaseUrl } from "@/lib/env";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";

interface UseStudioCommandsOptions {
  config: BadgeConfig;
  handle: string;
  saving?: boolean;
}

export type StudioCommandAction =
  | Extract<
      CommandAction,
      { type: "clear" | "preset" | "save" | "reset" }
    >
  | {
      type: "set";
      category: keyof BadgeConfig;
      value: BadgeConfig[keyof BadgeConfig];
    };

export type StudioCommandDef = CommandDef<StudioCommandAction>;

export function useStudioCommands({
  config,
  handle,
  saving = false,
}: UseStudioCommandsOptions): StudioCommandDef[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const text = (key: string) => t(key) as string;
    const format = (key: string, values: Record<string, string>) =>
      interpolate(text(key), values);
    const base = getBaseUrl();
    const profileUrl = `${base}/u/${handle}`;
    const badgeUrl = `${profileUrl}/badge.svg`;
    const commands: StudioCommandDef[] = [
      {
        name: "/set",
        description: text("studio.commands.setDescription"),
        usage: "/set <category> <value>",
        execute: (args) => {
          if (args.length < 2) {
            const categoryList = STUDIO_CATEGORIES.map((c) => {
              const alias = CATEGORY_KEY_TO_ALIAS[c.key] ?? c.key;
              return `  ${alias.padEnd(12)} ${c.options.map((o) => o.value).join(", ")}`;
            });
            return {
              lines: [
                makeLine("system", text("studio.commands.setUsage")),
                makeLine("dim", ""),
                ...categoryList.map((l) => makeLine("info", l)),
              ],
            };
          }

          const catInput = args[0]!;
          const value = args[1]!;
          const resolved = resolveCategory(catInput);

          if (!resolved) {
            return {
              lines: [
                makeLine(
                  "error",
                  format("studio.commands.unknownCategory", { category: catInput }),
                ),
                makeLine("dim", text("studio.commands.validCategories")),
              ],
            };
          }

          // Validate value against category options
          const category = STUDIO_CATEGORIES.find((c) => c.key === resolved);
          if (category && !category.options.some((o) => o.value === value)) {
            return {
              lines: [
                makeLine(
                  "error",
                  format("studio.commands.invalidValue", {
                    value,
                    category: resolved,
                  }),
                ),
                makeLine(
                  "dim",
                  format("studio.commands.options", {
                    options: category.options.map((o) => o.value).join(", "),
                  }),
                ),
              ],
            };
          }

          return {
            lines: [makeLine("success", `${resolved} → ${value}`)],
            action: {
              type: "set",
              category: resolved,
              value: value as BadgeConfig[keyof BadgeConfig],
            },
          };
        },
      },
      {
        name: "/preset",
        description: text("studio.commands.presetDescription"),
        usage: "/preset <name>",
        execute: (args) => {
          if (args.length === 0) {
            return {
              lines: [
                makeLine("system", text("studio.commands.availablePresets")),
                ...STUDIO_PRESETS.map((p) =>
                  makeLine(
                    "info",
                    `  ${p.id.padEnd(14)} ${getPresetLabel(p.id, p.label, t)}`,
                  ),
                ),
              ],
            };
          }
          const name = args[0]!.toLowerCase();
          const preset = STUDIO_PRESETS.find((p) => p.id === name);
          if (!preset) {
            return {
              lines: [
                makeLine(
                  "error",
                  format("studio.commands.unknownPreset", { preset: name }),
                ),
                makeLine(
                  "dim",
                  format("studio.commands.available", {
                    presets: STUDIO_PRESETS.map((p) => p.id).join(", "),
                  }),
                ),
              ],
            };
          }
          return {
            lines: [
              makeLine(
                "success",
                format("studio.commands.appliedPreset", {
                  preset: getPresetLabel(preset.id, preset.label, t),
                }),
              ),
            ],
            action: { type: "preset", name },
          };
        },
      },
      {
        name: "/save",
        description: text("studio.commands.saveDescription"),
        execute: () =>
          saving
            ? { lines: [makeLine("warning", text("studio.save.alreadySaving"))] }
            : {
                lines: [makeLine("system", text("studio.save.saving"))],
                action: { type: "save" },
              },
      },
      {
        name: "/reset",
        description: text("studio.commands.resetDescription"),
        execute: () => ({
          lines: [makeLine("warning", text("studio.commands.resetDone"))],
          action: { type: "reset" },
        }),
      },
      {
        name: "/status",
        description: text("studio.commands.statusDescription"),
        execute: () => ({
          lines: [
            makeLine("system", text("studio.commands.currentConfiguration")),
            ...STUDIO_CATEGORIES.map((c) =>
              makeLine(
                "info",
                `  ${getCategoryLabel(c, t).padEnd(20)} ${getOptionLabel(c.key, config[c.key], t)}`,
              ),
            ),
          ],
        }),
      },
      {
        name: "/embed",
        description: text("studio.commands.embedDescription"),
        execute: () => ({
          lines: [
            makeLine("system", text("studio.commands.embedHeading")),
            makeLine("dim", ""),
            makeLine("info", text("studio.commands.markdown")),
            makeLine("success", `![${text("studio.commands.embedAlt")}](${badgeUrl})`),
            makeLine("dim", ""),
            makeLine("info", text("studio.commands.html")),
            makeLine("success", `<img src="${badgeUrl}" alt="${text("studio.commands.embedAlt")}" width="600" height="315" />`),
          ],
        }),
      },
      {
        name: "/share",
        description: text("studio.commands.shareDescription"),
        execute: () => ({
          lines: [
            makeLine("system", text("studio.commands.shareHeading")),
            makeLine("info", `${text("studio.commands.directLink")} ${profileUrl}`),
            makeLine("info", `${text("studio.commands.badgeSvg")}   ${badgeUrl}`),
          ],
        }),
      },
      {
        name: "/help",
        description: text("studio.commands.helpDescription"),
        execute: () => ({
          lines: [
            makeLine("system", text("studio.commands.helpHeading")),
            makeLine("info", `  /set <cat> <val>   ${text("studio.commands.helpSet")}`),
            makeLine("info", `  /preset <name>     ${text("studio.commands.helpPreset")}`),
            makeLine("info", `  /save              ${text("studio.commands.helpSave")}`),
            makeLine("info", `  /reset             ${text("studio.commands.helpReset")}`),
            makeLine("info", `  /status            ${text("studio.commands.helpStatus")}`),
            makeLine("info", `  /embed             ${text("studio.commands.helpEmbed")}`),
            makeLine("info", `  /share             ${text("studio.commands.helpShare")}`),
            makeLine("info", `  /clear             ${text("studio.commands.helpClear")}`),
            makeLine("dim", ""),
            makeLine("dim", text("studio.commands.helpTip")),
          ],
        }),
      },
      {
        name: "/clear",
        description: text("studio.commands.clearDescription"),
        execute: () => ({
          lines: [],
          action: { type: "clear" },
        }),
      },
    ];
    return commands;
  }, [config, handle, saving, t]);
}
