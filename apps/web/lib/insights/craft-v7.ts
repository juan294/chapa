import {
  countBounds, createScoringWindow, isWithinScoringWindow, scoringInstant, scoreBounds,
  SCORING_V7_POLICY, SCORING_V7_RECEIPT_RULES,
  type CraftCalculationTrace, type CraftCriterion, type CraftEvidencePortfolio, type CraftScoringInputs,
  type CraftV7Result, type ImmutableRevision, type PrivateCriterionAssessment, type PrivateEvidenceClaim, type ScoringWindow,
} from "@chapa/shared";

export const CRAFT_CRITERIA = ["framing", "verification_debugging", "tool_judgment", "accepted_outcome"] as const;

/** Server/ledger boundary: authorization and reference existence come from private storage, never an upload. */
export interface CraftAssessmentContext {
  readonly ownerId: string;
  readonly window: ScoringWindow;
  readonly portfolios: readonly CraftEvidencePortfolio[];
  readonly claims: readonly PrivateEvidenceClaim[];
  readonly authorizedEvaluatorIds: readonly string[];
  readonly referenceIds: readonly string[];
}

function instant(value: string): number { return scoringInstant(value).getTime(); }

/** Fail closed on disconnected, conflicting or branching chains. Future records cannot revise the past. */
function latestRevisions<T extends ImmutableRevision>(records: readonly T[], referenceTime: string, identity: (row: T) => string): T[] {
  const groups = new Map<string, Map<string, T>>();
  const invalid = new Set<string>();
  for (const row of records) {
    if (instant(row.recordedAt) > instant(referenceTime)) continue;
    const key = identity(row);
    const group = groups.get(key) ?? new Map<string, T>();
    const previous = group.get(row.revisionId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) invalid.add(key);
    group.set(row.revisionId, row);
    groups.set(key, group);
  }
  const result: T[] = [];
  for (const [key, group] of groups) {
    if (invalid.has(key)) continue;
    const rows = [...group.values()].sort((a, b) => a.revision - b.revision);
    let previous: T | undefined;
    let valid = true;
    for (const row of rows) {
      if (!Number.isSafeInteger(row.revision) || row.revision !== (previous?.revision ?? 0) + 1 ||
          row.supersedesRevisionId !== (previous?.revisionId ?? null) ||
          (previous ? row.action === "create" || instant(row.recordedAt) < instant(previous.recordedAt) : row.action !== "create")) {
        valid = false;
        break;
      }
      previous = row;
    }
    if (valid && previous) result.push(previous);
  }
  return result;
}

/** No tools, report diagnostics or usage volume enter the evidence counts. No report is required. */
export function buildCraftInputs(context: CraftAssessmentContext): CraftScoringInputs {
  const { ownerId, window } = context;
  const expectedWindow = createScoringWindow(window.referenceTime);
  if ((Object.keys(expectedWindow) as (keyof ScoringWindow)[]).some(key => window[key] !== expectedWindow[key])) throw new RangeError("Invalid scoring window");
  const claims = new Map(latestRevisions(context.claims.filter(claim => claim.ownerId === ownerId), window.referenceTime, row => row.claimId)
    .filter(claim => claim.action !== "retract").map(claim => [claim.revisionId, claim]));
  const reviewers = new Set(context.authorizedEvaluatorIds);
  const references = new Set(context.referenceIds);
  const work = new Map<string, { accepted: Set<CraftCriterion>; rejected: Set<CraftCriterion> }>();
  const corroboratedWork = new Set<string>();
  const portfolios = context.portfolios.filter(portfolio => portfolio.ownerId === ownerId && instant(portfolio.receivedAt) <= instant(window.referenceTime));
  const episodes = portfolios.flatMap(portfolio => portfolio.episodes).filter(episode => isWithinScoringWindow(episode.occurredAt, window));
  // Resolve across the union before examining an episode, so a reupload cannot restore a retracted verdict.
  const assessments = latestRevisions(episodes.flatMap(episode => episode.assessments), window.referenceTime, row => row.assessmentId);
  for (const episode of episodes) {
    if (![...claims.values()].some(claim => claim.workItemId === episode.workItemId && claim.artifactRevision === episode.artifactRevision && claim.evidenceReferenceIds.some(ref => episode.evidenceReferenceIds.includes(ref)))) continue;
    const state = work.get(episode.workItemId) ?? { accepted: new Set<CraftCriterion>(), rejected: new Set<CraftCriterion>() };
    work.set(episode.workItemId, state);
    const corroborated = new Set<CraftCriterion>();
    for (const assessment of assessments) {
      const criterion = assessment.criterion as CraftCriterion;
      if (!CRAFT_CRITERIA.includes(criterion)) continue;
      const claim = claims.get(assessment.claimRevisionId);
      if (!claim || !hasObservedHorizon(claim, assessment) || claim.workItemId !== episode.workItemId || assessment.workItemId !== episode.workItemId ||
          claim.attribution !== "individual" || claim.artifactRevision !== episode.artifactRevision ||
          instant(assessment.assessedAt) < instant(episode.occurredAt) || instant(assessment.assessedAt) < instant(claim.recordedAt) ||
          instant(assessment.assessedAt) > instant(window.referenceTime) || instant(assessment.assessedAt) > instant(assessment.recordedAt) ||
          !assessment.rationale.trim() || assessment.rubricVersion !== "v7" || !assessment.evaluator.version.trim() ||
          assessment.evaluator.id === ownerId || !reviewers.has(assessment.evaluator.id) ||
          !["human_assessed", "automated_assessment", "independently_corroborated"].includes(assessment.provenance) ||
          assessment.evidenceReferenceIds.length === 0 || !assessment.evidenceReferenceIds.every(ref => references.has(ref) && episode.evidenceReferenceIds.includes(ref) && claim.evidenceReferenceIds.includes(ref))) continue;
      if (assessment.action === "retract" || assessment.status === "retracted" || assessment.status === "unassessed") continue;
      if (assessment.status === "accepted" && assessment.reasonCode === "criterion_demonstrated") {
        state.accepted.add(criterion);
        if (isIndependent(assessment)) corroborated.add(criterion);
      } else if (assessment.status === "rejected" && assessment.reasonCode === "criterion_not_demonstrated") state.rejected.add(criterion);
    }
    if (CRAFT_CRITERIA.every(criterion => corroborated.has(criterion))) corroboratedWork.add(episode.workItemId);
  }
  const counts = Object.fromEntries(CRAFT_CRITERIA.map(criterion => {
    let lower = 0, upper = 0;
    for (const state of work.values()) {
      if (state.accepted.has(criterion) && !state.rejected.has(criterion)) lower++;
      // Disagreement, withdrawal and absent assessment remain unknown, never a manufactured negative.
      if (!state.rejected.has(criterion) || state.accepted.has(criterion)) upper++;
    }
    if (work.size > 0 && portfolios.some(portfolio => portfolio.coverage !== "complete" && portfolio.episodes.some(episode => isWithinScoringWindow(episode.occurredAt, window)))) {
      upper = Math.max(upper, SCORING_V7_POLICY.caps.craftCriterion);
    }
    return [criterion, countBounds(lower, upper)];
  })) as CraftScoringInputs["counts"];
  return { policyVersion: "v7", window, eligibleEpisodes: work.size, counts,
    independentlyCorroboratedCompleteEpisodes: [...work.entries()].filter(([id, state]) => corroboratedWork.has(id) && CRAFT_CRITERIA.every(criterion => !state.rejected.has(criterion))).length };
}

