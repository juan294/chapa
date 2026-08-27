"use client";

import { useMemo } from "react";
import {
  DIMENSION_KEYS,
  SOLO_DIMENSION_KEYS,
  type BadgeConfig,
  type CraftResult,
  type DimensionScores,
  type ImpactV6Result,
  type StatsData,
} from "@chapa/shared";
import {
  CATEGORY_KEY_TO_ALIAS,
  type CommandResult,
} from "@/components/terminal/command-registry";
import { generateInsights } from "@/lib/dashboard/generate-insights";
import { STUDIO_PRESETS } from "@/lib/effects/defaults";
import { getBaseUrl } from "@/lib/env";
import {
  computeAdjustedScore,
  getTier,
} from "@/lib/impact/utils";
import { useTranslation } from "@/lib/i18n";
import type { WebMcpTool } from "@/lib/webmcp/use-model-context-tools";
import {
  createExplainDimensionTool,
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
import { getStudioCommandConfig } from "./studio-command-config";

export type StudioSaveStatus = "dirty" | "saving" | "saved" | "error";

export interface UseStudioWebMcpToolsOptions {
  config: BadgeConfig;
  enabled: boolean;
  stats: StatsData;
  impact: ImpactV6Result;
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

const SCORE_PROPERTY_SCHEMA = {
  type: "number",
  minimum: 0,
  maximum: 100,
};

const SIMULATE_SCORE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    dimensions: {
      type: "object",
      properties: Object.fromEntries(
        DIMENSION_KEYS.map((dimension) => [dimension, SCORE_PROPERTY_SCHEMA]),
      ),
      additionalProperties: false,
    },
  },
  required: ["dimensions"],
  additionalProperties: false,
};

function invalidInput(tool: string, message: string): string {
  return `Invalid input for ${tool}: ${message}.`;
}

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

function parseDimensionOverrides(
  inputs: Record<string, unknown>,
): Partial<DimensionScores> | string {
  if (!isWebMcpRecord(inputs.dimensions)) {
    return invalidInput("simulate_score", "dimensions must be an object");
  }

  const overrides: Partial<DimensionScores> = {};
  for (const [key, value] of Object.entries(inputs.dimensions)) {
    if (!DIMENSION_KEYS.includes(key as keyof DimensionScores)) {
      return invalidInput("simulate_score", `unknown dimension ${key}`);
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
      return invalidInput("simulate_score", `${key} must be a number from 0 to 100`);
    }
    overrides[key as keyof DimensionScores] = value;
  }
  return overrides;
}

export function useStudioWebMcpTools({
  config,
  enabled,
  stats,
  impact,
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
        description: "Apply one Creator Studio style option through the visible terminal.",
        inputSchema: APPLY_STYLE_INPUT_SCHEMA,
        execute: (inputs) => {
          if (
            !isWebMcpRecord(inputs) ||
            !isCommandToken(inputs.category) ||
            !isCommandToken(inputs.value)
          ) {
            return invalidInput(
              "apply_badge_style",
              "category and value must be single non-empty tokens",
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
          proposeSave();
          return "Save proposed — the user must confirm on-page.";
        },
      },
      {
        name: "simulate_score",
        description: "Simulate an impact score from dimension overrides without saving data.",
        inputSchema: SIMULATE_SCORE_INPUT_SCHEMA,
        annotations: readOnly,
        execute: (inputs) => {
          if (!isWebMcpRecord(inputs)) {
            return invalidInput("simulate_score", "input must be an object");
          }
          const overrides = parseDimensionOverrides(inputs);
          if (typeof overrides === "string") return overrides;

          const dimensions: DimensionScores = {
            ...impact.dimensions,
            ...overrides,
          };
          const dimensionKeys = impact.profileType === "solo"
            ? SOLO_DIMENSION_KEYS
            : DIMENSION_KEYS;
          const activeScores = dimensionKeys
            .map((dimension) => dimensions[dimension])
            .filter((score): score is number => score !== undefined);
          const composite = Math.round(
            activeScores.reduce((sum, score) => sum + score, 0) /
              activeScores.length,
          );
          const adjusted = computeAdjustedScore(composite, impact.confidence);
          return JSON.stringify({
            composite,
            adjusted,
            tier: getTier(adjusted),
            deltaVsCurrent: adjusted - impact.adjustedComposite,
          });
        },
      },
      {
        name: "suggest_improvements",
        description: "Return grounded improvement suggestions for the current impact profile.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: readOnly,
        execute: () => JSON.stringify(generateInsights(impact, null, null, t)),
      },
      createExplainDimensionTool({ impact, stats, craftResult, t, annotations: readOnly }),
    ];
  }, [
    config,
    enabled,
    stats,
    impact,
    craftResult,
    handle,
    saveStatus,
    runCommand,
    proposeSave,
    getCurrentConfig,
    t,
  ]);
}
