/**
 * First-badge email notification.
 *
 * Sends a one-time email to SUPPORT_FORWARD_EMAIL when a developer's badge
 * is generated for the first time in production. Uses a persistent Redis
 * marker key for deduplication (365-day TTL).
 *
 * Fire-and-forget: called with `void` from the badge route — never blocks
 * SVG rendering, never throws.
 */

import { getResend, escapeHtml } from "./resend";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";
import { scoringObservation } from "@/lib/history/scoring-observations";
import { withTimeout, EMAIL_SEND_TIMEOUT_MS } from "@/lib/async/with-timeout";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { getBaseUrl, getVercelEnv, getSupportForwardEmail } from "@/lib/env";

const MARKER_TTL = 31_536_000; // 365 days in seconds

/**
 * #1335 phase 5 ("delete v6") — the v6 aggregate HTML template is gone; every
 * badge is now scored by a v7/v7.2 receipt, so the receipt-only plain-text
 * body (previously this function's `scoring.policyVersion !== "v6"` branch)
 * is the only body there is.
 */
export async function notifyFirstBadge(
  handle: string,
  scoring: ScoreViewModel,
): Promise<void> {
  try {
    if (scoring.freshness === "unavailable" || scoring.illustrative) return;
    // 1. Production guard
    if (getVercelEnv() !== "production") return;

    const lowerHandle = handle.toLowerCase();
    const key = `badge:notified:${lowerHandle}`;

    // 2. Dedup check
    const already = await cacheGet<boolean>(key);
    if (already) return;

    // 3. Resend client
    const resend = getResend();
    if (!resend) return;

    // 4. Recipient
    const to = getSupportForwardEmail();
    if (!to) return;

    // 5. Build email
    const baseUrl = getBaseUrl();
    const shareUrl = `${baseUrl}/u/${lowerHandle}`;
    const badgeUrl = `${baseUrl}/u/${lowerHandle}/badge.svg`;

    const observed = scoringObservation(scoring);
    if (!observed || !observed.identity) return;
    const subject = `New badge: ${lowerHandle} — ${observed.tier ?? "Unassigned"} (${observed.policyVersion})`;
    const text = ["CHAPA — New Badge Created", `Handle: ${lowerHandle}`, `Policy: ${observed.policyVersion}`,
      `Score: ${observed.composite.display}`, `Exact score: ${observed.composite.exact}`, `Tier: ${observed.tier ?? "Unassigned"}`,
      `Archetype: ${observed.archetype ?? "Unassigned"}`, ...Object.entries(observed.dimensions).map(([key, point]) => `${key}: ${point.display}`),
      `Craft: ${observed.craft?.display ?? "Unavailable"} (separate from core)`, `Revision: ${observed.identity.revisionId}`,
      `Content hash: ${observed.identity.contentHash}`, `Window: ${observed.window?.startInclusive} to ${observed.window?.endExclusive}`,
      `Profile: ${shareUrl}`, `Badge: ${badgeUrl}`].join("\n");
    const html = `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>`;

    // 6. Send
    const { error } = await withTimeout(
      resend.emails.send({
        from: "Chapa Notifications <notifications@chapa.thecreativetoken.com>",
        to: [to],
        subject,
        html,
        text,
      }),
      EMAIL_SEND_TIMEOUT_MS,
      "notifyFirstBadge",
    );

    if (error) {
      console.error("[email] notifyFirstBadge send failed:", error);
      return;
    }

    // 7. Mark as notified (only after successful send)
    await cacheSet(key, true, MARKER_TTL);
  } catch (error) {
    console.error(
      "[email] notifyFirstBadge error:",
      (error as Error).message,
    );
  }
}
