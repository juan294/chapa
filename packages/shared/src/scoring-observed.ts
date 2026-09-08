import type { ContentDigest, CoreCountInputs, CoreDimension, CoreScoringResult, CountBounds, ObservationPeriod, QualityCriterion } from "./scoring-evidence";
import type { ScoringWindow } from "./scoring-window";
import type { ImpactTier } from "./types";

/** Additive v7.2 contract. Publication/replay dispatch remains historical until phase 4. */
export const SCORING_OBSERVED_POLICY = Object.freeze({
  policyVersion: "v7.2" as const,
  algorithmRevision: "v7.2" as const,
  displayVersion: "v7" as const,
  coreWeights: Object.freeze({ delivery: 0.25, quality: 0.25, consistency: 0.25, breadth: 0.25 }),
  caps: Object.freeze({ delivery: 120, qualityCriterion: 12, consistency: 40, breadthProjects: 4, breadthCategories: 4 }),
  normalization: "ln(1+min(count,cap))/ln(1+cap)",
  observedSelection: "original_lower_qualifying_count",
  calendarDays: 365,
  breadthMinimumDates: 3,
  tierThresholds: Object.freeze({ solid: 30, high: 70, elite: 85 }),
  display: Object.freeze({ revision: "v7.2", intermediate: "none", dimensionAndCraft: "nearest_integer_half_up", core: "nearest_integer_unless_tier_crossing_then_floor_100_div_100", label: "canonical_finite_decimal_trim_trailing_zeroes", tierBasis: "unrounded" }),
  archetype: Object.freeze({ eligibility: "original_normalized_dimension_endpoints_equal", rule: "v6_descriptive_tree_without_solo_exclusions", tieOrder: Object.freeze(["breadth", "quality", "consistency", "delivery"]), reportCraftEffect: "none" }),
  reportCraft: Object.freeze({
    classifierRevision: "cc-outcomes-v7.2" as const,
    provenance: "report_derived" as const,
    assessment: "model_estimate" as const,
    normalization: "trim_ascii_whitespace_lowercase_ascii_collapse_ascii_space_hyphen_underscore",
    aliases: Object.freeze({ fully_achieved: "fully_achieved", mostly_achieved: "mostly_achieved", partially_achieved: "partially_achieved", not_achieved: "not_achieved", failed: "not_achieved" }),
    outcomeCredits: Object.freeze({ fully_achieved: 1, mostly_achieved: 0.7, partially_achieved: 0.3, not_achieved: 0 }),
    denominator: "total_sessions",
    scoredEligibility: "positive_total_and_positive_recognized_count",
    duplicateCategories: "reject_before_overwrite",
    unknownLabels: "private_aggregate_count_only_public",
    period: "wholly_within_annual_window_and_not_future",
    selection: "latest_period_end_then_start_same_period_explicit_correction",
    exactDuplicate: "idempotent",
    expiry: "retain_unlocked_slot_without_numeric_vertex",
    coreWeight: 0,
  }),
  rawArtifactRetentionDays: 30,
  trendRetention: 0.85,
  numericTolerance: 1e-10,
});

export interface PointResult {
  readonly kind: "point";
  readonly exact: number;
  readonly displayValue: number;
  readonly displayLabel: string;
}

/** Canonical display only; no evidence scoring, version dispatch or publication. */
export function observedPointResult(exact: number, purpose: "core" | "dimension" | "craft"): PointResult {
  if (!Number.isFinite(exact) || exact < 0 || exact > 100) throw new RangeError("Invalid 0–100 observed point");
  const rounded = Math.round(exact);
  const crossedBoundary = Object.values(SCORING_OBSERVED_POLICY.tierThresholds).find(boundary => exact < boundary && rounded >= boundary);
  // Multiplication can round a binary64 predecessor onto the boundary itself.
  const displayValue = purpose === "core" && crossedBoundary !== undefined
    ? Math.min(Math.floor(exact * 100) / 100, crossedBoundary - 0.01)
    : rounded;
  return { kind: "point", exact, displayValue, displayLabel: String(displayValue) };
}

/** Original completion bounds remain evidence metadata; never flatten them to force a point. */
export interface ObservedCoreInputs {
  readonly policyVersion: "v7.2";
  readonly window: ScoringWindow;
  readonly counts: CoreCountInputs;
}
export interface ObservedScalarTrace<Cap extends number, Multiplier extends number> {
  readonly originalBounds: CountBounds;
  readonly observedCount: number;
  readonly cap: Cap;
  readonly clamped: number;
  readonly normalized: number;
  readonly multiplier: Multiplier;
  readonly weighted: number;
}
export interface ObservedCoreResult {
  readonly dimensions: Readonly<Record<CoreDimension, PointResult>>;
  readonly composite: PointResult;
  readonly tier: ImpactTier;
  /** Exactly the historical result for the ORIGINAL bounded inputs, including saturation. */
  readonly archetype: CoreScoringResult["archetype"];
}
export interface ObservedCoreTrace {
  readonly delivery: ObservedScalarTrace<120, 100>;
  readonly quality: Readonly<Record<QualityCriterion, ObservedScalarTrace<12, 25>>>;
  readonly consistency: ObservedScalarTrace<40, 100>;
  readonly breadth: { readonly projects: ObservedScalarTrace<4, 50>; readonly categories: ObservedScalarTrace<4, 50> };
  readonly dimensions: Readonly<Record<CoreDimension, number>>;
  readonly weightedDimensions: Readonly<Record<CoreDimension, number>>;
  readonly composite: number;
  readonly displayed: ObservedCoreResult;
}
export interface ObservedCoreCalculation { readonly core: ObservedCoreResult; readonly trace: ObservedCoreTrace }

