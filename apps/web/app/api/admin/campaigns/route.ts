import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbGetCampaigns, dbCreateCampaign } from "@/lib/db/campaigns";
import type { CampaignType } from "@/lib/db/campaigns";

const VALID_TYPES: CampaignType[] = ["announcement", "engagement"];

export async function GET(request: NextRequest) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const type = request.nextUrl.searchParams.get("type") as CampaignType | null;
  const campaigns = await dbGetCampaigns(undefined, type ?? undefined);
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

  const required = ["name", "subject", "headline", "bodyText", "ctaText", "ctaUrl"];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== "string") {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 },
      );
    }
  }

  const type = (body.type as string) ?? "announcement";
  if (!VALID_TYPES.includes(type as CampaignType)) {
    return NextResponse.json(
      { error: `Invalid type: ${type}` },
      { status: 400 },
    );
  }

  const id = await dbCreateCampaign({
    type: type as CampaignType,
    name: body.name as string,
    subject: body.subject as string,
    previewText: (body.previewText as string) ?? null,
    headline: body.headline as string,
    bodyText: body.bodyText as string,
    features: (body.features as { text: string }[]) ?? [],
    ctaText: body.ctaText as string,
    ctaUrl: body.ctaUrl as string,
  });

  if (!id) {
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id }, { status: 201 });
}
