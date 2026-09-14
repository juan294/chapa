import type { Platform } from "./platforms";
import type { ScoringWindow } from "./scoring-window";
import type { DeveloperArchetype, ImpactTier, ImpactV6Result } from "./types";

/** Product choices, not empirical percentiles or ability estimates. */
export const SCORING_V7_POLICY = Object.freeze({
  version: "v7" as const,
  coreWeights: Object.freeze({ delivery: 0.25, quality: 0.25, consistency: 0.25, breadth: 0.25 }),
  caps: Object.freeze({ delivery: 120, qualityCriterion: 12, consistency: 40, breadthProjects: 4, breadthCategories: 4, craftCriterion: 8 }),
  breadthMinimumDates: 3,
  tierThresholds: Object.freeze({ solid: 30, high: 70, elite: 85 }),
  craftDescriptorMinimum: 60,
  trendRetention: 0.85,
  rawArtifactRetentionDays: 30,
  numericTolerance: 1e-10,
});

/** Non-forge evidence uses its own namespace; no provider linkage or AI usage is required. */
export type EvidenceProvider = Platform | "supplemental" | "portfolio";

export type CoverageStatus = "complete" | "partial" | "unavailable" | "stale" | "legacy";
export type EvidenceProvenance = "source_observed" | "self_reported" | "automated_assessment" | "human_assessed" | "independently_corroborated";
export type EvidenceReasonCode = "criterion_demonstrated" | "criterion_not_demonstrated" | "not_assessed" | "not_accessible" | "not_supported" | "pagination_incomplete" | "discovery_incomplete" | "source_error" | "stale_data" | "legacy_aggregate" | "acceptance_time_unknown" | "attribution_unknown" | "alias_unresolved" | "partial_files" | "outside_window" | "retracted" | "insufficient_evidence";
export type Observation<T> =
  | { readonly status: "observed"; readonly value: T; readonly coverage: CoverageStatus; readonly provenance: EvidenceProvenance }
  | { readonly status: "unknown"; readonly coverage: Exclude<CoverageStatus, "complete">; readonly reasonCode: EvidenceReasonCode };
export function observed<T>(value: T, coverage: CoverageStatus, provenance: EvidenceProvenance): Observation<T> & { status: "observed" } {
  return { status: "observed", value, coverage, provenance };
}
export function unknown(coverage: Exclude<CoverageStatus, "complete">, reasonCode: EvidenceReasonCode): Observation<never> & { status: "unknown" } {
  return { status: "unknown", coverage, reasonCode };
}