export type ReportOutcomeCategory = "fully_achieved" | "mostly_achieved" | "partially_achieved" | "not_achieved";
/** Private ingestion keeps chart entries ordered until collision validation; never pre-build a map. */
export interface ReportCraftRawInputs {
  readonly policyVersion: "v7.2";
  readonly classifierRevision: "cc-outcomes-v7.2";
  readonly window: ScoringWindow;
  readonly reportPeriod: ObservationPeriod;
  readonly totalSessions: number;
  readonly outcomes: readonly { readonly label: string; readonly count: number }[];
}
/** Public replay allowlist: unknown raw labels, report body and private identities are absent. */
export interface ReportCraftInputs {
  readonly policyVersion: "v7.2";
  readonly classifierRevision: "cc-outcomes-v7.2";
  readonly window: ScoringWindow;
  readonly reportPeriod: ObservationPeriod;
  readonly totalSessions: number;
  readonly outcomes: Readonly<Record<ReportOutcomeCategory, number>>;
  readonly unknownSessions: number;
  readonly unclassifiedSessions: number;
}
export interface ReportCraftTrace {
  readonly outcomeCredits: typeof SCORING_OBSERVED_POLICY.reportCraft.outcomeCredits;
  readonly creditedSessions: number;
  readonly recognizedSessions: number;
  readonly totalSessions: number;
  readonly unknownSessions: number;
  readonly unclassifiedSessions: number;
  readonly recognizedCoverage: number;
  readonly exact: number;
}
export interface ScoredReportCraft {
  readonly status: "scored";
  readonly unlocked: true;
  readonly provenance: "report_derived";
  readonly assessment: "model_estimate";
  readonly reportPeriod: ObservationPeriod;
  readonly point: PointResult;
  readonly trace: ReportCraftTrace;
}
export type ReportCraftResult =
  | ScoredReportCraft
  | { readonly status: "no_report"; readonly unlocked: false; readonly point: null }
  | { readonly status: "insufficient_report_data"; readonly unlocked: false; readonly point: null; readonly reportPeriod: ObservationPeriod; readonly reason: "no_sessions" | "no_recognized_outcomes" }
  | { readonly status: "expired"; readonly unlocked: true; readonly point: null; readonly lastReport: ScoredReportCraft }
  | { readonly status: "unavailable"; readonly unlocked: boolean; readonly point: null; readonly lastReport: ScoredReportCraft | null; readonly reason: "source_error" | "publication_pending" | "outside_window" };
export type ReportCraftCalculation =
  | { readonly status: "valid"; readonly inputs: ReportCraftInputs; readonly result: ScoredReportCraft | Extract<ReportCraftResult, { status: "insufficient_report_data" }> }
  | { readonly status: "invalid"; readonly reason: "invalid_period" | "invalid_count" | "inconsistent_totals" | "duplicate_category" | "unsupported_schema" };
/** Selection has an explicit clock and correction lineage, never an upload-time/high-score tie break. */
export interface ReportCraftCandidate {
  readonly reportId: string;
  readonly contentDigest: ContentDigest;
  readonly supersedesReportId: string | null;
  readonly inputs: ReportCraftInputs;
}
export interface ReportCraftSelectionInputs {
  readonly window: ScoringWindow;
  readonly candidates: readonly ReportCraftCandidate[];
  readonly previouslyUnlocked: boolean;
  readonly lastPublished: ScoredReportCraft | null;
}
export type ReportCraftSelection =
  | { readonly status: "selected"; readonly candidate: ReportCraftCandidate }
  | { readonly status: "none"; readonly result: Exclude<ReportCraftResult, ScoredReportCraft> }
  | { readonly status: "conflict"; readonly reason: "same_period_requires_explicit_correction" };

/** Presentation membership is deliberately independent of the four arithmetic weights. */
export type ObservedRadarAxis =
  | { readonly dimension: CoreDimension; readonly status: "scored"; readonly point: PointResult }
  | { readonly dimension: "craft"; readonly status: "scored"; readonly point: PointResult }
  | { readonly dimension: "craft"; readonly status: "unavailable"; readonly point: null };
export interface ObservedRadarPresentation { readonly axes: readonly ObservedRadarAxis[] }
/** Bound to an already issued receipt; a product displayVersion alone cannot identify arithmetic. */
export interface ObservedScoreIdentity {
  readonly schemaVersion: "v7";
  readonly displayVersion: "v7";
  readonly policyVersion: "v7.2";
  readonly algorithmId: "chapa-impact-v7";
  readonly algorithmRevision: "v7.2";
  readonly policyDigest: ContentDigest;
  readonly algorithmDigest: ContentDigest;
  readonly receiptId: string;
  readonly revisionId: string;
  readonly revision: number;
  readonly contentHash: ContentDigest;
}
