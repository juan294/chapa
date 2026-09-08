import "server-only";
import { randomUUID } from "node:crypto";
import { canonicalJson, createScoringWindow, evidenceSourceKey, projectReceiptEvidence, scoringInstant, sealObservedScoreReceipt, RECEIPT_ALGORITHM_OBSERVED, SCORING_OBSERVED_POLICY,
  type EngineeringAggregation, type EngineeringEvidenceInput, type HashedObservedScoreReceipt, type PrivateCriterionAssessment, type PublicCriterionResult,
  type PublicObservedCraft, type PublicObservedScoringReceipt, type QualityCriterion, type ScoringWindow } from "@chapa/shared";
import { computeObservedImpactV7 } from "@/lib/impact/observed-v7";
import { dbReadEngineeringEvidence } from "@/lib/db/engineering-evidence";
import { projectEngineeringLedger } from "@/lib/evidence/projection";
import { dbPublishObservedReceipt, dbReadObservedReceipt, type ObservedTrendAnchor, type StoredObservedReceipt } from "@/lib/db/score-receipts-observed";
import { captureServerError } from "@/lib/analytics/server-errors";
import { collectSources, type ReceiptMaterializationOptions } from "./score-receipt-v7";
import { canonicalizeReceiptEvidence, observedSemanticIdentity, receiptSemanticIdentity } from "./receipt-semantic-identity";

export interface ObservedReceiptSnapshot {
  readonly receipt: HashedObservedScoreReceipt;
  readonly trend: ObservedTrendAnchor | null;
}
export interface ObservedReceiptMaterializationOptions extends ReceiptMaterializationOptions {
  /** Explicit correction binds collection to the target's exact frozen context. */
  readonly correctionRevisionId?: string;
  /** Report writes reproject retained evidence and never refresh linked providers. */
  readonly reportUpdate?: { readonly endExclusive: string };
  readonly publish?: (owner: string, actor: string, envelope: HashedObservedScoreReceipt, semanticDigest: string, expectedBaselineRevisionId?: string, coreSemanticDigest?: string) => ReturnType<typeof dbPublishObservedReceipt>;
  /** Persistence authority supplied by the authenticated orchestration layer.
   * Absence/errors are unavailable, never inferred no_report consent. */
  readonly readCraft?: (owner: string, window: ScoringWindow) => Promise<PublicObservedCraft>;
}
type FailureReason = "no_receipt" | "not_consented" | "storage_error" | "source_error" | "craft_error";
export type ObservedReceiptMaterialization =
  | { readonly status: "issued"; readonly snapshot: ObservedReceiptSnapshot; readonly publication: "inserted" | "duplicate"; readonly isCurrent: boolean; readonly freshness: "current" | "stale" }
  | { readonly status: "stored"; readonly snapshot: ObservedReceiptSnapshot; readonly freshness: "current" | "stale"; readonly reason?: FailureReason }
  | { readonly status: "unavailable"; readonly reason: FailureReason };
const snapshot = (stored: StoredObservedReceipt): ObservedReceiptSnapshot => ({ receipt: stored.envelope, trend: stored.trend });

const qualityCriteria: readonly QualityCriterion[] = ["rationale", "verification", "review_or_correction", "outcome_followup"];
/** Mirror the pinned core's final per-claim/per-work verdict resolution, not
 * its full private revision chains. A counted public row must also have the
 * same contemporaneous artifact support as the actual core calculation.
 */