/** No credentials or ordering of principal access. Non-forge hosts identify the issuing ledger namespace. */
export interface SourceIdentity { readonly provider: EvidenceProvider; readonly host: string; readonly subjectId: string }
export interface RepositoryIdentity extends SourceIdentity { readonly repositoryId: string }
export interface EvidenceIdentity extends RepositoryIdentity { readonly actorId: string; readonly eventId: string }
export interface ObservationPeriod { readonly startInclusive: string; readonly endExclusive: string }
export interface SourceCoverage {
  readonly source: SourceIdentity;
  readonly window: ScoringWindow;
  readonly dataThrough: string | null;
  readonly status: CoverageStatus;
  readonly discovery: "owned_and_contributed" | "contribution_search" | "registered_ledger" | "explicit_repositories" | "legacy_upload";
  readonly repositoryIds: readonly string[];
  readonly repositoryDiscoveryComplete: boolean;
  readonly eventKinds: Readonly<Partial<Record<EngineeringEventKind, CoverageStatus>>>;
  readonly reasonCodes: readonly EvidenceReasonCode[];
  readonly unknownPeriods: readonly ObservationPeriod[];
}
export interface ScoringScope {
  readonly sources: readonly SourceCoverage[];
  readonly excludedSources: readonly { readonly provider: EvidenceProvider; readonly reason: "not_connected" | "not_consented" }[];
  readonly ledgerRevisionIds: readonly string[];
}
export type WorkCategory = "implementation" | "verification_review" | "documentation_design" | "maintenance_support";
export type EngineeringEventKind = "accepted_change" | "authored_commit" | "review" | "issue_work" | "documentation_design" | "maintenance" | "practice_evidence";
export type AcceptanceMethod = "merged_change" | "default_branch_first_reachability" | "linked_issue_result" | "accepted_artifact";
export interface EventMeasurements {
  readonly changedFiles: Observation<readonly string[]>;
  readonly additions: Observation<number>;
  readonly deletions: Observation<number>;
  readonly leadTimeHours: Observation<number>;
  readonly hasDescription: Observation<boolean>;
  readonly hasIssueLink: Observation<boolean>;
  readonly usesFeatureBranch: Observation<boolean>;
}
export interface NormalizedEngineeringEvent extends EvidenceIdentity {
  readonly schemaVersion: "v7";
  readonly kind: EngineeringEventKind;
  /** Acceptance event time for accepted_change; authored time is a separate diagnostic. */
  readonly occurredAt: string;
  readonly dataThrough: string;
  readonly canonicalProjectId: string;
  readonly workItemId: string;
  readonly artifactRevision: string;
  readonly artifactReferenceIds: readonly string[];
  readonly attribution: "individual" | "team_participation" | "unclear";
  readonly provenance: EvidenceProvenance;
  readonly coverage: CoverageStatus;
  readonly measurements: EventMeasurements;
  readonly categories: readonly { readonly category: WorkCategory; readonly evidenceReferenceIds: readonly string[] }[];
  readonly acceptance: Observation<{ readonly method: AcceptanceMethod; readonly acceptedAt: string; readonly acceptedResultId: string }>;
}
export interface VerifiedRepositoryAlias {
  readonly repositories: readonly RepositoryIdentity[];
  readonly canonicalProjectId: string;
  readonly verifiedAt: string;
  readonly evidenceReferenceIds: readonly string[];
}
export interface EquivalentWorkItems {
  readonly workItemIds: readonly string[];
  readonly canonicalWorkItemId: string;
  readonly acceptedEventId: string;
  readonly evidenceReferenceIds: readonly string[];
}
export interface EngineeringEvidenceInput {
  readonly schemaVersion: "v7";
  readonly window: ScoringWindow;
  readonly scope: ScoringScope;
  readonly events: readonly NormalizedEngineeringEvent[];
  readonly repositoryAliases: readonly VerifiedRepositoryAlias[];
  readonly equivalentWorkItems: readonly EquivalentWorkItems[];
  readonly assessments: readonly PrivateCriterionAssessment[];
}

export type QualityCriterion = "rationale" | "verification" | "review_or_correction" | "outcome_followup";
export type CraftCriterion = "framing" | "verification_debugging" | "tool_judgment" | "accepted_outcome";
export type EvidenceCriterion = QualityCriterion | CraftCriterion;
export type AssessmentStatus = "accepted" | "rejected" | "unassessed" | "retracted";
export type OutcomeCategory = "delivered_benefit" | "correctness_security" | "performance_accessibility" | "reliability_cost" | "design_documentation" | "mentoring_review" | "maintenance_incident_recovery";
export interface EvidenceEvaluator {
  readonly id: string;
  readonly kind: "human" | "model";
  readonly version: string;
  /** Must be checked against claimant identity/conflicts before corroboration. */
  readonly independent: boolean;
}
export interface PrivateCriterionAssessment extends ImmutableRevision {
  readonly assessmentId: string;
  readonly claimRevisionId: string;
  readonly workItemId: string;
  readonly criterion: EvidenceCriterion;
  readonly status: AssessmentStatus;
  readonly rubricVersion: string;
  readonly reasonCode: EvidenceReasonCode;
  readonly evaluator: EvidenceEvaluator;
  readonly rationale: string;
  readonly assessedAt: string;
  readonly evidenceReferenceIds: readonly string[];
  readonly provenance: EvidenceProvenance;
}
export interface ImmutableRevision {
  readonly revisionId: string;
  readonly revision: number;
  readonly recordedAt: string;
  readonly supersedesRevisionId: string | null;
  readonly action: "create" | "correct" | "retract";
}
export interface PrivateEvidenceClaim extends ImmutableRevision {
  readonly claimId: string;
  readonly ownerId: string;
  readonly category: OutcomeCategory;
  readonly workItemId: string;
  readonly artifactRevision: string;
  readonly claim: string;
  readonly baseline: { readonly kind: "measured"; readonly value: string } | { readonly kind: "not_available"; readonly explanation: string };
  readonly observedResult: string;
  readonly method: string;
  readonly contributorRole: string;
  readonly attribution: "individual" | "team_participation" | "unclear";
  readonly observationPeriod: ObservationPeriod;
  readonly evidenceReferenceIds: readonly string[];
  readonly provenance: EvidenceProvenance;
  readonly limitations: readonly string[];
  readonly counterevidence: readonly string[];
}
export interface PrivateEvidenceReference {
  readonly referenceId: string;
  readonly ownerId: string;
  readonly artifactUri: string;
  readonly artifactRevision: string;
  readonly observedAt: string;
  readonly retention: "raw_30_days" | "until_owner_withdrawal";
  readonly expiresAt: string | null;
}

