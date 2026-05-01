import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbGetCampaign } from "@/lib/db/campaigns";
import { buildAnnouncementHtml } from "@/lib/email/templates/announcement";
import { buildEmailContent } from "@/lib/email/campaigns";
import { withErrorCapture } from "@/lib/analytics/server-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withErrorCapture("/api/admin/campaigns/[id]/preview", async (request: NextRequest, ctx) => {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const { id } = await (ctx as RouteParams).params;
  const campaign = await dbGetCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const html = buildAnnouncementHtml(buildEmailContent(campaign, "your-handle"));

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
