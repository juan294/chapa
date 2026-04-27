import { type NextRequest, NextResponse } from "next/server";
import { dbUpdateEmailNotifications, dbGetUserEmail } from "@/lib/db/users";
import { escapeHtml } from "@/lib/utils/escape";
import { markUnsubscribed } from "@/lib/email/audience";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { verifyUnsubscribeToken } from "@/lib/auth/unsubscribe-token";
import { fireAndForget } from "@/lib/async/fire-and-forget";

/**
 * GET /api/notifications/unsubscribe?handle=:handle&token=:token
 *
 * Unsubscribe endpoint linked from score-bump emails.
 * Sets email_notifications=false for the user. Returns a static
 * HTML confirmation page.
 *
 * Security: requires a valid HMAC-signed ownership token to prevent
 * unauthenticated third parties from unsubscribing arbitrary users.
 *
 * Rate limited: 10 requests per IP per 60 seconds.
 * Fail-open: even if the DB update fails, shows the confirmation
 * page so the user isn't confused.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:unsubscribe:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const handle = request.nextUrl.searchParams.get("handle")?.toLowerCase();

  if (!handle) {
    return NextResponse.json(
      { error: "Missing handle parameter" },
      { status: 400 },
    );
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  const secret = process.env.NEXTAUTH_SECRET?.trim() ?? "";

  if (!verifyUnsubscribeToken(handle, token, secret)) {
    return NextResponse.json(
      { error: "Invalid or missing unsubscribe token" },
      { status: 401 },
    );
  }

  // Best-effort DB update + Resend sync — fail-open for UX
  const [emailInfo] = await Promise.all([
    dbGetUserEmail(handle).catch(() => null),
    dbUpdateEmailNotifications(handle, false).catch((error: Error) => {
      console.error(
        "[unsubscribe] failed to update preferences:",
        error.message,
      );
    }),
  ]);

  // Sync unsubscribe to Resend (fire-and-forget)
  if (emailInfo?.email) {
    fireAndForget(() => markUnsubscribed(emailInfo.email), () => undefined);
  }

  // Return a simple confirmation page
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed — Chapa</title>
  <style>
    body { margin:0; padding:0; background:#0A0A0F; color:#E2E4E9; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#111118; border:1px solid rgba(139,92,246,0.15); border-radius:12px; padding:48px 40px; text-align:center; max-width:420px; }
    h1 { font-family:'Courier New',monospace; font-size:24px; color:#8B5CF6; margin:0 0 16px; }
    p { font-size:15px; color:#9AA4B2; margin:0 0 24px; line-height:1.6; }
    .handle { color:#8B5CF6; font-weight:600; }
    a { color:#8B5CF6; text-decoration:none; }
    a:hover { text-decoration:underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribed</h1>
    <p>
      <span class="handle">@${escapeHtml(handle)}</span> will no longer receive
      score update emails from Chapa.
    </p>
    <a href="/">← Back to Chapa</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
