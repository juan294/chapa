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

import type { ImpactV4Result } from "@chapa/shared";
import { getResend } from "./resend";
import { cacheGet, cacheSet } from "@/lib/cache/redis";

const MARKER_TTL = 31_536_000; // 365 days in seconds

export async function notifyFirstBadge(
  handle: string,
  impact: ImpactV4Result,
): Promise<void> {
  try {
    // 1. Production guard
    if (process.env.VERCEL_ENV !== "production") return;

    const key = `badge:notified:${handle.toLowerCase()}`;

    // 2. Dedup check
    const already = await cacheGet<boolean>(key);
    if (already) return;

    // 3. Resend client
    const resend = getResend();
    if (!resend) return;

    // 4. Recipient
    const to = process.env.SUPPORT_FORWARD_EMAIL?.trim();
    if (!to) return;

    // 5. Build email
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
      "https://chapa.thecreativetoken.com";
    const shareUrl = `${baseUrl}/u/${handle.toLowerCase()}`;
    const subject = `New badge: ${handle.toLowerCase()} — ${impact.archetype} (${impact.tier})`;

    const html = [
      `<h2>New Chapa Badge Created</h2>`,
      `<p><strong>Handle:</strong> ${handle.toLowerCase()}</p>`,
      `<p><strong>Archetype:</strong> ${impact.archetype}</p>`,
      `<p><strong>Composite Score:</strong> ${impact.compositeScore}</p>`,
      `<p><strong>Adjusted Score:</strong> ${impact.adjustedComposite}</p>`,
      `<p><strong>Tier:</strong> ${impact.tier}</p>`,
      `<p><strong>Confidence:</strong> ${impact.confidence}%</p>`,
      `<p><strong>Profile:</strong> <a href="${shareUrl}">${shareUrl}</a></p>`,
      `<p><strong>Computed at:</strong> ${impact.computedAt}</p>`,
    ].join("\n");

    const text = [
      "New Chapa Badge Created",
      "",
      `Handle: ${handle.toLowerCase()}`,
      `Archetype: ${impact.archetype}`,
      `Composite Score: ${impact.compositeScore}`,
      `Adjusted Score: ${impact.adjustedComposite}`,
      `Tier: ${impact.tier}`,
      `Confidence: ${impact.confidence}%`,
      `Profile: ${shareUrl}`,
      `Computed at: ${impact.computedAt}`,
    ].join("\n");

    // 6. Send
    const { error } = await resend.emails.send({
      from: "Chapa Notifications <notifications@chapa.thecreativetoken.com>",
      to: [to],
      subject,
      html,
      text,
    });

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
