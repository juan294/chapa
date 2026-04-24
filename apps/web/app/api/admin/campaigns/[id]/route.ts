import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import {
  type Campaign,
  dbGetCampaign,
  dbUpdateCampaign,
  dbDeleteCampaign,
} from "@/lib/db/campaigns";
import { cacheDel } from "@/lib/cache/redis";
import { parseCampaignPatchPayload } from "@/lib/campaigns/payload";

const ENGAGEMENT_CACHE_KEY = "campaign:active-engagement";

type AllowedPatchField =
  | "name"
  | "subject"
  | "previewText"
  | "headline"
  | "bodyText"
  | "features"
  | "ctaText"
  | "ctaUrl";

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

  return NextResponse.json({ campaign });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const campaign = await dbGetCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Can only edit draft campaigns" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let updates: Partial<Pick<Campaign, AllowedPatchField>>;
  try {
    updates = parseCampaignPatchPayload(body);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  // BE-H4: whitelist — only forward safe content fields to the DB layer
  const ok = await dbUpdateCampaign(id, updates);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 },
    );
  }

  // BE-M17: invalidate engagement campaign cache so changes are visible immediately
  await cacheDel(ENGAGEMENT_CACHE_KEY);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const ok = await dbDeleteCampaign(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Can only delete draft campaigns" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
