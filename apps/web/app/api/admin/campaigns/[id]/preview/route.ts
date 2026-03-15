import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { dbGetCampaign } from "@/lib/db/campaigns";
import { buildAnnouncementHtml } from "@/lib/email/templates/announcement";
import { buildEmailContent } from "@/lib/email/campaigns";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-campaigns:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = readSessionCookie(
    request.headers.get("cookie"),
    sessionSecret,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminHandle(session.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const campaign = await dbGetCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const html = buildAnnouncementHtml(buildEmailContent(campaign, "your-handle"));

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
