/**
 * Score-bump email notification.
 *
 * Sends a branded email to a developer when their Impact score increases
 * significantly, their tier changes, or their archetype changes.
 *
 * Guards:
 *   1. `score_notifications` feature flag must be enabled in Supabase
 *   2. User must have an email on file with notifications enabled
 *   3. Redis dedup marker (7-day TTL) prevents spam
 *
 * Fire-and-forget: called with `void` from the cron — never blocks,
 * never throws.
 */

import type { SnapshotDiff } from "@/lib/history/diff";
import type { SignificantChange } from "@/lib/history/significant-change";
import { getResend, escapeHtml } from "./resend";
import { EMAIL_FROM, buildEmailContent } from "./campaigns";
import {
  buildAnnouncementHtml,
  buildAnnouncementText,
} from "./templates/announcement";
import { featureRow } from "./html-helpers";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { dbGetUserEmail } from "@/lib/db/users";
import { dbGetFeatureFlag } from "@/lib/db/feature-flags";
import { dbGetActiveEngagementCampaign } from "@/lib/db/campaigns";
import { getBaseUrl } from "@/lib/env";

const DEDUP_TTL = 604_800; // 7 days in seconds

// ---------------------------------------------------------------------------
// Interpolation helper
// ---------------------------------------------------------------------------

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key as string] ?? "");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function notifyScoreBump(
  handle: string,
  diff: SnapshotDiff,
  significance: SignificantChange,
): Promise<void> {
  try {
    // 1. Feature flag guard (DB-backed, fail-closed)
    const flag = await dbGetFeatureFlag("score_notifications");
    if (!flag?.enabled) return;

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

    // 4b. Check for DB-backed engagement campaign template
    const engagementCampaign = await dbGetActiveEngagementCampaign();

    // 5. Build email
    const baseUrl = getBaseUrl();
    const shareUrl = `${baseUrl}/u/${lowerHandle}`;
    const unsubscribeUrl = `${baseUrl}/api/notifications/unsubscribe?handle=${lowerHandle}`;

    let subject: string;
    let html: string;
    let text: string;

    if (engagementCampaign) {
      // DB-backed engagement template with variable interpolation
      const delta = `+${Math.round(diff.adjustedComposite)}`;
      const vars: Record<string, string> = {
        handle: lowerHandle,
        delta,
        tier_from: diff.tier?.from ?? "",
        tier_to: diff.tier?.to ?? "",
        archetype_from: diff.archetype?.from ?? "",
        archetype_to: diff.archetype?.to ?? "",
      };

      const interpolatedCampaign = {
        ...engagementCampaign,
        subject: interpolate(engagementCampaign.subject, vars),
        headline: interpolate(engagementCampaign.headline, vars),
        bodyText: interpolate(engagementCampaign.bodyText, vars),
      };

      subject = interpolatedCampaign.subject;
      const content = buildEmailContent(interpolatedCampaign, lowerHandle);
      html = buildAnnouncementHtml(content);
      text = buildAnnouncementText(content);
    } else {
      // Fallback to hardcoded templates
      subject = buildSubject(lowerHandle, diff, significance);
      html = buildHtml({
        handle: lowerHandle,
        diff,
        significance,
        shareUrl,
        unsubscribeUrl,
      });
      text = buildText({
        handle: lowerHandle,
        diff,
        significance,
        shareUrl,
        unsubscribeUrl,
      });
    }

    // 6. Send
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
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
  const delta = `+${Math.round(diff.adjustedComposite)}`;
  switch (significance.reason) {
    case "tier_change":
      return `Your Profile Just Leveled Up — Impact ${delta} (${diff.tier!.from} → ${diff.tier!.to})`;
    case "archetype_change":
      return `${handle}: ${diff.archetype!.from} → ${diff.archetype!.to} — Impact ${delta}`;
    case "score_bump":
      return `${handle}: Impact score ${delta} points`;
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

  lines.push("CHAPA");
  lines.push("\u2500".repeat(40));
  lines.push("");

  lines.push(`Hey @${handle},`);
  lines.push("");

  // Headline
  switch (significance.reason) {
    case "tier_change":
      lines.push(
        `Your Profile Just Leveled Up! ${diff.tier!.from} \u2192 ${diff.tier!.to} (+${Math.round(diff.adjustedComposite)} points)`,
      );
      break;
    case "archetype_change":
      lines.push(
        `Your profile evolved: ${diff.archetype!.from} \u2192 ${diff.archetype!.to} (+${Math.round(diff.adjustedComposite)} points)`,
      );
      break;
    case "score_bump":
      lines.push(
        `Your Impact score just jumped +${Math.round(diff.adjustedComposite)} points!`,
      );
      break;
  }

  lines.push("");

  if (diff.tier) {
    lines.push(`\u2192 Tier: ${diff.tier.from} \u2192 ${diff.tier.to}`);
  }
  if (diff.archetype) {
    lines.push(
      `\u2192 Archetype: ${diff.archetype.from} \u2192 ${diff.archetype.to}`,
    );
  }

  // Dimension deltas
  const dims = [
    { label: "Delivery", delta: diff.dimensions.delivery },
    { label: "Quality", delta: diff.dimensions.quality },
    { label: "Consistency", delta: diff.dimensions.consistency },
    { label: "Breadth", delta: diff.dimensions.breadth },
  ].filter((d) => d.delta !== 0);

  if (dims.length > 0) {
    lines.push("");
    for (const d of dims) {
      lines.push(`\u2192 ${d.label}: ${formatDelta(d.delta)}`);
    }
  }

  lines.push("");
  lines.push(`View your badge: ${shareUrl}`);
  lines.push("");
  lines.push("\u2500".repeat(40));
  lines.push("chapa.thecreativetoken.com");
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// HTML template — unified with announcement design
// ---------------------------------------------------------------------------

function buildHtml(data: TemplateData): string {
  const { handle, diff, significance, shareUrl, unsubscribeUrl } = data;
  const safeHandle = escapeHtml(handle);
  const delta = Math.round(diff.adjustedComposite);

  let headline: string;
  switch (significance.reason) {
    case "tier_change":
      headline = "Your Profile Just Leveled Up!";
      break;
    case "archetype_change":
      headline = `Your profile evolved: ${escapeHtml(diff.archetype!.from)} &rarr; ${escapeHtml(diff.archetype!.to)}`;
      break;
    case "score_bump":
      headline = `Your Impact score just jumped +${delta} points!`;
      break;
  }

  // Build feature-style rows for changes
  const changeItems: string[] = [];

  changeItems.push(featureRow(`Impact score: +${delta} points`));

  if (diff.tier) {
    changeItems.push(
      featureRow(
        `Tier: ${escapeHtml(diff.tier.from)} &rarr; ${escapeHtml(diff.tier.to)}`,
      ),
    );
  }
  if (diff.archetype) {
    changeItems.push(
      featureRow(
        `Archetype: ${escapeHtml(diff.archetype.from)} &rarr; ${escapeHtml(diff.archetype.to)}`,
      ),
    );
  }

  // Dimension deltas
  const dims = [
    { label: "Delivery", delta: diff.dimensions.delivery },
    { label: "Quality", delta: diff.dimensions.quality },
    { label: "Consistency", delta: diff.dimensions.consistency },
    { label: "Breadth", delta: diff.dimensions.breadth },
  ].filter((d) => d.delta !== 0);

  for (const d of dims) {
    const sign = d.delta > 0 ? "+" : "";
    changeItems.push(featureRow(`${d.label}: ${sign}${Math.round(d.delta)}`));
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if !mso]><!-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Logo -->
        <tr><td style="padding-bottom:24px;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:#8B5CF6;letter-spacing:0.05em;">
            CHAPA_
          </span>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding-bottom:32px;">
          <div style="height:1px;background:rgba(139,92,246,0.15);"></div>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding-bottom:16px;">
          <span style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#8B8FA0;">
            Hey @${safeHandle},
          </span>
        </td></tr>

        <!-- Headline -->
        <tr><td style="padding-bottom:16px;">
          <h1 style="margin:0;font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:#E2E4E9;line-height:1.3;">
            ${headline}
          </h1>
        </td></tr>

        <!-- Score delta highlight -->
        <tr><td style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0" style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.20);border-radius:8px;">
            <tr>
              <td style="padding:16px 24px;text-align:center;">
                <span style="font-family:'JetBrains Mono',monospace;font-size:32px;font-weight:700;color:#4ADE80;">+${delta}</span>
                <span style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#8B8FA0;padding-left:8px;">points</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Change details -->
        ${changeItems.join("")}

        <!-- CTA -->
        <tr><td style="padding-top:24px;padding-bottom:32px;">
          <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;background:#8B5CF6;color:#FFFFFF;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            View Your Updated Badge
          </a>
        </td></tr>

        <!-- Footer divider -->
        <tr><td style="padding-bottom:16px;">
          <div style="height:1px;background:rgba(139,92,246,0.10);"></div>
        </td></tr>

        <!-- Footer -->
        <tr><td>
          <span style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#4A4A5E;">
            chapa.thecreativetoken.com
          </span>
          <span style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#4A4A5E;padding-left:12px;">
            &middot;
          </span>
          <a href="${unsubscribeUrl}" style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#4A4A5E;text-decoration:underline;padding-left:12px;">
            Unsubscribe
          </a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDelta(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n)}`;
}
