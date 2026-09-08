import type {
  ClientImpactV6Result,
  PublicObservedCraft,
  ObservedCoreInputs,
  DeveloperArchetype,
  EvidenceReasonCode,
  ImpactTier,
  PublicCoverageSummary,
  PublicScoringReceipt,
  ScoringScope,
} from "@chapa/shared";
import { createScoringWindow } from "@chapa/shared";
import type { ObservedReceiptSnapshot } from "./score-receipt-observed";
import type { ReceiptSnapshotV7 } from "@/lib/history/snapshot";

/** One displayed magnitude. A range is an evidence-completion range, never a
 * statistical confidence interval, and a component with no admissible bound is
 * `unknown` rather than a zero that would read as observed poor work. */
export type ScoreValue =
  | { readonly kind: "point"; readonly value: number; readonly display: number }
  | { readonly kind: "range"; readonly lower: number; readonly upper: number; readonly displayLower: number; readonly displayUpper: number };

export const CORE_DIMENSION_KEYS = ["delivery", "quality", "consistency", "breadth"] as const;
export type CoreDimensionKey = (typeof CORE_DIMENSION_KEYS)[number];
export const CRAFT_CRITERION_KEYS = ["framing", "verification_debugging", "tool_judgment", "accepted_outcome"] as const;
export type CraftCriterionKey = (typeof CRAFT_CRITERION_KEYS)[number];

export type CraftViewModel =
  | { readonly status: "not_observed" }
  | {
      readonly status: "observed";
      readonly composite: ScoreValue;
      readonly criteria: Readonly<Record<CraftCriterionKey, ScoreValue>>;
      readonly descriptor: "Artificer" | null;
    };

export interface ScoreWindowView {
  readonly referenceTime: string;
  readonly referenceDate: string;
  readonly startInclusive: string;
  readonly endExclusive: string;
  readonly calendarDays: number;
}

export interface ScoreIdentityView {
  readonly receiptId: string;
  readonly revisionId: string;
  readonly revision: number;
  readonly recordedAt: string;
  readonly action: PublicScoringReceipt["action"];
  readonly supersedesRevisionId: string | null;
  readonly contentHash: string;
}

/**
 * The single shape every scored consumer renders — badge SVG, OG image, share
 * page, Studio preview, public API, history, email and the WebMCP tools.
 *
 * Two rules hold this surface together. A consumer reads this model and never
 * recomputes a dimension, tier or archetype of its own: the receipt already
 * carries the displayed integers, so a second derivation is a second answer.
 * And `policyVersion` is load-bearing — a v6 model carries legacy aggregate
 * semantics and must never be labelled or explained as v7 arithmetic.
 */
export interface ScoreViewModel {
  /** Explicit synthetic demo; no issued receipt or personal evidence claim. */
  readonly illustrative?: boolean;
  /** Replay-safe public count inputs, bound to this model's exact receipt context. */
  readonly observedInputs?: ObservedCoreInputs;
  readonly policyVersion: "v6" | "v7" | "v7.2";
  readonly reportCraft?: PublicObservedCraft | null;
  readonly freshness?: "current" | "stale" | "unavailable";
  readonly handle: string;
  /** Present only for an issued v7 receipt. A v6 aggregate has no receipt identity. */
  readonly identity: ScoreIdentityView | null;
  readonly window: ScoreWindowView | null;
  readonly dimensions: Readonly<Record<CoreDimensionKey, ScoreValue>>;
  readonly composite: ScoreValue;
  /** Null when the evidence interval spans more than one tier, or for a
   * non-point dimension set where no definitive archetype may be assigned. */
  readonly tier: ImpactTier | null;
  readonly archetype: DeveloperArchetype | null;
  /** Null when the v7 Craft channel was not evaluated at all (a v6 model). */
  readonly craft: CraftViewModel | null;
  readonly coverage: readonly PublicCoverageSummary[];
  readonly exclusions: ScoringScope["excludedSources"];
  readonly limitations: readonly EvidenceReasonCode[];
}

const clampDisplay = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

function point(value: number): ScoreValue {
  return { kind: "point", value, display: clampDisplay(value) };
}

/** Receipt scores already carry their displayed integers; copy, never re-round. */
function fromReceiptScore(score: PublicScoringReceipt["core"]["composite"]): ScoreValue {
  return score.kind === "point"
    ? { kind: "point", value: score.value, display: score.displayValue }
    : { kind: "range", lower: score.lower, upper: score.upper, displayLower: score.displayLower, displayUpper: score.displayUpper };
}

function fromReceiptCraft(craft: PublicScoringReceipt["craft"]): CraftViewModel {
  if (!craft) return { status: "not_observed" };
  const result = craft.result;
  if (result.status !== "observed") return { status: "not_observed" };
  return {
    status: "observed",
    composite: fromReceiptScore(result.composite),
    criteria: Object.fromEntries(
      CRAFT_CRITERION_KEYS.map(key => [key, fromReceiptScore(result.criteria[key])]),
    ) as Record<CraftCriterionKey, ScoreValue>,
    descriptor: result.descriptor,
  };
}

/** Project an issued receipt. Nothing here recalculates: every number, tier and
 * archetype is the one the receipt was sealed with, so a consumer cannot drift
 * from the artifact its verification link resolves to. */
