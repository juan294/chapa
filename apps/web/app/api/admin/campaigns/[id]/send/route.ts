import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbGetCampaign } from "@/lib/db/campaigns";
import {
  initiateCampaign,
  processCampaignBatch,
  DAILY_SEND_LIMIT,
} from "@/lib/email/campaigns";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const campaign = await dbGetCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      { error: "Failed to initiate campaign" },
      { status: 500 },
    );
  }

  // Process first batch immediately
  const batchResult = await processCampaignBatch(id);

  return NextResponse.json({
    totalRecipients: result.totalRecipients,
    firstBatch: batchResult,
    message:
      result.totalRecipients <= DAILY_SEND_LIMIT
        ? "All emails sent"
        : `Sending ${result.totalRecipients} emails in daily batches of ${DAILY_SEND_LIMIT} (Free plan limit)`,
  });
}
