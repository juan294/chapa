/**
 * Score-bump email notification.
 *
 * Sends a branded email to a developer when their Impact score increases
 * significantly, their tier changes, or their archetype changes.
 *
 * Guards:
 *   1. SCORE_NOTIFICATIONS_ENABLED env var must be "true"
 *   2. User must have an email on file with notifications enabled
 *   3. Redis dedup marker (7-day TTL) prevents spam
 *
 * Fire-and-forget: called with `void` from the cron — never blocks,
 * never throws.
 */

import type { SnapshotDiff } from "@/lib/history/diff";
import type { SignificantChange } from "@/lib/history/significant-change";
import { getResend, escapeHtml } from "./resend";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { dbGetUserEmail } from "@/lib/db/users";
import { getBaseUrl } from "@/lib/env";

const DEDUP_TTL = 604_800; // 7 days in seconds

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function notifyScoreBump(
  handle: string,
  diff: SnapshotDiff,
  significance: SignificantChange,
): Promise<void> {
  try {
    // 1. Feature flag guard
    if (process.env.SCORE_NOTIFICATIONS_ENABLED?.trim() !== "true") return;

    const lowerHandle = handle.toLowerCase();

    // 2. Check user email + preferences
    const userEmail = await dbGetUserEmail(lowerHandle);
    if (!userEmail || !userEmail.emailNotifications) return;

    // 3. Dedup check (max 1 per 7 days)
    const dedupKey = `score-bump:${lowerHandle}`;
    const already = await cacheGet<boolean>(dedupKey);
    if (already) return;

    // 4. Resend client
    const resend = getResend();
    if (!resend) return;

    // 5. Build email
    const baseUrl = getBaseUrl();
    const shareUrl = `${baseUrl}/u/${lowerHandle}`;
    const unsubscribeUrl = `${baseUrl}/api/notifications/unsubscribe?handle=${lowerHandle}`;

    const subject = buildSubject(lowerHandle, diff, significance);
    const html = buildHtml({
      handle: lowerHandle,
      diff,
      significance,
      shareUrl,
      unsubscribeUrl,
    });
    const text = buildText({
      handle: lowerHandle,
      diff,
      significance,
      shareUrl,
      unsubscribeUrl,
    });

    // 6. Send
    const { error } = await resend.emails.send({
      from: "Chapa <notifications@chapa.thecreativetoken.com>",
      to: [userEmail.email],
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[email] notifyScoreBump send failed:", error);
      return;
    }

    // 7. Set dedup marker (only after successful send)
    await cacheSet(dedupKey, true, DEDUP_TTL);
  } catch (error) {
    console.error(
      "[email] notifyScoreBump error:",
      (error as Error).message,
    );
  }
}

// ---------------------------------------------------------------------------
// Subject line
// ---------------------------------------------------------------------------

function buildSubject(
  handle: string,
  diff: SnapshotDiff,
  significance: SignificantChange,
): string {
  switch (significance.reason) {
    case "tier_change":
      return `${handle}: ${diff.tier!.from} → ${diff.tier!.to} tier`;
    case "archetype_change":
      return `${handle}: ${diff.archetype!.from} → ${diff.archetype!.to}`;
    case "score_bump":
      return `${handle}: Impact score +${Math.round(diff.adjustedComposite)} points`;
  }
}

// ---------------------------------------------------------------------------
// Plain text template
// ---------------------------------------------------------------------------

interface TemplateData {
  handle: string;
  diff: SnapshotDiff;
  significance: SignificantChange;
  shareUrl: string;
  unsubscribeUrl: string;
}

function buildText(data: TemplateData): string {
  const { handle, diff, significance, shareUrl, unsubscribeUrl } = data;
  const lines: string[] = [];

  lines.push("CHAPA — Score Update");
  lines.push("═".repeat(40));
  lines.push("");

  // Headline
  switch (significance.reason) {
    case "tier_change":
      lines.push(`You leveled up! ${diff.tier!.from} → ${diff.tier!.to}`);
      break;
    case "archetype_change":
      lines.push(
        `Your profile evolved: ${diff.archetype!.from} → ${diff.archetype!.to}`,
      );
      break;
    case "score_bump":
      lines.push(
        `Your Impact score just jumped +${Math.round(diff.adjustedComposite)} points!`,
      );
      break;
  }

  lines.push("");
  lines.push(`Handle:    @${handle}`);
  lines.push(`Score:     +${Math.round(diff.adjustedComposite)} points`);

  if (diff.tier) {
    lines.push(`Tier:      ${diff.tier.from} → ${diff.tier.to}`);
  }
  if (diff.archetype) {
    lines.push(`Archetype: ${diff.archetype.from} → ${diff.archetype.to}`);
  }

  lines.push("");
  lines.push("Dimension changes:");
  if (diff.dimensions.building !== 0)
    lines.push(`  Building:    ${formatDelta(diff.dimensions.building)}`);
  if (diff.dimensions.guarding !== 0)
    lines.push(`  Guarding:    ${formatDelta(diff.dimensions.guarding)}`);
  if (diff.dimensions.consistency !== 0)
    lines.push(`  Consistency: ${formatDelta(diff.dimensions.consistency)}`);
  if (diff.dimensions.breadth !== 0)
    lines.push(`  Breadth:     ${formatDelta(diff.dimensions.breadth)}`);

  lines.push("");
  lines.push(`View your badge: ${shareUrl}`);
  lines.push("");
  lines.push("─".repeat(40));
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function buildHtml(data: TemplateData): string {
  const { handle, diff, significance, shareUrl, unsubscribeUrl } = data;
  const safeHandle = escapeHtml(handle);

  let headline: string;
  let headlineColor: string;

  switch (significance.reason) {
    case "tier_change":
      headline = `You leveled up! ${escapeHtml(diff.tier!.from)} → ${escapeHtml(diff.tier!.to)}`;
      headlineColor = "#4ADE80"; // terminal green
      break;
    case "archetype_change":
      headline = `Your profile evolved: ${escapeHtml(diff.archetype!.from)} → ${escapeHtml(diff.archetype!.to)}`;
      headlineColor = "#7C6AEF"; // brand purple
      break;
    case "score_bump":
      headline = `Your Impact score just jumped +${Math.round(diff.adjustedComposite)} points!`;
      headlineColor = "#7C6AEF";
      break;
  }

  // Build change details rows
  const changeRows: string[] = [];
  if (diff.tier) {
    changeRows.push(changeRow("Tier", diff.tier.from, diff.tier.to, "#4ADE80"));
  }
  if (diff.archetype) {
    changeRows.push(
      changeRow("Archetype", diff.archetype.from, diff.archetype.to, "#7C6AEF"),
    );
  }

  // Dimension deltas
  const dims = [
    { label: "Building", delta: diff.dimensions.building },
    { label: "Guarding", delta: diff.dimensions.guarding },
    { label: "Consistency", delta: diff.dimensions.consistency },
    { label: "Breadth", delta: diff.dimensions.breadth },
  ].filter((d) => d.delta !== 0);

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
              <td align="right" style="font-size:13px;color:rgba(255,255,255,0.8);">Score Update</td>
            </tr>
          </table>
        </td></tr>

        <!-- Main content -->
        <tr><td style="padding:32px;">

          <!-- Headline -->
          <div style="font-size:20px;font-weight:700;color:${headlineColor};margin-bottom:8px;">${headline}</div>
          <div style="font-size:14px;color:#6B6F7B;margin-bottom:24px;">@${safeHandle}</div>

          <!-- Score delta card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;border-radius:8px;border:1px solid rgba(124,106,239,0.10);margin-bottom:24px;">
            <tr>
              <td align="center" style="padding:20px;">
                <div style="font-size:36px;font-weight:700;color:#4ADE80;">+${Math.round(diff.adjustedComposite)}</div>
                <div style="font-size:11px;color:#6B6F7B;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Points</div>
              </td>
            </tr>
          </table>

          ${changeRows.length > 0 ? `
          <!-- Categorical changes -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${changeRows.join("")}
          </table>
          ` : ""}

          ${dims.length > 0 ? `
          <!-- Dimension changes -->
          <div style="font-size:12px;color:#6B6F7B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Dimension Changes</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${dims.map((d) => dimensionDeltaRow(d.label, d.delta)).join("")}
          </table>
          ` : ""}

          <!-- CTA button -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
              <td align="center">
                <a href="${shareUrl}" style="display:inline-block;background:#7C6AEF;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">View Your Updated Badge</a>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(124,106,239,0.10);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:11px;color:#3A3A4A;">chapa.thecreativetoken.com</td>
              <td align="right"><a href="${unsubscribeUrl}" style="font-size:11px;color:#3A3A4A;text-decoration:underline;">Unsubscribe</a></td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// HTML helper functions
// ---------------------------------------------------------------------------

function changeRow(
  label: string,
  from: string,
  to: string,
  accentColor: string,
): string {
  return `
    <tr>
      <td style="padding:8px 0;">
        <span style="font-size:12px;color:#6B6F7B;text-transform:uppercase;letter-spacing:1px;">${label}</span>
        <div style="margin-top:4px;">
          <span style="font-size:14px;color:#9AA4B2;">${escapeHtml(from)}</span>
          <span style="font-size:14px;color:#6B6F7B;"> → </span>
          <span style="font-size:14px;font-weight:600;color:${accentColor};">${escapeHtml(to)}</span>
        </div>
      </td>
    </tr>`;
}

function dimensionDeltaRow(label: string, delta: number): string {
  const color = delta > 0 ? "#4ADE80" : "#F87171";
  const sign = delta > 0 ? "+" : "";
  return `
    <tr>
      <td style="padding:4px 12px 4px 0;color:#9AA4B2;font-size:13px;white-space:nowrap;">${label}</td>
      <td style="padding:4px 0;text-align:right;">
        <span style="font-size:13px;font-weight:600;color:${color};">${sign}${Math.round(delta)}</span>
      </td>
    </tr>`;
}

function formatDelta(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n)}`;
}
