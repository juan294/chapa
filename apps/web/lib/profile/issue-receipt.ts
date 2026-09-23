import "server-only";
import { createScoringWindow } from "@chapa/shared";
import { materializeObservedScoreReceipt, type ObservedReceiptMaterializationOptions } from "./score-receipt-observed";
import { dbReadReportCraft, dbPublishObservedReceiptWithReport } from "@/lib/db/report-craft";
import { issueReceiptVerificationV7 } from "@/lib/verification/store";
import { captureServerError } from "@/lib/analytics/server-errors";
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

/**
 * Issue an observed v7.2 receipt for a registered subject.
 *
 * Called from the authenticated write paths — refresh, recalculate, generate —
 * and the warm-cache cron, never from a public read. Issuing on a public badge
 * hit would publish a durable artifact for whoever happened to be embedded,
 * which is the same mistake #1239 fixed for the `users` table.
 *
 * Publication consent is retired (#1335 phase 2): a registered subject needs
 * no opt-in to be published. `skipped` now means the render flag is off, the
 * subject has no source evidence yet, or the receipt is already up to date —
 * never an unconsenting subject, since that state no longer exists. Only a
 * genuine storage failure is captured, because that one is a durable write that
 * failed and must stay observable.
 */
export async function issueScoreReceipt(
  handle: string,
  options: { token?: string; referenceTime?: string; scoringSelection?: ScoringRenderSelection } = {},
): Promise<"issued" | "skipped" | "failed"> {
  // Gated with the render half. Issuing while nothing renders a receipt would
  // mint durable public artifacts no surface shows — and the warm-cache cron
  // would mint a fresh `revision: 1` every hour, with no revision chain.
  const selection = options.scoringSelection ?? await readScoringRenderSelection();
  if (!selection.enabled) return "skipped";

  try {
    const result = await materializeCurrentObservedReceipt(handle, { token: options.token, referenceTime: options.referenceTime ?? new Date().toISOString() });
    if (result.status === "issued" || result.status === "stored") {
      if (result.freshness !== "current") return "failed";
      // The receipt and the link that resolves it are one act. Issuing the
      // receipt without recording its verification would put a derived token
      // on the badge that `/verify` answers "not found" to.
      try {
        // The sealed envelope, not the receipt inside it: `issueReceiptVerificationV7`
        // re-verifies what it is given, and the inner payload does not carry the
        // hash that verification binds to.
        await issueReceiptVerificationV7(handle, handle, result.snapshot.receipt);
      } catch (error) {
        void captureServerError({ route: "issue-score-receipt-observed", statusCode: 500, error });
        return "failed";
      }
      return result.status === "issued" ? "issued" : "skipped";
    }
    if (result.status === "unavailable" && result.reason === "storage_error") {
      void captureServerError({
        route: "issue-score-receipt-observed",
        statusCode: 500,
        error: new Error(`Observed receipt storage failed for handle: ${handle}`),
      });
      return "failed";
    }
    return "skipped";
  } catch (error) {
    void captureServerError({ route: "issue-score-receipt-observed", statusCode: 500, error });
    return "failed";
  }
}
