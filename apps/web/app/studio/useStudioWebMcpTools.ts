"use client";

import { useMemo } from "react";
import {
  type BadgeConfig,
  type CraftResult,
  type StatsData,
} from "@chapa/shared";
import {
  CATEGORY_KEY_TO_ALIAS,
  type CommandResult,
} from "@/components/terminal/command-registry";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import { getBaseUrl } from "@/lib/env";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";
import { simulateObservedScore, type ObservedScenario } from "@/lib/impact/simulate";
import { useTranslation } from "@/lib/i18n";
import {
  invalidInput,
  type WebMcpTool,
} from "@/lib/webmcp/use-model-context-tools";
import {
  createExplainDimensionTool,
  observedImprovementSuggestions,
  isWebMcpRecord,
  WEBMCP_EMPTY_INPUT_SCHEMA,
  WEBMCP_READ_ONLY_ANNOTATIONS,
} from "@/lib/webmcp/shared-tools";
import {
  getCategoryLabel,
  getOptionLabel,
  getPresetLabel,
  STUDIO_CATEGORIES,
} from "./studio-options";
import type { StudioCommandAction } from "./useStudioCommands";
import { OBSERVED_SIMULATE_SCORE_INPUT_SCHEMA } from "@/lib/webmcp/catalog";
import { getStudioCommandConfig } from "./studio-command-config";

export type StudioSaveStatus = "dirty" | "saving" | "saved" | "error";

export interface UseStudioWebMcpToolsOptions {
  config: BadgeConfig;
  enabled: boolean;
  stats: StatsData;
  /** #1335 — v7.2 is the one scoring policy Studio renders. */
  scoring: ScoreViewModel;
  craftResult?: CraftResult | null;
  handle: string;
  saveStatus: StudioSaveStatus;
  runCommand: (input: string) => CommandResult<StudioCommandAction>;
  proposeSave: () => void;
  getCurrentConfig?: () => BadgeConfig;
}

const APPLY_STYLE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string" },
    value: { type: "string" },
  },
  required: ["category", "value"],
  additionalProperties: false,
};

const APPLY_PRESET_INPUT_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      enum: STUDIO_PRESETS.map((preset) => preset.id),
    },
  },
  required: ["name"],
  additionalProperties: false,
};

function isCommandToken(value: unknown): value is string {
  return typeof value === "string" && value !== "" && !/\s/.test(value);
}

function serializeCommandResult(
  result: CommandResult<StudioCommandAction>,
  currentConfig: BadgeConfig,
): string {
  const terminalLines = result.lines.map((line) => line.text).join("\n");
  const snapshot = JSON.stringify({
    config: currentConfig,
  });
  return terminalLines ? `${terminalLines}\n${snapshot}` : snapshot;
}

