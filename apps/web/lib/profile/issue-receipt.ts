import "server-only";
import { createScoringWindow } from "@chapa/shared";
import { materializeObservedScoreReceipt, type ObservedReceiptMaterializationOptions } from "./score-receipt-observed";
import { dbReadReportCraft, dbPublishObservedReceiptWithReport } from "@/lib/db/report-craft";
import { issueReceiptVerificationV7 } from "@/lib/verification/store";
import { readScoringRenderSelection, type ScoringRenderSelection } from "@/lib/scoring-render-selection";

/** The Craft reader and publication fence share one selected report generation. */
export async function materializeCurrentObservedReceipt(handle: string, options: ObservedReceiptMaterializationOptions = {}) {
  let reportUpdate = options.reportUpdate;
  if (reportUpdate && options.referenceTime) {
    const selected = await dbReadReportCraft(handle, createScoringWindow(options.referenceTime));
    if (selected.status === "found" && selected.craft.status === "scored") {
      reportUpdate = { endExclusive: selected.craft.report.inputs.reportPeriod.endExclusive };
    }
  }
  let authority: { selectedReportId: string | null; generation: number } | null = null;
  return materializeObservedScoreReceipt(handle, {
    ...options,
    reportUpdate,
    readCraft: async (owner, window) => {
      const result = await dbReadReportCraft(owner, window);
      if (result.status !== "found") throw new Error("Report authority unavailable");
      authority = result;
      return result.craft;
    },
    publish: async (owner, actor, envelope, semanticDigest, expectedBaselineRevisionId, coreSemanticDigest) => authority
      ? dbPublishObservedReceiptWithReport(owner, actor, envelope, semanticDigest, authority.selectedReportId, authority.generation, expectedBaselineRevisionId, coreSemanticDigest)
      : { status: "failed" },
  });
}

/** A recorded preserve/storage reason narrows to these three (#1335 phase 4)
 * -- `no_receipt` is not a failure of issuance itself (there is nothing to
 * preserve or publish), so it is folded into `storage_error` below rather
 * than exposed as a fourth reason nothing else needs to handle. */
export type ReceiptFailureReason = "storage_error" | "source_error" | "craft_error";

/**
 * Every fan-in issuance outcome, with no silent skip (#1335 phase 4): a
 * `preserve` outcome from `materializeCurrentObservedReceipt` -- previously
 * absorbed into a bare `"skipped"` and the root cause of the 2026-09-23
 * production incident this plan exists to fix -- is now an explicit,
 * recorded `failed{reason}`.
 */
export type ReceiptIssuanceOutcome =
  | { readonly status: "issued" }
  | { readonly status: "unchanged" }
  | { readonly status: "failed"; readonly reason: ReceiptFailureReason };

/**
 * Issue an observed v7.2 receipt for a registered subject.
 *
 * Called only by fan-in (`lib/collection/fan-in.ts`), once every one of an
 * owner's connected sources for the day is complete (#1335 phase 4) — never
 * from a public read, and never synchronously from a write route. Issuing on
 * a public badge hit would publish a durable artifact for whoever happened to
 * be embedded, which is the same mistake #1239 fixed for the `users` table.
 *
 * Publication consent is retired (#1335 phase 2): a registered subject needs
 * no opt-in to be published. `unchanged` means the receipt is already
 * current — never an unconsenting subject, since that state no longer
 * exists. Every other non-`issued` outcome is an explicit `failed{reason}`,
 * because a durable write that fails but reports success is always a bug.
 *
 * A `failed` outcome is deliberately *not* captured here: the sole caller
 * (`lib/collection/fan-in.ts`) captures every `failed` outcome exactly once,
 * regardless of reason. Capturing here too used to double-report every
 * `storage_error` -- one capture point, at the caller, is enough.
 */
export async function issueScoreReceipt(
  handle: string,
  options: { token?: string; referenceTime?: string; scoringSelection?: ScoringRenderSelection } = {},
): Promise<ReceiptIssuanceOutcome> {
  // Gated with the render half. Issuing while nothing renders a receipt would
  // mint durable public artifacts no surface shows — and the warm-cache cron
  // would mint a fresh `revision: 1` every hour, with no revision chain.
  const selection = options.scoringSelection ?? await readScoringRenderSelection();
  if (!selection.enabled) return { status: "unchanged" };

  try {
    const result = await materializeCurrentObservedReceipt(handle, { token: options.token, referenceTime: options.referenceTime ?? new Date().toISOString() });
    if (result.status === "issued" || result.status === "stored") {
      if (result.status === "stored" && result.reason) {
        // A preserve outcome: an error occurred, but a prior current receipt
        // was retained rather than clobbered. Still a recorded, observable
        // failure — never silently absorbed as "nothing to do". (Its
        // `freshness` is always "stale" here, which is why this check comes
        // before the freshness check below — checking freshness first would
        // mask the specific reason behind a generic storage_error.)
        return { status: "failed", reason: result.reason === "no_receipt" ? "storage_error" : result.reason };
      }
      if (result.freshness !== "current") return { status: "failed", reason: "storage_error" };
      // The receipt and the link that resolves it are one act. Issuing the
      // receipt without recording its verification would put a derived token
      // on the badge that `/verify` answers "not found" to.
      try {
        // The sealed envelope, not the receipt inside it: `issueReceiptVerificationV7`
        // re-verifies what it is given, and the inner payload does not carry the
        // hash that verification binds to.
        await issueReceiptVerificationV7(handle, handle, result.snapshot.receipt);
      } catch {
        return { status: "failed", reason: "storage_error" };
      }
      return result.status === "issued" ? { status: "issued" } : { status: "unchanged" };
    }
    // result.status === "unavailable".
    return { status: "failed", reason: result.reason === "no_receipt" ? "storage_error" : result.reason };
  } catch {
    return { status: "failed", reason: "storage_error" };
  }
}