export function receiptViewModel(handle: string, snapshot: ReceiptSnapshotV7): ScoreViewModel {
  const receipt = snapshot.receipt.receipt;
  return {
    policyVersion: "v7",
    handle: handle.toLowerCase(),
    identity: {
      receiptId: receipt.receiptId,
      revisionId: receipt.revisionId,
      revision: receipt.revision,
      recordedAt: receipt.recordedAt,
      action: receipt.action,
      supersedesRevisionId: receipt.supersedesRevisionId,
      contentHash: snapshot.receipt.contentHash.value,
    },
    window: { ...receipt.window },
    dimensions: Object.fromEntries(
      CORE_DIMENSION_KEYS.map(key => [key, fromReceiptScore(receipt.core.dimensions[key])]),
    ) as Record<CoreDimensionKey, ScoreValue>,
    composite: fromReceiptScore(receipt.core.composite),
    tier: receipt.core.tier,
    archetype: receipt.core.archetype,
    craft: fromReceiptCraft(receipt.craft),
    coverage: receipt.coverage,
    exclusions: receipt.exclusions,
    limitations: receipt.limitations,
  };
}

/** Current observed receipts copy canonical points. Expired reports remain
 * unlocked but have no current point; their old sealed artifact stays intact. */
export function observedReceiptViewModel(handle: string, snapshot: ObservedReceiptSnapshot, capturedAt = Date.now()): ScoreViewModel {
  const receipt = snapshot.receipt.receipt;
  const currentWindow = createScoringWindow(new Date(capturedAt).toISOString());
  let reportCraft = receipt.craft;
  if (reportCraft.status === "scored" && reportCraft.report.inputs.reportPeriod.startInclusive < currentWindow.startInclusive) {
    reportCraft = reportCraft.report.inputs.reportPeriod.endExclusive <= currentWindow.startInclusive
      ? { status: "expired", unlocked: true, report: null, lastReport: reportCraft.report }
      : { status: "unavailable", unlocked: true, report: null, lastReport: reportCraft.report, reason: "outside_window" };
  }
  return {
    observedInputs: receipt.inputs,
    policyVersion: "v7.2", handle: handle.toLowerCase(),
    identity: { receiptId: receipt.receiptId, revisionId: receipt.revisionId, revision: receipt.revision, recordedAt: receipt.recordedAt,
      action: receipt.action, supersedesRevisionId: receipt.supersedesRevisionId, contentHash: snapshot.receipt.contentHash.value },
    window: { ...receipt.window },
    dimensions: Object.fromEntries(CORE_DIMENSION_KEYS.map(key => [key, { kind: "point", value: receipt.core.dimensions[key].exact, display: receipt.core.dimensions[key].displayValue }])) as Record<CoreDimensionKey, ScoreValue>,
    composite: { kind: "point", value: receipt.core.composite.exact, display: receipt.core.composite.displayValue }, tier: receipt.core.tier, archetype: receipt.core.archetype,
    craft: null, reportCraft, freshness: receipt.window.referenceDate === currentWindow.referenceDate ? "current" : "stale",
    coverage: receipt.coverage, exclusions: receipt.exclusions, limitations: receipt.limitations,
  };
}

/**
 * Project a v6 aggregate into the same shape so consumers have one branch
 * instead of two. The result is deliberately labelled `v6`: its dimensions are
 * legacy aggregates, it has no receipt identity, no evidence coverage and no
 * Craft channel, and `legacy_aggregate` is its standing limitation.
 */
export function legacyViewModel(impact: ClientImpactV6Result): ScoreViewModel {
  return {
    policyVersion: "v6",
    handle: impact.handle.toLowerCase(),
    identity: null,
    window: null,
    dimensions: {
      delivery: point(impact.dimensions.delivery),
      quality: point(impact.dimensions.quality),
      consistency: point(impact.dimensions.consistency),
      breadth: point(impact.dimensions.breadth),
    },
    composite: point(impact.adjustedComposite),
    tier: impact.tier,
    archetype: impact.archetype,
    craft: null,
    coverage: [],
    exclusions: [],
    limitations: ["legacy_aggregate"],
  };
}

/** True when two models describe the same issued artifact. Consumers that show
 * a score beside a verification link use this rather than comparing numbers. */
export function sameScoredRevision(left: ScoreViewModel, right: ScoreViewModel): boolean {
  if (left.policyVersion !== right.policyVersion || left.handle !== right.handle) return false;
  if (!left.identity || !right.identity) return left.identity === right.identity;
  return left.identity.revisionId === right.identity.revisionId && left.identity.contentHash === right.identity.contentHash;
}

/** What a renderer needs to draw a score. A range contributes its lower bound
 * as the drawn magnitude AND names itself in `rangeKeys`, so a surface can show
 * the interval truthfully; a renderer that ignores `rangeKeys` still cannot
 * overstate the evidence, because the lower bound is the only claim the
 * evidence supports. */
export interface RenderableScore {
  readonly dimensions: Readonly<Record<CoreDimensionKey, number>>;
  readonly composite: number;
  readonly tier: ImpactTier | null;
  readonly archetype: DeveloperArchetype | null;
  readonly rangeKeys: readonly (CoreDimensionKey | "composite")[];
}

const drawn = (score: ScoreValue): number => (score.kind === "point" ? score.display : score.displayLower);

/** One projection for every rendering surface — embedded SVG, OG image, Studio
 * preview and share page — so they cannot disagree about the same revision. */
export function renderableScore(model: ScoreViewModel): RenderableScore {
  const rangeKeys: (CoreDimensionKey | "composite")[] = CORE_DIMENSION_KEYS.filter(
    key => model.dimensions[key].kind === "range",
  );
  if (model.composite.kind === "range") rangeKeys.push("composite");
  return {
    dimensions: Object.fromEntries(
      CORE_DIMENSION_KEYS.map(key => [key, drawn(model.dimensions[key])]),
    ) as Record<CoreDimensionKey, number>,
    composite: drawn(model.composite),
    tier: model.tier,
    archetype: model.archetype,
    rangeKeys,
  };
}
