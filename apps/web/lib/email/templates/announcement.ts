/**
 * Announcement email template — developer-aesthetic dark theme.
 *
 * Matches the Chapa website design: dark background, JetBrains Mono headings,
 * Plus Jakarta Sans body, purple accent. Minimal, mostly text, no images.
 */

import { escapeHtml } from "@/lib/email/resend";
import { featureRow } from "@/lib/email/html-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnnouncementData {
  handle: string;
  headline: string;
  bodyText: string;
  features: { text: string }[];
  ctaText: string;
  ctaUrl: string;
  previewText?: string;
}

// ---------------------------------------------------------------------------
// Base URL helper
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    "https://chapa.thecreativetoken.com"
  );
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

export function buildAnnouncementHtml(data: AnnouncementData): string {
  const handle = escapeHtml(data.handle);
  const headline = escapeHtml(data.headline);
  const bodyParagraphs = data.bodyText
    .split(/\n\n+/)
    .map((p) => escapeHtml(p.trim()))
    .filter(Boolean);
  const ctaText = escapeHtml(data.ctaText);
  const ctaUrl = escapeHtml(data.ctaUrl);
  const baseUrl = getBaseUrl();
  const unsubscribeUrl = escapeHtml(
    `${baseUrl}/api/notifications/unsubscribe?handle=${data.handle}`,
  );
  const previewText = data.previewText
    ? escapeHtml(data.previewText)
    : undefined;

  const featureRows = data.features
    .map((f) => featureRow(escapeHtml(f.text), 20))
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${previewText ? `<meta name="description" content="${previewText}">` : ""}
  <!--[if !mso]><!-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : ""}

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
            Hey @${handle},
          </span>
        </td></tr>

        <!-- Headline -->
        <tr><td style="padding-bottom:16px;">
          <h1 style="margin:0;font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:#E2E4E9;line-height:1.3;">
            ${headline}
          </h1>
        </td></tr>

        <!-- Body -->
        ${bodyParagraphs.map((p, i) => {
          const divider = `<tr><td style="padding-bottom:16px;"><div style="height:1px;background:rgba(139,92,246,0.40);"></div></td></tr>`;
          let rows = "";
          if (bodyParagraphs.length > 1 && i === 0) rows += divider;
          rows += `<tr><td style="padding-bottom:16px;">
          <p style="margin:0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#8B8FA0;line-height:1.6;">
            ${p}
          </p>
        </td></tr>`;
          if (bodyParagraphs.length > 1 && i === 0) rows += divider;
          return rows;
        }).join("\n        ")}

        <!-- Feature bullets -->
        ${featureRows}

        <!-- CTA -->
        <tr><td style="padding-top:24px;padding-bottom:32px;">
          <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;background:#8B5CF6;color:#FFFFFF;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            ${ctaText}
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
// Plain text template
// ---------------------------------------------------------------------------

export function buildAnnouncementText(data: AnnouncementData): string {
  const baseUrl = getBaseUrl();
  const lines = [
    "CHAPA",
    "\u2500\u2500\u2500\u2500\u2500",
    "",
    `Hey @${data.handle},`,
    "",
    data.headline,
    "",
    data.bodyText,
    "",
    ...data.features.map((f) => `\u2192 ${f.text}`),
    "",
    `${data.ctaText}: ${data.ctaUrl}`,
    "",
    "\u2500\u2500\u2500\u2500\u2500",
    "chapa.thecreativetoken.com",
    `Unsubscribe: ${baseUrl}/api/notifications/unsubscribe?handle=${data.handle}`,
  ];
  return lines.join("\n");
}
