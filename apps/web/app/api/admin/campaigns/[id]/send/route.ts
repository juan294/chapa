import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
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
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Campaign already started" },
      { status: 400 },
    );
  }

  const result = await initiateCampaign(id);
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
