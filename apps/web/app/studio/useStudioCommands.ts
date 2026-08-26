import { useMemo } from "react";
import type { BadgeConfig } from "@chapa/shared";
import { STUDIO_CATEGORIES, getOptionLabel } from "./studio-options";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import {
  CATEGORY_KEY_TO_ALIAS,
  makeLine,
  resolveCategory,
  type CommandDef,
} from "@/components/terminal/command-registry";
import { getBaseUrl } from "@/lib/env";

interface UseStudioCommandsOptions {
  config: BadgeConfig;
  handle: string;
}

export function useStudioCommands({
  config,
  handle,
}: UseStudioCommandsOptions): CommandDef[] {
  return useMemo(() => {
    const base = getBaseUrl();
    const profileUrl = `${base}/u/${handle}`;
    const badgeUrl = `${profileUrl}/badge.svg`;
    const commands: CommandDef[] = [
      {
        name: "/set",
        description: "Set badge config field",
        usage: "/set <category> <value>",
        execute: (args) => {
          if (args.length < 2) {
            const categoryList = STUDIO_CATEGORIES.map((c) => {
              const alias = CATEGORY_KEY_TO_ALIAS[c.key] ?? c.key;
              return `  ${alias.padEnd(12)} ${c.options.map((o) => o.value).join(", ")}`;
            });
            return {
              lines: [
                makeLine("system", "Usage: /set <category> <value>"),
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
                makeLine("error", `Unknown category: ${catInput}`),
                makeLine("dim", "Valid: bg, card, border, score, heatmap, interact, stats, tier, celebrate"),
              ],
            };
          }

          // Validate value against category options
          const category = STUDIO_CATEGORIES.find((c) => c.key === resolved);
          if (category && !category.options.some((o) => o.value === value)) {
            return {
              lines: [
                makeLine("error", `Invalid value "${value}" for ${resolved}`),
                makeLine("dim", `Options: ${category.options.map((o) => o.value).join(", ")}`),
              ],
            };
          }

          return {
            lines: [makeLine("success", `${resolved} → ${value}`)],
            action: { type: "set", category: resolved, value },
          };
        },
      },
      {
        name: "/preset",
        description: "Apply a preset configuration",
        usage: "/preset <name>",
        execute: (args) => {
          if (args.length === 0) {
            return {
              lines: [
                makeLine("system", "Available presets:"),
                ...STUDIO_PRESETS.map((p) =>
                  makeLine("info", `  ${p.id.padEnd(14)} ${p.label}`),
                ),
              ],
            };
          }
          const name = args[0]!.toLowerCase();
          const preset = STUDIO_PRESETS.find((p) => p.id === name);
          if (!preset) {
            return {
              lines: [
                makeLine("error", `Unknown preset: ${name}`),
                makeLine("dim", `Available: ${STUDIO_PRESETS.map((p) => p.id).join(", ")}`),
              ],
            };
          }
          return {
            lines: [makeLine("success", `Applied preset: ${preset.label}`)],
            action: { type: "preset", name },
          };
        },
      },
      {
        name: "/save",
        description: "Save current configuration",
        execute: () => ({
          lines: [makeLine("system", "Saving configuration...")],
          action: { type: "save" },
        }),
      },
      {
        name: "/reset",
        description: "Reset to defaults",
        execute: () => ({
          lines: [makeLine("warning", "Configuration reset to defaults.")],
          action: { type: "reset" },
        }),
      },
      {
        name: "/status",
        description: "Show current config summary",
        execute: () => ({
          lines: [
            makeLine("system", "Current configuration:"),
            ...STUDIO_CATEGORIES.map((c) =>
              makeLine(
                "info",
                `  ${c.label.padEnd(20)} ${getOptionLabel(c.key, config[c.key])}`,
              ),
            ),
          ],
        }),
      },
      {
        name: "/embed",
        description: "Show embed snippets",
        execute: () => ({
          lines: [
            makeLine("system", "Embed your badge:"),
            makeLine("dim", ""),
            makeLine("info", "Markdown:"),
            makeLine("success", `![Chapa Badge](${badgeUrl})`),
            makeLine("dim", ""),
            makeLine("info", "HTML:"),
            makeLine("success", `<img src="${badgeUrl}" alt="Chapa Badge" width="600" height="315" />`),
          ],
        }),
      },
      {
        name: "/share",
        description: "Show share links",
        execute: () => ({
          lines: [
            makeLine("system", "Share your badge:"),
            makeLine("info", `Direct link: ${profileUrl}`),
            makeLine("info", `Badge SVG:   ${badgeUrl}`),
          ],
        }),
      },
      {
        name: "/help",
        description: "List all studio commands",
        execute: () => ({
          lines: [
            makeLine("system", "Creator Studio commands:"),
            makeLine("info", "  /set <cat> <val>   Set effect (bg, card, border, score, heatmap, interact, stats, tier, celebrate)"),
            makeLine("info", "  /preset <name>     Apply preset (minimal/premium/holographic/maximum)"),
            makeLine("info", "  /save              Save configuration"),
            makeLine("info", "  /reset             Reset to defaults"),
            makeLine("info", "  /status            Show current config"),
            makeLine("info", "  /embed             Show embed snippets"),
            makeLine("info", "  /share             Show share links"),
            makeLine("info", "  /clear             Clear output"),
            makeLine("dim", ""),
            makeLine("dim", "Tip: Click options in Quick Controls to auto-execute commands."),
          ],
        }),
      },
      {
        name: "/clear",
        description: "Clear output",
        execute: () => ({
          lines: [],
          action: { type: "clear" },
        }),
      },
    ];
    return commands;
  }, [config, handle]);
}
