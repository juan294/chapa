import "server-only";

import { withTimeout, EMAIL_SEND_TIMEOUT_MS } from "@/lib/async/with-timeout";
import { getBaseUrl, getSupportForwardEmail } from "@/lib/env";
import { escapeHtml } from "@/lib/utils/escape";
import { getResend } from "./resend";

export async function sendChallengeEmail(
  handle: string,
  reason: string,
): Promise<{ success: boolean }> {
  try {
    const resend = getResend();
    if (!resend) return { success: false };

    const to = getSupportForwardEmail();
    if (!to) return { success: false };

    const lowerHandle = handle.toLowerCase();
    const shareUrl = `${getBaseUrl()}/u/${lowerHandle}`;
    const subject = `Score challenge: @${handle}`;
    const text = buildText(handle, reason, shareUrl);
    const html = buildHtml(handle, reason, shareUrl);

    const { error } = await withTimeout(
      resend.emails.send({
        from: "Chapa Support <support@chapa.thecreativetoken.com>",
        to: [to],
        subject,
        html,
        text,
      }),
      EMAIL_SEND_TIMEOUT_MS,
      "sendChallengeEmail",
    );

    if (error) {
      console.error("[email] sendChallengeEmail failed:", error);
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    console.error("[email] sendChallengeEmail error:", (error as Error).message);
    return { success: false };
  }
}

function buildText(handle: string, reason: string, shareUrl: string): string {
  return [
    "CHAPA — Score Challenge",
    "═".repeat(40),
    "",
    `Handle:  @${handle}`,
    `Profile: ${shareUrl}`,
    "",
    "Concern from developer:",
    reason,
    "",
    "---",
    "Sent via 'Something seem off?' in the score explanation panel.",
  ].join("\n");
}

function buildHtml(handle: string, reason: string, shareUrl: string): string {
  const safeHandle = escapeHtml(handle);
  const safeReason = escapeHtml(reason).replace(/\n/g, "<br>");
  const safeShareUrl = escapeHtml(shareUrl);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:12px;border:1px solid rgba(139,92,246,0.15);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#8B5CF6 0%,#7C3AED 100%);padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:2px;">CHAPA</td>
              <td align="right" style="font-size:13px;color:rgba(255,255,255,0.8);">Score Challenge</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="font-size:22px;font-weight:700;color:#E2E4E9;font-family:'Courier New',monospace;margin-bottom:4px;">@${safeHandle}</div>
          <a href="${safeShareUrl}" style="font-size:13px;color:#8B5CF6;">${safeShareUrl}</a>
          <div style="margin-top:24px;padding:16px;background:#0A0A0F;border-radius:8px;border:1px solid rgba(139,92,246,0.10);">
            <div style="font-size:11px;color:#6B6F7B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Developer's concern</div>
            <div style="font-size:14px;color:#E2E4E9;line-height:1.6;">${safeReason}</div>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(139,92,246,0.10);">
          <div style="font-size:11px;color:#3A3A4A;">Sent via 'Something seem off?' in the score explanation panel.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
