import { type NextRequest, NextResponse } from "next/server";
import { dbUpdateEmailNotifications } from "@/lib/db/users";

/**
 * GET /api/notifications/unsubscribe?handle=:handle
 *
 * Simple unsubscribe endpoint linked from score-bump emails.
 * Sets email_notifications=false for the user. Returns a static
 * HTML confirmation page.
 *
 * Fail-open: even if the DB update fails, shows the confirmation
 * page so the user isn't confused.
 */
export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get("handle")?.toLowerCase();

  if (!handle) {
    return NextResponse.json(
      { error: "Missing handle parameter" },
      { status: 400 },
    );
  }

  // Best-effort DB update — fail-open for UX
  try {
    await dbUpdateEmailNotifications(handle, false);
  } catch (error) {
    console.error(
      "[unsubscribe] failed to update preferences:",
      (error as Error).message,
    );
  }

  // Return a simple confirmation page
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed — Chapa</title>
  <style>
    body { margin:0; padding:0; background:#0A0A0F; color:#E2E4E9; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#111118; border:1px solid rgba(124,106,239,0.15); border-radius:12px; padding:48px 40px; text-align:center; max-width:420px; }
    h1 { font-family:'Courier New',monospace; font-size:24px; color:#7C6AEF; margin:0 0 16px; }
    p { font-size:15px; color:#9AA4B2; margin:0 0 24px; line-height:1.6; }
    .handle { color:#7C6AEF; font-weight:600; }
    a { color:#7C6AEF; text-decoration:none; }
    a:hover { text-decoration:underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribed</h1>
    <p>
      <span class="handle">@${handle}</span> will no longer receive
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
