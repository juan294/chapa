import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbGetCampaign } from "@/lib/db/campaigns";
import { buildAnnouncementHtml } from "@/lib/email/templates/announcement";
import { buildEmailContent } from "@/lib/email/campaigns";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authError = await adminAuth(request);
  if (authError) return authError;

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