/** Bounds are computed after deduplication in the appropriate units, never raw item additions to weeks/projects. */
export interface CountBounds { readonly lower: number; readonly upper: number }
export function countBounds(lower: number, upper: number): CountBounds {
  if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper) || lower < 0 || upper < lower) throw new RangeError("Invalid nonnegative count bounds");
  return { lower, upper };
}
export type ScoreBounds =
  | { readonly kind: "point"; readonly value: number; readonly displayValue: number }
  | { readonly kind: "range"; readonly lower: number; readonly upper: number; readonly displayLower: number; readonly displayUpper: number };
export function scoreBounds(lower: number, upper: number): ScoreBounds {
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower < 0 || upper > 100 || upper < lower) throw new RangeError("Invalid 0–100 score bounds");
  return lower === upper ? { kind: "point", value: lower, displayValue: Math.round(lower) } :
    { kind: "range", lower, upper, displayLower: Math.floor(lower), displayUpper: Math.ceil(upper) };
}
export interface CoreCountInputs {
  readonly deliveryUnits: CountBounds;
  readonly quality: Readonly<Record<QualityCriterion, CountBounds>>;
  readonly activeIsoWeeks: CountBounds;
  readonly eligibleProjects: CountBounds;
  readonly eligibleCategories: CountBounds;
}
/** This exact allowlist is the entire core arithmetic input: no Craft, AI, tenure or principal scope. */
export interface CoreScoringInputs {
  readonly policyVersion: "v7";
  readonly window: ScoringWindow;
  readonly counts: CoreCountInputs;
}
export type CoreDimension = "delivery" | "quality" | "consistency" | "breadth";
export interface CoreScoringResult {
  readonly dimensions: Readonly<Record<CoreDimension, ScoreBounds>>;
  readonly composite: ScoreBounds;
  readonly tier: ImpactTier | null;
  readonly archetype: Exclude<DeveloperArchetype, "Artificer"> | null;
}
export interface CraftScoringInputs {
  readonly policyVersion: "v7";
  readonly window: ScoringWindow;
  readonly eligibleEpisodes: number;
  readonly counts: Readonly<Record<CraftCriterion, CountBounds>>;
  readonly independentlyCorroboratedCompleteEpisodes: number;
}
export type CraftV7Result = { readonly status: "not_observed" } | {
  readonly status: "observed";
  readonly criteria: Readonly<Record<CraftCriterion, ScoreBounds>>;
  readonly composite: ScoreBounds;
  readonly descriptor: "Artificer" | null;
};

