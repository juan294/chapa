/**
 * Recorded-score-change email notification.
 *
 * #1335 phase 5 — the v6 `notifyScoreBump` (SnapshotDiff-based, hardcoded
 * and DB-backed campaign templates) is retired along with `metrics_snapshots`
 * and `SnapshotDiff`. `notifyObservedScoreChange` below is the only
 * remaining notifier, over a `ScoringComparison` from the current v7.2
 * receipt history.
 *
 * Guards:
 *   1. `score_notifications` feature flag must be enabled in Supabase
 *   2. User must have an email on file with notifications enabled
 *   3. Redis dedup marker (7-day TTL) prevents spam
 *
 * Fire-and-forget: called with `void` — never blocks, never throws.
 */

import { getResend, escapeHtml } from "./resend";
import { withTimeout, EMAIL_SEND_TIMEOUT_MS } from "@/lib/async/with-timeout";
import { EMAIL_FROM } from "./campaigns";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { dbGetUserEmail } from "@/lib/db/users";
import { dbGetFeatureFlag } from "@/lib/db/feature-flags";
import { getBaseUrl } from "@/lib/env";
import { buildUnsubscribeUrl } from "./unsubscribe-url";

const DEDUP_TTL = 604_800; // 7 days in seconds

/** Receipt revision notice. Keeps current point semantics separate from legacy
 * campaign templates that describe rounded EMA gains as performance jumps. */
export async function notifyObservedScoreChange(handle: string, comparison: import("@/lib/history/scoring-observations").ScoringComparison): Promise<boolean> {
  const { isSignificantScoringChange } = await import("@/lib/history/significant-change");
  const identity = comparison.current.identity;
  if (comparison.status !== "comparable" || !isSignificantScoringChange(comparison).significant || !identity) return false;
  try {
    if (!(await dbGetFeatureFlag("score_notifications"))?.enabled) return false;
    const lowerHandle = handle.toLowerCase();
    const user = await dbGetUserEmail(lowerHandle);
    if (!user?.emailNotifications) return false;
    const key = `score-bump:${lowerHandle}`;
    if (await cacheGet<boolean>(key)) return false;
    const resend = getResend();
    if (!resend) return false;
    const { current, previous } = comparison;
    const text = [`CHAPA — Recorded score updated`, `Handle: ${lowerHandle}`, `Policy: ${current.policyVersion}`,
      `Previous score: ${previous.composite.display}`, `Current score: ${current.composite.display}`, `Exact current score: ${current.composite.exact}`,
      `Tier: ${current.tier ?? "Unassigned"}`, `Archetype: ${current.archetype ?? "Unassigned"}`,
      `Revision: ${identity.revisionId}`, `Content hash: ${identity.contentHash}`,
      `Window: ${current.window?.startInclusive} to ${current.window?.endExclusive}`,
      "This compares recorded evidence in the same scoring window.",
      `${getBaseUrl()}/u/${lowerHandle}`, `Unsubscribe: ${buildUnsubscribeUrl(lowerHandle)}`].join("\n");
    const { error } = await withTimeout(resend.emails.send({ from: EMAIL_FROM, to: [user.email], subject: `${lowerHandle}: recorded ${current.policyVersion} score updated`,
      text, html: `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>` }), EMAIL_SEND_TIMEOUT_MS, "notifyObservedScoreChange");
    if (error) return false;
    await cacheSet(key, true, DEDUP_TTL);
    return true;
  } catch { return false; }
}
