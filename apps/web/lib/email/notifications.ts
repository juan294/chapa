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
import { getBaseUrl } from "@/lib/env";

const MARKER_TTL = 31_536_000; // 365 days in seconds

export async function notifyFirstBadge(
  handle: string,
  impact: ImpactV4Result,
): Promise<void> {
  try {
    // 1. Production guard
    if (process.env.VERCEL_ENV !== "production") return;

    const lowerHandle = handle.toLowerCase();
    const key = `badge:notified:${lowerHandle}`;

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
    const baseUrl = getBaseUrl();
    const shareUrl = `${baseUrl}/u/${lowerHandle}`;
    const badgeUrl = `${baseUrl}/u/${lowerHandle}/badge.svg`;
    const subject = `New badge: ${lowerHandle} — ${impact.archetype} (${impact.tier})`;
    const { dimensions } = impact;

    const html = buildHtml({
      handle: lowerHandle,
      archetype: impact.archetype,
      compositeScore: impact.compositeScore,
      adjustedComposite: impact.adjustedComposite,
      tier: impact.tier,
      confidence: impact.confidence,
      dimensions,
      shareUrl,
      badgeUrl,
      computedAt: impact.computedAt,
    });

    const text = [
      "CHAPA — New Badge Created",
      "═".repeat(40),
      "",
      `Handle:      ${lowerHandle}`,
      `Archetype:   ${impact.archetype}`,
      `Tier:        ${impact.tier}`,
      "",
      `Composite:   ${impact.compositeScore}`,
      `Adjusted:    ${impact.adjustedComposite}`,
      `Confidence:  ${impact.confidence}%`,
      "",
      "Dimensions:",
      `  Building:    ${dimensions.building}`,
      `  Guarding:    ${dimensions.guarding}`,
      `  Consistency: ${dimensions.consistency}`,
      `  Breadth:     ${dimensions.breadth}`,
      "",
      `Profile: ${shareUrl}`,
      `Badge:   ${badgeUrl}`,
      "",
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

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

interface EmailData {
  handle: string;
  archetype: string;
  compositeScore: number;
  adjustedComposite: number;
  tier: string;
  confidence: number;
  dimensions: { building: number; guarding: number; consistency: number; breadth: number };
  shareUrl: string;
  badgeUrl: string;
  computedAt: string;
}

function dimensionBar(label: string, value: number): string {
  const pct = Math.min(100, Math.max(0, value));
  return `
    <tr>
      <td style="padding:4px 12px 4px 0;color:#9AA4B2;font-size:13px;white-space:nowrap;">${label}</td>
      <td style="padding:4px 0;width:100%;">
        <div style="background:#1A1A2E;border-radius:4px;height:8px;width:100%;overflow:hidden;">
          <div style="background:#7C6AEF;height:8px;border-radius:4px;width:${pct}%;"></div>
        </div>
      </td>
      <td style="padding:4px 0 4px 8px;color:#E2E4E9;font-size:13px;font-weight:600;text-align:right;">${value}</td>
    </tr>`;
}

function buildHtml(data: EmailData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:12px;border:1px solid rgba(124,106,239,0.15);overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#7C6AEF 0%,#5E4FCC 100%);padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:2px;">CHAPA</td>
              <td align="right" style="font-size:13px;color:rgba(255,255,255,0.8);">New Badge Created</td>
            </tr>
          </table>
        </td></tr>

        <!-- Main content -->
        <tr><td style="padding:32px;">

          <!-- Handle + archetype -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td>
                <div style="font-size:22px;font-weight:700;color:#E2E4E9;font-family:'Courier New',monospace;">@${data.handle}</div>
                <div style="font-size:14px;color:#7C6AEF;margin-top:4px;font-weight:600;">${data.archetype} &middot; ${data.tier} Tier</div>
              </td>
            </tr>
          </table>

          <!-- Score card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;border-radius:8px;border:1px solid rgba(124,106,239,0.10);margin-bottom:24px;">
            <tr>
              <td align="center" style="padding:16px;border-right:1px solid rgba(124,106,239,0.10);">
                <div style="font-size:28px;font-weight:700;color:#7C6AEF;">${data.adjustedComposite}</div>
                <div style="font-size:11px;color:#6B6F7B;text-transform:uppercase;letter-spacing:1px;">Adjusted</div>
              </td>
              <td align="center" style="padding:16px;border-right:1px solid rgba(124,106,239,0.10);">
                <div style="font-size:28px;font-weight:700;color:#E2E4E9;">${data.compositeScore}</div>
                <div style="font-size:11px;color:#6B6F7B;text-transform:uppercase;letter-spacing:1px;">Composite</div>
              </td>
              <td align="center" style="padding:16px;">
                <div style="font-size:28px;font-weight:700;color:#4ADE80;">${data.confidence}%</div>
                <div style="font-size:11px;color:#6B6F7B;text-transform:uppercase;letter-spacing:1px;">Confidence</div>
              </td>
            </tr>
          </table>

          <!-- Dimensions -->
          <div style="font-size:12px;color:#6B6F7B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Dimensions</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${dimensionBar("Building", data.dimensions.building)}
            ${dimensionBar("Guarding", data.dimensions.guarding)}
            ${dimensionBar("Consistency", data.dimensions.consistency)}
            ${dimensionBar("Breadth", data.dimensions.breadth)}
          </table>

          <!-- CTA buttons -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
              <td align="center" style="padding:0 4px 0 0;">
                <a href="${data.shareUrl}" style="display:block;background:#7C6AEF;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-align:center;">View Profile</a>
              </td>
              <td align="center" style="padding:0 0 0 4px;">
                <a href="${data.badgeUrl}" style="display:block;background:#1A1A2E;color:#9D8FFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-align:center;border:1px solid rgba(124,106,239,0.20);">View Badge SVG</a>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(124,106,239,0.10);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:11px;color:#3A3A4A;">Computed at ${data.computedAt}</td>
              <td align="right" style="font-size:11px;color:#3A3A4A;">chapa.thecreativetoken.com</td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
