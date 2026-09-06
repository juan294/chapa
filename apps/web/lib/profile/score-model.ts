import "server-only";
import type { ClientImpactV6Result } from "@chapa/shared";
import { readScoreReceiptV7 } from "./score-receipt-v7";
import type { ReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { legacyViewModel, receiptViewModel, type ScoreViewModel } from "./score-view-model";

/**
 * The one place a rendering surface decides which policy version it is showing.
 *
 * An issued v7 receipt wins whenever one exists for the subject, because the
 * receipt is the artifact a verification link resolves to — a surface that drew
 * the v6 aggregate beside a v7 verification link would publish two answers for
 * one revision. Where no receipt has been issued the legacy v6 aggregate is
 * projected into the same shape and labelled `v6`, so the badge for a handle
 * that has never consented keeps working rather than losing its score.
 *
 * The fallback is deliberate and load-bearing: `/u/:handle` accepts any handle
 * on earth (a README embed of a stranger's badge), and such a subject has no
 * ledger, no consent and therefore no receipt. Failing closed here would blank
 * every embedded badge that is not a registered, consented account.
 */
export async function resolveScoreModel(
  handle: string,
  impact: ClientImpactV6Result,
): Promise<ScoreViewModel> {
  return scoreModelFrom(handle, impact, await readScoreReceiptV7(handle));
}

/**
 * The same decision once the receipt read has already happened.
 *
 * Materialization reads the receipt concurrently with stats rather than after
 * them — the read does not depend on the v6 aggregate, and serializing it
 * behind the GitHub fetch would spend the badge's cache-miss latency budget on
 * a lookup that could have overlapped it.
 */
export function scoreModelFrom(
  handle: string,
  impact: ClientImpactV6Result,
  receipt: ReceiptSnapshotV7 | null,
): ScoreViewModel {
  return receipt ? receiptViewModel(handle, receipt) : legacyViewModel(impact);
}
