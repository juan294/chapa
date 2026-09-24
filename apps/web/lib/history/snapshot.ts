import { SCORING_V7_RECEIPT_RULES } from "@chapa/shared";

/**
 * #1335 phase 5 — the v6 `buildSnapshot` (raw stats plus the legacy impact
 * result, producing a compact metrics snapshot) is retired along with
 * `metrics_snapshots` itself.
 */

/** Receipt/raw headline and trend are separate versioned artifacts. Superseded
 * historical receipts may have no retained trend anchor; never reconstruct one. */
export interface ReceiptSnapshotV7 {
  readonly version: "v7";
  readonly replayStatus: "replayable";
  readonly receipt: import("@chapa/shared").HashedScoreReceipt;
  readonly trend: import("@chapa/shared").TrendObservation;
}
export function buildReceiptSnapshotV7(
  receipt: import("@chapa/shared").HashedScoreReceipt,
  anchor: import("@chapa/shared").TrendAnchor | null,
): ReceiptSnapshotV7 {
  const payload = receipt.receipt;
  // PostgreSQL float JSON output can differ from receipt arithmetic by a few ULPs.
  // Only internal raw math is tolerant; identity, classification and domains remain exact.
  if (anchor && (payload.action === "retract" || anchor.receiptRevisionId !== payload.revisionId || anchor.referenceDate !== payload.window.referenceDate || anchor.policyVersion !== payload.policyVersion || payload.core.composite.kind !== "point" || !Number.isFinite(anchor.rawPoint) || anchor.rawPoint < 0 || anchor.rawPoint > 100 || Math.abs(anchor.rawPoint - payload.core.composite.value) > SCORING_V7_RECEIPT_RULES.numericTolerance || !Number.isFinite(anchor.unroundedValue) || anchor.unroundedValue < 0 || anchor.unroundedValue > 100)) throw new RangeError("Receipt/trend identity mismatch");
  return { version: "v7", replayStatus: "replayable", receipt,
    trend: anchor ? { status: "point", anchor, assumption: "new_value_backward_fill" } : { status: "gap", referenceDate: payload.window.referenceDate, reason: payload.action !== "retract" && payload.core.composite.kind === "range" ? "range" : "missing" } };
}
