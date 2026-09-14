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
import type { ScoreViewModel } from "@/lib/profile/score-view-model";
import { publicScoreProjection } from "@/lib/profile/public-score-projection";
import { calculateObservedCoreV7 } from "@/lib/impact/observed-v7";
import { invalidInput } from "./errors";

export interface WebMcpToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface WebMcpExecutionContext {
  signal: AbortSignal;
}

export interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMcpToolAnnotations;
  execute(
    inputs: Record<string, unknown>,
    context: WebMcpExecutionContext,
  ): string | Promise<string>;
}

type Translate = LanguageContextValue["t"];

interface ExplainDimensionToolOptions {
  scoring?: ScoreViewModel | null;
  impact: ClientImpactV6Result;
  stats: StatsData;
  craftResult?: CraftResult | null;
  t: Translate;
  /**
   * No default on purpose: the caller must state whether the page it's
   * rendering on shows trusted (Studio) or untrusted (public share page)
   * data. Defaulting would recreate the silent-classification bug this
   * option exists to prevent (#1171 / SE-L3 / BE-L3).
   */
  annotations: WebMcpToolAnnotations;
}

/** GitHub's own limit on the profile `name` field. */
const MAX_AGENT_FREE_TEXT_LENGTH = 255;

/**
 * Bound and neutralise free text before it crosses into a visitor's browser
 * AI agent context via a WebMCP tool result (#1171 / SE-M2). Strips ASCII
 * control characters -- including newlines, which could otherwise be used to
 * fake structure inside an otherwise-plain-text agent payload -- then caps
 * length.
 *
 * This is a projection for the WebMCP tool boundary ONLY. It must never be
 * applied to the SVG render path or the share-page HTML render path, which
 * correctly show the full, untruncated text (mirrors the `impactForClient`
 * confidence-redaction pattern at `app/u/[handle]/page.tsx`, which is also
 * scoped to the client/tool boundary and never touches the render paths).
 */
export function sanitizeFreeTextForAgent(
  value: string | undefined,
  maxLength: number = MAX_AGENT_FREE_TEXT_LENGTH,
): string | undefined {
  if (value === undefined) return undefined;
  const stripped = value
    // Deliberately matching ASCII control chars (incl. newlines).
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .trim();
  return stripped.length > maxLength ? stripped.slice(0, maxLength) : stripped;
}

export const WEBMCP_EMPTY_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const WEBMCP_READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
} as const;

export const WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS = {
  readOnlyHint: true,
  untrustedContentHint: true,
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
  scoring,
  stats,
  craftResult = null,
  t,
  annotations,
}: ExplainDimensionToolOptions): WebMcpTool {
  const text = (key: string) => t(key) as string;

  return {
    name: "explain_dimension",
    description: "Explain one impact dimension using the current profile and activity.",
    inputSchema: EXPLAIN_DIMENSION_INPUT_SCHEMA,
    annotations,
    execute: (inputs) => {
      const dimension = isWebMcpRecord(inputs) ? inputs.dimension : undefined;
      if (
        typeof dimension !== "string" ||
        !DIMENSION_KEYS.includes(dimension as DimensionKey)
      ) {
        return invalidInput("explain_dimension", "dimension must be a known dimension");
      }

      const key = dimension as DimensionKey;
      if (scoring?.policyVersion === "v7.2") return JSON.stringify(explainObservedDimension(scoring, key));
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

/** Same public current-policy explanation for remote and in-page tools. */
export function explainObservedDimension(model: ScoreViewModel, key: DimensionKey) {
  const projection = publicScoreProjection(model);
  const calculation = model.observedInputs ? calculateObservedCoreV7(model.observedInputs) : null;
  return { policyVersion: model.policyVersion, identity: model.identity, window: model.window,
    dimension: key, score: projection.dimensions[key] ?? null, exactScore: projection.exactDimensions[key] ?? null,
    ...(key === "craft" ? { craft: projection.craft, formula: "100 × credited report sessions / total report sessions; separate from core" }
      : { inputs: model.observedInputs ?? null, trace: calculation?.trace[key] ?? null, weight: 0.25,
        note: "Recorded qualifying observations only. Missing observations are not a judgment of ability." }) };
}
export function observedImprovementSuggestions(model: ScoreViewModel) {
  return { policyVersion: model.policyVersion, identity: model.identity, window: model.window,
    suggestions: ["Document supporting evidence for work already done. Missing observations do not measure your ability.",
      "Craft is a separate report-derived estimate and does not raise the core score."],
    counts: model.observedInputs?.counts ?? null };
}
