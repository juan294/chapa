import {
  DIMENSION_KEYS,
  type ClientImpactV6Result,
  type CraftResult,
  type StatsData,
} from "@chapa/shared";
import {
  buildDimensionExplanation,
  getDimensionFormulaKey,
} from "@/lib/dashboard/score-explanation";
import type { DimensionKey } from "@/lib/dashboard/dimension-sub-metrics";
import type { LanguageContextValue } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import type { WebMcpTool } from "./use-model-context-tools";

type Translate = LanguageContextValue["t"];

interface ExplainDimensionToolOptions {
  impact: ClientImpactV6Result;
  stats: StatsData;
  craftResult?: CraftResult | null;
  t: Translate;
}

export const WEBMCP_EMPTY_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const WEBMCP_READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
} as const;

export const EXPLAIN_DIMENSION_INPUT_SCHEMA = {
  type: "object",
  properties: {
    dimension: {
      type: "string",
      enum: [...DIMENSION_KEYS],
    },
  },
  required: ["dimension"],
  additionalProperties: false,
};

export function isWebMcpRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createExplainDimensionTool({
  impact,
  stats,
  craftResult = null,
  t,
}: ExplainDimensionToolOptions): WebMcpTool {
  const text = (key: string) => t(key) as string;

  return {
    name: "explain_dimension",
    description: "Explain one impact dimension using the current profile and activity.",
    inputSchema: EXPLAIN_DIMENSION_INPUT_SCHEMA,
    annotations: WEBMCP_READ_ONLY_ANNOTATIONS,
    execute: (inputs) => {
      const dimension = isWebMcpRecord(inputs) ? inputs.dimension : undefined;
      if (
        typeof dimension !== "string" ||
        !DIMENSION_KEYS.includes(dimension as DimensionKey)
      ) {
        return "Invalid input for explain_dimension: dimension must be a known dimension.";
      }

      const key = dimension as DimensionKey;
      const dimensionExplanation = buildDimensionExplanation(
        impact,
        stats,
        key,
        craftResult,
      );
      const subMetrics = dimensionExplanation.subMetrics.map((metric) => ({
        ...metric,
        label: text(`scoreExplanation.subMetrics.${metric.key}`),
        rawLabel: interpolate(
          text(`scoreExplanation.rawLabels.${metric.rawLabelKey}`),
          metric.rawLabelParams,
        ),
      }));
      const tipKey = key === "quality" && impact.profileType === "solo"
        ? "dimensions.quality.soloTip"
        : `dimensions.${key}.tip`;
      return JSON.stringify({
        dimension: key,
        score: impact.dimensions[key] ?? null,
        tip: text(tipKey),
        formula: text(getDimensionFormulaKey(dimensionExplanation)),
        subMetrics,
      });
    },
  };
}
