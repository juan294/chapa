import {
  DIMENSION_KEYS,
} from "@chapa/shared";
import type { DimensionScores } from "@chapa/shared";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";

type DimensionKey = keyof DimensionScores;
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

interface ExplainDimensionToolOptions {
  /** #1335 — v7.2 is the one scoring policy Studio and the share page ever
   * supply; there is no legacy fallback left to branch to. */
  scoring: ScoreViewModel;
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
 * correctly show the full, untruncated text.
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
  scoring,
  annotations,
}: ExplainDimensionToolOptions): WebMcpTool {
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
      return JSON.stringify(explainObservedDimension(scoring, key));
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
