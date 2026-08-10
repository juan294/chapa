import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbGetCampaign } from "@/lib/db/campaigns";
import {
  initiateCampaign,
  processCampaignBatch,
  DAILY_SEND_LIMIT,
} from "@/lib/email/campaigns";
import { withErrorCapture } from "@/lib/analytics/server-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = withErrorCapture("/api/admin/campaigns/[id]/send", async (request: NextRequest, ctx) => {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const { id } = await (ctx as RouteParams).params;
  const campaign = await dbGetCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (campaign.type === "engagement") {
    return NextResponse.json(
      { error: "Engagement campaigns are sent automatically" },
      { status: 400 },
    );
  }
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Campaign already started" },
      { status: 400 },
    );
  }

  // Pass pre-fetched campaign to avoid redundant DB query inside initiateCampaign
  const result = await initiateCampaign(id, campaign);
  if (!result) {
    return NextResponse.json(
      { error: "Campaign already started or could not be claimed" },
      { status: 409 },
    );
  }

  // Process first batch immediately
  const batchResult = await processCampaignBatch(id);

  return NextResponse.json({
    totalRecipients: result.totalRecipients,
    firstBatch: batchResult,
    message:
      batchResult.failed > 0
        ? `${batchResult.sent} sent; ${batchResult.failed} failed`
        : result.totalRecipients <= DAILY_SEND_LIMIT && batchResult.remaining === 0
        ? "All emails sent"
        : `Sending ${result.totalRecipients} emails in daily batches of ${DAILY_SEND_LIMIT} (Free plan limit)`,
  });
});