/** Opaque receipt-local references must be allocated by the publisher, never hashes of private names. */
export interface PublicCriterionResult {
  readonly workItemRef: string;
  readonly criterion: EvidenceCriterion;
  readonly status: AssessmentStatus;
  readonly rubricVersion: string;
  readonly reasonCode: EvidenceReasonCode;
  readonly qualifyingCount: 0 | 1;
  readonly provenance: EvidenceProvenance;
}
export function publicCriterionResult(assessment: PrivateCriterionAssessment, workItemRef: string): PublicCriterionResult {
  return { workItemRef, criterion: assessment.criterion, status: assessment.status, rubricVersion: assessment.rubricVersion,
    reasonCode: assessment.reasonCode, qualifyingCount: assessment.status === "accepted" ? 1 : 0, provenance: assessment.provenance };
}
export interface PublicCoverageSummary {
  readonly sourceRef: string;
  readonly provider: EvidenceProvider;
  readonly status: CoverageStatus;
  readonly dataThrough: string | null;
  readonly discovery: SourceCoverage["discovery"];
  readonly accessibleRepositoryCount: number;
  readonly repositoryDiscoveryComplete: boolean;
  readonly reasonCodes: readonly EvidenceReasonCode[];
  readonly unknownPeriods: readonly ObservationPeriod[];
}
export interface PublicScoringReceipt extends ImmutableRevision {
  readonly schemaVersion: "v7";
  readonly policyVersion: "v7";
  readonly receiptId: string;
  readonly subjectRef: string;
  readonly window: ScoringWindow;
  readonly inputs: CoreScoringInputs;
  readonly core: CoreScoringResult;
  readonly craft: { readonly inputs: CraftScoringInputs; readonly result: CraftV7Result } | null;
  readonly criteria: readonly PublicCriterionResult[];
  readonly coverage: readonly PublicCoverageSummary[];
  readonly exclusions: ScoringScope["excludedSources"];
  readonly limitations: readonly EvidenceReasonCode[];
  readonly serializationVersion: "canonical-json-v1";
  readonly algorithm: ReceiptAlgorithmIdentity;
  readonly calculation: ReceiptCalculationTrace;
}
export type VersionedScoringRecord =
  | { readonly version: "v6"; readonly replayStatus: "legacy_not_replayable"; readonly result: ImpactV6Result }
  | { readonly version: "v7"; readonly replayStatus: "replayable"; readonly receipt: PublicScoringReceipt };
export interface ReceiptVerificationReference {
  readonly receiptId: string;
  readonly receiptRevisionId: string;
  readonly digest: string;
  readonly keyId: string;
  readonly algorithm: "HMAC-SHA256";
  readonly persistedAt: string;
}
export interface ReceiptRevocationTombstone {
  readonly receiptId: string;
  readonly status: "revoked";
  readonly revokedAt: string;
}
export interface TrendAnchor {
  readonly policyVersion: "v7";
  readonly referenceDate: string;
  readonly receiptRevisionId: string;
  readonly rawPoint: number;
  readonly unroundedValue: number;
  readonly previousAnchorRevisionId: string | null;
}
export type TrendObservation = { readonly status: "gap"; readonly referenceDate: string; readonly reason: "range" | "missing" } |
  { readonly status: "point"; readonly anchor: TrendAnchor; readonly assumption: "new_value_backward_fill" };

/** Persist dated uploads as evidence, not rejuvenated annual totals. */
export interface DatedEvidenceUpload {
  readonly schemaVersion: "v7";
  readonly uploadId: string;
  readonly ownerId: string;
  readonly receivedAt: string;
  readonly reportPeriod: ObservationPeriod;
  readonly source: SourceIdentity;
  readonly events: readonly NormalizedEngineeringEvent[];
  readonly coverage: SourceCoverage;
}
export interface CraftEpisode {
  readonly episodeId: string;
  readonly workItemId: string;
  readonly occurredAt: string;
  readonly artifactRevision: string;
  readonly evidenceReferenceIds: readonly string[];
  readonly assessments: readonly (PrivateCriterionAssessment & { readonly criterion: CraftCriterion })[];
}
export interface CraftUsageDiagnostics {
  readonly reportPeriod: ObservationPeriod;
  readonly knownClassifications: Readonly<Record<string, number>>;
  readonly unknownLabels: Readonly<Record<string, number>>;
  readonly unclassifiedSessions: number;
  readonly likelySatisfiedEstimateCount: number;
  readonly totalSessions: number;
}
/** Private optional portfolio, never an engineering evidence input. */
export interface CraftEvidencePortfolio {
  readonly schemaVersion: "v7";
  readonly uploadId: string;
  readonly ownerId: string;
  readonly receivedAt: string;
  readonly reportPeriod: ObservationPeriod;
  readonly coverage: CoverageStatus;
  readonly episodes: readonly CraftEpisode[];
  readonly diagnostics: CraftUsageDiagnostics | null;
}

