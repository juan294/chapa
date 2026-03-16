import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { dbGetCampaigns } from "@/lib/db/campaigns";
import { processCampaignBatch } from "@/lib/email/campaigns";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find active campaigns (filter at DB level)
  const active = await dbGetCampaigns("sending");

  if (active.length === 0) {
    return NextResponse.json({
      status: "idle",
      message: "No active campaigns",
    });
  }

  // Process first active campaign (one at a time to respect daily limits)
  const campaign = active[0]!;
  const result = await processCampaignBatch(campaign.id);

  return NextResponse.json({
    status: "ok",
    campaignId: campaign.id,
    campaignName: campaign.name,
    ...result,
  });
}