/** A performed episode may precede its measurement horizon; an observed result cannot precede observation. */
function hasObservedHorizon(claim: PrivateEvidenceClaim, assessment: PrivateCriterionAssessment): boolean {
  try {
    const start = instant(claim.observationPeriod.startInclusive);
    const end = instant(claim.observationPeriod.endExclusive);
    return start < end && end <= instant(claim.recordedAt) && end <= instant(assessment.assessedAt);
  } catch { return false; }
}

function isIndependent(assessment: PrivateCriterionAssessment): boolean {
  return assessment.provenance === "independently_corroborated" && assessment.evaluator.kind === "human" && assessment.evaluator.independent;
}

/** Pure, clock-free optional arithmetic. Trace includes every full-precision intermediate. */
export function calculateCraftV7(input: CraftScoringInputs): { result: CraftV7Result; trace: CraftCalculationTrace } {
  if (input.policyVersion !== "v7") throw new RangeError("Unsupported Craft policy");
  countBounds(input.eligibleEpisodes, input.eligibleEpisodes);
  countBounds(input.independentlyCorroboratedCompleteEpisodes, input.eligibleEpisodes);
  const criteria = Object.fromEntries(CRAFT_CRITERIA.map(criterion => {
    const value = input.counts[criterion];
    countBounds(value.lower, value.upper);
    if (value.lower > input.eligibleEpisodes || input.independentlyCorroboratedCompleteEpisodes > value.lower || (input.eligibleEpisodes === 0 && value.upper !== 0)) throw new RangeError("Inconsistent Craft counts");
    const cap = SCORING_V7_POLICY.caps.craftCriterion;
    const clamped = countBounds(Math.min(value.lower, cap), Math.min(value.upper, cap));
    const normalized = { lower: Math.log1p(clamped.lower) / Math.log1p(cap), upper: Math.log1p(clamped.upper) / Math.log1p(cap) };
    const multiplier = SCORING_V7_RECEIPT_RULES.craftCriterionWeight;
    return [criterion, { input: value, cap, clamped, normalized, multiplier, weighted: { lower: multiplier * normalized.lower, upper: multiplier * normalized.upper } }];
  })) as CraftCalculationTrace["criteria"];
  const composite = { lower: CRAFT_CRITERIA.reduce((sum, criterion) => sum + criteria[criterion].weighted.lower, 0), upper: CRAFT_CRITERIA.reduce((sum, criterion) => sum + criteria[criterion].weighted.upper, 0) };
  const bounds = scoreBounds(composite.lower, composite.upper);
  const result: CraftV7Result = input.eligibleEpisodes === 0 ? { status: "not_observed" } : { status: "observed",
    criteria: Object.fromEntries(CRAFT_CRITERIA.map(criterion => [criterion, scoreBounds(criteria[criterion].weighted.lower, criteria[criterion].weighted.upper)])) as Record<CraftCriterion, ReturnType<typeof scoreBounds>>,
    composite: bounds, descriptor: bounds.kind === "point" && bounds.value >= SCORING_V7_POLICY.craftDescriptorMinimum && input.independentlyCorroboratedCompleteEpisodes > 0 ? "Artificer" : null };
  return { result, trace: { criteria, composite, displayed: result } };
}
