import { dbListObservedReceiptHistory } from "@/lib/db/scoring-history-observed";
import { observedReceiptViewModel } from "@/lib/profile/score-view-model";
import { buildScoringHistory } from "./scoring-observations";

/** HTTP and remote tools expose the same daily winners and durable EMA.
 * Project at the recorded reference time: historical Craft must not expire
 * simply because somebody reads an old observation today. */
export async function readObservedScoringHistory(handle: string, dates: { from?: string; to?: string } = {}) {
  const stored = await dbListObservedReceiptHistory(handle, dates);
  if (stored.status !== "found") return { status: stored.status };
  const history = buildScoringHistory(stored.entries.map(({ envelope, trend }) => ({
    model: observedReceiptViewModel(handle, { receipt: envelope, trend }, Date.parse(envelope.receipt.window.referenceTime)), trend,
  })));
  return { status: "found" as const, history };
}
