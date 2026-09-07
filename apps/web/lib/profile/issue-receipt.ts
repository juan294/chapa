import "server-only";
import { materializeScoreReceiptV7 } from "./score-receipt-v7";
import { issueReceiptVerificationV7 } from "@/lib/verification/store";
import { captureServerError } from "@/lib/analytics/server-errors";
import { isScoringV7RenderingEnabled } from "@/lib/feature-flags";

/**
 * Issue a v7 receipt for a subject who has consented to publication.
 *
 * Called from the authenticated write paths — refresh, recalculate, generate —
 * and the warm-cache cron, never from a public read. Issuing on a public badge
 * hit would publish a durable artifact for whoever happened to be embedded,
 * which is the same mistake #1239 fixed for the `users` table.
 *
 * `not_consented` is the normal answer for the overwhelming majority of
 * subjects and is deliberately silent: consent is opt-in, and a subject who has
 * not opted in keeps their labelled v6 aggregate rather than acquiring a
 * published evidence receipt as a side effect of pressing Refresh. Only a
 * genuine storage failure is captured, because that one is a durable write that
 * failed and must stay observable.
 */
export async function issueScoreReceiptIfConsented(
  handle: string,
  options: { token?: string; referenceTime?: string } = {},
): Promise<"issued" | "skipped" | "failed"> {
  // Gated with the render half. Issuing while nothing renders a receipt would
  // mint durable public artifacts no surface shows — and the warm-cache cron
  // would mint a fresh `revision: 1` every hour, with no revision chain.
  if (!(await isScoringV7RenderingEnabled())) return "skipped";

  try {
    const result = await materializeScoreReceiptV7(handle, options);
    if (result.status === "issued") {
      // The receipt and the link that resolves it are one act. Issuing the
      // receipt without recording its verification would put a derived token
      // on the badge that `/verify` answers "not found" to.
      try {
        // The sealed envelope, not the receipt inside it: `issueReceiptVerificationV7`
        // re-verifies what it is given, and the inner payload does not carry the
        // hash that verification binds to.
        await issueReceiptVerificationV7(handle, handle, result.snapshot.receipt);
      } catch (error) {
        void captureServerError({ route: "issue-score-receipt-v7", statusCode: 500, error });
        return "failed";
      }
      return "issued";
    }
    if (result.status === "unavailable" && result.reason === "storage_error") {
      void captureServerError({
        route: "issue-score-receipt-v7",
        statusCode: 500,
        error: new Error(`v7 receipt storage failed for handle: ${handle}`),
      });
      return "failed";
    }
    return "skipped";
  } catch (error) {
    void captureServerError({ route: "issue-score-receipt-v7", statusCode: 500, error });
    return "failed";
  }
}
