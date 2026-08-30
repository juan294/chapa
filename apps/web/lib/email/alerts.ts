/**
 * Operational alert email fallback (#1162 / DO-B1).
 *
 * `captureOperationalAlert` (lib/analytics/server-errors.ts) posts P1/P2
 * operational signals to `CHAPA_ALERT_WEBHOOK_URL` when it's configured. That
 * env var is unset in production, so every signal was silently dropped —
 * six of the nine have no other delivery path. Per project decision, this is
 * NOT a Discord/Slack webhook: it's a plain email via the already-configured
 * Resend client, sent to `SUPPORT_FORWARD_EMAIL` (both already set in
 * production — net config change is zero).
 *
 * Fire-and-forget contract, matching every other function in lib/email/:
 * never throws, always resolves, and the caller decides what "delivery
 * failed" means for the request path (nothing here — alerts never affect a
 * response).
 */

import { getResend } from "./resend";
import { escapeHtml } from "@/lib/utils/escape";
import { withTimeout, EMAIL_SEND_TIMEOUT_MS } from "@/lib/async/with-timeout";
import { getSupportForwardEmail } from "@/lib/env";

export interface AlertEmailPayload {
  source: string;
  timestamp: string;
  signal: string;
  severity: "P1" | "P2" | "P3" | "P4";
  summary: string;
  route?: string;
  properties: Record<string, unknown>;
}

/**
 * Send an operational alert as an email. The caller is responsible for
 * sanitizing `summary`/`properties` before calling this — this function does
 * no additional redaction of its own.
 *
 * @returns `true` if the email was accepted by Resend, `false` on any
 *   failure (unconfigured, send error, or unexpected exception). Never throws.
 */
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) return false;

    const to = getSupportForwardEmail();
    if (!to) return false;

    const subject = `[Chapa ${payload.severity}] ${payload.signal}`;
    const text = buildText(payload);
    const html = buildHtml(payload);

    const { error } = await withTimeout(
      resend.emails.send({
        from: "Chapa Alerts <alerts@chapa.thecreativetoken.com>",
        to: [to],
        subject,
        html,
        text,
      }),
      EMAIL_SEND_TIMEOUT_MS,
      "sendAlertEmail",
    );

    if (error) {
      console.error("[email] sendAlertEmail failed:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[email] sendAlertEmail error:", (error as Error).message);
    return false;
  }
}

function buildText(payload: AlertEmailPayload): string {
  return [
    `CHAPA OPERATIONAL ALERT — ${payload.severity}`,
    "=".repeat(40),
    "",
    `Signal:  ${payload.signal}`,
    `Summary: ${payload.summary}`,
    ...(payload.route ? [`Route:   ${payload.route}`] : []),
    `Time:    ${payload.timestamp}`,
    "",
    "Properties:",
    JSON.stringify(payload.properties, null, 2),
  ].join("\n");
}

function buildHtml(payload: AlertEmailPayload): string {
  const propsJson = escapeHtml(JSON.stringify(payload.properties, null, 2));
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#08170F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#08170F;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0F2419;border-radius:12px;border:1px solid rgba(253,115,109,0.25);overflow:hidden;">
        <tr><td style="background:#7C1D1D;padding:20px 32px;">
          <span style="font-family:'Courier New',monospace;font-size:16px;font-weight:700;color:#FFFFFF;letter-spacing:1px;">CHAPA ALERT &middot; ${escapeHtml(payload.severity)}</span>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <div style="font-size:16px;font-weight:700;color:#DFEAE4;margin-bottom:8px;">${escapeHtml(payload.signal)}</div>
          <div style="font-size:14px;color:#8BA398;margin-bottom:16px;">${escapeHtml(payload.summary)}</div>
          ${payload.route ? `<div style="font-size:12px;color:#6B6F7B;margin-bottom:4px;">Route: ${escapeHtml(payload.route)}</div>` : ""}
          <div style="font-size:12px;color:#6B6F7B;margin-bottom:16px;">Time: ${escapeHtml(payload.timestamp)}</div>
          <pre style="background:#08170F;border-radius:8px;padding:12px;color:#65E7B0;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">${propsJson}</pre>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