function resolvedCriteria(aggregation: EngineeringAggregation): PublicCriterionResult[] {
  const latest = new Map<string, PrivateCriterionAssessment>();
  for (const row of aggregation.assessments) if (!latest.has(row.assessmentId) || latest.get(row.assessmentId)!.revision < row.revision) latest.set(row.assessmentId, row);
  const registered = new Set(aggregation.scope.ledgerRevisionIds);
  const claims = new Map<string, PrivateCriterionAssessment[]>();
  for (const row of latest.values()) {
    if (!qualityCriteria.includes(row.criterion as QualityCriterion)) continue;
    const key = JSON.stringify([row.workItemId, row.criterion, row.claimRevisionId]);
    claims.set(key, [...(claims.get(key) ?? []), row]);
  }
  type Verdict = { work: string; criterion: QualityCriterion; status: "accepted" | "rejected" | "unknown"; supporting: PrivateCriterionAssessment[]; rows: PrivateCriterionAssessment[] };
  const works = new Map<string, Verdict[]>();
  for (const rows of claims.values()) {
    const first = rows[0]!;
    const valid = rows.filter(row => registered.has(row.claimRevisionId) && row.rubricVersion === "v7" && row.provenance !== "self_reported"
      && row.rationale.trim() && row.evaluator.id && row.evaluator.version && row.evidenceReferenceIds.length && row.action !== "retract"
      && scoringInstant(row.assessedAt) <= scoringInstant(row.recordedAt));
    const accepted = valid.filter(row => row.status === "accepted" && row.reasonCode === "criterion_demonstrated");
    const rejected = valid.filter(row => row.status === "rejected" && row.reasonCode === "criterion_not_demonstrated");
    const status = accepted.length && !rejected.length ? "accepted" : rejected.length && !accepted.length ? "rejected" : "unknown";
    const key = JSON.stringify([first.workItemId, first.criterion]);
    works.set(key, [...(works.get(key) ?? []), { work: first.workItemId, criterion: first.criterion as QualityCriterion, status, supporting: status === "accepted" ? accepted : status === "rejected" ? rejected : [], rows }]);
  }
  const unresolved = new Set(aggregation.scope.sources.filter(source => source.reasonCodes.includes("alias_unresolved")).map(source => evidenceSourceKey(source.source)));
  const selections = new Map(aggregation.acceptanceSelections.map(row => [row.workItemId, row.acceptedEventId]));
  const known = aggregation.events.filter(event => {
    if (unresolved.has(evidenceSourceKey(event))) return false;
    const selected = selections.get(event.workItemId);
    if (!selected || selected === event.eventId) return true;
    const method = event.acceptance.status === "observed" ? event.acceptance.value.method : null;
    const accepted = (event.kind === "accepted_change" && (method === "merged_change" || method === "linked_issue_result"))
      || (event.kind === "authored_commit" && method === "default_branch_first_reachability") || (event.kind === "issue_work" && method === "linked_issue_result")
      || ((event.kind === "documentation_design" || event.kind === "maintenance") && method === "accepted_artifact");
    return event.kind !== "accepted_change" && !accepted;
  });
  const refs = new Map<string, string>();
  const provenanceOrder = ["source_observed", "self_reported", "automated_assessment", "human_assessed", "independently_corroborated"];
  const result: PublicCriterionResult[] = [];
  for (const [, group] of [...works].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const first = group[0]!;
    const events = known.filter(event => event.workItemId === first.work);
    if (!events.length) continue;
    const status = group.some(row => row.status === "accepted") ? "accepted" : group.every(row => row.status === "rejected") ? "rejected" : "unknown";
    const supporting = group.filter(row => row.status === status).flatMap(row => row.supporting);
    const references = new Set(supporting.flatMap(row => row.evidenceReferenceIds));
    const supported = events.some(event => event.artifactReferenceIds.some(ref => references.has(ref)));
    const verdict = supported ? status : "unknown";
    const provenance = [...(supporting.length ? supporting : group.flatMap(row => row.rows))].sort((a, b) => provenanceOrder.indexOf(a.provenance) - provenanceOrder.indexOf(b.provenance))[0]!.provenance;
    if (!refs.has(first.work)) refs.set(first.work, `work-${refs.size + 1}`);
    result.push({ workItemRef: refs.get(first.work)!, criterion: first.criterion, status: verdict === "unknown" ? "unassessed" : verdict,
      rubricVersion: "v7", reasonCode: verdict === "accepted" ? "criterion_demonstrated" : verdict === "rejected" ? "criterion_not_demonstrated" : "not_assessed", qualifyingCount: verdict === "accepted" ? 1 : 0, provenance });
  }
  return result;
}

/** Policy-qualified durable authority; no latest historical range-policy read. */
export async function readObservedScoreReceipt(owner: string, revisionId?: string) {
  return dbReadObservedReceipt(owner.toLowerCase(), revisionId);
}

/** Current authenticated write orchestrator; public readers use durable state.
 * Connected-source/Craft failures preserve durable evidence with stale status;
 * no unavailable read is converted to an authoritative empty point.
 */
