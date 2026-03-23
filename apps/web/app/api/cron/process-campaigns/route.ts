import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { dbGetCampaigns } from "@/lib/db/campaigns";
import { processCampaignBatch } from "@/lib/email/campaigns";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = verifyCronSecret(request);
  if (denied) return denied;

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