/** SHA-256 over the exact published bytes named by an algorithm or policy artifact. */
export interface ContentDigest {
  readonly algorithm: "SHA-256";
  readonly value: string;
}
/** Persist these with the receipt; a mutable branch name/version alone is insufficient. */
export interface ReceiptAlgorithmIdentity {
  readonly algorithmId: "chapa-impact-v7";
  readonly revision: string;
  readonly algorithmDigest: ContentDigest;
  readonly policyDigest: ContentDigest;
}

/** Explicit serialization/replay semantics. Changes require a new policy/algorithm identity. */
export const SCORING_V7_RECEIPT_RULES = Object.freeze({
  normalization: "ln(1+min(count,cap))/ln(1+cap)" as const,
  caps: SCORING_V7_POLICY.caps,
  coreWeights: SCORING_V7_POLICY.coreWeights,
  deliveryMultiplier: 100 as const,
  qualityCriterionWeight: 25 as const,
  consistencyMultiplier: 100 as const,
  breadthComponentWeight: 50 as const,
  craftCriterionWeight: 25 as const,
  breadthMinimumDates: SCORING_V7_POLICY.breadthMinimumDates,
  rounding: Object.freeze({
    intermediate: "none" as const,
    point: "nearest_integer_half_up" as const,
    rangeLower: "floor" as const,
    rangeUpper: "ceil" as const,
    pointEquality: "exact" as const,
    tierBasis: "unrounded" as const,
    tierBoundaryDisplay: "distinguishing_decimal_or_less_than" as const,
  }),
  tierThresholds: SCORING_V7_POLICY.tierThresholds,
  rangeTier: "entire_interval_in_one_tier" as const,
  archetypeRule: "v6_descriptive_tree_without_solo_exclusions" as const,
  archetypeTieOrder: Object.freeze(["breadth", "quality", "consistency", "delivery"] as const),
  rangeArchetype: "none_if_any_dimension_is_nonpoint" as const,
  craftDescriptorMinimum: SCORING_V7_POLICY.craftDescriptorMinimum,
  craftDescriptorRequirement: "complete_point_and_independently_corroborated_episode_with_all_four_criteria" as const,
  numericTolerance: SCORING_V7_POLICY.numericTolerance,
  trendRetention: SCORING_V7_POLICY.trendRetention,
  trendAssumption: "new_value_backward_fill" as const,
});
export type ReceiptCalculationRules = typeof SCORING_V7_RECEIPT_RULES;

/** Full precision endpoints, including intermediate 0–1 and weighted values. */
export interface ExactNumericBounds { readonly lower: number; readonly upper: number }
/** Recorded steps are checked against inputs by the independent calculator, never trusted as answers. */
export interface NormalizationTrace<Cap extends number, Multiplier extends number> {
  readonly input: CountBounds;
  readonly cap: Cap;
  readonly clamped: CountBounds;
  readonly normalized: ExactNumericBounds;
  readonly multiplier: Multiplier;
  readonly weighted: ExactNumericBounds;
}
export interface CoreCalculationTrace {
  readonly delivery: NormalizationTrace<120, 100>;
  readonly quality: Readonly<Record<QualityCriterion, NormalizationTrace<12, 25>>>;
  readonly consistency: NormalizationTrace<40, 100>;
  readonly breadth: {
    readonly projects: NormalizationTrace<4, 50>;
    readonly categories: NormalizationTrace<4, 50>;
  };
  readonly dimensions: Readonly<Record<CoreDimension, ExactNumericBounds>>;
  readonly weightedDimensions: Readonly<Record<CoreDimension, ExactNumericBounds>>;
  readonly composite: ExactNumericBounds;
  readonly displayed: CoreScoringResult;
}
export interface CraftCalculationTrace {
  readonly criteria: Readonly<Record<CraftCriterion, NormalizationTrace<8, 25>>>;
  readonly composite: ExactNumericBounds;
  readonly displayed: CraftV7Result;
}
/** All public numeric arithmetic is replayable with this trace, the receipt inputs and pinned artifact identities. */
export interface ReceiptCalculationTrace {
  readonly rules: ReceiptCalculationRules;
  readonly core: CoreCalculationTrace;
  readonly craft: CraftCalculationTrace | null;
}