export function useStudioWebMcpTools({
  config,
  enabled,
  stats,
  scoring,
  craftResult = null,
  handle,
  saveStatus,
  runCommand,
  proposeSave,
  getCurrentConfig,
}: UseStudioWebMcpToolsOptions): WebMcpTool[] {
  const { t } = useTranslation();

  return useMemo<WebMcpTool[]>(() => {
    if (!enabled) return [];
    const readOnly = WEBMCP_READ_ONLY_ANNOTATIONS;

    return [
      {
        name: "list_style_options",
        description: "List Creator Studio style categories, presets, and current settings.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: readOnly,
        execute: () =>
          JSON.stringify({
            categories: STUDIO_CATEGORIES.map((category) => ({
              key: category.key,
              alias: CATEGORY_KEY_TO_ALIAS[category.key] ?? category.key,
              label: getCategoryLabel(category, t),
              options: category.options.map((option) => ({
                value: option.value,
                label: getOptionLabel(category.key, option.value, t),
                description: option.description,
              })),
            })),
            presets: STUDIO_PRESETS.map((preset) => ({
              name: preset.id,
              label: getPresetLabel(preset.id, preset.label, t),
              config: preset.config,
            })),
            currentConfig: getCurrentConfig?.() ?? config,
          }),
      },
      {
        name: "apply_badge_style",
        description: "Apply one Creator Studio style option through the visible terminal. Get valid categories and values from list_style_options first.",
        inputSchema: APPLY_STYLE_INPUT_SCHEMA,
        execute: (inputs) => {
          if (
            !isWebMcpRecord(inputs) ||
            !isCommandToken(inputs.category) ||
            !isCommandToken(inputs.value)
          ) {
            return invalidInput(
              "apply_badge_style",
              "category and value must be single non-empty tokens; call list_style_options for valid categories and values",
            );
          }
          const result = runCommand(`/set ${inputs.category} ${inputs.value}`);
          return serializeCommandResult(
            result,
            getCurrentConfig?.() ??
              getStudioCommandConfig(config, result.action) ??
              config,
          );
        },
      },
      {
        name: "apply_preset",
        description: "Apply a Creator Studio preset through the visible terminal.",
        inputSchema: APPLY_PRESET_INPUT_SCHEMA,
        execute: (inputs) => {
          const name = isWebMcpRecord(inputs) ? inputs.name : undefined;
          if (
            typeof name !== "string" ||
            !STUDIO_PRESETS.some((preset) => preset.id === name)
          ) {
            return invalidInput("apply_preset", "name must be a known preset");
          }
          const result = runCommand(`/preset ${name}`);
          return serializeCommandResult(
            result,
            getCurrentConfig?.() ??
              getStudioCommandConfig(config, result.action) ??
              config,
          );
        },
      },
      {
        name: "preview_badge",
        description: "Return the current preview configuration, badge URL, and save status.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: readOnly,
        execute: () =>
          JSON.stringify({
            config: getCurrentConfig?.() ?? config,
            badgeSvgUrl: `${getBaseUrl()}/u/${encodeURIComponent(handle)}/badge.svg`,
            saveStatus,
          }),
      },
      {
        name: "reset_badge_config",
        description: "Reset Creator Studio through the visible terminal.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        execute: () => {
          const result = runCommand("/reset");
          return serializeCommandResult(
            result,
            getCurrentConfig?.() ??
              getStudioCommandConfig(config, result.action) ??
              config,
          );
        },
      },
      {
        name: "save_badge_config",
        description: "Ask the user to confirm saving the current preview configuration.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        execute: () => {
          if (saveStatus === "saved") {
            return "No unsaved changes. The current configuration is already saved.";
          }
          if (saveStatus === "saving") {
            return "A save is already in progress. Wait for it to finish, then check preview_badge for the save status.";
          }
          proposeSave();
          return "Save proposed — the user must confirm on-page.";
        },
      },
      {
        name: "simulate_score",
        description: "Simulate a hypothetical score from evidence-count scenarios, using the current v7.2 policy and fixed receipt context. The simulation never publishes evidence; Craft stays separate from core.",
        inputSchema: OBSERVED_SIMULATE_SCORE_INPUT_SCHEMA,
        annotations: readOnly,
        execute: (inputs) => {
          if (!isWebMcpRecord(inputs)) {
            return invalidInput("simulate_score", "input must be an object");
          }
          try { return JSON.stringify(simulateObservedScore(scoring, inputs as ObservedScenario)); }
          catch (error) { return invalidInput("simulate_score", error instanceof Error ? error.message : "Invalid scenario"); }
        },
      },
      {
        name: "suggest_improvements",
        description: "Return grounded improvement suggestions for the current impact profile.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: readOnly,
        execute: () => JSON.stringify(observedImprovementSuggestions(scoring)),
      },
      createExplainDimensionTool({ scoring, stats, craftResult, t, annotations: readOnly }),
    ];
  }, [
    config,
    enabled,
    stats,
    scoring,
    craftResult,
    handle,
    saveStatus,
    runCommand,
    proposeSave,
    getCurrentConfig,
    t,
  ]);
}
