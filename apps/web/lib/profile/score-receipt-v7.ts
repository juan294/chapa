import "server-only";
import { randomUUID } from "node:crypto";
import {
  createScoringWindow,
  projectReceiptEvidence,
  sealScoreReceipt,
  RECEIPT_ALGORITHM_V7,
  SCORING_V7_RECEIPT_RULES,
  type EngineeringEvidenceInput,
  type NormalizedEngineeringEvent,
  type PrivateCriterionAssessment,
  type ScoringScope,
  type ScoringWindow,
  type SourceCoverage,
} from "@chapa/shared";
import { computeImpactV7 } from "@/lib/impact/v7";
import { selectSourceEvidence } from "@/lib/platform/source-collectors";
import type { SourceProvider } from "@/lib/platform/source-authorization";
import { dbReadEngineeringEvidence } from "@/lib/db/engineering-evidence";
import { projectEngineeringLedger } from "@/lib/evidence/projection";
import { dbReadCraftV7 } from "@/lib/db/craft-v7";
import { dbPublishReceiptV7, dbReadReceiptV7 } from "@/lib/db/snapshots";
import { getCachedReceiptSnapshotV7 } from "@/lib/cache/snapshot-cache";
import type { ReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { captureServerError } from "@/lib/analytics/server-errors";

/** Every connected source Chapa can observe engineering evidence from. A
 * provider absent from a subject's connections becomes a disclosed exclusion,
 * never a silently dropped source. */
export const RECEIPT_SOURCE_PROVIDERS: readonly SourceProvider[] = ["github", "gitlab", "bitbucket", "codeberg"];

export interface ReceiptMaterializationOptions {
  /** Captured once by the caller at the orchestrator boundary. Omitted only by
   * a caller that has no earlier boundary of its own. */
  readonly referenceTime?: string;
  readonly token?: string;
  /** Read durable evidence and never collect, refresh, append or publish. */
  readonly readOnly?: boolean;
  readonly refresh?: boolean;
}

export type ReceiptMaterialization =
  | { readonly status: "issued"; readonly snapshot: ReceiptSnapshotV7; readonly publication: "inserted" | "duplicate" }
  | { readonly status: "stored"; readonly snapshot: ReceiptSnapshotV7 }
  | { readonly status: "unavailable"; readonly reason: "no_receipt" | "not_consented" | "storage_error" };

interface CollectedEvidence {
  readonly sources: SourceCoverage[];
  readonly excludedSources: ScoringScope["excludedSources"];
  readonly events: NormalizedEngineeringEvent[];
}

/**
 * Collect one source per provider under the single captured window. A provider
 * that is not connected or not consented is recorded as an exclusion; a
 * connected provider that could not be read stays in scope with its own
 * incomplete coverage, because dropping it would narrow the evidence range by
 * hiding a source rather than by observing more.
 */
async function collectSources(
  owner: string,
  window: ScoringWindow,
  options: ReceiptMaterializationOptions,
): Promise<CollectedEvidence> {
  const scope = { discovery: "owned_and_contributed" as const, repositoryIds: [] as readonly string[], eventKinds: [] as readonly string[] };
  const results = await Promise.all(
    RECEIPT_SOURCE_PROVIDERS.map(async provider => ({
      provider,
      selection: await selectSourceEvidence({
        owner, provider, window, scope,
        ...(options.token !== undefined ? { token: options.token } : {}),
        readOnly: options.readOnly === true,
        refresh: options.refresh === true,
      }),
    })),
  );

  const sources: SourceCoverage[] = [];
  const excludedSources: ScoringScope["excludedSources"][number][] = [];
  const events: NormalizedEngineeringEvent[] = [];
  for (const { provider, selection } of results) {
    if (selection.status === "observed" || selection.status === "stale") {
      sources.push(selection.status === "stale"
        ? { ...selection.observation.coverage, status: "stale", reasonCodes: [...new Set([...selection.observation.coverage.reasonCodes, "stale_data" as const])] }
        : selection.observation.coverage);
      events.push(...selection.observation.events);
      continue;
    }
    if (selection.status === "unlinked") { excludedSources.push({ provider, reason: "not_connected" }); continue; }
    if (selection.status === "disabled") { excludedSources.push({ provider, reason: "not_consented" }); continue; }
    // unavailable / unsupported / readonlymiss: connected but unreadable now.
    sources.push({
      source: { provider, host: `${provider === "github" ? "github.com" : provider === "gitlab" ? "gitlab.com" : provider === "bitbucket" ? "bitbucket.org" : "codeberg.org"}`, subjectId: owner },
      window, dataThrough: null, status: "unavailable", discovery: "owned_and_contributed",
      repositoryIds: [], repositoryDiscoveryComplete: false,
      eventKinds: {}, reasonCodes: [selection.status === "unsupported" ? "not_supported" : "not_accessible"], unknownPeriods: [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
    });
  }
  return { sources, excludedSources, events };
}

/** Assessments the receipt may publish: resolved, non-retracted verdicts only. */
function publishableAssessments(assessments: readonly PrivateCriterionAssessment[]): PrivateCriterionAssessment[] {
  return assessments.filter(row => row.action !== "retract");
}

/** A receipt may carry a Craft block only with its arithmetic trace: the trace
 * is what binds the displayed Craft result to its inputs. An unreadable or
 * incomplete portfolio therefore reads as no Craft channel at all, which
 * changes Craft alone and never the core. */
async function readCraft(owner: string, window: ScoringWindow) {
  try {
    const craft = await dbReadCraftV7(owner, owner, window);
    if (!craft.trace || !craft.inputs || !craft.result) return null;
    return { inputs: craft.inputs, result: craft.result, trace: craft.trace };
  } catch {
    return null;
  }
}

/** The durable read path every consumer shares: cache first, then Supabase. */
export async function readScoreReceiptV7(owner: string, revisionId?: string): Promise<ReceiptSnapshotV7 | null> {
  const handle = owner.toLowerCase();
  try {
    const cached = await getCachedReceiptSnapshotV7(handle, revisionId);
    if (cached) return cached;
  } catch { /* A cache miss is not an authority on issuance. */ }
  try {
    return await dbReadReceiptV7(handle, revisionId);
  } catch {
    return null;
  }
}

/**
 * Materialize exactly one v7 receipt for a subject.
 *
 * One reference time is captured here and threaded through the window, every
 * source selection, the ledger and Craft projections, the receipt and its
 * persisted revision, so a badge, a share page, an API response and a
 * verification link all resolve to the same issued artifact. A read-only call
 * observes durable state and publishes nothing.
 */
export async function materializeScoreReceiptV7(
  owner: string,
  options: ReceiptMaterializationOptions = {},
): Promise<ReceiptMaterialization> {
  const handle = owner.toLowerCase();
  if (options.readOnly) {
    const stored = await readScoreReceiptV7(handle);
    return stored ? { status: "stored", snapshot: stored } : { status: "unavailable", reason: "no_receipt" };
  }

  const referenceTime = options.referenceTime ?? new Date().toISOString();
  let window: ScoringWindow;
  try {
    window = createScoringWindow(referenceTime);
  } catch {
    return { status: "unavailable", reason: "storage_error" };
  }

  try {
    const ledgerSnapshot = await dbReadEngineeringEvidence(handle, handle, window);
    if (!ledgerSnapshot.publicConsent) return { status: "unavailable", reason: "not_consented" };
    const ledger = projectEngineeringLedger(ledgerSnapshot, window);
    const collected = await collectSources(handle, window, options);

    const scope: ScoringScope = {
      sources: [...collected.sources, ...ledger.scope.sources],
      excludedSources: [...collected.excludedSources, ...ledger.scope.excludedSources],
      ledgerRevisionIds: ledger.scope.ledgerRevisionIds,
    };
    const input: EngineeringEvidenceInput = {
      schemaVersion: "v7",
      window,
      scope,
      events: [...collected.events, ...ledger.events],
      repositoryAliases: ledger.repositoryAliases,
      equivalentWorkItems: ledger.equivalentWorkItems,
      assessments: ledger.assessments,
    };

    const core = computeImpactV7(input);
    const craft = await readCraft(handle, window);
    const projected = projectReceiptEvidence(scope, publishableAssessments(ledger.assessments));

    const envelope = await sealScoreReceipt({
      schemaVersion: "v7", policyVersion: "v7",
      receiptId: randomUUID(), revisionId: randomUUID(), subjectRef: "subject-1",
      revision: 1, supersedesRevisionId: null, action: "create",
      recordedAt: window.referenceTime, window,
      inputs: core.inputs, core: core.core,
      craft: craft ? { inputs: craft.inputs, result: craft.result } : null,
      criteria: projected.criteria, coverage: projected.coverage, exclusions: projected.exclusions,
      limitations: core.limitations,
      serializationVersion: "canonical-json-v1", algorithm: RECEIPT_ALGORITHM_V7,
      calculation: { rules: SCORING_V7_RECEIPT_RULES, core: core.calculation, craft: craft ? craft.trace : null },
    });

    const published = await dbPublishReceiptV7(handle, handle, envelope);
    return { status: "issued", snapshot: published.snapshot, publication: published.status };
  } catch (error) {
    void captureServerError({ route: "score-receipt-v7", statusCode: 500, error });
    return { status: "unavailable", reason: "storage_error" };
  }
}
