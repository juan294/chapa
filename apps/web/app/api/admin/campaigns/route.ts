import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbGetCampaigns, dbCreateCampaign } from "@/lib/db/campaigns";
import type { CampaignType } from "@/lib/db/campaigns";
import { parseCampaignCreatePayload } from "@/lib/campaigns/payload";

const VALID_TYPES: CampaignType[] = ["announcement", "engagement"];

export async function GET(request: NextRequest) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const rawType = request.nextUrl.searchParams.get("type");
  const type = rawType && VALID_TYPES.includes(rawType as CampaignType)
    ? (rawType as CampaignType)
    : undefined;
  const campaigns = await dbGetCampaigns(undefined, type);
  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let campaign;
  try {
    campaign = parseCampaignCreatePayload(body);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  const id = await dbCreateCampaign({
    type: campaign.type as CampaignType,
    name: campaign.name,
    subject: campaign.subject,
    previewText: campaign.previewText,
    headline: campaign.headline,
    bodyText: campaign.bodyText,
    features: campaign.features,
    ctaText: campaign.ctaText,
    ctaUrl: campaign.ctaUrl,
  });

  if (!id) {
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id }, { status: 201 });
}
