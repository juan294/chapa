import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { dbGetCampaigns } from "@/lib/db/campaigns";
import { processCampaignBatch } from "@/lib/email/campaigns";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { cacheSet } from "@/lib/cache/redis";

export const maxDuration = 300;
const HEARTBEAT_KEY = "cron:lastrun:process-campaigns";
const HEARTBEAT_TTL_SECONDS = 60 * 60 * 48;

export const GET = withErrorCapture("/api/cron/process-campaigns", async (request: NextRequest) => {
  const denied = verifyCronSecret(request);
  if (denied) return denied;

  // Find active campaigns (filter at DB level)
  const active = await dbGetCampaigns("sending");

  if (active.length === 0) {
    await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SECONDS);
    return NextResponse.json({
      status: "idle",
      message: "No active campaigns",
    });
  }

  // Process first active campaign (one at a time to respect daily limits)
  const campaign = active[0]!;
  const result = await processCampaignBatch(campaign.id);

  await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SECONDS);

  return NextResponse.json({
    status: "ok",
    campaignId: campaign.id,
    campaignName: campaign.name,
    ...result,
  });
});