export async function materializeObservedScoreReceipt(owner: string, options: ObservedReceiptMaterializationOptions = {}): Promise<ObservedReceiptMaterialization> {
  const handle = owner.toLowerCase();
  const previous = await readObservedScoreReceipt(handle);
  const publish: NonNullable<ObservedReceiptMaterializationOptions["publish"]> = options.publish
    ?? ((owner, actor, envelope, semanticDigest, baseline, coreSemanticDigest) => {
      void baseline; return dbPublishObservedReceipt(owner, actor, envelope, semanticDigest, coreSemanticDigest);
    });
  if (previous.status === "unavailable") return { status: "unavailable", reason: "storage_error" };
  if (options.readOnly) return previous.status === "found"
    ? { status: "stored", snapshot: snapshot(previous), freshness: "current" }
    : { status: "unavailable", reason: "no_receipt" };
  const preserve = async (reason: FailureReason): Promise<ObservedReceiptMaterialization> => {
    const authorized = await readObservedScoreReceipt(handle);
    return authorized.status === "found" && authorized.envelope.receipt.action !== "retract"
      ? { status: "stored", snapshot: snapshot(authorized), freshness: "stale", reason }
      : { status: "unavailable", reason };
  };
  try {
    const target = options.correctionRevisionId ? await readObservedScoreReceipt(handle, options.correctionRevisionId) : null;
    if (target && (target.status !== "found" || target.envelope.receipt.action === "retract")) return { status: "unavailable", reason: "storage_error" };
    const correction = target?.status === "found" ? target : null;
    const capturedTime = options.referenceTime ?? new Date().toISOString();
    const baselineWindow = previous.status === "found" ? previous.envelope.receipt.window : null;
    const frozenTime = options.reportUpdate && baselineWindow
      && baselineWindow.referenceDate === capturedTime.slice(0, 10)
      && scoringInstant(options.reportUpdate.endExclusive) <= scoringInstant(baselineWindow.referenceTime)
      ? baselineWindow.referenceTime : capturedTime;
    const window = createScoringWindow(correction?.envelope.receipt.window.referenceTime ?? frozenTime);
    // A report inside the exact durable context changes only Craft. Reading
    // mutable provider/ledger caches here would make the report alter the core
    // or make a valid report depend on an unrelated refresh outage.
    if (options.reportUpdate && !correction && previous.status === "found"
      && previous.envelope.receipt.action !== "retract" && baselineWindow?.referenceTime === window.referenceTime) {
      if (!options.readCraft) return preserve("craft_error");
      let craft: PublicObservedCraft;
      try { craft = await options.readCraft(handle, window); } catch { return preserve("craft_error"); }
      if (craft.status === "unavailable") return preserve("craft_error");
      if (!previous.coreSemanticDigest) return preserve("storage_error");
      const unchanged = canonicalJson(craft) === canonicalJson(previous.envelope.receipt.craft);
      const envelope = unchanged ? previous.envelope : await sealObservedScoreReceipt({ ...previous.envelope.receipt,
        receiptId: randomUUID(), revisionId: randomUUID(), revision: 1, supersedesRevisionId: null, action: "create", recordedAt: window.referenceTime, craft });
      // The service-only core digest binds every retained private evidence
      // detail. Combining the same core/Craft digests works identically for
      // report-only writes and later ordinary source refreshes.
      const semanticDigest = unchanged ? previous.semanticDigest : await observedSemanticIdentity(previous.coreSemanticDigest, craft);
      const published = await publish(handle, handle, envelope, semanticDigest, previous.envelope.receipt.revisionId, previous.coreSemanticDigest);
      if (published.status === "failed") return preserve("storage_error");
      const freshness = published.isCurrent ? "current" : "stale";
      return published.status === "duplicate"
        ? { status: "stored", snapshot: snapshot(published), freshness }
        : { status: "issued", snapshot: snapshot(published), publication: published.status, isCurrent: published.isCurrent, freshness };
    }
    const ledgerSnapshot = await dbReadEngineeringEvidence(handle, handle, window);
    if (!ledgerSnapshot.publicConsent) return { status: "unavailable", reason: "not_consented" };
    const ledger = projectEngineeringLedger(ledgerSnapshot, window);
    const collected = await collectSources(handle, window, { ...options, readOnly: options.reportUpdate && previous.status === "found" ? true : options.readOnly });
    const sources = collected.sources.map(source => {
      // The read-only coordinator labels a retained normalized observation
      // stale when its original window differs. Re-evaluate its dated events
      // in the new context, preserving the genuine observation cutoff. We
      // cannot promise completeness for this new window or new repositories.
      if (!options.reportUpdate || previous.status !== "found" || source.status !== "stale"
        || source.discovery === "legacy_upload" || !source.dataThrough || source.reasonCodes.includes("source_error")
        || scoringInstant(source.window.referenceTime) >= scoringInstant(window.referenceTime)) return source;
      return { ...source, window, status: "partial" as const, repositoryDiscoveryComplete: false,
        eventKinds: Object.fromEntries(Object.keys(source.eventKinds).map(kind => [kind, "partial" as const])),
        unknownPeriods: [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }] };
    });
    if (sources.some(source => source.status === "unavailable" || source.status === "stale" || source.status === "legacy" || source.reasonCodes.includes("source_error"))) return preserve("source_error");
    if (!options.readCraft) return preserve("craft_error");
    let craft: PublicObservedCraft;
    try { craft = await options.readCraft(handle, window); } catch { return preserve("craft_error"); }
    if (craft.status === "unavailable") return preserve("craft_error");
    const evidence: EngineeringEvidenceInput = canonicalizeReceiptEvidence({ schemaVersion: "v7", window,
      scope: { sources: [...sources, ...ledger.scope.sources], excludedSources: [...collected.excludedSources, ...ledger.scope.excludedSources], ledgerRevisionIds: ledger.scope.ledgerRevisionIds },
      events: [...collected.events, ...ledger.events], repositoryAliases: ledger.repositoryAliases, equivalentWorkItems: ledger.equivalentWorkItems, assessments: ledger.assessments });
    const core = computeObservedImpactV7(evidence);
    const projected = { ...projectReceiptEvidence(evidence.scope, []), criteria: resolvedCriteria(core.aggregation) };
    for (const criterion of qualityCriteria) {
      if (projected.criteria.filter(row => row.criterion === criterion && row.qualifyingCount === 1).length !== core.observedCounts.quality[criterion]) throw new Error("Public criterion projection diverged from credited evidence");
    }
    const prior = correction?.envelope.receipt;
    const candidate: PublicObservedScoringReceipt = {
      schemaVersion: "v7", policyVersion: "v7.2", receiptId: prior?.receiptId ?? randomUUID(), revisionId: randomUUID(), subjectRef: "subject-1",
      revision: (prior?.revision ?? 0) + 1, supersedesRevisionId: prior?.revisionId ?? null, action: prior ? "correct" : "create", recordedAt: window.referenceTime, window,
      inputs: core.inputs, core: core.core, craft, ...projected, limitations: [...core.limitations].sort(),
      serializationVersion: "canonical-json-v1", algorithm: RECEIPT_ALGORITHM_OBSERVED, calculation: { rules: SCORING_OBSERVED_POLICY, core: core.trace },
    };
    // Seal before no-op comparison too: an invalid injected Craft result must
    // never bypass the strict parser merely because other evidence is stable.
    const envelope = await sealObservedScoreReceipt(candidate);
    const coreSemanticDigest = await receiptSemanticIdentity({ ...envelope.receipt, craft: { status: "no_report", unlocked: false, report: null } }, evidence, ledgerSnapshot);
    const semanticDigest = await observedSemanticIdentity(coreSemanticDigest, craft);
    const baseline = correction ?? (previous.status === "found" ? previous : null);
    const unchanged = baseline && baseline.envelope.receipt.action !== "retract" && baseline.envelope.receipt.window.referenceDate === window.referenceDate && baseline.semanticDigest === semanticDigest;
    const published = await publish(handle, handle, unchanged ? baseline.envelope : envelope, semanticDigest, undefined, coreSemanticDigest);
    if (published.status === "failed") return preserve("storage_error");
    // The database winner may be another caller's identical root. Always
    // return that stored envelope rather than the locally allocated candidate.
    const freshness = published.isCurrent ? "current" : "stale";
    return published.status === "duplicate"
      ? { status: "stored", snapshot: snapshot(published), freshness }
      : { status: "issued", snapshot: snapshot(published), publication: published.status, isCurrent: published.isCurrent, freshness };
  } catch (error) {
    void captureServerError({ route: "score-receipt-observed", statusCode: 500, error });
    return preserve("storage_error");
  }
}
