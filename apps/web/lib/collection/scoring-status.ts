import type { SourceProvider, SourceDiagnostic } from "@/lib/platform/evidence-diagnostics";
import type { CollectionJobState } from "@/lib/db/collection-queue";

/**
 * Scoring status contract (#1335 phase 4). Every scored surface renders exactly
 * one of these states for a handle: a ready receipt, collection in progress,
 * collection paused on an owner action, or a handle that has not signed up.
 * Derived by the pure `deriveScoringStatus` (`lib/collection/status.ts`) and
 * served to the owner by `GET /api/scoring/status`, which returns
 * `{ scoringStatus: ScoringStatus }`.
 */
export type ProviderStatusReason = "reconnect" | "rate_limited" | "temporary" | "failed";

export interface ProviderStatus {
  readonly provider: SourceProvider;
  readonly state: CollectionJobState;
  /** 0-100; capped at 99 until the job is complete. An estimate: discovery can grow the operation count. */
  readonly percent: number;
  /** ISO timestamp when a waiting or retrying job resumes. */
  readonly resumesAt?: string;
  /** 1-based retry attempt for a retrying job. */
  readonly attempt?: number;
  readonly reason?: ProviderStatusReason;
  /** Operator detail; never a URL, body or credential. */
  readonly stop?: SourceDiagnostic;
}

export type ScoringStatus =
  | { readonly kind: "unregistered" }
  | { readonly kind: "collecting"; readonly percent: number; readonly sources: readonly ProviderStatus[]; readonly hasPriorReceipt: boolean }
  | { readonly kind: "action_needed"; readonly sources: readonly ProviderStatus[]; readonly hasPriorReceipt: boolean }
  | { readonly kind: "ready"; readonly receiptDate: string; readonly updating: boolean };

export type ScoringStatusKind = ScoringStatus["kind"];
